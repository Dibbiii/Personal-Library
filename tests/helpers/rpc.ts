import type { z } from 'zod';
import type { DataErrorCode } from '../../src/lib/data/errors';
import type { RpcTransport } from '../../src/lib/data/rpc-client';
import type { PgRpcError } from '../../src/lib/server/db';

/** Calls an RPC and validates the JSON against its Zod contract. */
export async function expectRpcContract<T extends z.ZodTypeAny>(
	client: RpcTransport,
	name: string,
	args: Record<string, unknown> | undefined,
	schema: T
): Promise<z.output<T>> {
	const { data, error } = await client.rpc(name, args);

	if (error) {
		throw new Error(`RPC ${name} failed: ${error.code ?? ''} ${error.message} ${error.details ?? ''}`);
	}

	const parsed = schema.safeParse(data);
	if (!parsed.success) {
		throw new Error(
			`RPC ${name} violated contract:\n${parsed.error.message}\nPayload:\n${JSON.stringify(data, null, 2)}`
		);
	}
	return parsed.data;
}

/** Calls an RPC that must fail and returns the normalised error. */
export async function expectRpcError(
	client: RpcTransport,
	name: string,
	args?: Record<string, unknown>
): Promise<{ code: string | undefined; dataCode: DataErrorCode; message: string }> {
	const { data, error } = await client.rpc(name, args);
	if (!error) {
		throw new Error(`RPC ${name} was expected to fail but returned ${JSON.stringify(data)}`);
	}
	const { dataCode } = error as PgRpcError;
	return { code: error.code, dataCode, message: error.message };
}
