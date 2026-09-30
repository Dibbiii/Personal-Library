// Shared helpers for scripts/db-*.mjs (plain Node, no build step).
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MIGRATIONS_DIR = path.join(ROOT, 'db', 'migrations');
export const SEED_DIR = path.join(ROOT, 'db', 'seed');

export const DEFAULT_ADMIN_URL = 'postgres://postgres:postgres@127.0.0.1:5433/segnalibro';

// Load .env (Node >= 20.12). Variables already in the environment win.
try {
	process.loadEnvFile(path.join(ROOT, '.env'));
} catch {
	// no .env: defaults below apply
}

export function adminUrl() {
	return process.env.DATABASE_ADMIN_URL || DEFAULT_ADMIN_URL;
}

/**
 * @param {string} [url]
 * @param {import('postgres').Options<{}>} [options]
 */
export function connectAdmin(url = adminUrl(), options = {}) {
	return postgres(url, { max: 1, onnotice: () => {}, connect_timeout: 10, ...options });
}

/** @param {string} text */
export function sha256(text) {
	return createHash('sha256').update(text).digest('hex');
}

/** @param {string} url */
export function describeUrl(url) {
	const u = new URL(url);
	return `${u.hostname}:${u.port}${u.pathname}`;
}

/** @param {string} url */
export function isLocalUrl(url) {
	return ['127.0.0.1', 'localhost', '::1', '[::1]', 'db'].includes(new URL(url).hostname);
}

/** @param {string} [dir] */
export async function listMigrations(dir = MIGRATIONS_DIR) {
	const names = (await readdir(dir)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
	return Promise.all(
		names.map(async (name) => {
			const text = await readFile(path.join(dir, name), 'utf8');
			return { name, text, checksum: sha256(text) };
		})
	);
}

/**
 * Migration files wrap themselves in BEGIN/COMMIT so they can also be piped to
 * psql. The runner owns the transaction (it must also record the migration in
 * schema_migrations atomically), so the outer BEGIN/COMMIT lines are removed.
 */
/** @param {string} text */
export function stripTransaction(text) {
	return text
		.replace(/^\s*begin;\s*$/im, '')
		.replace(/^\s*commit;\s*$(?![\s\S]*^\s*commit;\s*$)/im, '');
}
