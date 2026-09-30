# Recensione (voto, 3 aggettivi, rating per genere, tag, citazioni)

Modulo B3. Spec: MASTER_SPEC sez. 6 ("Review bloccata"), 10, 11, 12, 13, 48.17-48.18.
Mockup: `screens/05-book-detail-review.png` (+ `extra/05b`), `03-move-sheet.png` (+ `extra/03b`), `07-stats.png` (aspetto citazioni).

## Come montarlo (dettaglio libro)

```svelte
<script lang="ts">
	import { ReviewPanel } from '$lib/components/review';
</script>

<ReviewPanel {detail} onsaved={() => invalidateAll()} scoresReset={reviewScoresReset}>
	{#snippet lockedFooter()}<!-- pulsante "Sposta" -->{/snippet}
	{#snippet afterScores()}<!-- card "Date di lettura" -->{/snippet}
</ReviewPanel>
```

| Prop           | Tipo                 | Note                                                                                                                |
| -------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `detail`       | `BookDetailResponse` | Obbligatoria. Il componente non carica nulla: legge `book`, `review`, `quotes`.                                     |
| `lockedFooter` | `Snippet?`           | Dentro la card bloccata, sotto il testo (mockup 03: pulsante "Sposta").                                             |
| `afterScores`  | `Snippet?`           | Fra "Valutazioni specifiche" e "Tag tematici" (mockup 05: "Date di lettura"). Usa `ReviewCard` per lo stesso stile. |
| `onsaved`      | `() => void`         | Dopo ogni salvataggio riuscito. `invalidateAll()` è sicuro: una modifica non salvata non viene sovrascritta.        |
| `scoresReset`  | `boolean?`           | Mostra l'avviso "valutazioni specifiche azzerate" (passa `reviewScoresReset` di `changeGenre`).                     |

- Il pannello non mette padding orizzontale: il gutter è della pagina. Applica da solo lo scope del genere
  (`genreScopeStyle(detail.book.genre.slug)`), quindi funziona ovunque.
- Sbloccato se `detail.book.completedReadingsCount >= 1` (non lo stato corrente: una rilettura in corso resta
  recensibile). Se il conteggio passa a >= 1 dopo un `invalidateAll()` il pannello si sblocca da solo.
- Dopo `changeGenre` ricarica `detail` (il genere nuovo arriva da lì). Se c'erano punteggi specifici compare
  l'avviso; `ReviewScoresResetNotice` (props `genreLabel?`, `ondismiss?`) è esportato per usarlo anche altrove.

## Comportamento

- **Autosave** con debounce di 700 ms. La RPC `save_review` richiede voto generale e 3 aggettivi distinti:
  finché manca uno dei due la bozza resta **solo in locale** (`localStorage`, chiave `sb-review-draft:<bookId>`),
  senza chiamare il server, e compare "Bozza non ancora salvata: mancano ...". Al ritorno sulla pagina la bozza
  viene ripristinata (se diversa dal server e dello stesso genere).
- Indicatore discreto (pill fissa sopra la tab bar, `role=status`): "Salvo…", "Salvato" (2 s), bozza, offline con
  "Riprova", errore con "Riprova". Offline = `fetch` fallisce o 502/503: la bozza resta al sicuro, si riprova su
  evento `online`, e si salva con `keepalive` quando la pagina viene nascosta o il componente smontato.
- Togliere un aggettivo da una recensione salvata non cancella nulla sul server: torna "bozza" finché non ce ne
  sono di nuovo 3.
- Tag: 27 predefiniti. Come nel mockup ne mostra 9 (selezionati prima, poi Viaggio, Vendetta, Perdita, Mistero,
  Famiglia) e "Mostra tutti i tag (+18)". L'ordine è fissato all'apertura: i chip non saltano mentre si tocca.
- Rating specifici: facoltativi (toccare la stella scelta di nuovo la azzera). Etichetta breve del mockup per
  Fantasy ("Sistema magico"); l'etichetta completa è nel DB/spec.
- Citazioni: solo con almeno una lettura completata (RPC `add_quote` → 55000/CONFLICT altrimenti). Testo
  (max 5000) e pagina facoltativa; le virgolette scritte dall'utente attorno al testo vengono tolte (la UI mostra «…»).
  Eliminazione con dialog di conferma.

