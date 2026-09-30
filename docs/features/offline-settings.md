# Offline, PWA, Impostazioni, privacy (agente B7)

Spec: MASTER_SPEC §9 (offline), §21 (temi), §36 (`/settings`), §41 (privacy), §42 (foreground), §46 (PWA).

## Outbox offline

`$lib/offline/outbox.ts` (browser). Il database resta la source of truth: niente optimistic mutation.

```ts
import { submitReadingOp, newEventId, OutboxRejectedError } from '$lib/offline/outbox';

type ReadingOp = {
	eventId: string; // UUID generato dal client (newEventId()), idempotency key
	readingId: string;
	page: number;
	occurredAt: string; // ISO con offset
	localDate: string; // YYYY-MM-DD
	operation: 'progress' | 'correction' | 'finish' | 'dnf';
};

submitReadingOp(op: ReadingOp): Promise<{ status: 'synced'; result: unknown } | { status: 'queued' }>;
```

- L'evento viene **prima scritto in IndexedDB** (`segnalibro-offline`, store `outbox`) e poi inviato con
  `POST /api/reading/event` (B2, idempotente per `eventId`). `result` è il corpo JSON del server
  (`ReadingMutationResult`, con `duplicate`).
- `queued`: offline, errore di rete, timeout (12 s), 5xx, 408/425/429. L'evento resta in coda e riparte da solo.
- `OutboxRejectedError` (con `status`, `code`): il server ha risposto con un 4xx permanente (validazione 422,
  conflitto 409, 404...). L'evento **non** viene accodato: il chiamante mostra l'errore.
- Una coda già presente viene svuotata prima (ordine per `occurredAt`, poi inserimento). Gli eventi di una stessa
  lettura sono inviati in ordine: se uno è in backoff i successivi della stessa lettura aspettano.
- Rimozione dalla coda **solo dopo un ack 2xx JSON** del server. Un redirect al login (`redirect: 'manual'`) o un
  401/403 lasciano la voce in coda (`authRequired`: banner "Accedi di nuovo..."). Un 4xx permanente sposta la voce
  nello store `failed` con il motivo: niente retry infinito, visibile in `/settings#sincronizzazione` (Riprova/Scarta).
- Backoff esponenziale sui 5xx: 2 s, 4 s, 8 s... massimo 5 min, jitter ±20 %.
- Ogni voce ha `userId`: la sync non invia mai eventi di un altro account sullo stesso dispositivo.
- Trigger di sync: evento `online`, `visibilitychange` (ritorno in foreground; se l'app è rimasta in background
  ≥ 30 s si fa anche `invalidateAll()`, spec §42), avvio app, timer del backoff, Background Sync API
  (`registration.sync.register('segnalibro-outbox')`, feature detection; lo script `static/sw-outbox.js` importato dal
  service worker invia con lo stesso schema IndexedDB), messaggi BroadcastChannel dalle altre tab.
- Lock tra tab: Web Locks API (`segnalibro-outbox-flush`), con fallback in-process. Anche se due invii si
  sovrapponessero, l'idempotenza del server evita il doppio conteggio.
- Dopo una sync riuscita: `window` `CustomEvent('segnalibro:synced', { detail: { eventIds, source } })` e, se la
  sync non è quella di `submit`, `invalidateAll()`.
- Store reattivo (runes): `outboxStatus` da `$lib/offline/outbox` (`pending`, `failed`, `syncing`, `online`,
  `authRequired`, `lastSyncedAt`, `justSynced`, `pendingItems`, `failedItems`).
- Altre funzioni: `syncNow()` ("Riprova ora": azzera il backoff), `retryFailed(eventId)`, `retryAllFailed()`,
  `discardFailed(eventId)`, `startOutbox(userId)` (chiamata da `AppRuntime`), `forgetOutboxUser()` (logout).

Struttura: `core.ts` (logica pura con `OutboxStorage`/`Send`/`OutboxLock` iniettati, testata senza IndexedDB),
`transport.ts` (fetch + classificazione), `idb-storage.ts` (idb), `outbox.ts` (cablaggio browser).

### Montaggio

