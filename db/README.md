# db/

PostgreSQL 17 (Docker) con migration SQL semplici, seed di sviluppo e ruoli/RLS propri.
Documentazione completa: [`docs/DATABASE.md`](../docs/DATABASE.md).

```text
db/
  migrations/   001_schema.sql ... 007_app_api.sql   (ordinate per nome, una transazione ciascuna)
  seed/         demo_library.sql (generato) + generate_seed.py (il generatore, opzionale)
scripts/
  db-migrate.mjs   applica le migration pendenti       (--status per vedere lo stato)
  db-seed.mjs      (ri)crea l'utente demo e la sua libreria
  db-reset.mjs     SOLO SVILUPPO: azzera gli schemi, rifà migration e seed (--no-seed, --force)
  db-lib.mjs       helper condivisi
docker-compose.yml   servizio `db` (postgres:17, container segnalibro-db, porta 5433)
```

## Avvio rapido

```bash
docker compose up -d db --wait        # avvia Postgres e attende l'healthcheck
node scripts/db-migrate.mjs           # crea schema, ruolo segnalibro_app, funzioni
node scripts/db-seed.mjs              # utente demo + libreria dei mockup
# oppure, per ripartire da zero:
node scripts/db-reset.mjs
```

Script npm consigliati (vanno aggiunti a `package.json`, vedi sotto):
`npm run db:up | db:migrate | db:seed | db:reset`.

Account demo: **demo@segnalibro.local / segnalibro-demo** (nome "Alessandra").

## Variabili d'ambiente

| Variabile            | Default in sviluppo                                                 | Uso                                                                  |
| -------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `DATABASE_URL`       | `postgres://segnalibro_app:segnalibro_app@127.0.0.1:5433/segnalibro` | l'app (ruolo `segnalibro_app`, RLS attiva). Obbligatoria in produzione |
| `DATABASE_ADMIN_URL` | `postgres://postgres:postgres@127.0.0.1:5433/segnalibro`             | migration, reset, seed, fixture dei test (owner/superuser)           |
| `DATABASE_POOL_MAX`  | `10`                                                                | dimensione del pool dell'app                                         |
| `STORAGE_DIR`        | `./storage`                                                         | cover caricate (da ignorare in git)                                  |

Gli script leggono `.env` (Node >= 20.12) se presente; le variabili già nell'ambiente vincono.

## Regole per le migration

- Un file = una transazione. I file contengono `begin;`/`commit;` (così si possono anche dare in pasto
  a `psql`); il runner li toglie e gestisce lui la transazione, registrando il file in
  `public.schema_migrations` con il checksum sha256.
- **Non modificare una migration già applicata**: il runner si rifiuta di proseguire. Aggiungere
  `008_...sql`. In sviluppo si può sempre fare `db-reset`.
- Ogni nuova funzione in `public` va protetta come le altre: `revoke all on function ... from public;`
  poi `grant execute on function ... to segnalibro_app;` (il test "no function is executable by PUBLIC"
  lo verifica).
- Ogni nuova tabella con dati utente: `user_id` diretto, `enable` + `force row level security`, policy
  `user_id = (select app.current_user_id())`, `grant` minimi a `segnalibro_app`.

## Produzione

Il ruolo `segnalibro_app` viene creato dalla migration 001 con la password di sviluppo: dopo la prima
migration eseguire `ALTER ROLE segnalibro_app PASSWORD '<segreto>'` e usarla in `DATABASE_URL`.
`DATABASE_ADMIN_URL` serve solo a chi lancia le migration (CI/deploy), mai all'app.

## Script da aggiungere a package.json (lo gestisce chi possiede package.json)

```json
"db:up": "docker compose up -d db --wait",
"db:migrate": "node scripts/db-migrate.mjs",
"db:seed": "node scripts/db-seed.mjs",
"db:reset": "node scripts/db-reset.mjs",
"test:contracts": "vitest run tests/contracts/unit.contracts.test.ts tests/contracts/auth-unit.contracts.test.ts tests/contracts/storage.contracts.test.ts",
"test:contracts:db": "RUN_DB_CONTRACT_TESTS=1 vitest run tests/contracts/db.contracts.test.ts"
```

`.gitignore` deve contenere `/storage` (e `.env`, `.env.*` con `!.env.example`, già presenti).
