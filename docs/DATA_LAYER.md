# Data layer: wiring e come aggiungere una RPC

```text
+page.svelte  <-  +page.server.ts (load/actions)  ->  locals.repos.<dominio>  ->  funzione Postgres
```

I componenti non importano mai il database né i nomi delle RPC. Le `load` e le form action lato
server ricevono `event.locals.repos`, costruito in `src/hooks.server.ts`.

## Stato attuale

- **Sessione**: il cookie httpOnly `SESSION_COOKIE_NAME` (default `sb-session`) contiene il token;
  `validateSession(token)` (`$lib/server/auth`) restituisce `{ id, email, displayName }` o `null`.
  Login, registrazione e logout sono form action/endpoint in `src/routes/auth/*` e usano
  `registerUser`, `authenticate`, `createSession`, `invalidateSession`. Il cookie si imposta con
  `setSessionCookie` (`$lib/server/session-cookie`): httpOnly, `sameSite=lax`, `secure` in produzione.
- **Guard** (`hooks.server.ts`): senza utente tutto tranne `/auth/*` reindirizza a
  `/auth/login?next=...` (`next` passa da `safeRedirectPath`); con utente, `/auth/login` e
  `/auth/register` reindirizzano a `/library`. `locals.user` e `locals.repos` sono già valorizzati.
- **Repository**: `createRepositories(createPgRpcClient(user.id))` (`$lib/server/repositories`).
  Per ora solo `library` (`RpcLibraryRepository`: `getHome`, `getShelfPage`, `getGenreView`,
  `getBookDetail`, `changeGenre`); gli altri sono TODO nella factory.
- **Trasporto**: `src/lib/data` contiene solo interfacce, contratti e mappatura errori
  (`RpcTransport` = `RpcClient`, `callRpc`, `DataAccessError`). L'implementazione Postgres
  (`createPgRpcClient`, `withUser` con RLS) sta in `src/lib/server/db`.
  `callRpc` valida la risposta con Zod e traduce gli SQLSTATE: `42501` AUTH_REQUIRED, `P0002`
  NOT_FOUND, `23505`/`40001`/`40P01` CONFLICT, `23503`/`23514`/`22023` VALIDATION, risposta fuori
  contratto CONTRACT, il resto SERVER; un errore non SQL del driver diventa NETWORK.

## Aggiungere una RPC

1. Funzione SQL: migration in `db/` (responsabilità del database). La funzione restituisce già il
   JSON camelCase con `contractVersion: 1`.
2. Contratto: schema Zod della risposta e tipi di input in `src/lib/contracts/` (di solito esistono).
   Se cambia la shape, aggiornare insieme Zod, la documentazione RPC e i test in `tests/contracts/`.
3. Nome: aggiungerlo a `RPC` in `src/lib/data/rpc-names.ts`.
4. Interfaccia: metodo in `src/lib/data/repositories.ts`.
5. Implementazione: classe in `src/lib/data/` che riceve `RpcTransport` e chiama
   `callRpc(transport, RPC.nome, { p_arg: ... }, schema)`. Argomenti con prefisso `p_`, snake_case;
   opzionali mancanti come `null`. Esempio: `RpcLibraryRepository.getBookDetail`.
6. Registrazione: una riga nella factory `src/lib/server/repositories.ts`
   (es. `queue: new RpcQueueRepository(rpc)`), togliendo il relativo TODO.
7. Uso in una pagina:

```ts
// src/routes/(app)/book/[id]/+page.server.ts
import { requireRepository } from '$lib/server/repositories';

export const load = async ({ locals, params }) => {
	const library = requireRepository(locals.repos, 'library');
	return { detail: await library.getBookDetail(params.id) };
};
```

Nelle form action: catturare `DataAccessError` e rispondere con `fail(...)` secondo `error.code`
(mai parsare `error.message`).

## Catalogo esterno (Open Library / Google Books)

Il repository `catalog` non è una RPC: si implementa lato server (`+server.ts` o classe in
`src/lib/server/`) con `GOOGLE_BOOKS_API_KEY` da `$env/dynamic/private`. Il browser non riceve
mai chiavi.

## Variabili d'ambiente

`.env.example` elenca tutto: `DATABASE_URL`, `DATABASE_ADMIN_URL`, `STORAGE_DIR`,
`SESSION_COOKIE_NAME`, `GOOGLE_BOOKS_API_KEY`. Si leggono con `$env/dynamic/private`, solo lato server.
