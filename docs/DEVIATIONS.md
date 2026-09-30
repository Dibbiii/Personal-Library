# Deviazioni dalla specifica e dal baseline

Ogni voce indica cosa è cambiato, perché, e come tornare indietro.

## Niente Supabase: PostgreSQL + autenticazione nel server SvelteKit

Per richiesta esplicita dell'utente, Supabase (Auth, Storage, client, CLI) è sostituito da
PostgreSQL 17 in Docker, con autenticazione, sessioni e storage file implementati nel server
SvelteKit. Il database è raggiunto solo dal server (`postgres`/postgres.js); le RPC restano
funzioni Postgres chiamate dal data layer. Conseguenze:

- hosting Node/Docker (`@sveltejs/adapter-node`) invece di Cloudflare;
- sessione = cookie httpOnly (`SESSION_COOKIE_NAME`) + `validateSession`, non JWT di Supabase;
- `src/lib/data/rpc-client.ts` non dipende più da PostgREST: la mappatura errori usa gli SQLSTATE
  delle funzioni SQL (`42501`, `P0002`, `23505`...), `RpcClient` è un alias di `RpcTransport`;
- registrazione: nessuna conferma email (l'account è attivo subito).

## Font: Young Serif + Figtree invece di Fraunces + Inter

La specifica (sezione 39) indica Fraunces/Inter come _preferenza_. Il sorgente dei mockup usa
`Young Serif` (titoli) e `Figtree` (UI); i mockup vanno seguiti alla lettera. Self-hosted con
`@fontsource/young-serif` (latin + latin-ext, 400) e `@fontsource-variable/figtree`.
Tornare a Fraunces/Inter: cambiare gli import in `src/routes/+layout.svelte` e `--font-display` /
`--font-ui` in `src/lib/styles/tokens.css`.

## Colori: il mockup vince sulla specifica

- `primary` è `#6C0820` (mockup) invece di `#570F1D` (spec); `#570F1D` resta come `primaryDeep`
  per i glifi piccoli. `onPrimary` è `#FAF1EE`, `textSecondary` `#6B3A42`, `surfaceElevated`
  `#FDF7F5`, `info` `#3D5D91`.
- Token aggiunti al tema (`DESIGN_REFERENCE.md` 2.3): `primaryDeep`, `shelfAxis`, `infoHover`,
  `onGenreInk`, `onGenreWhite`, `sheetHandle`, `backgroundShelf`, `bingoCard`, `graveyardBg`,
  `tombTop|Bottom`, legno (`wood*`), decorazioni (`waxEdge`, `flame`, `flameCore`, `leaf*`, `pot*`).
  Vivono solo in `src/lib/themes/segnalibro.ts`; lo schema Zod `semanticThemeColorsSchema`
  (`src/lib/contracts/themes.ts`) è esteso con gli stessi campi (obbligatori). Un tema custom
  deve quindi partire da una copia di un tema built-in. Non esistono temi custom salvati, quindi
  `schemaVersion` resta 1.
- Gli `rgba()` del mockup sono resi con `color-mix()` sui token (ombre su `text-primary`, scrim
  50%, bagliori LED sul colore del genere).
- `onBase` di "Mitologia, Epica e Retelling": da bianco (3.84:1) al testo scuro (4.57:1) per
  passare AA; il mockup usa `#2B1006` in quel punto (differenza trascurabile). Controllo
  automatico in `tests/unit/theme.test.ts`.

## Shell e navigazione

- Barra inferiore come nel mockup: sfondo `--color-background`, bordo superiore `--color-surface`;
  la Home ha il fondo più scuro `--color-background-shelf`. Inattivo = `--color-shelf-axis`.
- Nella vista genere la barra, le pill e la pagina si ricolorano dal genere (mix di light/dark).
- Sulle schermate con sheet/dialog la barra resta sotto lo scrim invece di sparire.

## Modifiche minime al baseline copiato

- `src/lib/themes/segnalibro.ts` e `src/lib/pwa/manifest.ts`: import con estensione `.ts`. Vite 8
  carica `vite.config.ts` con il loader nativo, che non risolve import senza estensione e
  stampava un warning a ogni comando. `tsconfig.json` abilita `allowImportingTsExtensions`.
- I file copiati sono stati riformattati da Prettier (tab). Nessun cambio logico oltre a quelli
  descritti in questo documento.
- `RpcLibraryRepository` vive in `src/lib/data/example-library-repository.ts` e non è riesportato
  da `src/lib/data/index.ts`; la factory lo importa dal file. Con il repository definitivo
  conviene rinominare il file e riesportarlo.

## Versioni

`npm install` ha preso le ultime versioni (Vite 8, Vitest 5, TypeScript 6, ESLint 10, Tailwind 4,
Svelte 5.5x), più nuove di quelle del baseline (Vitest 3, TS 5.9). I flag `strict`,
`noUncheckedIndexedAccess` ed `exactOptionalPropertyTypes` del baseline sono mantenuti.

## Tailwind

Tailwind 4 solo per layout/utility. `@theme { --color-*: initial }` in `src/app.css` rimuove la
palette di default: non esistono classi `bg-red-500` & simili (e `lint:colors` le vieta comunque).

## PWA

- `generateSW` (Workbox): precache di JS/CSS/font/icone; le navigazioni usano `NetworkFirst`
  (timeout 4s, cache `sb-pages`). L'HTML è SSR, quindi non esiste una shell statica da
  precaricare: offline funzionano le pagine già visitate, manca ancora una pagina di fallback.
- L'HTML in cache contiene dati personali: al logout la cache `sb-pages` andrebbe svuotata (TODO,
  da fare insieme all'outbox offline).
- Il warning di build "glob pattern prerendered/**" è innocuo: nessuna pagina è prerenderizzata.
- Il service worker non è attivo in `npm run dev`.

## Extra non richiesti

- `/dev/components`: galleria dei componenti condivisi, 404 fuori da `npm run dev`.
- `scripts/generate-icons.ts` (`npm run icons`): icone PWA dai colori del tema. `static/icons/`
  è escluso da `lint:colors` perché contiene colori derivati dal tema.

## CSP

L'inline script anti-flash e lo `<style id="sb-theme-css">` in `app.html` richiedono
`'unsafe-inline'` o un nonce quando si configurerà la CSP (fase 10): `kit.csp` in modalità hash
non copre `app.html`, servirà un nonce generato in `hooks.server.ts`.
