import type { z } from 'zod';
import { DataAccessError } from './errors';

export interface RpcErrorLike {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
}

export interface RpcTransport {
  rpc(
    functionName: string,
    args?: Record<string, unknown>,
  ): Promise<{
    data: unknown;
    error: RpcErrorLike | null;
  }>;
}

function mapRpcError(error: RpcErrorLike): DataAccessError {
  switch (error.code) {
    case 'PGRST301':
      return new DataAccessError('AUTH_REQUIRED', error.message, error);

    case '23505':
      return new DataAccessError('CONFLICT', error.message, error);

    case '23503':
    case '23514':
    case '22023':
      return new DataAccessError('VALIDATION', error.message, error);

    default:
      return new DataAccessError('SERVER', error.message, error);
  }
}

export async function callRpc<TSchema extends z.ZodTypeAny>(
  transport: RpcTransport,
  functionName: string,
  args: Record<string, unknown> | undefined,
  schema: TSchema,
): Promise<z.output<TSchema>> {
  let response: Awaited<ReturnType<RpcTransport['rpc']>>;

  try {
    response = await transport.rpc(functionName, args);
  } catch (error) {
    throw new DataAccessError(
      'NETWORK',
      `Network error while calling ${functionName}`,
      error,
    );
  }

  if (response.error) {
    throw mapRpcError(response.error);
  }

  const parsed = schema.safeParse(response.data);

  if (!parsed.success) {
    throw new DataAccessError(
      'CONTRACT',
      `Invalid response contract from ${functionName}: ${parsed.error.message}`,
      parsed.error,
    );
  }

  return parsed.data;
}
