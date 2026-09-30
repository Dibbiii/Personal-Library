#!/usr/bin/env node
// DEVELOPMENT ONLY: wipes the application schemas, re-runs every migration and the seed.
//
//   node scripts/db-reset.mjs              reset + seed
//   node scripts/db-reset.mjs --no-seed    reset only
//   node scripts/db-reset.mjs --force      allow a non-local DATABASE_ADMIN_URL
//
// Drops schemas public, private, app and extensions (CASCADE) - i.e. all tables,
// functions, sessions and users - and recreates `public`. Cluster-level objects
// (the segnalibro_app role) are kept; migration 001 re-creates it only if missing.
import { pathToFileURL } from 'node:url';
import { adminUrl, connectAdmin, describeUrl, isLocalUrl } from './db-lib.mjs';
import { runMigrations } from './db-migrate.mjs';
import { seedDemo } from './db-seed.mjs';

export async function resetDatabase(sql, { seed = true, log = () => {} } = {}) {
	await sql.unsafe(`
		drop schema if exists public cascade;
		drop schema if exists private cascade;
		drop schema if exists app cascade;
		drop schema if exists extensions cascade;
		create schema public;
		grant usage on schema public to public;
	`);
	log('schemas recreated');
	await runMigrations(sql, { log: (m) => log(`  ${m}`) });
	if (seed) {
		await seedDemo(sql);
		log('demo seed loaded');
	}
}

async function main() {
	const url = adminUrl();
	if (
		process.env.NODE_ENV === 'production' ||
		(!isLocalUrl(url) && !process.argv.includes('--force'))
	) {
		throw new Error(
			`Refusing to reset ${describeUrl(url)}: not a local development database (use --force to override).`
		);
	}

	const sql = connectAdmin();
	try {
		console.log(`resetting ${describeUrl(url)}`);
		await resetDatabase(sql, {
			seed: !process.argv.includes('--no-seed'),
			log: (m) => console.log(m)
		});
		console.log('done');
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