## Componenti (`$lib/components/review`)

`ReviewPanel` (entry, sceglie bloccato/editor), `ReviewCard` (card con titolo, `required`, `aside`),
`ReviewLockedCard`, `AdjectiveInput`, `OverallRating` (usa `RatingStars` 36px), `GenreDimensionRatings` +
`RatingDimension` (stelle da 20px con area di tocco 30x44, vedi deviazioni), `ThemeTagPicker`, `QuotesEditor`,
`ReviewScoresResetNotice`. Stato e salvataggio stanno in `ReviewEditor.svelte` (interno). `api.ts` = fetch verso
gli endpoint.

## Logica pura (`$lib/review`)

`dimensions.ts` (chiavi stabili per genere, `REVIEW_DIMENSIONS_VERSION`, `scoresForGenre`, `wouldResetScores`),
`adjectives.ts` (trim, maiuscola iniziale, duplicati case-insensitive, max 24 caratteri, esattamente 3),
`tags.ts` (27 tag, toggle, `resolveTagIds`, ordine di visualizzazione), `draft.ts` (bozza, campi mancanti,
`toSaveRequest`, `saveReviewRequestSchema`), `quotes.ts`, `local-draft.ts` (solo browser).
`tests/unit/review-logic.test.ts` verifica anche che dimensioni e tag coincidano con la migration 004.
L'autorità resta il DB: il reset dei rating al cambio genere lo fa `change_book_genre`, la UI lo anticipa.

## Dati e API

Migration **`db/migrations/103_review_quotes_api.sql`** (additiva, idempotente, `SECURITY DEFINER` con
`private.require_uid()`, `EXECUTE` solo a `segnalibro_app`):

| RPC                                                 | Uso                                                           |
| --------------------------------------------------- | ------------------------------------------------------------- |
| `get_review_reference()`                            | tag attivi (con id) e dimensioni attive per genere            |
| `add_quote(p_book_id, p_body, p_page default null)` | richiede lettura completata (`55000`); body 1..5000, page > 0 |
| `update_quote(p_quote_id, p_body, p_page)`          | `P0002` se non esiste o non è tua                             |
| `delete_quote(p_quote_id)`                          | idem                                                          |

Contratti Zod in `src/lib/contracts/reviews.ts` (`reviewReferenceResponseSchema`, `addQuoteInputSchema`,
`updateQuoteInputSchema`, `quoteMutationResponseSchema`, `quoteDeleteResponseSchema`). Repository:
`RpcReviewRepository` (`save`, `getReference`) e `RpcQuotesRepository` (`add`, `update`, `remove`) in
`src/lib/data/review-repository.ts`, registrati come `review` e `quotes`.

Endpoint (errori `{ code, message }`):

| Metodo e path             | Corpo                                                     | Risposta                         |
| ------------------------- | --------------------------------------------------------- | -------------------------------- |
| `PUT /api/review`         | `{ bookId, rating, adjectives[3], scores[], tagSlugs[] }` | `{ contractVersion, review }`    |
| `POST /api/quotes`        | `{ bookId, body, page? }`                                 | 201 `{ contractVersion, quote }` |
| `PATCH /api/quotes/[id]`  | `{ body, page? }`                                         | `{ contractVersion, quote }`     |
| `DELETE /api/quotes/[id]` | -                                                         | `{ contractVersion, ok }`        |

I tag viaggiano come **slug**: il server li risolve in id con `get_review_reference` (la UI non conosce gli id).
`save_review` riscrive lo stato intero, quindi il PUT è idempotente.

## Sviluppo e test

- `/dev/review` (solo `vite dev`): elenco libri, poi `?book=<uuid>`; include un selettore di genere che usa
  `PATCH /api/books/[id]/genre` per provare il reset.
- Unit: `npx vitest run tests/unit/review-logic.test.ts`.
- Contratti (non resettano il DB, usano un utente di prova): `RUN_DB_CONTRACT_TESTS=1 npx vitest run tests/contracts/review.contracts.test.ts`.
- E2E: `tests/e2e/review.spec.ts` (serve `vite dev` perché usa `/dev/review`; salta i test se la route è 404).
