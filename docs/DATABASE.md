# Database, autenticazione e storage

PostgreSQL 17 in Docker, raggiunto **solo dal server SvelteKit** con postgres.js. Nessun servizio
di auth/API/storage esterno: account, sessioni e file sono implementati nel progetto.
Comandi e variabili: [`db/README.md`](../db/README.md).

```text
browser -> SvelteKit (hooks: cookie -> validateSession) -> locals.repos
        -> createPgRpcClient(userId)  ->  BEGIN; set_config('app.user_id', ...); select public.<rpc>(...); COMMIT
        -> PostgreSQL (ruolo segnalibro_app, RLS)
```

## Avvio

```bash
docker compose up -d db --wait   # container segnalibro-db, porta host 5433, volume segnalibro_pgdata
node scripts/db-migrate.mjs      # applica db/migrations/*.sql
node scripts/db-seed.mjs         # utente demo + libreria dei mockup
node scripts/db-reset.mjs        # azzera tutto e rifà migration + seed (solo sviluppo)
```

Demo: `demo@segnalibro.local` / `segnalibro-demo`, nome "Alessandra". Il seed è idempotente: ricrea
l'utente (id fisso `de000000-0000-4000-8000-000000000001`) e, per cascata, tutta la sua libreria.

## Ruoli, identità e RLS

| Ruolo            | Chi lo usa                      | Note                                                                  |
| ---------------- | ------------------------------- | --------------------------------------------------------------------- |
| `postgres`       | migration, seed, test (admin)   | owner di tabelle e funzioni; superuser, quindi bypassa RLS            |
| `segnalibro_app` | l'applicazione (`DATABASE_URL`) | `LOGIN NOSUPERUSER NOBYPASSRLS`, non possiede nulla, non crea oggetti |

**Identità della richiesta.** Il server apre una transazione ed esegue
`select set_config('app.user_id', '<uuid>', true)` (locale alla transazione, quindi sicuro con il
pool). `app.current_user_id()` legge quel valore (`NULL` = anonimo) e sostituisce `auth.uid()`:
lo usano tutte le policy RLS e `private.require_uid()` (errore `42501` se nullo).
L'id arriva sempre e solo dalla sessione validata (`hooks.server.ts`), mai dall'input dell'utente;
`withUser` rifiuta qualunque valore che non sia un UUID.

**RLS.** Tutte le tabelle con dati utente (`profiles`, `user_preferences`, `custom_themes`,
`user_books`, `reading_queue`, `readings`, `reading_progress_events`, `reviews`, `review_scores`,
`user_book_tags`, `quotes`, `bingo_boards`, `bingo_cells`) hanno `ENABLE` + `FORCE ROW LEVEL SECURITY`
e una policy `user_id = (select app.current_user_id())`. `user_id` è presente in ogni tabella figlia e
le foreign key sono composite `(user_id, id)`: anche ignorando la RLS non si può agganciare una riga a un
libro di un altro utente. Senza identità (query su `sql` fuori da `withUser`) non si vede nessuna riga.

**Privilegi (principio del minimo).**

- Tabelle `app.users` e `app.sessions`: nessun privilegio per `segnalibro_app`. Si passa da funzioni
  `SECURITY DEFINER` (`search_path = ''`, `EXECUTE` revocato a PUBLIC e concesso solo a `segnalibro_app`).
- Catalogo globale (`genres`, `works`, `authors`, `work_authors`, `editions`, `rating_dimensions`, `tags`):
  sola lettura. L'unica scrittura è `app.catalog_upsert_edition` (vedi sotto).
- Tabelle di dominio con invarianti (`readings`, `reading_queue`, `reading_progress_events`, `reviews`,
  `review_scores`, `user_book_tags`): nessun INSERT/UPDATE/DELETE diretto, solo via RPC.
- `user_books`: INSERT e UPDATE limitati per colonna; le proiezioni (`lifecycle_state`,
  `completed_readings_count`, `review_rating`, `last_finished_at`, `last_activity_at`) le scrive solo il DB.
