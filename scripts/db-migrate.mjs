#!/usr/bin/env node
// Applies db/migrations/*.sql in order, each file in its own transaction.
//
//   node scripts/db-migrate.mjs            apply pending migrations
//   node scripts/db-migrate.mjs --status   list applied / pending, change nothing
//
// Connects with DATABASE_ADMIN_URL (default postgres://postgres:postgres@127.0.0.1:5433/segnalibro):
// DDL needs the owner/superuser role, not the runtime role segnalibro_app.
// Applied files are recorded in public.schema_migrations with a sha256 checksum;
// editing an already applied file is an error (add a new migration instead).
import { pathToFileURL } from 'node:url';
import {
	adminUrl,
	connectAdmin,
	describeUrl,
	listMigrations,
	stripTransaction
} from './db-lib.mjs';

const LOCK_KEY = 7_283_001; // pg_advisory_lock key: one migrator at a time

/**
 * @param {import('postgres').Sql} sql  admin connection (max: 1 is fine)
 * @param {{ dir?: string, log?: (msg: string) => void }} [options]
 * @returns {Promise<string[]>} names of the migrations applied in this run
 */
export async function runMigrations(sql, { dir, log = () => {} } = {}) {
	await sql`select pg_advisory_lock(${LOCK_KEY})`;
	try {
		await sql`
			create table if not exists public.schema_migrations (
				filename    text primary key,
				checksum    text not null,
				applied_at  timestamptz not null default now()
			)
		`;

		const applied = new Map(
			(await sql`select filename, checksum from public.schema_migrations`).map((r) => [
				r.filename,
				r.checksum
			])
		);
		const files = await listMigrations(dir);
		const done = [];

		for (const file of files) {
			const previous = applied.get(file.name);
			if (previous !== undefined) {
				if (previous !== file.checksum) {
					throw new Error(
						`Migration ${file.name} was modified after being applied. ` +
							'Do not edit applied migrations: add a new one (or run db-reset in development).'
					);
				}
				continue;
			}

			log(`applying ${file.name}`);
			await sql.begin(async (tx) => {
				await tx.unsafe(stripTransaction(file.text));
				await tx`insert into public.schema_migrations (filename, checksum) values (${file.name}, ${file.checksum})`;
			});
			done.push(file.name);
		}
		return done;
	} finally {
		await sql`select pg_advisory_unlock(${LOCK_KEY})`;
	}
}

/**
 * @param {import('postgres').Sql} sql
 * @param {{ dir?: string }} [options]
 */
export async function migrationStatus(sql, { dir } = {}) {
	const exists = (await sql`select to_regclass('public.schema_migrations') as t`)[0]?.t != null;
	const applied = new Map(
		exists
			? (await sql`select filename, checksum from public.schema_migrations`).map((r) => [
					r.filename,
					r.checksum
				])
			: []
	);
	return (await listMigrations(dir)).map((f) => ({
		name: f.name,
		state: !applied.has(f.name)
			? 'pending'
			: applied.get(f.name) === f.checksum
				? 'applied'
				: 'MODIFIED'
	}));
}

async function main() {
	const sql = connectAdmin();
	try {
		if (process.argv.includes('--status')) {
			for (const m of await migrationStatus(sql)) console.log(`${m.state.padEnd(8)} ${m.name}`);
			return;
		}
		console.log(`migrating ${describeUrl(adminUrl())}`);
		const done = await runMigrations(sql, { log: (m) => console.log(`  ${m}`) });
		console.log(done.length ? `applied ${done.length} migration(s)` : 'database is up to date');
	} finally {
		await sql.end({ timeout: 5 });
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error(error.message ?? error);
		process.exit(1);
	});
}
