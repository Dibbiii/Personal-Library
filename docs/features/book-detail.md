# Vista genere, dettaglio libro e ciclo di lettura

Mockup: `02-genre`, `03-move-sheet`, `04-soft-limit-dialog`, `05-book-detail-review` (+ `extra/`). Spec: §5-8, §17, §27.

## Route

| Route                      | File                            | Note                                                                                                                                                                                                                                                                                           |
| -------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/genre/[slug]?sort=&dir=` | `src/routes/(app)/genre/[slug]` | slug non valido o genere sconosciuto = 404. `sort` = `title\|author\|pages\|rating\|date`, `dir` = `asc\|desc`; default `rating desc` (come il mockup). L'ordine vive nell'URL: i chip sono link veri (`data-sveltekit-replacestate`), la risposta del server ridisegna la pagina senza flash. |
| `/book/[id]`               | `src/routes/(app)/book/[id]`    | id non UUID o libro non trovato = 404 "Libro non trovato" (`+error.svelte` locale). `#progress` apre lo sheet di aggiornamento pagina.                                                                                                                                                         |

La coda ("Prossimo", "N su 3") si legge con `library.getHome({ shelfLimit: 1 })`; il dettaglio dichiara `depends('app:queue')`, quindi `addToQueue/removeFromQueue` di `$lib/client/queue.svelte` lo ricaricano.

## Endpoint JSON (validazione Zod in/out, errori `{ code, message }`)

Tutti in `src/routes/(app)/api/`, helper condiviso `reading/_http.ts` (status: AUTH_REQUIRED 401, NOT_FOUND 404, CONFLICT 409, VALIDATION 422, RATE_LIMITED 429, NETWORK 503, SERVER 500, CONTRACT 502). Schemi in `$lib/client/reading-contract.ts`.

| Metodo e path                        | Body                                                                                                        | Risposta                                                                                                                                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/reading/start`            | `{ bookId, startedAt?, startPage? }`                                                                        | `ReadingMutationResult`                                                                                                                                                             |
| `POST /api/reading/pause` / `resume` | `{ readingId }`                                                                                             | `ReadingMutationResult`                                                                                                                                                             |
| `POST /api/reading/event`            | `{ eventId, readingId, page, occurredAt, localDate, operation: 'progress'\|'correction'\|'finish'\|'dnf' }` | `ReadingMutationResult` (`duplicate: true` se l'`eventId` esiste già: nessun doppio conteggio)                                                                                      |
| `POST /api/reading/add-completed`    | `{ bookId, startedAt, finishedAt, finalPage, startPage? }`                                                  | `ReadingMutationResult`. Toglie anche il libro dai prossimi (`queue_remove`, idempotente). Non crea eventi di avanzamento: niente giorni inventati in calendario/streak (spec §15). |
| `PATCH /api/books/[id]/genre`        | `{ genreSlug }`                                                                                             | `{ contractVersion: 1, reviewScoresReset, genreSlug }`                                                                                                                              |

Repository: `RpcReadingRepository` (`src/lib/data/reading-repository.ts`, registrato in `src/lib/server/repositories.ts`). Gli SQLSTATE `55000` (lettura già chiusa / già aperta) arrivano come `CONFLICT`.

## Logica pura (`src/lib/client/reading-logic.ts`, test in `tests/unit/reading-logic.test.ts`)

- `currentStatusChoice`: stato mostrato. "Letto più di una volta" è **derivato** da `completedReadingsCount >= 2`, mai salvato.
- `planStatusChange(context, target)`: dalla situazione attuale alle operazioni reali (`start`, `pause`, `resume`, `finish`, `dnf`, `addCompleted`) e ai dati da raccogliere (`dates`, `dnfPage`).
  - TBR non è raggiungibile se il libro ha già letture (le letture sono immutabili); "In pausa" solo da "In lettura"; "Letto più di una volta" solo dopo una lettura completata.
  - Letto da TBR/DNF: lettura storica con date (default oggi). Da una lettura aperta: `finish` alla pagina finale (totale pagine se noto).
  - DNF senza lettura aperta: `start` + `dnf` alla pagina scelta.
- `classifyPageUpdate`: `progress` se la pagina avanza, `correction` se è minore (corregge il totale, non è "lettura negativa"), `noop`, `invalid` (non intera, negativa, oltre il totale).
- `isReviewUnlocked`: `completedReadingsCount >= 1` (resta vera durante una rilettura).

## Client

`$lib/client/reading.ts`: `startReading`, `pauseReading`, `resumeReading`, `addCompletedReading`, `changeBookGenre`, `submitReadingOp`, `describeReadingError` (messaggi italiani per `DataErrorCode`, mai parsing di stringhe). `submitReadingOp` è un wrapper su `submitReadingOp` di `$lib/offline/outbox` (IndexedDB): risultato `synced` o `queued`; un rifiuto permanente diventa `ReadingApiError` con il codice del server.
`$lib/client/reading-actions.ts`: `runPlanSteps` esegue il piano; `submitPageUpdate/Finish/Dnf` generano l'`eventId` (UUID) sul client.

## Componenti (`src/lib/components/detail`, `genre`)

`GenreHeader`, `SortBar`, `ShelfGrid` (mensola: un solo gradiente ripetuto a passo fisso, corretto per qualunque numero di colonne; copertina fluida 34:50, altezza ricavata con `cqw`); `BookHero` (hero con mensola e glow oppure layout compatto a sinistra, su desktop sempre hero), `StatusButton`, `MoveSheet`, `ReadingStatusSheet`, `MarkReadSheet`, `ProgressPanel`, `ProgressSheet`, `ReadingHistory`, `AddReadingSheet`, `SeriesCard`, `ActionsMenu` (menu "⋯").

## Scelte e limiti

- Layout: compatto (mockup 05) se `completedReadingsCount >= 1`, hero (mockup 03) altrimenti. Su desktop due colonne (cover/meta/avanzamento/serie a sinistra, recensione a destra).
- Estensioni non nel mockup, nello stesso stile: voce "In pausa" nello sheet stato; "Rimuovi dai prossimi"; pannello "Avanzamento" (pagina, %, barra, aggiorna/finito/pausa); sheet "Aggiorna pagina"; "Aggiungi rilettura" (inizia ora / già riletta con date); chip stato cliccabile anche nel layout hero.
- Voci non disponibili nello sheet stato restano visibili ma disabilitate, con il motivo.
- Card Serie: i volumi prima del corrente sono mostrati come "letti" e i successivi come "mancanti" in base a numero/totale della serie; non si verifica quali volumi siano nella libreria.
- Date mostrate in fuso `Europe/Rome` (uguale su server e client).
- Non esiste eliminazione del libro nel contratto: il menu "⋯" non la offre.
