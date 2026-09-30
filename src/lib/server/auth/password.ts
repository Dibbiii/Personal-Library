/**
 * Password hashing with scrypt (node:crypto). This file is dependency-free on
 * purpose: scripts/db-seed.mjs imports it directly to hash the demo password
 * with exactly the code that registerUser uses.
 *
 * Stored format (PHC-like):   scrypt$<log2 N>$<r>$<p>$<salt b64url>$<hash b64url>
 * The parameters live in the string, so they can be raised later without
 * invalidating existing hashes (see {@link needsRehash}).
 */
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// OWASP password-storage cheat sheet: scrypt N=2^16, r=8, p=2 (64 MiB).
const LOG_N = 16;
const R = 8;
const P = 2;
const SALT_BYTES = 16;
const KEY_BYTES = 64;
// scrypt needs ~128 * N * r bytes; give it headroom.
const MAX_MEM = 256 * 1024 * 1024;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 1024;

function derive(
	password: string,
	salt: Buffer,
	logN: number,
	r: number,
	p: number,
	keylen: number
) {
	const options: ScryptOptions = { N: 2 ** logN, r, p, maxmem: MAX_MEM };
	return new Promise<Buffer>((resolve, reject) => {
		scrypt(password.normalize('NFKC'), salt, keylen, options, (error, key) =>
			error ? reject(error) : resolve(key)
		);
	});
}

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(SALT_BYTES);
	const key = await derive(password, salt, LOG_N, R, P, KEY_BYTES);
	return ['scrypt', LOG_N, R, P, salt.toString('base64url'), key.toString('base64url')].join('$');
}

interface ParsedHash {
	logN: number;
	r: number;
	p: number;
	salt: Buffer;
	key: Buffer;
}

function parse(stored: string): ParsedHash | null {
	const parts = stored.split('$');
	if (parts.length !== 6 || parts[0] !== 'scrypt') return null;

	const logN = Number(parts[1]);
	const r = Number(parts[2]);
	const p = Number(parts[3]);
	if (![logN, r, p].every(Number.isInteger)) return null;
	// refuse absurd parameters coming from a corrupted row (memory/CPU DoS)
	if (logN < 10 || logN > 20 || r < 1 || r > 32 || p < 1 || p > 16) return null;

	const salt = Buffer.from(parts[4] ?? '', 'base64url');
	const key = Buffer.from(parts[5] ?? '', 'base64url');
	if (salt.length < 8 || key.length < 16) return null;

	return { logN, r, p, salt, key };
}

/** Constant-time verification. Returns false (never throws) for malformed hashes. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const parsed = parse(stored);
	if (!parsed) return false;

	try {
		const candidate = await derive(
			password,
			parsed.salt,
			parsed.logN,
			parsed.r,
			parsed.p,
			parsed.key.length
		);
		return candidate.length === parsed.key.length && timingSafeEqual(candidate, parsed.key);
	} catch {
		return false;
	}
}

/** True when the stored hash uses weaker parameters than the current ones. */
export function needsRehash(stored: string): boolean {
	const parsed = parse(stored);
	return !parsed || parsed.logN < LOG_N || parsed.r < R || parsed.p < P;
}

let dummyHash: Promise<string> | undefined;

/**
 * A valid hash of a random password. authenticate() verifies against it when the
 * email is unknown, so "no such user" and "wrong password" take the same time.
 */
export function dummyPasswordHash(): Promise<string> {
	dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
	return dummyHash;
}
