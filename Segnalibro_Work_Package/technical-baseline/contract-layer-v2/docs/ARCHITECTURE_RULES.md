# Segnalibro — Frontend architecture rules

## Dipendenze ammesse

```text
Svelte component
      |
      v
Repository interface
      |
      v
RPC / Server endpoint
      |
      v
PostgreSQL / external provider
```

Un componente non deve:

- importare direttamente il client Supabase;
- conoscere nomi di tabelle;
- conoscere nomi di RPC;
- assemblare query SQL/PostgREST;
- hardcodare colori;
- reinterpretare una response non validata.

## Domain vs transport

I contratti in `src/lib/contracts` sono il boundary.

Il database può restituire internamente `snake_case`, ma una RPC/read-model deve
esporre `camelCase`.

Per questo è preferibile costruire già il JSON corretto dentro PostgreSQL,
anziché spargere mapping in decine di componenti.

## Error handling

Il repository normalizza gli errori in:

- `AUTH_REQUIRED`
- `NOT_FOUND`
- `CONFLICT`
- `VALIDATION`
- `RATE_LIMITED`
- `NETWORK`
- `SERVER`
- `CONTRACT`

La UI reagisce al codice; non deve fare parsing delle stringhe Postgres.

## Offline progress

La outbox IndexedDB memorizza almeno:

```ts
{
  eventId: UUID,
  readingId: UUID,
  page: number,
  occurredAt: ISO timestamp,
  localDate: YYYY-MM-DD,
  operation: "progress" | "correction" | "finish"
}
```

`eventId` viene creato prima del primo tentativo di rete e non cambia nei retry.

## bigint

Gli ID catalogo (`works`, `editions`, `authors`) vengono esposti come stringhe.
Gli UUID user-owned restano UUID string.

Non usare `Number(bigintId)` nel frontend.

## null vs undefined

Response server:
- campo presente e senza valore => `null`;
- array vuoto => `[]`.

Input client:
- un campo opzionale non specificato può essere `undefined`.

Questa regola riduce molti bug di rendering e serializzazione.

## Theme

Color literals sono ammessi soltanto nei file di definizione tema.

Nei componenti:

```css
color: var(--color-text-primary);
background: var(--color-surface);
```

Nel contesto genere:

```css
color: var(--genre-current-on);
background: var(--genre-current);
```

Mai `#hex`, `rgb()`, `hsl()` o nomi colore nei componenti/routes.
