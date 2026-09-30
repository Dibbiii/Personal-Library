/**
 * Custom book covers on the local filesystem (no object-storage service).
 *
 *   <STORAGE_DIR>/covers/<userId>/<uuid>.<png|jpg|webp>
 *
 * The database only keeps the relative path in user_books.cover_storage_path.
 * The HTTP endpoints (upload / serve) live in the "add books" feature and must:
 *   - upload : saveCover(locals.user.id, file)            -> store `path`
 *   - serve  : readCover(path, locals.user.id)            -> 404 on null
 *   - delete : deleteCover(path, locals.user.id)
 * Always pass the session user id so ownership is enforced.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { serverEnv } from '../db/env';

export const MAX_COVER_BYTES = 5 * 1024 * 1024;

export type CoverContentType = 'image/png' | 'image/jpeg' | 'image/webp';

const EXTENSIONS: Record<CoverContentType, 'png' | 'jpg' | 'webp'> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp'
};
const CONTENT_TYPES: Record<string, CoverContentType> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	webp: 'image/webp'
};

export type StorageErrorReason =
	| 'empty'
	| 'too_large'
	| 'unsupported_type'
	| 'invalid_path'
	| 'forbidden';

export class StorageError extends Error {
	constructor(
		readonly reason: StorageErrorReason,
		message?: string
	) {
		super(message ?? reason);
		this.name = 'StorageError';
	}
}

export interface SavedCover {
	/** Value for user_books.cover_storage_path, e.g. `covers/<userId>/<uuid>.jpg`. */
	path: string;
	contentType: CoverContentType;
	size: number;
}

/** Accepts a web `File`/`Blob` (FormData) or raw bytes. */
export type CoverInput = Blob | Uint8Array;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const USER_ID_RE = new RegExp(`^${UUID}$`);
const COVER_PATH_RE = new RegExp(`^covers/(${UUID})/(${UUID})\\.(png|jpg|webp)$`);

export function storageRoot(): string {
	return path.resolve(serverEnv('STORAGE_DIR') ?? './storage');
}

/** Detects the real type from the file signature; the client-declared MIME type is not trusted. */
export function sniffImageType(bytes: Uint8Array): CoverContentType | null {
	if (
		bytes.length >= 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47 &&
		bytes[4] === 0x0d &&
		bytes[5] === 0x0a &&
		bytes[6] === 0x1a &&
		bytes[7] === 0x0a
	) {
		return 'image/png';
	}
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return 'image/jpeg';
	}
	if (
		bytes.length >= 12 &&
		String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' &&
		String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP'
	) {
		return 'image/webp';
	}
	return null;
}

interface ParsedCoverPath {
	userId: string;
	file: string;
	contentType: CoverContentType;
	relative: string;
}

/**
 * Strict allow-list for stored paths: exactly `covers/<uuid>/<uuid>.<ext>`.
 * This rejects `..`, absolute paths, backslashes, NUL bytes, encoded traversal
 * and anything else that is not a path this module generated.
 */
export function parseCoverPath(value: string): ParsedCoverPath {
	const match = typeof value === 'string' ? COVER_PATH_RE.exec(value) : null;
	if (!match) throw new StorageError('invalid_path');
	const [, userId, name, ext] = match;
	return {
		userId: userId as string,
		file: `${name}.${ext}`,
		contentType: CONTENT_TYPES[ext as string] as CoverContentType,
		relative: value
	};
}

/** Throws `forbidden` unless `path` lives in `userId`'s folder. */
export function assertCoverOwnership(userId: string, coverPath: string): void {
	const parsed = parseCoverPath(coverPath);
	if (!USER_ID_RE.test(userId) || parsed.userId !== userId.toLowerCase()) {
		throw new StorageError('forbidden');
	}
}

/** Absolute location of a validated path, guaranteed to be inside the storage root. */
function resolveInsideRoot(relative: string): string {
	const root = storageRoot();
	const absolute = path.resolve(root, relative);
	if (!absolute.startsWith(root + path.sep)) throw new StorageError('invalid_path');
	return absolute;
}

async function toBytes(input: CoverInput): Promise<Uint8Array> {
	if (input instanceof Uint8Array) return input;
	if (input.size > MAX_COVER_BYTES) throw new StorageError('too_large');
	return new Uint8Array(await input.arrayBuffer());
}

export async function saveCover(userId: string, file: CoverInput): Promise<SavedCover> {
	if (!USER_ID_RE.test(userId)) throw new StorageError('forbidden', 'invalid user id');

	const bytes = await toBytes(file);
	if (bytes.length === 0) throw new StorageError('empty');
	if (bytes.length > MAX_COVER_BYTES) throw new StorageError('too_large');

	const contentType = sniffImageType(bytes);
	if (!contentType) throw new StorageError('unsupported_type');

	// A declared MIME type, when present, must agree with the real content.
	const declared = file instanceof Uint8Array ? '' : file.type;
	if (declared && declared !== contentType && !(declared === 'image/jpg' && contentType === 'image/jpeg')) {
		throw new StorageError('unsupported_type', `declared ${declared} but content is ${contentType}`);
	}

	const relative = `covers/${userId}/${randomUUID()}.${EXTENSIONS[contentType]}`;
	const target = resolveInsideRoot(relative);
	const temp = `${target}.${randomUUID()}.tmp`;

	await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
	await writeFile(temp, bytes, { mode: 0o600, flag: 'wx' });
	await rename(temp, target); // atomic: readers never see a half-written file

	return { path: relative, contentType, size: bytes.length };
}

/**
 * Returns the file, or `null` when it does not exist. Throws StorageError for a
 * malformed path, or (when `userId` is given) a path of another user.
 */
export async function readCover(
	coverPath: string,
	userId?: string
): Promise<{ data: Buffer; contentType: CoverContentType } | null> {
	const parsed = parseCoverPath(coverPath);
	if (userId !== undefined) assertCoverOwnership(userId, coverPath);

	try {
		return {
			data: await readFile(resolveInsideRoot(parsed.relative)),
			contentType: parsed.contentType
		};
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw error;
	}
}

/** Deletes one cover. Returns false when it was already gone. */
export async function deleteCover(coverPath: string, userId?: string): Promise<boolean> {
	const parsed = parseCoverPath(coverPath);
	if (userId !== undefined) assertCoverOwnership(userId, coverPath);

	try {
		await unlink(resolveInsideRoot(parsed.relative));
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}

/** Removes every cover of a user (account deletion). */
export async function deleteUserCovers(userId: string): Promise<void> {
	if (!USER_ID_RE.test(userId)) return;
	await rm(resolveInsideRoot(`covers/${userId}`), { recursive: true, force: true });
}
