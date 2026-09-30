// Registered by db.contracts.test.ts: accounts, sessions and account deletion.
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	AuthValidationError,
	EmailTakenError,
	SESSION_TTL_SECONDS,
	authenticate,
	createSession,
	deleteAccount,
	invalidateSession,
	registerUser,
	validateSession,
	validateSessionWithExpiry
} from '../../src/lib/server/auth';
import { sql, withUser } from '../../src/lib/server/db';
import { saveCover } from '../../src/lib/server/storage';
import { runDb } from '../helpers/env';
import { adminSql } from '../helpers/users';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

(runDb ? describe : describe.skip)('auth: accounts and sessions', () => {
	const created: string[] = [];
	const email = `Auth-${randomUUID().slice(0, 8)}@Example.TEST`;
	const password = 'correct horse battery';
	let userId: string;

	afterAll(async () => {
		if (created.length) await adminSql()`delete from app.users where id = any(${created}::uuid[])`;
	});

	describe('registerUser', () => {
		it('normalises the email, stores a scrypt hash and bootstraps profile + preferences', async () => {
			const user = await registerUser({ email: `  ${email}  `, password, displayName: '  Alessandra ' });
			userId = user.id;
			created.push(user.id);

			expect(user).toEqual({ id: user.id, email: email.toLowerCase(), displayName: 'Alessandra' });

			const [row] = await adminSql()<
				{ email: string; password_hash: string; display_name: string; profile: string | null; prefs: string | null }[]
			>`
				select u.email, u.password_hash, u.display_name,
				       (select display_name from public.profiles where id = u.id) as profile,
				       (select theme_key from public.user_preferences where user_id = u.id) as prefs
				from app.users u where u.id = ${user.id}::uuid
			`;
			expect(row?.email).toBe(email.toLowerCase());
			expect(row?.password_hash).toMatch(/^scrypt\$16\$8\$2\$[\w-]+\$[\w-]+$/);
			expect(row?.password_hash).not.toContain(password);
			expect(row?.profile).toBe('Alessandra');
			expect(row?.prefs).toBe('segnalibro');
		});

		it('rejects a duplicate email regardless of case', async () => {
			await expect(
				registerUser({ email: email.toUpperCase(), password, displayName: 'Dup' })
			).rejects.toBeInstanceOf(EmailTakenError);
		});

		it('validates input', async () => {
			const bad = (input: { email: string; password: string; displayName: string }) =>
				registerUser(input).catch((e: unknown) => e);

			const short = await bad({ email: 'x@example.test', password: '1234567', displayName: 'X' });
			expect(short).toBeInstanceOf(AuthValidationError);
			expect(short).toMatchObject({ field: 'password', reason: 'too_short' });

			expect(await bad({ email: 'not-an-email', password, displayName: 'X' })).toMatchObject({
				field: 'email',
				reason: 'invalid'
			});
			expect(await bad({ email: '', password, displayName: 'X' })).toMatchObject({ field: 'email' });
			expect(await bad({ email: 'x@example.test', password, displayName: '   ' })).toMatchObject({
				field: 'displayName',
				reason: 'required'
			});
			expect(await bad({ email: 'x@example.test', password: 'a'.repeat(2000), displayName: 'X' })).toMatchObject({
				field: 'password',
				reason: 'too_long'
			});
		});

		it('the database itself refuses un-normalised emails', async () => {
			await expect(
				adminSql()`insert into app.users (email, password_hash) values ('UPPER@example.test', 'x')`
			).rejects.toMatchObject({ code: '23514' });
		});
	});

	describe('authenticate', () => {
		it('accepts the right credentials (email case/whitespace insensitive)', async () => {
			const user = await authenticate(`  ${email.toUpperCase()} `, password);
			expect(user).toEqual({ id: userId, email: email.toLowerCase(), displayName: 'Alessandra' });
		});

		it('returns null for a wrong password, an unknown user or empty input', async () => {
			expect(await authenticate(email, 'wrong password!')).toBeNull();
			expect(await authenticate(email, password + ' ')).toBeNull();
			expect(await authenticate(`nobody-${randomUUID()}@example.test`, password)).toBeNull();
			expect(await authenticate('', password)).toBeNull();
			expect(await authenticate(email, '')).toBeNull();
		});

		it('is not fooled by SQL metacharacters', async () => {
			expect(await authenticate(`' or '1'='1`, `' or '1'='1`)).toBeNull();
			expect(await authenticate(`${email}' --`, password)).toBeNull();
		});
	});

	describe('sessions', () => {
		const hashOf = (token: string) => createHash('sha256').update(token).digest('hex');

		it('creates a 30 day session and stores only the sha256 of the token', async () => {
			const { token, expiresAt } = await createSession(userId);
			expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

			const delta = expiresAt.getTime() - Date.now();
			expect(Math.abs(delta - SESSION_TTL_SECONDS * 1000)).toBeLessThan(10_000);

			const rows = await adminSql()<{ token_hash: string; expires_at: Date }[]>`
				select token_hash, expires_at from app.sessions where user_id = ${userId}::uuid
			`;
			expect(rows.map((r) => r.token_hash)).toContain(hashOf(token));
			expect(rows.some((r) => r.token_hash === token)).toBe(false);

			expect(await validateSession(token)).toEqual({
				id: userId,
				email: email.toLowerCase(),
				displayName: 'Alessandra'
			});
		});

		it('rejects unknown, malformed and tampered tokens', async () => {
			const { token } = await createSession(userId);
			expect(await validateSession(randomUUID())).toBeNull();
			expect(await validateSession('')).toBeNull();
			expect(await validateSession(token.slice(0, -1))).toBeNull();
			expect(await validateSession(`${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`)).toBeNull();
			expect(await validateSession(hashOf(token))).toBeNull(); // the stored hash is not a credential
			expect(await validateSession(`${token}' or 1=1 --`)).toBeNull();
		});

		it('stops working once expired', async () => {
			const { token } = await createSession(userId);
			await adminSql()`update app.sessions set expires_at = now() - interval '1 minute' where token_hash = ${hashOf(token)}`;
			expect(await validateSession(token)).toBeNull();
		});

		it('extends the expiry when used (sliding), at most every 5 minutes', async () => {
			const { token } = await createSession(userId);
			const h = hashOf(token);

			// recently used: no write, expiry untouched
			await adminSql()`update app.sessions set expires_at = now() + interval '1 day', last_used_at = now() where token_hash = ${h}`;
			const untouched = await validateSessionWithExpiry(token);
			const day = 24 * 3600 * 1000;
			expect(Math.abs(untouched!.expiresAt.getTime() - (Date.now() + day))).toBeLessThan(10_000);

			// not used for an hour: pushed back to 30 days from now
			await adminSql()`update app.sessions set last_used_at = now() - interval '1 hour' where token_hash = ${h}`;
			const extended = await validateSessionWithExpiry(token);
			expect(Math.abs(extended!.expiresAt.getTime() - (Date.now() + SESSION_TTL_SECONDS * 1000))).toBeLessThan(10_000);

			const [row] = await adminSql()<{ expires_at: Date }[]>`select expires_at from app.sessions where token_hash = ${h}`;
			expect(Math.abs(row!.expires_at.getTime() - extended!.expiresAt.getTime())).toBeLessThan(1000);
		});

		it('invalidateSession ends only that session', async () => {
			const first = await createSession(userId);
			const second = await createSession(userId);
			expect(await validateSession(first.token)).not.toBeNull();

			await invalidateSession(first.token);
			expect(await validateSession(first.token)).toBeNull();
			expect(await validateSession(second.token)).not.toBeNull();

			await invalidateSession(first.token); // idempotent
			await invalidateSession('garbage');
		});

		it('expired sessions of a user are purged on the next login', async () => {
			const { token } = await createSession(userId);
			await adminSql()`update app.sessions set expires_at = now() - interval '1 day' where token_hash = ${hashOf(token)}`;
			await createSession(userId);
			const rows = await adminSql()`select 1 from app.sessions where token_hash = ${hashOf(token)}`;
			expect(rows).toHaveLength(0);
		});
	});

	describe('deleteAccount', () => {
		let storageDir: string;
		let previousStorage: string | undefined;

		beforeAll(async () => {
			previousStorage = process.env.STORAGE_DIR;
			storageDir = await mkdtemp(path.join(os.tmpdir(), 'segnalibro-auth-'));
			process.env.STORAGE_DIR = storageDir;
		});
		afterAll(async () => {
			if (previousStorage === undefined) delete process.env.STORAGE_DIR;
			else process.env.STORAGE_DIR = previousStorage;
			await rm(storageDir, { recursive: true, force: true });
		});

		it('removes the user and everything they own, even with a Bingo cell and a custom theme', async () => {
			const victim = await registerUser({
				email: `victim-${randomUUID().slice(0, 8)}@example.test`,
				password,
				displayName: 'Victim'
			});
			created.push(victim.id);
			const session = await createSession(victim.id);
			const sibling = await registerUser({
				email: `sibling-${randomUUID().slice(0, 8)}@example.test`,
				password,
				displayName: 'Sibling'
			});
			created.push(sibling.id);

			const db = adminSql();
			const bookId = randomUUID();
			const boardId = randomUUID();
			const themeId = randomUUID();
			await db`
				insert into public.user_books (id, user_id, genre_id, title, author_display, format)
				values (${bookId}::uuid, ${victim.id}::uuid, 1, 'Da cancellare', 'Autore', 'physical')
			`;
			await db`insert into public.bingo_boards (id, user_id, year) values (${boardId}::uuid, ${victim.id}::uuid, 2026)`;
			await db`
				insert into public.bingo_cells (user_id, board_id, position, challenge, user_book_id, completed_at)
				values (${victim.id}::uuid, ${boardId}::uuid, 1, 'Sfida', ${bookId}::uuid, now())
			`;
			await db`insert into public.custom_themes (id, user_id, name, tokens) values (${themeId}::uuid, ${victim.id}::uuid, 'T', '{}'::jsonb)`;
			await db`update public.user_preferences set custom_theme_id = ${themeId}::uuid where user_id = ${victim.id}::uuid`;
			await db`
				insert into public.quotes (user_id, user_book_id, body) values (${victim.id}::uuid, ${bookId}::uuid, 'citazione')
			`;

			// Deleting only the assigned book is still refused (checked at commit)...
			await expect(db`delete from public.user_books where id = ${bookId}::uuid`).rejects.toThrow();
			// ...and so is dropping a custom theme that is still selected.
			await expect(db`delete from public.custom_themes where id = ${themeId}::uuid`).rejects.toThrow();

			const cover = await saveCover(victim.id, PNG);
			const siblingCover = await saveCover(sibling.id, PNG);
			expect(existsSync(path.join(storageDir, cover.path))).toBe(true);

			// another user cannot delete this account
			await expect(
				withUser(sibling.id, (tx) => tx`select app.delete_account(${victim.id}::uuid)`)
			).rejects.toMatchObject({ code: '42501' });
			await expect(sql`select app.delete_account(${victim.id}::uuid)`).rejects.toMatchObject({ code: '42501' });

			await deleteAccount(victim.id);

			const [left] = await db<Record<string, number>[]>`
				select
					(select count(*)::int from app.users where id = ${victim.id}::uuid) as users,
					(select count(*)::int from app.sessions where user_id = ${victim.id}::uuid) as sessions,
					(select count(*)::int from public.user_books where user_id = ${victim.id}::uuid) as books,
					(select count(*)::int from public.bingo_cells where user_id = ${victim.id}::uuid) as cells,
					(select count(*)::int from public.custom_themes where user_id = ${victim.id}::uuid) as themes,
					(select count(*)::int from public.quotes where user_id = ${victim.id}::uuid) as quotes,
					(select count(*)::int from public.profiles where id = ${victim.id}::uuid) as profiles,
					(select count(*)::int from public.user_preferences where user_id = ${victim.id}::uuid) as prefs
			`;
			expect(left).toEqual({ users: 0, sessions: 0, books: 0, cells: 0, themes: 0, quotes: 0, profiles: 0, prefs: 0 });

			expect(await validateSession(session.token)).toBeNull();
			expect(await authenticate(victim.email, password)).toBeNull();
			expect(existsSync(path.join(storageDir, cover.path))).toBe(false);
			expect(existsSync(path.join(storageDir, siblingCover.path))).toBe(true);
			expect(await authenticate(sibling.email, password)).not.toBeNull();
		});
	});
});
