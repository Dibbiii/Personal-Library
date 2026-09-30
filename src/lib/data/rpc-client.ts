import type { z } from 'zod';
import { DataAccessError, type DataErrorCode } from './errors';

export interface RpcErrorLike {
	code?: string;
	/** Codice già normalizzato dal trasporto (vedi classifySqlState). */
	dataCode?: DataErrorCode;
	message: string;
	details?: string;
	hint?: string;
}

/**
 * Trasporto verso le funzioni Postgres. L'implementazione concreta (postgres.js) sta in
 * src/lib/server/db; qui restano solo l'interfaccia e la mappatura degli errori.
 */
export interface RpcTransport {
	rpc(
		functionName: string,
		args?: Record<string, unknown>
	): Promise<{
		data: unknown;
		error: RpcErrorLike | null;
	}>;
}

export type RpcClient = RpcTransport;

/** Codici SQLSTATE usati dalle funzioni SQL del progetto. */
function mapRpcError(error: RpcErrorLike): DataAccessError {
	if (error.dataCode) return new DataAccessError(error.dataCode, error.message, error);

	switch (error.code) {
		case '42501':
			return new DataAccessError('AUTH_REQUIRED', error.message, error);

		case 'P0002':
			return new DataAccessError('NOT_FOUND', error.message, error);

		case '23505':
		case '40001':
		case '40P01':
			return new DataAccessError('CONFLICT', error.message, error);

		case '23503':
		case '23514':
		case '22023':
			return new DataAccessError('VALIDATION', error.message, error);

		default:
			return new DataAccessError('SERVER', error.message, error);
	}
}

function isSqlError(error: unknown): error is RpcErrorLike {
	return (
		typeof error === 'object' &&
		error !== null &&
		'message' in error &&
		typeof error.message === 'string' &&
		'code' in error &&
		typeof error.code === 'string' &&
		/^[0-9A-Z]{5}$/.test(error.code)
	);
}

export async function callRpc<TSchema extends z.ZodTypeAny>(
	transport: RpcTransport,
	functionName: string,
	args: Record<string, unknown> | undefined,
	schema: TSchema
): Promise<z.output<TSchema>> {
	let response: Awaited<ReturnType<RpcTransport['rpc']>>;

	try {
		response = await transport.rpc(functionName, args);
	} catch (error) {
		// Il trasporto può aver già normalizzato l'errore.
		if (error instanceof DataAccessError) throw error;
		// Un driver che lancia un errore SQL (SQLSTATE a 5 caratteri) non è un problema di rete.
		if (isSqlError(error)) throw mapRpcError(error);
		throw new DataAccessError('NETWORK', `Network error while calling ${functionName}`, error);
	}

	if (response.error) {
		throw mapRpcError(response.error);
	}

	const parsed = schema.safeParse(response.data);

	if (!parsed.success) {
		throw new DataAccessError(
			'CONTRACT',
			`Invalid response contract from ${functionName}: ${parsed.error.message}`,
			parsed.error
		);
	}

	return parsed.data;
}
