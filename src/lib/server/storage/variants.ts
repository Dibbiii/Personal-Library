import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import path from 'node:path';

export const COVER_WIDTHS = [128, 320, 768] as const;
export type CoverWidth = (typeof COVER_WIDTHS)[number];
const jobs = new Map<string, Promise<Buffer | null>>();
const waiters: (() => void)[] = [];
let active = 0;

export class VariantImageError extends Error {}

async function limited<T>(run: () => Promise<T>): Promise<T> {
	if (active >= 2) await new Promise<void>((resolve) => waiters.push(resolve));
	else active++;
	try {
		return await run();
	} finally {
		const next = waiters.shift();
		if (next) next();
		else active--;
	}
}

/** Input paths have already passed storage ownership and path validation. */
export async function readVariant(original: string, width: CoverWidth): Promise<Buffer | null> {
	const target = `${original}.variants/${width}.webp`;
	try {
		return await readFile(target);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}
	const existing = jobs.get(target);
	if (existing) return existing;
	const job = limited(async () => {
		try {
			return await readFile(target);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}
		let input: Buffer;
		try {
			input = await readFile(original);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
			throw error;
		}
		let output: Buffer;
		try {
			output = await sharp(input, { limitInputPixels: 40_000_000 })
				.autoOrient()
				.resize({ width, withoutEnlargement: true })
				.webp({ quality: 80 })
				.toBuffer();
		} catch (cause) {
			throw new VariantImageError('Immagine non valida o troppo grande.', { cause });
		}
		await mkdir(`${original}.variants`, { recursive: true, mode: 0o700 });
		const temp = `${target}.${randomUUID()}.tmp`;
		try {
			await writeFile(temp, output, { mode: 0o600, flag: 'wx' });
			await rename(temp, target);
		} finally {
			await rm(temp, { force: true });
		}
		return output;
	});
	jobs.set(target, job);
	try {
		return await job;
	} finally {
		jobs.delete(target);
	}
}

export async function prepareVariants(original: string): Promise<void> {
	const results = await Promise.allSettled(
		COVER_WIDTHS.map((width) => readVariant(original, width))
	);
	const failure = results.find((result) => result.status === 'rejected');
	if (failure?.status === 'rejected') throw failure.reason;
}

/** Original must be removed first, so new requests cannot create another derivative. */
export async function deleteVariants(original: string): Promise<void> {
	await Promise.allSettled(
		COVER_WIDTHS.map((width) => jobs.get(`${original}.variants/${width}.webp`))
	);
	await rm(`${original}.variants`, { recursive: true, force: true });
}

export async function settleVariantsUnder(directory: string): Promise<void> {
	await Promise.allSettled(
		[...jobs].filter(([file]) => file.startsWith(directory + path.sep)).map(([, job]) => job)
	);
}
