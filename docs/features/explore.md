# Esplora: Ruota della Fortuna e calendario annuale

Route `/explore` (mockup `06-explore.png`). Proprietario: agente B4.

## Dati

- `load` (`src/routes/(app)/explore/+page.server.ts`): `explore.getPool()` (tutti i non letti) e
  `stats.getCalendar(year)` in parallelo. L'anno arriva da `?year=` (`parseYearParam`, default anno
  corrente).
- `GET /api/explore/calendar?year=YYYY`: stesso calendario per il cambio anno senza ricaricare la
  pagina. Errori `{ code, message }` (anno non valido = 422 `VALIDATION`).
- Repository (registrati in `src/lib/server/repositories.ts`):
  - `RpcExploreRepository.getPool(input?: { genres?: GenreSlug[] }): Promise<BookSummary[]>`
    (RPC `get_explore_pool`, solo `lifecycle_state = 'unread'`);
  - `RpcStatsRepository.getCalendar(year) / getYearStats(year) / getDashboard(year)`
    (RPC `get_reading_calendar`, `get_year_stats`, `get_stats_dashboard`), risposte validate con Zod.

## Logica pura (`src/lib/explore/`)

- `wheel.ts`: layout spicchi (`sliceStartAngle`, `slicePath`, `sliceLabelLayout`), scelta con
  `crypto.getRandomValues` (`cryptoRandomInt`, rejection sampling), `planSpin` (estrae il vincitore
  su tutto il pool, poi `rotationForSlice` calcola l'angolo finale), `sliceIndexAtPointer`
  (angolo -> spicchio), `sampleSlices` (campione di max 12 spicchi, un genere alla volta, poi
  mescolato senza vicini dello stesso genere), `shortTitle`.
- `calendar.ts`: griglia mesi con settimana da lunedì, anni bisestili, `daySegmentsBackground`
  (1 genere pieno, 2 = `linear-gradient(90deg)` 50/50, 3+ = `conic-gradient` a segmenti uguali),
  `formatDayLabel` ("12 marzo: Fantasy, Classici"), `parseYearParam`, `yearOptions`.
- `queue-client.ts`: `requestQueueAdd(bookId, force)` su `POST /api/queue/add`.

## Comportamento

- **Ruota**: SVG inline, colori solo `var(--color-*)`/`var(--genre-<slug>)`. Gli spicchi sono al
  massimo 12 (`MAX_WHEEL_SLICES`); se il pool è più grande la pagina lo dichiara sotto la ruota e
  l'estrazione resta uniforme su tutti i non letti (il vincitore sostituisce, se manca, uno
  spicchio dello stesso genere prima che la ruota parta). Rotazione CSS di 4,6 s con
  `cubic-bezier(0.12, 0.62, 0.08, 1)` (decelerazione), almeno 5 giri.
  Con `prefers-reduced-motion` (o `data-motion="reduce"`) niente rotazione: angolo applicato subito,
  la card risultato compare con una breve dissolvenza.
- **Filtri**: "Tutti i non letti" + 7 generi, selezione multipla, filtro lato client sul pool già
  caricato; ogni cambio azzera risultato e ruota. Stati vuoti: nessun non letto / filtri senza
  risultati (con "Mostra tutti i non letti").
- **Risultato**: card "LA SORTE HA SCELTO" (link a `/book/<id>`), "Gira ancora", "Metti nei prossimi"
  (soft-limit: dialog `ConfirmDialog` "Aggiungi comunque" quando il server risponde
  `requiresConfirmation`).
- **Calendario**: un pallino per giorno con Progress Event reali. Ogni giorno attivo è un bottone con
  `aria-label` ("12 marzo: Fantasy, Classici"); il tocco apre un popover con generi e pagine del
  giorno, Esc o click fuori lo chiudono. "Oggi" (solo client) = anello bordeaux
  (DESIGN_REFERENCE 8.4). Pill anno con bottom sheet (ultimi 10 anni).
- **Desktop >= 1024px**: ruota (sticky) e calendario affiancati; i mesi passano da 2 colonne a
  `auto-fill` (min 230px).

## Test

- Unit: `tests/unit/explore-wheel.test.ts`, `tests/unit/explore-calendar.test.ts`.
- E2E: `tests/e2e/explore.spec.ts` (utente di prova registrato dal test e rimosso a fine test;
  calendario con l'utente demo in sola lettura). Crea i libri di prova con SQL admin.
