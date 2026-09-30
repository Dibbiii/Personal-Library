# Aggiunta libri, catalogo esterno e cover

Tre modi per aggiungere un libro (MASTER_SPEC sez. 18-20): scanner ISBN, ricerca titolo/autore,
inserimento manuale. In ogni flusso l'utente conferma sempre genere, formato, serie e numero volume
nello sheet `AddBookConfirmSheet`; poi si apre `/book/<id>`.

## Route e componenti

| Route         | Contenuto                                                                              |
| ------------- | -------------------------------------------------------------------------------------- |
| `/add`        | scelta dei tre modi                                                                    |
| `/add/scan`   | `ISBNScanner` + lookup per ISBN (`?` nessun parametro)                                 |
| `/add/search` | `BookSearch` (input con debounce 400 ms), accetta `?q=`; un ISBN digitato fa un lookup |
| `/add/manual` | `ManualBookForm` (funziona senza API esterne), accetta `?title=` e `?isbn=`            |

Componenti in `src/lib/components/catalog/`: `BookSearch`, `BookSearchResult`, `ISBNScanner`,
`AddBookConfirmSheet`, `ManualBookForm`, `CoverPicker`, `CoverImage` (cover con placeholder locale).

### ISBNScanner

`BarcodeDetector` se supporta `ean_13`, altrimenti `@zxing/library` con `import()` dinamico (chunk
separato, mai nel bundle iniziale). Solo contesto sicuro (HTTPS o localhost); altrimenti, o con
permesso negato, nessuna fotocamera, errore: messaggio chiaro e alternative (ISBN digitato, ricerca,
manuale). Torcia se la traccia la espone. Lo stream viene fermato: allo smontaggio, con la scheda
nascosta (`visibilitychange`), su `pagehide`, dopo una lettura. Un codice EAN che non è un ISBN
(prefisso diverso da 978/979 o checksum errato) non viene accettato. Istruzioni testuali e live region.

### CoverPicker

```svelte
<CoverPicker
  bookId={string}
  cover={{ coverUrl: string | null; coverStoragePath: string | null }}
  onchanged={() => void}
  bind:open        <!-- opzionale: apertura controllata dal chiamante -->
  showTrigger={true} <!-- opzionale: false se l'apertura è del chiamante -->
/>
```

Bottom sheet "Cambia copertina": cover attuale, upload da galleria o fotocamera (le foto oltre 5 MB
sono ridimensionate nel browser), cover alternative dei provider, "Rimuovi cover personalizzata".
Dopo ogni modifica chiama `onchanged` e `invalidateAll()`.

Helper per mostrare una cover rispettando la precedenza **custom > provider > placeholder**:
`coverSrc(cover)` in `$lib/catalog/covers` (restituisce `/api/covers/<coverStoragePath>`, l'URL del
provider o `null` = placeholder).

## Endpoint (tutti richiedono la sessione; errori `{ code, message, field? }`)

| Metodo e path                                          | Descrizione                                                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `GET /api/catalog/search?title=&author=&language=`     | fino a 5 candidati (`catalogSearchResponseSchema`: contratto + `degraded` + `providers`)         |
| `GET /api/catalog/isbn?isbn=`                          | candidati per ISBN + `exactMatch` (true = preselezionabile)                                      |
| `POST /api/library/add` (JSON)                         | `{ status: 'added', bookId }` (201) oppure `{ status: 'duplicate', exact, existing }` (200)      |
| `POST /api/covers/upload` (multipart `bookId`, `file`) | cover personalizzata: png/jpeg/webp, max 5 MB, tipo dai magic bytes                              |
| `POST /api/covers/select` (JSON)                       | `{action:'provider', bookId, coverUrl}` o `{action:'remove-custom', bookId}`                     |
| `GET /api/covers/alternatives?bookId=`                 | cover dei provider per ISBN e titolo/autore di quel libro                                        |
| `GET /api/covers/<coverStoragePath>`                   | serve la cover dell'utente (`Cache-Control: private`, `nosniff`); path altrui o malformati = 404 |

