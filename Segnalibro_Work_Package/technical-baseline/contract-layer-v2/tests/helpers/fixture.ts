import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { dbTestEnv } from './env';

export interface ContractFixture {
  client: SupabaseClient;
  admin: SupabaseClient;
  sql: ReturnType<typeof postgres>;
  userId: string;
  password: string;
  email: string;
  books: {
    fantasy: string;
    mythology: string;
    thriller: string;
    classic: string;
    romance: string;
  };
  bingo: {
    boardId: string;
    firstCellId: string;
  };
  tags: {
    magic: number;
    friendship: number;
  };
  cleanup(): Promise<void>;
}

export async function createContractFixture(): Promise<ContractFixture> {
  const env = dbTestEnv();

  const admin = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const client = createClient(env.supabaseUrl, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const sql = postgres(env.dbUrl, { max: 1 });

  const suffix = randomUUID().slice(0, 8);
  const email = `contract-${suffix}@example.test`;
  const password = `Contract-${randomUUID()}!`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: 'Contract Test' },
  });

  if (createError || !created.user) {
    await sql.end({ timeout: 1 });
    throw createError ?? new Error('Unable to create contract-test user');
  }

  const userId = created.user.id;

  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    await admin.auth.admin.deleteUser(userId);
    await sql.end({ timeout: 1 });
    throw signInError;
  }

  // Stable global rating dimensions used by save_review contract coverage.
  await sql`
    insert into public.rating_dimensions (
      dimension_key, genre_id, label_it, sort_order, version, is_active
    ) values
      ('fantasy.worldbuilding', 5, 'Worldbuilding', 1, 1, true),
      ('fantasy.characters',    5, 'Personaggi',    2, 1, true)
    on conflict (dimension_key) do update set
      genre_id = excluded.genre_id,
      label_it = excluded.label_it,
      sort_order = excluded.sort_order,
      is_active = true
  `;

  const [magic] = await sql<{ id: number }[]>`
    insert into public.tags (slug, label_it, sort_order, is_active)
    values ('magic', 'Magia', 1, true)
    on conflict (slug) do update set label_it = excluded.label_it
    returning id
  `;

  const [friendship] = await sql<{ id: number }[]>`
    insert into public.tags (slug, label_it, sort_order, is_active)
    values ('friendship', 'Amicizia', 2, true)
    on conflict (slug) do update set label_it = excluded.label_it
    returning id
  `;

  if (!magic || !friendship) throw new Error('Unable to seed tags');

  const workSuffix = `contract-${suffix}`;
  const [work] = await sql<{ id: string }[]>`
    insert into public.works (title, original_title, first_published_year, open_library_work_id)
    values ('Il nome del vento', 'The Name of the Wind', 2007, ${`OL-${workSuffix}`})
    returning id::text
  `;
  if (!work) throw new Error('Unable to seed work');

  const [author] = await sql<{ id: string }[]>`
    insert into public.authors (name, open_library_author_id)
    values ('Patrick Rothfuss', ${`OLA-${workSuffix}`})
    returning id::text
  `;
  if (!author) throw new Error('Unable to seed author');

  await sql`
    insert into public.work_authors (work_id, author_id, position)
    values (${work.id}::bigint, ${author.id}::bigint, 1)
  `;

  const [edition] = await sql<{ id: string }[]>`
    insert into public.editions (
      work_id, isbn_13, language, publisher, published_year,
      page_count, cover_provider, cover_url
    ) values (
      ${work.id}::bigint,
      ${`978${suffix.replace(/[^0-9]/g, '').padEnd(10, '0').slice(0, 10)}`}::text,
      'it', 'Contract Press', 2026,
      662, 'open-library', 'https://covers.openlibrary.org/b/id/12345-L.jpg'
    )
    returning id::text
  `;
  if (!edition) throw new Error('Unable to seed edition');

  const books = {
    fantasy: randomUUID(),
    mythology: randomUUID(),
    thriller: randomUUID(),
    classic: randomUUID(),
    romance: randomUUID(),
  };

  await sql`
    insert into public.user_books (
      id, user_id, edition_id, genre_id, title, author_display, page_count,
      language, format, source, series_name, series_number, series_total,
      cover_url
    ) values
      (
        ${books.fantasy}::uuid, ${userId}::uuid, ${edition.id}::bigint, 5,
        'Il nome del vento', 'Patrick Rothfuss', 662, 'it', 'physical', 'search',
        'Le Cronache dell''Assassino del Re', 1, 3,
        'https://covers.openlibrary.org/b/id/12345-L.jpg'
      ),
      (
        ${books.mythology}::uuid, ${userId}::uuid, null, 2,
        'Circe', 'Madeline Miller', 432, 'it', 'physical', 'manual',
        null, null, null,
        'https://covers.openlibrary.org/b/id/23456-L.jpg'
      ),
      (
        ${books.thriller}::uuid, ${userId}::uuid, null, 4,
        'Assassinio sull''Orient Express', 'Agatha Christie', 256, 'it', 'digital', 'manual',
        null, null, null,
        'https://covers.openlibrary.org/b/id/34567-L.jpg'
      ),
      (
        ${books.classic}::uuid, ${userId}::uuid, null, 1,
        'Orgoglio e pregiudizio', 'Jane Austen', 432, 'it', 'physical', 'manual',
        null, null, null,
        'https://covers.openlibrary.org/b/id/45678-L.jpg'
      ),
      (
        ${books.romance}::uuid, ${userId}::uuid, null, 6,
        'Red, White & Royal Blue', 'Casey McQuiston', 448, 'en', 'digital', 'manual',
        null, null, null,
        'https://covers.openlibrary.org/b/id/56789-L.jpg'
      )
  `;

  const boardId = randomUUID();
  await sql`
    insert into public.bingo_boards (id, user_id, year, title)
    values (${boardId}::uuid, ${userId}::uuid, 2026, 'La card del 2026')
  `;

  const cells = Array.from({ length: 16 }, (_, index) => ({
    id: randomUUID(),
    position: index + 1,
    challenge: `Sfida ${index + 1}`,
  }));

  for (const cell of cells) {
    await sql`
      insert into public.bingo_cells (
        id, user_id, board_id, position, challenge
      ) values (
        ${cell.id}::uuid,
        ${userId}::uuid,
        ${boardId}::uuid,
        ${cell.position},
        ${cell.challenge}
      )
    `;
  }

  async function cleanup() {
    try {
      await admin.auth.admin.deleteUser(userId);
    } finally {
      await sql.end({ timeout: 1 });
    }
  }

  return {
    client,
    admin,
    sql,
    userId,
    password,
    email,
    books,
    bingo: {
      boardId,
      firstCellId: cells[0]!.id,
    },
    tags: {
      magic: magic.id,
      friendship: friendship.id,
    },
    cleanup,
  };
}