- `quotes`, `bingo_*`, `custom_themes`: CRUD diretto sotto RLS. `profiles`/`user_preferences`: UPDATE
  solo delle colonne modificabili.
- Le RPC pubbliche sono `SECURITY DEFINER` (come nel package originale) e filtrano esplicitamente per
  `private.require_uid()`; le implementazioni interne vivono in `private.*` (nessun accesso per l'app).

## Modello account e sessioni

```text
app.users     id uuid pk, email text unique (lowercase, CHECK), display_name, password_hash,
              created_at, updated_at, last_login_at
app.sessions  id, user_id fk -> users on delete cascade, token_hash (sha256 hex) unique,
              expires_at, created_at, last_used_at
```

Un trigger su `app.users` crea `profiles` e `user_preferences` (sostituisce quello su `auth.users`).
Codice: `src/lib/server/auth/`.

| Funzione                                     | Comportamento                                                                                                                                                                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `registerUser({email,password,displayName})` | normalizza l'email (trim + lowercase), password 8-1024 caratteri, hash **scrypt** (N=2^16, r=8, p=2, salt 16 byte, formato `scrypt$16$8$2$salt$hash`). `EmailTakenError` se esiste; `AuthValidationError{field,reason}` per input non valido. Ritorna `{id,email,displayName}` |
| `authenticate(email,password)`               | `AuthUser` o `null`. `timingSafeEqual`; per email sconosciute verifica comunque un hash fittizio (stessi tempi)                                                                                                                                                                |
| `createSession(userId)`                      | token = 32 byte casuali base64url (43 caratteri); nel DB **solo lo sha256**; scadenza 30 giorni; ripulisce le sessioni scadute di quell'utente                                                                                                                                 |
| `validateSession(token)`                     | `AuthUser` o `null`. **Sliding expiration**: se l'ultimo rinnovo è più vecchio di 5 minuti la scadenza torna a +30 giorni (al massimo una scrittura ogni 5 minuti per sessione). `validateSessionWithExpiry` restituisce anche la scadenza per rinnovare il cookie             |
| `invalidateSession(token)`                   | elimina quella sessione (idempotente)                                                                                                                                                                                                                                          |
| `deleteAccount(userId)`                      | elimina l'utente e, per cascata, libreria, sessioni, ecc.; poi cancella le sue cover su disco. La funzione SQL verifica che `app.user_id` coincida. L'autorizzazione (es. richiesta password) spetta al chiamante                                                              |

`displayName` ha il fallback alla parte locale dell'email per account creati senza nome.

**Rate limiting login** (`src/lib/server/auth/rate-limit.ts`, in memoria, per processo):
`checkLoginRateLimit(email, ip)` -> `{allowed, retryAfterSeconds, remaining}`; `recordLoginFailure(email, ip)`;
`clearLoginFailures(email, ip)` dopo un login riuscito. Limiti: 5 fallimenti / 15 min per coppia email+IP e 30 /
15 min per IP, poi blocco di 15 minuti. Con più istanze il limite effettivo si moltiplica e si azzera al riavvio.

## Accesso ai dati (`src/lib/server/db`)

- `sql`: pool postgres.js da `DATABASE_URL` (`$env/dynamic/private` se c'è, altrimenti `process.env`; in
  sviluppo default a `127.0.0.1:5433`, in produzione `DATABASE_URL` è obbligatoria). **Creazione lazy**: nessun
  accesso all'ambiente né connessione a import-time (necessario per `vite build`).
- `withUser(userId, fn)`: transazione con identità impostata.
- `createPgRpcClient(userId | null): RpcClient` (= `RpcTransport` di `src/lib/data/rpc-client.ts`): per ogni
  chiamata esegue `select public.<fn>(p_a => $1, p_b => $2) as result` dentro `withUser`. Il nome funzione deve
  essere in `RPC` (`rpc-names.ts`), i nomi argomento devono essere `p_[a-z0-9_]+`; argomenti `undefined` vengono
  omessi (vale il default SQL). Restituisce `{data, error}` senza lanciare. `null` = chiamante anonimo.
- `mapPgError(error): DataAccessError` e `error.dataCode` (nel risultato di `rpc`) applicano la mappa:

| SQLSTATE                                    | Codice          | Da dove                                                  |
| ------------------------------------------- | --------------- | -------------------------------------------------------- |
| `42501`                                     | `AUTH_REQUIRED` | nessuna identità, o permesso negato                      |
| `P0002`                                     | `NOT_FOUND`     | "... not found", anche per id di altri utenti            |
| `23505`, `55000`, `40001`, `40P01`          | `CONFLICT`      | evento duplicato, lettura già chiusa / già aperta, retry |
| `P0001`, `23502`, `23503`, `23514`, `22xxx` | `VALIDATION`    | `RAISE EXCEPTION` semplice (input), vincoli, cast        |
| `53300`                                     | `RATE_LIMITED`  | troppe connessioni                                       |
| `ECONN*`, `CONNECTION_*`, `08xxx`, `57P0x`  | `NETWORK`       | DB irraggiungibile                                       |
| altro                                       | `SERVER`        |                                                          |
| risposta non conforme a Zod                 | `CONTRACT`      | lo decide `callRpc`                                      |

- `upsertCatalogEdition(userId, input)`: scrittura del catalogo (sotto).

### Catalogo: chi scrive e come

Il catalogo (Work -> Edition, Author) è leggibile dall'app ma non scrivibile direttamente. La funzione
`app.catalog_upsert_edition(...)` (`SECURITY DEFINER`, richiede un'identità, serializzata da un advisory lock)
è l'unico percorso:

1. Un'edizione esistente si riconosce **solo** da identificatori forti (`isbn_13`, `isbn_10`,
   `open_library_edition_id`, `google_books_id`); se trovata, vengono riempite solo le colonne `NULL` (mai
   sovrascritti valori esistenti né rubati identificatori di un'altra edizione).
2. Altrimenti si crea l'edizione sul work indicato (`workId`), sul work con lo stesso `open_library_work_id`,
   oppure su un work nuovo con i suoi autori (riuso per `open_library_author_id`, altrimenti per nome identico
   case-insensitive).
3. **Titolo + autore non bastano mai a unire due edizioni** (MASTER_SPEC sez. 19).

Ritorna `{workId, editionId, created}` con gli id bigint come **stringhe**. Poi il libro si aggiunge con un
normale INSERT su `user_books` (colonne ammesse: vedi migration 006) con `edition_id` e `cover_url`.

## Storage cover (`src/lib/server/storage`)

File su disco in `STORAGE_DIR` (default `./storage`, da ignorare in git): `covers/<userId>/<uuid>.<png|jpg|webp>`.
Il DB conserva solo il path relativo in `user_books.cover_storage_path`.

| Funzione                                                         | Note                                                                                                                                                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `saveCover(userId, file)`                                        | `File`/`Blob`/`Uint8Array`. Tipo dedotto dai magic bytes (png/jpeg/webp), il MIME dichiarato deve coincidere; max 5 MB; scrittura atomica (tmp + rename), permessi 0600. Ritorna `{path, contentType, size}` |
| `readCover(path, userId?)`                                       | `{data, contentType}` o `null` se manca                                                                                                                                                                      |
| `deleteCover(path, userId?)`                                     | `true`/`false` se già assente                                                                                                                                                                                |
| `deleteUserCovers(userId)`                                       | usata da `deleteAccount`                                                                                                                                                                                     |
| `assertCoverOwnership`, `parseCoverPath`, `StorageError{reason}` | `reason`: `empty`, `too_large`, `unsupported_type`, `invalid_path`, `forbidden`                                                                                                                              |

Sicurezza: i path accettati sono solo quelli che corrispondono esattamente a
`covers/<uuid>/<uuid>.(png|jpg|webp)` (niente `..`, assoluti, `\`, NUL, encoding, maiuscole), risolti e
ricontrollati dentro la root. **Gli endpoint devono passare sempre l'id della sessione** come `userId`
(`readCover(path, locals.user.id)`): senza, il controllo di appartenenza non avviene. Servire i file con
`Content-Type` dal risultato, `X-Content-Type-Options: nosniff` e `Cache-Control: private`.

## RPC pubbliche (nomi, argomenti, ritorno)

Invariate rispetto al package originale; tutte restituiscono JSON camelCase con `contractVersion: 1`
(schemi Zod in `src/lib/contracts/rpc.ts`). Gli argomenti hanno il prefisso `p_`.

| RPC                                                                 | Argomenti (default)                                                                                                                                           | Ritorno (schema Zod)                                                        |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `get_library_home`                                                  | `p_shelf_limit integer` (24)                                                                                                                                  | `libraryHomeResponseSchema`                                                 |
| `get_shelf_page`                                                    | `p_genre_slug text`, `p_cursor_created_at timestamptz` (null), `p_cursor_id uuid` (null), `p_limit integer` (24)                                              | `shelfPageResponseSchema`                                                   |
| `get_genre_view`                                                    | `p_genre_slug text`, `p_sort_field text` ('title'), `p_sort_direction text` ('asc'), `p_limit integer` (48), `p_offset integer` (0)                           | `genreViewResponseSchema`                                                   |
| `get_book_detail`                                                   | `p_book_id uuid`                                                                                                                                              | `bookDetailResponseSchema`                                                  |
| `get_explore_pool`                                                  | `p_genre_slugs text[]` (null = tutti)                                                                                                                         | `explorePoolResponseSchema`                                                 |
| `get_reading_calendar`                                              | `p_year integer`                                                                                                                                              | `readingCalendarResponseSchema`                                             |
| `get_year_stats`                                                    | `p_year integer`                                                                                                                                              | `yearStatsResponseSchema`                                                   |
| `get_stats_dashboard`                                               | `p_year integer`                                                                                                                                              | `statsDashboardResponseSchema`                                              |
| `get_bingo_board`                                                   | `p_year integer`                                                                                                                                              | `bingoBoardResponseSchema`                                                  |
| `assign_bingo_book`                                                 | `p_cell_id uuid`, `p_book_id uuid` (null = svuota la cella)                                                                                                   | `bingoBoardResponseSchema`                                                  |
| `queue_add`                                                         | `p_book_id uuid`, `p_force boolean` (false)                                                                                                                   | `queueAddResponseSchema` (`added`, `alreadyQueued`, `requiresConfirmation`) |
| `queue_remove`                                                      | `p_book_id uuid`                                                                                                                                              | `queueMutationResponseSchema`                                               |
| `queue_move`                                                        | `p_book_id uuid`, `p_new_position integer`                                                                                                                    | `queueMutationResponseSchema`                                               |
| `start_reading`                                                     | `p_book_id uuid`, `p_started_at timestamptz` (now), `p_start_page integer` (0)                                                                                | `readingMutationResultSchema`                                               |
| `pause_reading`, `resume_reading`                                   | `p_reading_id uuid`                                                                                                                                           | `readingMutationResultSchema`                                               |
| `record_progress`, `correct_progress`, `finish_reading`, `mark_dnf` | `p_event_id uuid`, `p_reading_id uuid`, `p_page integer`, `p_occurred_at timestamptz` (now), `p_local_date date` (null)                                       | `readingMutationResultSchema` (`duplicate: true` se l'evento esiste già)    |
| `add_completed_reading`                                             | `p_book_id uuid`, `p_started_at timestamptz`, `p_finished_at timestamptz`, `p_final_page integer`, `p_start_page integer` (0)                                 | `readingMutationResultSchema`                                               |
| `change_book_genre`                                                 | `p_book_id uuid`, `p_genre_slug text`                                                                                                                         | `genreChangeResponseSchema`                                                 |
| `save_review`                                                       | `p_book_id uuid`, `p_rating smallint`, `p_adjectives text[]` (3 distinti), `p_scores jsonb` ('[]', `[{dimension_key, score}]`), `p_tag_ids smallint[]` ('{}') | `reviewSaveResultSchema`                                                    |
| `get_theme_selection`                                               | -                                                                                                                                                             | `themeMutationResponseSchema`                                               |
| `set_theme_selection`                                               | `p_kind text` ('builtin' \| 'custom'), `p_key text` (null), `p_custom_theme_id uuid` (null)                                                                   | `themeMutationResponseSchema`                                               |

Idempotenza: `record_progress`/`correct_progress`/`finish_reading`/`mark_dnf` usano `p_event_id` (generato dal
client) come chiave; un retry (anche concorrente) restituisce `duplicate: true` senza riscrivere nulla; lo
stesso `event_id` su un'altra lettura è `CONFLICT` (`23505`). `queue_add` non genera errori per il soft limit
di 3: risponde `requiresConfirmation` e non scrive finché non si ripete con `p_force = true`.
`queue_remove` su un libro non in coda è un no-op (risponde con la coda, vuota per chi non la possiede).

### RPC aggiunte da 105_* (Statistiche, Bingo, Citazioni)

| RPC | Argomenti (default) | Ritorno (schema Zod in `contracts/stats-lists.ts`) |
| --- | --- | --- |
| `list_quotes` | `p_book_id uuid` (null), `p_limit integer` (100, max 500), `p_offset integer` (0) | `quoteListResponseSchema` |
| `list_bingo_boards` | - | `bingoBoardListResponseSchema` (anno decrescente, `completedPositions`) |
| `create_bingo_board` | `p_year integer` | `bingoBoardResponseSchema` (`23505` se esiste, `22023` anno non valido) |
| `get_year_genre_breakdown` | `p_year integer` | `yearGenreBreakdownResponseSchema` |
| `list_completed_books` | `p_query text` (null), `p_limit integer` (50, max 200) | `completedBooksResponseSchema` |

Dettagli in `docs/features/stats.md`.

## Migration e differenze rispetto al package originale

Il package originale assumeva un backend gestito (servizio di auth, API REST automatica, bucket file).
Qui diventa:

| Originale                                         | Ora                                                                                                                        |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `auth.users`, `auth.uid()`                        | `app.users`, `app.sessions`, `app.current_user_id()` (legge `app.user_id`)                                                 |
| ruoli `anon`, `authenticated`, `service_role`     | un solo ruolo runtime `segnalibro_app`; le operazioni admin usano `postgres`                                               |
| `grant/revoke ... authenticated`, `... from anon` | stessi privilegi su `segnalibro_app`; `revoke ... from public` dove serviva                                                |
| API REST sulle funzioni `public`                  | `createPgRpcClient`: `select public.fn(p_x => $1)` dentro `withUser`                                                       |
| trigger `on_auth_user_created`                    | `on_app_user_created` su `app.users`; nome display da `app.users.display_name`; nessun backfill                            |
| bucket + policy storage (migration 006)           | eliminati: storage su filesystem (`src/lib/server/storage`)                                                                |
| `email` tipo `citext` (idea iniziale)             | `text` con CHECK `email = lower(btrim(email))`: con `search_path = ''` gli operatori di `citext` non sarebbero risolvibili |
| `gen_random_uuid()` da estensione                 | built-in di PG 13+; `pg_trgm` resta nello schema `extensions`                                                              |

File in `db/migrations/`:

1. `001_schema.sql` - schema, ruolo, `app.*`, RLS (ora con `FORCE`), grant.
2. `002_rpc_layer.sql`, 3. `003_rpc_contract_alignment.sql` - RPC e contratto v1 (identiche nella logica).
   Modifiche: `auth.uid()` -> `app.current_user_id()`, grant su `segnalibro_app`, e **errcode espliciti** sulle
   eccezioni che prima erano `P0001` generiche: `55000` (conflitto di stato: lettura già chiusa, lettura già
   aperta, review/bingo senza lettura completata) e `23505` (`event_id` già usato altrove). Così la UI distingue
   CONFLICT da VALIDATION senza leggere i messaggi. Nella 003 la `revoke execute on all functions in schema
private` include ora `segnalibro_app` (le funzioni rinominate in `private.legacy_*` ereditavano il grant).
3. `004_reference_data.sql` - dimensioni di rating e tag.
4. `005_fix_account_deletion.sql` - bug reali dell'originale che impedivano di eliminare un account:
   FK `bingo_cells_book_fk` (`RESTRICT` -> `NO ACTION DEFERRABLE INITIALLY DEFERRED`), FK
   `user_preferences_custom_theme_fk` (idem, per un tema custom selezionato) e trigger di proiezione
   (`readings_projection_trigger`, `sync_review_rating`) resi `SECURITY DEFINER`.
5. `006_harden_user_books_insert.sql` - l'INSERT su `user_books` è limitato alle colonne modificabili (prima
   un client poteva inserire un libro già "finished" senza storia di letture).
6. `007_app_api.sql` - funzioni `app.*` (registrazione, login lookup, sessioni, eliminazione account,
   scrittura catalogo).

**Bug di contratto trovati:** nessuno nella shape JSON (tutte le RPC validano contro Zod). Gli unici
cambiamenti al comportamento pubblico sono i codici SQLSTATE sopra, necessari al modello errori.

## Test

```bash
docker compose up -d db --wait && node scripts/db-reset.mjs
npx vitest run tests/contracts/unit.contracts.test.ts tests/contracts/auth-unit.contracts.test.ts tests/contracts/storage.contracts.test.ts   # senza DB
RUN_DB_CONTRACT_TESTS=1 npx vitest run tests/contracts/db.contracts.test.ts                                                                    # con DB
```

`tests/contracts/db.contracts.test.ts` raccoglie: contratti RPC (+ idempotenza `record_progress`, soft limit),
`migrations.contracts.ts` (migrazione da DB vuoto in un database temporaneo, ruoli, privilegi, assenza di
EXECUTE a PUBLIC), `auth.contracts.ts` (registrazione, login, sessioni, scadenza, sliding, eliminazione
account), `rls.contracts.ts` (un secondo utente non vede né modifica nulla, nemmeno conoscendo gli id;
anonimo; nessuna perdita di identità tra connessioni del pool), `catalog.contracts.ts`, `seed.contracts.ts`
(i numeri dei mockup sul seed). Le variabili lette sono `DATABASE_URL` e `DATABASE_ADMIN_URL`.

## Seed vs mockup

Il seed (`db/seed/demo_library.sql`, generato da `db/seed/generate_seed.py`) riproduce e verifica
automaticamente: Dune 30% p.214/712 e Le otto montagne 62% p.164/264 in lettura; prossimi Circe, Il problema dei
tre corpi, Assassinio sull'Orient Express; Mitologia 9 libri (6 letti con voti + 3); Il nome del vento recensito
con 2 letture; Bingo 2026 7/16, 2025 16/16, 2024 11/16; citazioni (p. 48 e 131); cimitero DNF Ulisse 112, Moby Dick
204, Il Silmarillion 58; 18.420 pagine nel 2026, record di serie 41.

Differenze note: (1) `currentStreak` (23) dipende dalla data odierna: l'ultima attività del seed è il
2026-09-29, quindi dal 2026-10-01 la serie corrente scende a 0; (2) i libri del seed non hanno cover
(`cover_url`/`cover_storage_path` nulli), quindi la UI mostra i dorsi/placeholder invece delle copertine
dei mockup; (3) i titoli che riempiono gli scaffali oltre a quelli visibili nei mockup sono di contorno.
