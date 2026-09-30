import postgres from 'postgres';
import { DEV_DATABASE_URL, isProduction, serverEnv } from './env';

export type Sql = postgres.Sql;
export type Tx = postgres.TransactionSql;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
	return typeof value === 'string' && UUID_RE.test(value);
}

function databaseUrl(): string {
	const url = serverEnv('DATABASE_URL');
	if (url) return url;
	if (isProduction()) throw new Error('DATABASE_URL is required in production.');
	return DEV_DATABASE_URL;
}

function createPool(): Sql {
	return postgres(databaseUrl(), {
		max: Number(serverEnv('DATABASE_POOL_MAX') ?? 10),
		idle_timeout: 20,
		connect_timeout: 10,
		// Notices (e.g. "relation already exists, skipping") are noise for the app.
		onnotice: () => {}
	});
}

// One pool per process, also across Vite HMR reloads of this module in dev.
const globalKey = Symbol.for('segnalibro.sql');
const globals = globalThis as unknown as Record<symbol, Sql | undefined>;

/**
 * The pool is created on first use, never at import time: SvelteKit imports
 * server modules while building (analysis phase), when no environment exists
 * and `$env/dynamic/private` must not be read.
 */
function pool(): Sql {
	return (globals[globalKey] ??= createPool());
}

/**
 * Pool connected as the unprivileged `segnalibro_app` role (DATABASE_URL).
 * Queries issued directly on `sql` carry NO user identity: RLS hides every
 * user-owned row. Use {@link withUser} (or createPgRpcClient) for user data.
 *
 * `sql` is a lazy handle to the real postgres.js pool: tagged-template calls,
 * `sql.begin`, `sql.unsafe`, `sql(identifier)`, ... all work as usual.
 */
export const sql: Sql = new Proxy((() => {}) as unknown as Sql, {
	apply(_target, _thisArg, args) {
		const p = pool();
		return Reflect.apply(p as unknown as (...a: unknown[]) => unknown, p, args);
	},
	get(_target, prop) {
		const p = pool();
		const value = Reflect.get(p, prop, p) as unknown;
		return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(p) : value;
	},
	has(_target, prop) {
		return Reflect.has(pool(), prop);
	}
});

/**
 * Runs `fn` in a transaction whose identity is `userId`:
 * `app.user_id` is set transaction-locally, so `app.current_user_id()`, every
 * RLS policy and every RPC see exactly this user, and the setting disappears at
 * COMMIT/ROLLBACK (safe with connection pooling).
 */
export async function withUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
	if (!isUuid(userId)) throw new TypeError('withUser: userId must be a UUID');

	return (await sql.begin(async (tx) => {
		await tx`select set_config('app.user_id', ${userId}, true)`;
		return fn(tx);
	})) as T;
}

/** Closes the pool if it was ever opened (tests, scripts, graceful shutdown). */
export async function closeDb(timeoutSeconds = 5): Promise<void> {
	const current = globals[globalKey];
	if (!current) return;
	delete globals[globalKey];
	await current.end({ timeout: timeoutSeconds });
}
