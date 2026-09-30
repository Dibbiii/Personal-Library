import './env'; // must stay first: sets DATABASE_URL defaults before src/lib/server/db loads
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { registerUser } from '../../src/lib/server/auth';
import { createPgRpcClient } from '../../src/lib/server/db';
import type { RpcTransport } from '../../src/lib/data/rpc-client';
import { DATABASE_ADMIN_URL } from './env';

let admin: postgres.Sql | undefined;

/** Owner-role connection (bypasses RLS): fixtures and assertions about what is REALLY stored. */
export function adminSql(): postgres.Sql {
	admin ??= postgres(DATABASE_ADMIN_URL, { max: 2, onnotice: () => {} });
	return admin;
}

export async function closeAdminSql(): Promise<void> {
	const current = admin;
	admin = undefined;
	await current?.end({ timeout: 2 });
}

export interface TestUser {
	id: string;
	email: string;
	password: string;
	displayName: string;
	/** RPC transport bound to this user (RLS applies). */
	rpc: RpcTransport;
	/** Removes the user and, by cascade, all their data. */
	cleanup(): Promise<void>;
}

/** Registers a real account through registerUser(). */
export async function createTestUser(label = 'extra'): Promise<TestUser> {
	const email = `contract-${label}-${randomUUID().slice(0, 8)}@example.test`;
	const password = `Contract-${randomUUID()}`;
	const displayName = `Contract ${label}`;
	const user = await registerUser({ email, password, displayName });

	return {
		id: user.id,
		email,
		password,
		displayName,
		rpc: createPgRpcClient(user.id),
		async cleanup() {
			await adminSql()`delete from app.users where id = ${user.id}::uuid`;
		}
	};
}
