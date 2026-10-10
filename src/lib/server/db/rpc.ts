import postgres from 'postgres';
import { DataAccessError, type DataErrorCode } from '../../data/errors';
import type { RpcErrorLike, RpcTransport } from '../../data/rpc-client';
import { RPC } from '../../data/rpc-names';
import { isUuid, sql, withUser } from './client';

/**
 * Same shape as the baseline transport (src/lib/data/rpc-client.ts). The
 * `RpcClient` name is kept because the spec talks about it.
 */
export type RpcClient = RpcTransport;

/** RpcErrorLike + the already-normalised error model code. */
export interface PgRpcError extends RpcErrorLike {
	/** Normalised code (MASTER_SPEC section 44). Prefer this over `code`. */
	dataCode: DataErrorCode;
}

const ALLOWED_FUNCTIONS: ReadonlySet<string> = new Set(Object.values(RPC));
const ARG_NAME_RE = /^p_[a-z][a-z0-9_]*$/;

// ---------------------------------------------------------------------------
// Error mapping (SQLSTATE -> error model). The RPCs raise:
//   42501  authentication required (no app.user_id)            -> AUTH_REQUIRED
//   P0002  "... not found" (also for other users' ids)         -> NOT_FOUND
//   23505  duplicate event_id / unique violation               -> CONFLICT
//   55000  state conflict (reading already closed, open reading exists, ...) -> CONFLICT
//   23503 / 23514 / 22xxx / P0001  invalid input / constraint  -> VALIDATION
// ---------------------------------------------------------------------------

const NETWORK_CODES = new Set([
	'ECONNREFUSED',
	'ECONNRESET',
	'ENOTFOUND',
	'ETIMEDOUT',
	'EAI_AGAIN',
	'CONNECTION_CLOSED',
	'CONNECTION_DESTROYED',
	'CONNECTION_ENDED',
	'CONNECT_TIMEOUT'
]);

export function classifySqlState(code: string | undefined): DataErrorCode {
	if (!code) return 'SERVER';
	if (NETWORK_CODES.has(code)) return 'NETWORK';

	switch (code) {
		case '42501':
			return 'AUTH_REQUIRED';
		case 'P0002':
		case '02000':
			return 'NOT_FOUND';
		case '23505':
		case '55000':
		case '40001': // serialization_failure: retryable
		case '40P01': // deadlock_detected: retryable
			return 'CONFLICT';
		case '53300': // too_many_connections
			return 'RATE_LIMITED';
		case 'P0001': // plain RAISE EXCEPTION: input validation in the RPCs
		case '23502': // not_null_violation
		case '23503': // foreign_key_violation
		case '23514': // check_violation
		case '23000':
			return 'VALIDATION';
	}

	if (code.startsWith('22')) return 'VALIDATION'; // data exceptions (22P02, 22023, 22003, ...)
	if (code.startsWith('08') || code === '57P01' || code === '57P02' || code === '57P03') {
		return 'NETWORK';
	}
	return 'SERVER';
}

function errorCodeOf(error: unknown): string | undefined {
	if (typeof error === 'object' && error !== null && 'code' in error) {
		const code = (error as { code?: unknown }).code;
		if (typeof code === 'string') return code;
	}
	return undefined;
}

/** Normalises anything thrown while talking to Postgres into a DataAccessError. */
export function mapPgError(error: unknown): DataAccessError {
	if (error instanceof DataAccessError) return error;

	const code = errorCodeOf(error);
	const dataCode = classifySqlState(code);
	const message = error instanceof Error ? error.message : String(error);
	return new DataAccessError(dataCode, message, error);
}

function toRpcError(error: unknown): PgRpcError {
	const code = errorCodeOf(error);
	const pg = error instanceof postgres.PostgresError ? error : undefined;
	const result: PgRpcError = {
		message: error instanceof Error ? error.message : String(error),
		dataCode: classifySqlState(code)
	};
	if (code !== undefined) result.code = code;
	if (pg?.detail) result.details = pg.detail;
	if (pg?.hint) result.hint = pg.hint;
	return result;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * Transport for the repositories (`callRpc(transport, name, args, schema)`):
 * every call runs `select public.<fn>(p_arg => $n, ...)` in its own transaction
 * with `app.user_id` set to `userId`, and returns the function's JSON.
 *
 * Pass `null` to call as an anonymous user (every RPC then fails with
 * AUTH_REQUIRED, which is what the anonymous-access tests rely on).
 *
 * Errors are returned (not thrown) as `{ data: null, error }` exactly like the
 * baseline transport; `error.dataCode` holds the normalised code and
 * `mapPgError(error)` does the same for exceptions thrown elsewhere.
 */
export function createPgRpcClient(userId: string | null): RpcClient {
	if (userId !== null && !isUuid(userId)) {
		throw new TypeError('createPgRpcClient: userId must be a UUID or null');
	}

	return {
		async rpc(functionName, args) {
			if (!ALLOWED_FUNCTIONS.has(functionName)) {
				return {
					data: null,
					error: { message: `Unknown RPC "${functionName}"`, dataCode: 'VALIDATION' } satisfies PgRpcError
				};
			}

			const names: string[] = [];
			const values: unknown[] = [];
			for (const [name, value] of Object.entries(args ?? {})) {
				if (value === undefined) continue; // let the SQL default apply
				if (!ARG_NAME_RE.test(name)) {
					return {
						data: null,
						error: { message: `Invalid RPC argument "${name}"`, dataCode: 'VALIDATION' } satisfies PgRpcError
					};
				}
				names.push(name);
				values.push(value);
			}

			const callArgs = names
				.map((name, index) => {
					// Postgres.js serializes inferred timestamptz via Date, losing microseconds.
					// A keyset cursor must retain the exact database value, including tied timestamps.
					const cast = functionName === RPC.shelfPage && name === 'p_cursor_created_at'
						? '::text::timestamptz'
						: '';
					return `${name} => $${index + 1}${cast}`;
				})
				.join(', ');
			const query = `select public.${functionName}(${callArgs}) as result`;

			try {
				const rows =
					userId === null
						? await sql.unsafe(query, values as never[])
						: await withUser(userId, (tx) => tx.unsafe(query, values as never[]));

				return { data: (rows[0]?.result as unknown) ?? null, error: null };
			} catch (error) {
				return { data: null, error: toRpcError(error) };
			}
		}
	};
}