`src/routes/(app)/+layout.svelte`: un import e `<AppRuntime userId={data.user?.id} />` dopo `AppShell`.
`AppRuntime` avvia la outbox, cattura `beforeinstallprompt`, riallinea le preferenze dal profilo (una volta per
sessione del browser), ripulisce cache/outbox al logout e renderizza `OfflineBanner` (pill discreta: "Offline · 2
aggiornamenti in coda", "Sincronizzo...", "Sincronizzato", "N aggiornamenti non sincronizzati"). Su mobile sta sopra
la barra di navigazione, su desktop in alto a destra.

Hook di test: sotto automazione (`navigator.webdriver`) `window.__segnalibroTest` espone `submitReadingOp`,
`newEventId`, `syncNow` per gli e2e.

## PWA

Config in `vite.config.ts` (generateSW di A1, modifiche additive): `additionalManifestEntries: /offline`,
`importScripts: ['/sw-outbox.js']`, `precacheFallback: { fallbackURL: '/offline' }` sulle navigazioni NetworkFirst.

- `/offline` (`src/routes/offline`, pubblica in `hooks.server.ts`, `csr = false`): pagina di cortesia in italiano,
  precaricata dal service worker; è quella che si vede offline su una pagina mai visitata.
- Pagine già visitate: cache `sb-pages` (NetworkFirst, 4 s). Al logout `AppRuntime` cancella `sb-pages`, la coda
  dell'utente corrente resta nel DB locale ma non viene più inviata (`meta.userId` rimosso).
- Il service worker non esiste in `npm run dev`: i test PWA girano solo su build (`sw.js` presente), altrimenti `skip`.

## Temi

- `RpcThemeRepository` (`src/lib/data/theme-repository.ts`) registrato come `locals.repos.themes`:
  `getSelection`, `setSelection`, `listBuiltins` (dal codice), `listCustom`, `saveCustom`, `deleteCustom`.
  Custom = JSON `{ schemaVersion: 1, colors, genres }` validato da `themeDefinitionSchema` (solo `#RRGGBB`, mai CSS).
- Secondo tema built-in: **Salvia** (`src/lib/themes/salvia.ts`), carta crema e verde salvia profondo, generi del
  tema Segnalibro. Contrasto AA verificato per ogni tema in `tests/unit/settings-export.test.ts`.
- Cambio tema senza reload: `applySelection()` (`$lib/components/settings/preferences.ts`) usa `ThemeController`,
  aggiorna il cookie `sb-theme` e poi salva sul profilo con `PUT /api/settings/theme`; se il salvataggio
  fallisce si torna al tema precedente.
- Tema custom e no-flash: l'SSR non conosce il tema custom (il cookie contiene l'uuid, l'HTML esce con `segnalibro`).
  Le variabili del tema sono copiate in `localStorage['sb-custom-theme']` e riapplicate da uno script inline in
  `app.html` **prima del primo paint** (solo nomi `--color-*`/`--genre-*` e valori `#RRGGBB`). Su un dispositivo
  nuovo, `AppRuntime` le recupera dal profilo (`GET /api/settings`) alla prima apertura: lì un frame con il tema
  predefinito è inevitabile.
- Editor: "Crea tema personalizzato" duplica il tema attivo; 8 colori principali (`<input type=color>`), gli altri
  token derivano (`deriveTheme`), anteprima live isolata, controllo contrasto (AA 4.5) mostrato ma non bloccante.

## Impostazioni (`/settings`)

Account (nome modificabile, email, Esci), Tema, Scaffali (`hybrid | spines | covers`), Movimento
(`system | reduce | full` → `data-motion` su `<html>`, regola CSS in `app.css`), App (installazione con
`beforeinstallprompt`, stato offline), Sincronizzazione (contatori, elementi da controllare), Privacy e dati.

### `getShelfMode()` per la Home

```ts
import { getShelfMode } from '$lib/server/settings';
// in +page.server.ts
const shelfMode = await getShelfMode({ locals, cookies }); // 'hybrid' | 'spines' | 'covers'
```

Legge il profilo dal DB; se il DB non risponde usa il cookie `sb-shelf`, altrimenti `hybrid`. Non lancia mai.
Anche `locals.repos.settings.get()` restituisce `shelfMode`, `motionPreference`, `displayName`, `selection`.

### Database (migration `107_settings_privacy.sql`, additiva)

RPC: `get_user_settings`, `update_user_settings`, `list_custom_themes`, `save_custom_theme`, `delete_custom_theme`,
`export_user_data`. I parametri `jsonb` si passano come **oggetto JS** (con una stringa postgres.js salva una stringa JSON).
Eliminare un tema custom in uso riporta prima al tema built-in salvato.

### Endpoint

| Endpoint                                   | Uso                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `GET/PATCH /api/settings`                  | impostazioni (+ tema custom selezionato); PATCH: nome/scaffali/movimento, copia nei cookie `sb-motion`/`sb-shelf` |
| `PUT /api/settings/theme`                  | salva la selezione e il cookie `sb-theme`                            |
| `GET/POST /api/settings/themes`            | elenco / crea-aggiorna tema custom                                   |
| `DELETE /api/settings/themes/[id]`         | elimina tema custom                                                  |
| `GET /api/export/json`, `/api/export/csv`  | download (`Content-Disposition: attachment`, `no-store`)             |
| `DELETE /api/account`                      | cancellazione account                                                |

Errori `{ code, message }` con status coerente al `DataErrorCode` (`src/lib/server/settings-http.ts`).

## Privacy

- Libreria privata per default: nessuna pagina pubblica.
- Export JSON completo (`format: 'segnalibro-export'`, profilo, preferenze, temi custom, libri con tag, coda, letture,
  eventi di avanzamento, review con punteggi, citazioni, bingo) e CSV dei libri (UTF-8 con BOM, CRLF, protezione
  da formula injection). Non include i file delle cover caricate (solo `hasCustomCover`).
- Cancellazione: serve riscrivere l'email **e** la password (rate limit del login condiviso); poi `deleteAccount(userId)`
  (cascata DB + `deleteUserCovers`), cookie di sessione e preferenze cancellati, cache `sb-pages` e coda locale
  svuotate, redirect a `/auth/login`.

## Test

- `npx vitest run tests/unit/outbox.test.ts tests/unit/settings-export.test.ts`
- `npx playwright test tests/e2e/offline-settings.spec.ts` (con `npm run build && preview`, come da
  `playwright.config.ts`; i test PWA si saltano se non c'è il service worker).
