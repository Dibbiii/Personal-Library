# Segnalibro — RPC/API contract v1

Queste regole fanno parte dell'API. Il database può cambiare internamente senza
obbligare la UI a cambiare finché questi contratti restano compatibili.

## Regole generali

1. Ogni read-model e mutation response ha `contractVersion: 1`.
2. Le chiavi JSON esposte alla UI sono `camelCase`.
3. PostgreSQL può continuare a usare `snake_case`.
4. UUID = string UUID.
5. ID `bigint` del catalogo = **stringa** al boundary JSON.
6. `timestamptz` = ISO-8601 completo di timezone.
7. Le date locali del calendario = `YYYY-MM-DD`.
8. Un campo conosciuto ma assente viene restituito come `null`, non omesso.
9. Le collezioni vuote sono `[]`, mai `null`.
10. La UI non riceve righe raw del database: riceve read-model stabili.
11. Il frontend valida ogni response con Zod.
12. Un fallimento di validazione è un errore `CONTRACT`, non viene ignorato.

---

## `get_library_home`

```ts
{
  contractVersion: 1,

  currentlyReading: [
    {
      book: BookSummary,
      reading: {
        id,
        currentPage,
        totalPages,
        progressPercent,
        startedAt,
        paused
      }
    }
  ],

  queue: [
    {
      position,
      addedAt,
      book: BookSummary
    }
  ],

  shelves: [
    {
      genre: GenreRef,
      totalCount,
      hasMore,
      books: BookSummary[]
    }
  ]
}
```

La Home deve essere caricabile con una sola RPC.

---

## `get_shelf_page`

Usa keyset pagination.

Input:

```ts
{
  genre,
  cursor?: {
    createdAt,
    id
  },
  limit
}
```

Output:

```ts
{
  contractVersion: 1,
  data: {
    genre,
    books,
    hasMore,
    nextCursor
  }
}
```

`nextCursor` è `null` alla fine dello scaffale.

---

## `get_genre_view`

Output:

```ts
{
  contractVersion: 1,

  genre,

  counts: {
    total,
    read,
    unread
  },

  sort: {
    field,
    direction
  },

  sections: [
    {
      key: "read",
      count,
      books
    },
    {
      key: "unread",
      count,
      books
    }
  ]
}
```

L'ordinamento agisce dentro le sezioni, mai tra le sezioni.

---

## `get_book_detail`

```ts
{
  contractVersion: 1,

  book: BookSummary,

  queuePosition: number | null,
  currentReading: Reading | null,

  readings: ReadingHistoryItem[],

  review: Review | null,
  quotes: Quote[]
}
```

`completedReadingsCount >= 1` è la condizione di dominio per permettere una review.

---

## Progress events

`record_progress`, `correct_progress` e `finish_reading` ricevono un
`eventId` generato dal client.

Questo ID è l'idempotency key per retry/offline sync.

Una correzione può produrre `pageDelta < 0`; non significa "lettura negativa":
serve a correggere il conteggio aggregato precedentemente registrato.

---

## Cover

`BookSummary.cover` contiene:

```ts
{
  coverUrl: string | null,
  coverStoragePath: string | null
}
```

Precedenza:

1. `coverStoragePath` — custom cover dell'utente.
2. `coverUrl` — provider esterno.
3. placeholder locale.

La UI non deve confondere uno Storage path con un URL pubblico.

---

## Theme

Il DB memorizza solo la selezione tema e, per i custom theme, token validati.
Nessun componente può memorizzare o hardcodare colori.

```ts
ThemeDefinition
  -> CSS semantic tokens
  -> contextual genre tokens
  -> components
```

Un tema custom non contiene CSS arbitrario.

---

## Queue mutations

`queue_add` models the soft limit explicitly instead of throwing an error:

```ts
{
  contractVersion: 1,
  status: 'added' | 'alreadyQueued' | 'requiresConfirmation',
  currentCount: number,
  position: number | null,
  queue: QueueBook[]
}
```

If `status === 'requiresConfirmation'`, the UI asks the user for confirmation
and repeats the operation with `force = true`.

`queue_remove` and `queue_move` return:

```ts
{
  contractVersion: 1,
  queue: QueueBook[]
}
```

so the client can replace its local queue atomically after every mutation.

---

## Reading mutation response

`start_reading`, `pause_reading`, `resume_reading`, `record_progress`,
`correct_progress`, `finish_reading`, `mark_dnf` and `add_completed_reading`
all converge on one response:

```ts
{
  contractVersion: 1,
  reading: Reading,
  duplicate: boolean
}
```

`record_progress`, `correct_progress`, `finish_reading` and `mark_dnf` accept a
client-generated `eventId`. This makes every terminal/progress action safe to
retry after an offline or ambiguous network failure.

---

## `change_book_genre`

```ts
{
  contractVersion: 1,
  book: BookSummary,
  reviewScoresReset: boolean
}
```

If a reviewed book changes genre, genre-specific scores are removed while the
overall rating, adjectives, tags and quotes remain.

---

## `save_review`

```ts
{
  contractVersion: 1,
  review: Review
}
```

The database validates the book is already completed, the three adjectives are
non-empty/distinct, all rating dimensions belong to the book genre, and all tag
IDs are valid. The write is atomic.

---

## Bingo

`get_bingo_board(year)` and `assign_bingo_book(cellId, bookId)` return the same
`BingoBoardResponse` contract. A board is valid only when it has exactly 16
cells. Assignment only accepts books with at least one completed reading.

---

## Theme selection

`get_theme_selection()` and `set_theme_selection(...)` return:

```ts
{
  contractVersion: 1,
  selection:
    | { kind: 'builtin', key: string }
    | { kind: 'custom', id: UUID }
}
```

Built-in theme definitions remain in source code; the database stores only the
selection.
