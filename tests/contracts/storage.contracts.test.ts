import { existsSync, statSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	MAX_COVER_BYTES,
	StorageError,
	assertCoverOwnership,
	deleteCover,
	deleteUserCovers,
	parseCoverPath,
	readCover,
	saveCover,
	sniffImageType
} from '../../src/lib/server/storage';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const WEBP = Uint8Array.from([...Buffer.from('RIFF'), 4, 0, 0, 0, ...Buffer.from('WEBPVP8 ')]);
const GIF = Uint8Array.from(Buffer.from('GIF89a\x01\x00\x01\x00'));
const SVG = Uint8Array.from(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'));

const reason = (promise: Promise<unknown>) =>
	promise.then(
		() => 'no error',
		(error: unknown) => (error instanceof StorageError ? error.reason : `other: ${String(error)}`)
	);

describe('cover storage', () => {
	let base: string;
	let root: string;
	const alice = randomUUID();
	const bob = randomUUID();
	let previous: string | undefined;

	beforeAll(async () => {
		previous = process.env.STORAGE_DIR;
		base = await mkdtemp(path.join(os.tmpdir(), 'segnalibro-storage-'));
		root = path.join(base, 'storage');
		process.env.STORAGE_DIR = root;
	});

	afterAll(async () => {
		if (previous === undefined) delete process.env.STORAGE_DIR;
		else process.env.STORAGE_DIR = previous;
		await rm(base, { recursive: true, force: true });
	});

	it('stores png, jpeg and webp under covers/<userId>/<uuid>.<ext> and reads them back', async () => {
		for (const [bytes, type, ext] of [
			[PNG, 'image/png', 'png'],
			[JPEG, 'image/jpeg', 'jpg'],
			[WEBP, 'image/webp', 'webp']
		] as const) {
			const saved = await saveCover(alice, bytes);
			expect(saved.contentType).toBe(type);
			expect(saved.size).toBe(bytes.length);
			expect(saved.path).toMatch(new RegExp(`^covers/${alice}/[0-9a-f-]{36}\\.${ext}$`));

			const file = path.join(root, saved.path);
			expect(existsSync(file)).toBe(true);
			expect(statSync(file).mode & 0o077).toBe(0); // private to the server user

			const read = await readCover(saved.path, alice);
			expect(read?.contentType).toBe(type);
			expect(Buffer.compare(read!.data, Buffer.from(bytes))).toBe(0);
		}
	});

	it('accepts a File from a form upload and cross-checks the declared type', async () => {
		const ok = await saveCover(alice, new File([PNG], 'cover.png', { type: 'image/png' }));
		expect(ok.contentType).toBe('image/png');

		const untyped = await saveCover(alice, new File([JPEG], 'cover.bin'));
		expect(untyped.contentType).toBe('image/jpeg');

		expect(await reason(saveCover(alice, new File([PNG], 'cover.jpg', { type: 'image/jpeg' })))).toBe('unsupported_type');
	});

	it('rejects non-images by content, whatever the client claims', async () => {
		expect(await reason(saveCover(alice, GIF))).toBe('unsupported_type');
		expect(await reason(saveCover(alice, SVG))).toBe('unsupported_type');
		expect(await reason(saveCover(alice, new File([SVG], 'x.png', { type: 'image/png' })))).toBe('unsupported_type');
		expect(await reason(saveCover(alice, new File(['<html>'], 'x.png', { type: 'image/png' })))).toBe('unsupported_type');
		expect(await reason(saveCover(alice, new Uint8Array()))).toBe('empty');
		expect(sniffImageType(Uint8Array.from([0xff, 0xd8]))).toBeNull();
	});

	it('enforces the size limit (5 MB)', async () => {
		const atLimit = new Uint8Array(MAX_COVER_BYTES);
		atLimit.set(PNG);
		expect((await saveCover(alice, atLimit)).size).toBe(MAX_COVER_BYTES);

		const over = new Uint8Array(MAX_COVER_BYTES + 1);
		over.set(PNG);
		expect(await reason(saveCover(alice, over))).toBe('too_large');
		expect(await reason(saveCover(alice, new Blob([over], { type: 'image/png' })))).toBe('too_large');
	});

	it('refuses to save for something that is not a user id (no traversal through userId)', async () => {
		for (const bad of ['../evil', '..', 'a/b', '', `${alice}/../${bob}`, '/etc']) {
			expect(await reason(saveCover(bad, PNG)), bad).toBe('forbidden');
		}
		// nothing was written outside covers/
		expect((await readdir(root)).sort()).toEqual(['covers']);
	});

	it('blocks path traversal and any path that this module did not generate', async () => {
		const file = randomUUID();
		const malicious = [
			'../etc/passwd',
			'../../etc/passwd',
			'/etc/passwd',
			'covers/../../etc/passwd',
			`covers/${alice}/../../../etc/passwd`,
			`covers/${alice}/../${bob}/${file}.png`,
			`covers/${alice}/${file}.png/../../${bob}/${file}.png`,
			`covers/${alice}/${file}.png/..`,
			`covers/${alice}/%2e%2e/${file}.png`,
			`covers/%2e%2e/${alice}/${file}.png`,
			`covers\\${alice}\\${file}.png`,
			`covers/${alice}/${file}.png\0.txt`,
			`covers/${alice}/${file}.PNG`,
			`covers/${alice}/${file}.svg`,
			`covers/${alice}/${file}.png.exe`,
			`covers/${alice}//${file}.png`,
			`covers/${alice}/${file}`,
			`/covers/${alice}/${file}.png`,
			`./covers/${alice}/${file}.png`,
			`covers/${alice}`,
			`covers`,
			'',
			' ',
			`covers/${alice.toUpperCase()}/${file}.png`
		];
		for (const p of malicious) {
			expect(() => parseCoverPath(p), JSON.stringify(p)).toThrow(StorageError);
			expect(await reason(readCover(p)), `read ${JSON.stringify(p)}`).toBe('invalid_path');
			expect(await reason(readCover(p, alice)), `read as alice ${JSON.stringify(p)}`).toBe('invalid_path');
			expect(await reason(deleteCover(p)), `delete ${JSON.stringify(p)}`).toBe('invalid_path');
		}
		// a non-string (corrupted DB value) is rejected too
		expect(() => parseCoverPath(undefined as unknown as string)).toThrow(StorageError);
		expect(() => parseCoverPath(null as unknown as string)).toThrow(StorageError);
	});

	it("a path is only readable, deletable or assignable by its owner", async () => {
		const mine = await saveCover(alice, PNG);
		expect(() => assertCoverOwnership(alice, mine.path)).not.toThrow();
		expect(() => assertCoverOwnership(bob, mine.path)).toThrow(StorageError);

		expect(await reason(readCover(mine.path, bob))).toBe('forbidden');
		expect(await reason(deleteCover(mine.path, bob))).toBe('forbidden');
		expect(existsSync(path.join(root, mine.path))).toBe(true); // bob's attempt changed nothing

		// a hand-made path inside another user's folder is forbidden as well
		const forged = `covers/${bob}/${randomUUID()}.png`;
		expect(await reason(readCover(forged, alice))).toBe('forbidden');
		expect(await reason(deleteCover(forged, alice))).toBe('forbidden');
	});

	it('missing files are null / false, not errors; delete works and is idempotent', async () => {
		const gone = `covers/${alice}/${randomUUID()}.png`;
		expect(await readCover(gone, alice)).toBeNull();
		expect(await deleteCover(gone, alice)).toBe(false);

		const saved = await saveCover(alice, JPEG);
		expect(await deleteCover(saved.path, alice)).toBe(true);
		expect(await deleteCover(saved.path, alice)).toBe(false);
		expect(await readCover(saved.path, alice)).toBeNull();
	});

	it("deleteUserCovers removes one user's folder and leaves the others", async () => {
		const a = await saveCover(alice, PNG);
		const b = await saveCover(bob, PNG);
		await deleteUserCovers(alice);
		expect(existsSync(path.join(root, a.path))).toBe(false);
		expect(existsSync(path.join(root, 'covers', alice))).toBe(false);
		expect(existsSync(path.join(root, b.path))).toBe(true);
		await deleteUserCovers('../..'); // ignored: not a user id
		expect(existsSync(root)).toBe(true);
	});

	it('leaves no temporary files behind', async () => {
		const dir = path.join(root, 'covers', bob);
		const names = await readdir(dir);
		expect(names.filter((n) => n.endsWith('.tmp'))).toEqual([]);
	});
});
