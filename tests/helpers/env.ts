/**
 * Test environment. Import this module FIRST in every DB test file: it fills in
 * the local docker-compose defaults for any variable that is not already set,
 * before src/lib/server/db reads DATABASE_URL.
 *
 *   DATABASE_URL        runtime role (segnalibro_app, RLS applies)
 *   DATABASE_ADMIN_URL  owner role, used by the tests only to create fixtures
 *                       and to inspect the catalog (RLS bypass)
 */
import path from 'node:path';

try {
	process.loadEnvFile(path.resolve(process.cwd(), '.env'));
} catch {
	// no .env file: defaults below
}

process.env.DATABASE_URL ||= 'postgres://segnalibro_app:segnalibro_app@127.0.0.1:5433/segnalibro';
process.env.DATABASE_ADMIN_URL ||= 'postgres://postgres:postgres@127.0.0.1:5433/segnalibro';

export const DATABASE_URL = process.env.DATABASE_URL;
export const DATABASE_ADMIN_URL = process.env.DATABASE_ADMIN_URL;

export const runDb = process.env.RUN_DB_CONTRACT_TESTS === '1';
