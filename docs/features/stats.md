# Statistiche, Bookish Bingo, Citazioni, Quote Card, Cimitero DNF

Route: `/stats`, `/stats/[year]`, `/bingo` (redirect all'anno corrente), `/bingo/[year]`, `/quotes`.
Mockup: `docs/mockup/screens/07-stats.png`, `08-bingo.png`; spec §13, §15, §16, §17.

## Dati

| Uso                                                                  | Repository (`locals.repos`)                                               | RPC                                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Card, autore, mese, pagine, streak, tag, citazioni recenti, cimitero | `stats.getDashboard(year)` (B4)                                           | `get_stats_dashboard`                                                                         |
| Barra segmentata dei generi                                          | `statsExtras.getGenreBreakdown(year)`                                     | `get_year_genre_breakdown` (105)                                                              |
| Elenco globale citazioni                                             | `statsExtras.listQuotes({bookId?, limit?, offset?})`                      | `list_quotes` (105)                                                                           |
| Libri candidati per il Bingo                                         | `statsExtras.listCompletedBooks({query?, limit?})`                        | `list_completed_books` (105)                                                                  |
| Card Bingo                                                           | `bingo.getBoard(year)`, `assignBook`, `listBoards()`, `createBoard(year)` | `get_bingo_board`, `assign_bingo_book`, `list_bingo_boards` (105), `create_bingo_board` (105) |

Streak, cimitero e regole sulle letture sono calcolati dal DB: il client non ricalcola nulla.
`get_stats_dashboard` restituisce il cimitero di sempre (non filtrato per anno): entrano solo libri con
ultimo stato DNF e `completed_readings_count = 0`. Lo streak e' globale (non per anno): per un anno
passato mostra comunque serie corrente e record.

## Migration additive (prefisso 105, applicare con `node scripts/db-migrate.mjs`)

- `105_stats_lists.sql`: `list_quotes`, `list_bingo_boards`, `create_bingo_board`.
- `105_year_genre_breakdown.sql`: `get_year_genre_breakdown`.
- `105_completed_books.sql`: `list_completed_books`.

Tutte: `security definer`, `search_path = ''`, utente da `private.require_uid()`, JSON camelCase con
`contractVersion: 1`, `revoke ... from public` + `grant ... to segnalibro_app`. Zod in
`src/lib/contracts/stats-lists.ts`. `create_bingo_board` crea 16 caselle con le sfide del mockup e
risponde `23505` (CONFLICT) se l'anno ha gia' una card, `22023` (VALIDATION) per anni fuori 1900-2200.

## Endpoint (JSON, errori `{ code, message }`)

- `POST /api/bingo/assign` `{ cellId, bookId | null }` -> `BingoBoard` (solo libri con lettura completata: 409 altrimenti).
- `POST /api/bingo/board` `{ year }` -> `BingoBoard` (201; 409 se esiste).
- `GET /api/stats/completed-books?q=&limit=` -> `{ contractVersion, books: BookSummary[] }`.

## Componenti

- `$lib/components/stats`: `StatsView`, `StatCard`, `GenreBar`, `TopTags`, `BingoSection`, `BingoMini`,
  `QuotesSection`, `QuotePromo`, `QuoteListItem`, `DnfCemetery`, `Tombstone`, `YearPicker`, `format.ts`.
- `$lib/components/bingo`: `BingoGrid`, `BingoCell`, `BingoSummary`, `BingoTabs`, `BingoBoardList`,
  `BingoAssignSheet`, `NewBoardSheet`, `icons.ts` (posizione -> icona dello sprite).
- `$lib/components/quotes`: `QuoteCard` (anteprima canvas), `QuoteCardCreator` (bottom sheet).
- `$lib/quotes`: `layout.ts` (word-wrap e scaling, puro), `palette.ts` (colori da token CSS),
  `render.ts` (disegno 1080x1350), `export.ts` (PNG, download, `navigator.share` con file).

## Quote Card

Il creator si carica con `import()` al primo click su "Crea Quote Card" (non e' nel bundle iniziale).
Flusso: `document.fonts.ready` + `fonts.load` -> colori risolti con `getComputedStyle` su un elemento
sonda (`var(--genre-…)`, `--color-primary`…, nessun colore letterale) -> `renderQuoteCard` su canvas.
L'export usa `OffscreenCanvas` se c'e' (altrimenti `<canvas>`), `convertToBlob`/`toBlob` in PNG;
"Scarica PNG" scarica, "Condividi" compare solo se `navigator.canShare({ files })`. Il corpo del testo
scende da 72 a 34 px finche' la citazione sta nel riquadro; oltre il minimo si tronca con "…".
Stili: Genere (base), Chiaro (light/dark), Tema (primary/accent), Carta (background) + scelta del genere.

## Differenze / estensioni rispetto ai mockup

- Il chip anno apre un foglio con gli anni (corrente, 4 precedenti, anni con una card Bingo).
- Stati vuoti (anno senza letture, nessuna card, nessuna citazione, cimitero vuoto) non presenti nei mockup.
- Sottotitolo card nell'elenco "Le tue card": oltre a "Bingo completo!" e "Quasi!" (>= 10) usa "In corso" / "Da iniziare".
- Layout desktop: griglia 4 colonne per le card, Bingo e Citazioni affiancati, Cimitero a tutta larghezza;
  Bingo con colonna "Le tue card" a destra. Etichette delle caselle piu' grandi da 720px.
- Anteprima delle mini-card della promo Citazioni con le citazioni reali dell'utente (fallback: frasi del mockup).
- Tag piu' usati: mostra i primi 4 come nel mockup. Barra generi: dati reali (il seed ha 7/6/6/6/6/6/6, non 14/9/8…).
- Lapide: link al dettaglio del libro; senza pagina nota mostra "Riposa qui".

## Test

- `npx vitest run tests/unit/quote-card-layout.test.ts` (wrapping, scaling, ellissi, palette, formato numeri).
- `tests/contracts/stats-lists.contracts.test.ts` (Zod senza DB; con `RUN_DB_CONTRACT_TESTS=1` le nuove RPC con utenti di prova, non resetta il DB).
- `tests/e2e/stats-bingo.spec.ts`: cimitero (DNF senza letture si', rilettura abbandonata no), nuova card, assegna/rimuovi,
  Quote Card (PNG 1080x1350 valido e non vuoto). Usa utenti `b5-*@test.local`, rimossi a fine test.
