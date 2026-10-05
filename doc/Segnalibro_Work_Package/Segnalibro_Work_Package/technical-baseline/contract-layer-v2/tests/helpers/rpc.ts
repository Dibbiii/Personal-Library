import type { SupabaseClient } from '@supabase/supabase-js';
import type { z } from 'zod';

export async function expectRpcContract<T extends z.ZodTypeAny>(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown> | undefined,
  schema: T,
): Promise<z.output<T>> {
  const { data, error } = await client.rpc(name, args ?? {});

  if (error) {
    throw new Error(
      `RPC ${name} failed: ${error.code ?? ''} ${error.message} ${error.details ?? ''}`,
    );
  }

  const parsed = schema.safeParse(data);

  if (!parsed.success) {
    throw new Error(
      `RPC ${name} violated contract:\n${parsed.error.message}\nPayload:\n${JSON.stringify(data, null, 2)}`,
    );
  }

  return parsed.data;
}