Rate limit in memoria per utente (ricerca 40/min, aggiunta 20/min, cover 15/min) -> 429 con `Retry-After`.
Mappa errori: AUTH_REQUIRED 401, NOT_FOUND 404, CONFLICT 409, VALIDATION 422 (413/415 per i file),
RATE_LIMITED 429, NETWORK/CONTRACT 502, SERVER 500.

## Provider e cache (`src/lib/server/catalog`, logica pura in `src/lib/catalog`)

Interfaccia `BookProvider { id; search(); lookupIsbn() }`. Implementazioni reali: `OpenLibraryProvider`
(`search.json` con `editions.*`, `/isbn/<isbn>.json`, cover `covers.openlibrary.org`) e
`GoogleBooksProvider` (`volumes?q=isbn:` / `intitle+inauthor`, chiave opzionale
`GOOGLE_BOOKS_API_KEY`, solo server). Nessun accesso ai provider dal browser; `fetchJson` accetta
solo HTTPS verso host in allow-list, con timeout 7 s (`AbortSignal`), errori mappati in
`DataAccessError` (`NETWORK`, `RATE_LIMITED`, ...). Se un provider è giù l'altro continua
(`degraded: true`); se sono tutti giù la richiesta fallisce con `NETWORK`/`RATE_LIMITED`.
Google Books senza chiave ha una quota anonima condivisa molto bassa: va spesso in 429, che è gestito.

Ranking (`ranking.ts`): ISBN esatto (precedenza assoluta) > titolo > autore > lingua (preferenza, mai
filtro) > cover > pagine/editore/data. **Titolo + autore non bastano a fondere due edizioni**:
`dedupeCandidates` unisce solo con ISBN-13/10 o id provider in comune. La preselezione automatica
(`exactMatch`) avviene solo con ISBN identico; il risultato è limitato a 5 candidati.

Cache (`TtlCache`, LRU in memoria di processo, niente Redis): ricerca 12 h, ISBN positivo 30 giorni,
ISBN senza risultati 15 min, risposte degradate 60 s. Richieste concorrenti identiche condividono
una sola chiamata.

## Scrittura nel database

`ServerCatalogRepository` (`src/lib/data/catalog-repository.ts`, registrato in `repositories.ts`):
`search`, `lookupIsbn` (interfaccia `CatalogRepository`) più `searchDetailed`, `lookupIsbnDetailed`,
`addBook`, `listCoverAlternatives`, `selectProviderCover`, `setCustomCover`, `removeCustomCover`.
I metodi di scrittura ricevono l'id utente della sessione. Nessuna migration: l'aggiunta usa
`upsertCatalogEdition` (unica scrittura del catalogo) e un INSERT su `public.user_books` con le
colonne ammesse dalla migration 006; le cover aggiornano `cover_url` / `cover_storage_path`
(UPDATE di colonna già concesso). Duplicati: stesso ISBN o stessa edizione = duplicato esatto (si
apre il libro esistente); stesso titolo e autore (senza distinzione di maiuscole) = avviso con
"Aggiungi comunque".

Un candidato arriva dal browser e viene rivalidato (Zod, checksum ISBN, host cover in allow-list); i
campi servono solo a popolare il catalogo, che l'app legge ma non mostra ad altri utenti.

## Variabili d'ambiente

- `GOOGLE_BOOKS_API_KEY` (opzionale, solo server).
- `STORAGE_DIR` per i file caricati.
- Produzione con `adapter-node`: il corpo delle richieste è limitato a 512 kB di default; per
  l'upload delle cover impostare `BODY_SIZE_LIMIT=6M`.

## Test

- Unit: `tests/unit/catalog-*.test.ts` (ISBN, ranking/merge, cache TTL, provider con fixture in
  `tests/fixtures/catalog/`, service, schemi). `npx vitest run tests/unit/catalog`.
- E2E: `tests/e2e/add-book.spec.ts` (provider simulati con `page.route`; crea e rimuove un utente di
  prova `b6-e2e-*@test.local`; richiede un server e il DB; `E2E_BASE_URL` indica il server).
