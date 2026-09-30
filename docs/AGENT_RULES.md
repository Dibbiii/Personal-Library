# Regole per chi lavora in parallelo su Segnalibro

Più agenti modificano questo repo contemporaneamente. Queste regole evitano che si pestino i piedi.

## Divieti assoluti
- **Supabase è vietato**, per nessun motivo (niente supabase-js, CLI, container, Auth/Storage/PostgREST, e nemmeno la parola nel codice). Il DB è PostgreSQL 17 in Docker; auth, sessioni e storage sono codice nostro.
- **Niente git né `but`**: nessun commit, stage, reset, `git rm`, ecc. Il versionamento lo gestisce la sessione principale.
- **Niente colori letterali** (#hex, rgb(), hsl(), nomi colore, classi Tailwind colorate) fuori da `src/lib/themes/`. Usa solo i token CSS (`var(--color-…)`, `var(--genre-current…)`, `color-mix()`). `npm run lint:colors` deve restare verde. Se manca un token, aggiungilo in `src/lib/themes/` (additivo) e documentalo.
- Nessun Supabase/SQL/nome di tabella o RPC nei componenti Svelte: i componenti parlano solo con `+page.server.ts`, form action o endpoint `/api/<feature>`, che usano `locals.repos` (vedi `docs/DATA_LAYER.md`).
- Non introdurre infrastruttura non richiesta (Redis, GraphQL, ecc.) né librerie pesanti.

## Fonti da leggere prima di scrivere UI
1. `Segnalibro_Work_Package/MASTER_SPEC.md` (spec funzionale; dove cita Supabase è superata da `docs/DEVIATIONS.md`).
2. `docs/mockup/DESIGN_REFERENCE.md`, `docs/mockup/CHECKLIST.md`, `docs/mockup/screens/*.png` (vanno guardati con Read): l'utente vuole i mockup seguiti **ALLA LETTERA**. Dove il mockup contraddice la spec vince il mockup; dove il mockup non copre un caso richiesto dalla spec, estendi nello stesso stile e segnalalo nel report.
3. `docs/COMPONENTS.md`, `docs/DATA_LAYER.md`, `docs/DATABASE.md`, `docs/DEVIATIONS.md`.
4. Asset visivi: `docs/mockup/assets/` (SVG candela, pianta, tazza, ecc., `icons-sprite.svg`); dorsi: `docs/mockup/SPINES.md`.

## Risorse condivise (occhio ai conflitti)
- **Database condiviso** (`segnalibro-db`, porta 5433) già con migration e seed. **NON eseguire** `db-reset`, `db:reset`, `test:contracts:db` o qualsiasi cosa che droppi/ricrei il DB: li usano tutti. Per provare mutazioni **non modificare i dati dell'utente demo** (`demo@segnalibro.local` / `segnalibro-demo`): registra un utente di prova (email `<tuonome>-<n>@test.local`) oppure ripristina ciò che cambi. Puoi leggere liberamente col demo per i confronti visivi.
- **Dev server**: avvia il tuo con `npx vite dev --port <TUA_PORTA> --strictPort` (porta assegnata nel tuo brief). Non usare altre porte, non fermare processi altrui.
- **Browser**: NON usare i tool `mcp__playwright__*` (un solo browser condiviso fra tutti gli agenti). Per screenshot/test usa script Node con `@playwright/test`/`playwright` (`chromium.launch()`, già installato) in `/private/tmp/claude-501/-Users-tacosalfornoh-Coding-Dibbi-Personal-Library/44e92337-870a-4ef3-9667-ebee0177998a/scratchpad/<tuo-nome>/`. Viewport mobile 390×844 e desktop 1280×800.
- **Niente `npm install`/`npm uninstall`** (corromperebbe node_modules condiviso). Sono già installati: `@zxing/library`, `idb`, `zod`, `postgres`, Tailwind 4, Playwright, Vitest, fontsource. Se ti serve altro, scrivilo nel report finale invece di installarlo (o fai a meno).
- **Niente `npm run build`** (scrive in `.svelte-kit`/`build` e rompe gli altri). Usa `npm run check`, `npm run lint`, `npm run lint:colors`, `npm test` (se fallisce per un file di un altro agente a metà lavoro, ignoralo e rilancia più tardi; non sistemare i file altrui).
- **File condivisi: modifica solo con Edit puntuali (mai riscrivere l'intero file), rileggendo subito prima**: `src/lib/data/rpc-names.ts`, `src/lib/data/index.ts`, `src/lib/server/repositories.ts` (una riga per il tuo repository; rimuovi il tuo TODO), `src/lib/themes/*` (solo aggiunte). Non modificare `src/lib/components/ui/*`, `src/lib/components/layout/*` e `src/hooks.server.ts` se non con una modifica minima, additiva e retro-compatibile (es. nuova prop opzionale); descrivila nel report.
- **Documentazione**: scrivi la tua in `docs/features/<feature>.md` (non editare `COMPONENTS.md`/`DATA_LAYER.md`, aggiungici solo una riga di puntatore se serve, con Edit).
- **Convenzione endpoint**: i componenti client chiamano endpoint `src/routes/(app)/api/<feature>/…/+server.ts` (JSON, validazione Zod in ingresso e uscita, errori `{ code, message }` con HTTP coerente al `DataErrorCode`). Non mettere più feature nello stesso endpoint.
- **Route**: ogni route ha un solo proprietario (vedi brief). Non sovrascrivere le pagine altrui.

## Componenti condivisi dei libri (li crea l'agente "Home")
Path fissi, da importare negli altri moduli: `$lib/components/book/BookCover.svelte`, `BookSpine.svelte`, `BookCard.svelte` (API in `docs/COMPONENTS.md` sezione Book, scritta dall'agente Home appena pronta; controlla se il file esiste prima di usarlo, altrimenti sviluppa le tue parti e integra alla fine). Input comune: `BookSummary` da `$lib/contracts/books`.

## Qualità
- Svelte 5 (runes), TypeScript strict, niente `any`. Commenti solo dove servono; stile coerente con il codice vicino.
- Validazione Zod ai confini, errori normalizzati (`DataAccessError.code`), mai parsing di stringhe Postgres.
- Accessibilità: target 44×44, focus visibile, aria-label, ESC/focus trap nei sheet, `prefers-reduced-motion`, colore mai unico segnale.
- Mobile-first, poi desktop dedicato (spec §34). Nessun layout shift delle cover (dimensioni riservate, `loading="lazy"`, `decoding="async"` sotto il fold).
- Test: unit Vitest per la logica pura; un test Playwright e2e (`tests/e2e/<feature>.spec.ts`) per il flusso principale, con utente di prova. Verifica **visivamente** contro i mockup con screenshot a 390px e confrontali con `docs/mockup/screens/` (a 390px il render HTML è il riferimento).
- Italiano per tutta la UI. Titoli di libri/autori non si traducono.

## Report finale
Conciso: cosa funziona, file principali, API esposte ad altri moduli (firme), deviazioni/estensioni rispetto ai mockup, test eseguiti (comando + esito), problemi aperti, richieste di dipendenze.
