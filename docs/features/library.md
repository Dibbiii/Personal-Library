# Libreria (Home), primitive dei libri, coda "I prossimi" e drag

## File principali

| Area            | Percorso                                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home            | `src/routes/(app)/library/+page.server.ts` (una sola RPC `getHome`), `+page.svelte`                                                                       |
| Componenti Home | `src/lib/components/library/`: `HomeHeader`, `ReadingNow`, `UpNextQueue`, `GenreShelf`, `ShelfFrame`, `Decoration`, `QueueItemMenu`                       |
| Stato Home      | `home-state.svelte.ts` (`HomeState`: in lettura, coda, scaffali, paginazione), `home-dnd.svelte.ts` (`HomeDnd`: cosa succede al rilascio)                 |
| Primitive libri | `src/lib/components/book/` (`BookCover`, `BookSpine`, `BookCard`, `FormatIcon`), API in `docs/COMPONENTS.md` sezione Book                                 |
| Dorsi           | `src/lib/book/`: `spine.ts` (algoritmo), `palette.ts`, `shelf-layout.ts` (composizione scaffale), `cover-url.ts`                                          |
| Coda            | `src/lib/data/queue-repository.ts`, `src/routes/(app)/api/queue/{add,remove,move}`, `src/lib/client/queue.svelte.ts`, `components/queue/QueueConfirmHost` |
| Paginazione     | `GET /api/library/shelf` (keyset)                                                                                                                         |
| Drag            | `src/lib/actions/drag.ts` (+ `drag.css`)                                                                                                                  |
| Test            | `tests/unit/spines.test.ts`, `shelf-layout.test.ts`, `drag.test.ts`; `tests/e2e/library.spec.ts`                                                          |

## Helper coda per gli altri moduli (`$lib/client/queue.svelte`)

```ts
addToQueue(bookId: string, options?: { genre?: GenreSlug; confirm?: boolean; skipInvalidate?: boolean }):
  Promise<{ status: 'added' | 'alreadyQueued' | 'cancelled'; position: number | null; queue: QueueBook[] }>
removeFromQueue(bookId: string, options?: { skipInvalidate?: boolean }): Promise<QueueBook[]>
moveInQueue(bookId: string, newPosition: number /* 1-based */, options?: { skipInvalidate?: boolean }): Promise<QueueBook[]>
class QueueRequestError extends Error { code: string; status: number }   // lanciata su errori HTTP/rete
const QUEUE_DEPENDENCY = 'app:queue'                                      // da `$lib/client/queue-keys`
```

- `addToQueue` oltre il soft limit (3) mostra da solo il dialog del mockup 04 (testo con N reale, "Aggiungi
  comunque" / "Annulla") e, se confermato, richiama con `force`. Annullando ritorna `status: 'cancelled'`.
  `genre` colora lo slot tratteggiato dell'illustrazione. Il dialog e' `QueueConfirmHost`, montato in
  `src/routes/(app)/+layout.svelte`: funziona da qualunque pagina `(app)`.
- Dopo ogni scrittura chiama `invalidate('app:queue')` (salvo `skipInvalidate`): le pagine che mostrano la
  coda dichiarano `depends('app:queue')` nella loro `load` (la Home lo fa).
- Endpoint (JSON, errori `{ code, message }`): `POST /api/queue/add { bookId, force? }` ->
  `{ status, currentCount, position, queue }`; `POST /api/queue/remove { bookId }` e
  `POST /api/queue/move { bookId, newPosition }` -> `{ queue }`.

## Home

- Header, "In lettura" (cover `lg` 104x156 frontali, candela e pianta, LED rosa, card progresso; ogni card e'
  un link a `/book/<id>#progress`), "I prossimi 3" (cover 72x108 con badge 1/2/3, slot "Trascina qui", tazza,
  titoli a 2 righe), 7 scaffali per genere nell'ordine della spec (plancia = link a `/genre/<slug>`).
- Scaffale: libri con stato in testa (in lettura sempre di fronte con badge "In lettura"; il primo "Prossimo"
  di fronte, gli altri dorsi con badge sopra), gli altri sono dorsi (8% "evidenziati" di fronte, senza
  immagine reale), una decorazione dopo il 2°-5° elemento e al piu' un libro appoggiato prima della
  decorazione. I dorsi non scaricano mai immagini.
- Paginazione keyset: quando la coda dello scaffale entra in vista (IntersectionObserver) `HomeState.loadMore`
  chiama `/api/library/shelf`. `getHome` non espone il cursore: la prima volta si chiede l'inizio con un limite
  maggiore e si scartano i doppioni.
- Desktop (>=1024px): "In lettura" e "I prossimi" affiancati, scaffali a tutta larghezza (max `--content-max`).
- Oltre i 3 libri in coda: pill "N libri", gli elementi dopo il terzo sono leggermente attenuati.

## Drag & drop (`$lib/actions/drag`)

Pointer Events (nessun HTML5 DnD). Touch/penna: pressione lunga 400 ms senza muoversi oltre 8 px, altrimenti
e' scroll; dopo il lift lo scroll e' bloccato (`touchmove` non passivo). Mouse: parte oltre i 8 px.

```ts
use:draggable={{ data, ghost?(container) => cleanup, onstart?, ondrop?(target, data), onend?({ dropped }), longPressMs?, slop?, disabled? }}
use:dropzone={{ data?, accepts?(payload) => boolean, onhover?(active, payload) }}
// helper puri: exceedsSlop, edgeScrollDelta, ghostOrigin, findZone
```

Ghost (cover ruotata -5deg, scala 1.16, ombra), cerchio del dito (solo touch), auto-scroll verticale ai bordi
del viewport e orizzontale ai bordi dello scaffale (`[data-shelf-scroller]`), Esc/pointercancel annullano, il
click dopo il drag e' soppresso, `prefers-reduced-motion` azzera le transizioni (regole globali di `app.css`).

Azioni al rilascio (`HomeDnd`): su uno scaffale genere -> `PATCH /api/books/<id>/genre` (endpoint di B2,
aggiornamento ottimistico con rollback); sulla plancia/area "I prossimi" -> `addToQueue`; su un altro libro
dei prossimi -> `moveInQueue`.

Alternative accessibili: bottone "..." su ogni libro dei prossimi -> sheet "Sposta su / Sposta giu / Rimuovi
dai prossimi"; "Sposta" nel dettaglio libro (B2).

## Note

- Le dimensioni dei dorsi, i pattern e l'inchiostro sono deterministici (`id|titolo|autore|genere`); l'inchiostro
  e' scelto sul colore reale del tema built-in attivo (`palette.ts`).
- `coverStoragePath` -> `/api/covers/<path>`: se B6 sceglie un altro prefisso basta cambiare `cover-url.ts`.
