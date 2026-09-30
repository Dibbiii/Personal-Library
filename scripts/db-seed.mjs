#!/usr/bin/env node
// Loads the development seed: the demo account plus a library that reproduces the mockups.
//
//   demo@segnalibro.local / segnalibro-demo    (display name "Alessandra")
//
// Idempotent: the demo user (fixed id) is deleted (ON DELETE CASCADE removes the
// whole library and its sessions) and recreated in ONE transaction together with
// db/seed/demo_library.sql. The password is hashed with src/lib/server/auth/password.ts,
// the same code registerUser uses (Node >= 22.18 runs the .ts file natively).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { adminUrl, connectAdmin, describeUrl, ROOT, SEED_DIR } from './db-lib.mjs';

export const DEMO_USER = {
	id: 'de000000-0000-4000-8000-000000000001',
	email: 'demo@segnalibro.local',
	password: 'segnalibro-demo',
	displayName: 'Alessandra'
};

async function loadHasher() {
	const url = pathToFileURL(path.join(ROOT, 'src', 'lib', 'server', 'auth', 'password.ts')).href;
	return (await import(url)).hashPassword;
}

/** @param {import('postgres').Sql} sql admin connection */
export async function seedDemo(sql) {
	const hashPassword = await loadHasher();
	const passwordHash = await hashPassword(DEMO_USER.password);
	const script = await readFile(path.join(SEED_DIR, 'demo_library.sql'), 'utf8');

	await sql.begin(async (tx) => {
		await tx`delete from app.users where id = ${DEMO_USER.id}::uuid or email = ${DEMO_USER.email}`;
		await tx`
			insert into app.users (id, email, display_name, password_hash)
			values (${DEMO_USER.id}::uuid, ${DEMO_USER.email}, ${DEMO_USER.displayName}, ${passwordHash})
		`;
		await tx.unsafe(script);
	});
}

async function main() {
	const sql = connectAdmin();
	try {
		console.log(`seeding ${describeUrl(adminUrl())}`);
		await seedDemo(sql);
		console.log(`demo user ready: ${DEMO_USER.email} / ${DEMO_USER.password}`);
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
