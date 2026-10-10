# Segnalibro — stato dei lavori

Riepilogo delle funzionalità aggiornato con lo scaffale Saggi.

## Regole fissate dall'utente
- **Supabase vietato, per nessun motivo.** Il database è PostgreSQL 17 in Docker; auth, sessioni e storage dei file sono codice nostro nel server SvelteKit.
- **I mockup si seguono alla lettera.** Dove il mockup contraddice la spec vince il mockup; dove non copre un caso richiesto dalla spec si estende nello stesso stile e lo si dichiara.
- Nessun colore hardcoded fuori da `src/lib/themes/`. Nessun accesso diretto al database dai componenti.

---

## 1. Cosa è stato fatto

### Fase A — fondamenta
- **Scaffold** SvelteKit (Svelte 5, TypeScript strict, Vite, Tailwind 4 solo per layout), `adapter-node`, ESLint/Prettier, Vitest, Playwright.
- **Design system a token**: tema `segnalibro`, variabili CSS generate dal tema, colori per genere, tema senza flash (cookie `sb-theme`), script `lint:colors` che blocca i colori letterali.
- **Font e colori presi dal mockup**: Young Serif + Figtree (non Fraunces/Inter della spec); bordeaux principale `#6C0820` (la spec diceva `#570F1D`, che resta come `primaryDeep`).
- **AppShell**: barra inferiore mobile con pill attiva, sidebar desktop, componenti condivisi (`BottomSheet`, `ConfirmDialog`, `Chip`, `RatingStars`, `Button`, `Card`, ecc.; vedi `docs/COMPONENTS.md`).
- **Auth**: registrazione, login, logout, guard delle route, sessioni nel database (solo lo sha256 del token), password con scrypt, limite ai tentativi di login.
- **Database** (`db/`, `docker-compose.yml`, container `segnalibro-db` sulla 5433): migration 001–007 adattate dal package originale, ruolo applicativo `segnalibro_app` senza privilegi di superutente, RLS forzata su tutte le tabelle utente, runner di migration con checksum, seed demo che riproduce i mockup.
- **Storage cover** su filesystem con controllo di appartenenza e protezione dal path traversal.
- **Riferimento visivo dei mockup** estratto in `docs/mockup/` (misure, checklist, asset SVG, specifica dei dorsi).

### Fase B — funzionalità
| Area | Consegnato |
|---|---|
| Home (`/library`) | In lettura, I prossimi 3 con soft-limit, 8 scaffali con dorsi CSS deterministici (Saggi in verde), paginazione keyset, drag con Pointer Events e alternativa accessibile Su/Giù/Rimuovi |
| Vista genere e dettaglio libro | Ordinamento nell'URL, sheet Sposta, sheet Stato di lettura, aggiornamento pagina con correzioni, finish, DNF, pausa/ripresa, riletture con date, cambio genere con avviso sul reset dei voti |
| Recensione | 3 aggettivi, voto, valutazioni per genere, 27 tag, citazioni (CRUD), autosave, stato bloccato fino alla prima lettura completata |
| Esplora | Ruota della fortuna in SVG con filtri per genere, calendario annuale dai Progress Event reali, marcatore multi-genere |
| Statistiche | Dashboard annuale, Bookish Bingo (assegnazione solo di libri letti), pagina Citazioni, Quote Card in PNG, Cimitero DNF |
| Aggiunta libri | Scanner ISBN (BarcodeDetector con fallback ZXing), ricerca titolo/autore, inserimento manuale, Open Library + Google Books lato server con cache e ranking, cover personalizzata |
| Offline, PWA, Impostazioni | Coda IndexedDB idempotente per gli aggiornamenti di pagina, PWA installabile con pagina offline, selettore temi (nuovo tema Salvia) e editor di temi personalizzati, export JSON/CSV, cancellazione account |

### Correzioni fatte dalla sessione principale (dopo la Fase B)
- Rimosse le dipendenze Supabase, installato `adapter-node`.
- Mappatura degli errori del database sui codici giusti (`CONFLICT`, `VALIDATION`, `NETWORK`).
- Script npm: `db:up`, `db:migrate`, `db:seed`, `db:reset`, `test:contracts` (più suite), `test:contracts:db` (tutta la cartella), `test:e2e:dev`.
- `.env` creato dal file di esempio.
- Corretti 2 errori TypeScript nei test e2e; formattati 4 file.
- `serverEnv`: un valore esplicito in `process.env` ora ha la precedenza su `.env` di SvelteKit (era la causa dei 5 test di storage falliti).
- Il test delle migration ora legge l'elenco dalla cartella `db/migrations` invece di una lista fissa.
- `playwright.config.ts`: `E2E_MODE=dev` usa `vite dev` (serve alle pagine `/dev/*`); il default resta build di produzione (serve alla PWA).

### Ultimo stato verificato
| Controllo | Esito |
|---|---|
| `npm run check` | 0 errori, 0 warning |
| `npm run lint` e `lint:colors` | verdi |
| `npm test` (unit) | 351 passati, 70 saltati (richiedono il database) |
| Test di contratto con database (`tests/contracts`) | 125/125 |
| `npm run build` | riuscita |
| `npm run test:e2e` (build di produzione) | 106 passati, **1 fallito**, 12 saltati, 3 non eseguiti |

---

## 2. Cosa resta da fare

### 2.1 Subito (chiusura Fase B)
1. **Test e2e fallito**: `offline-settings.spec.ts` › "movimento e scaffali si salvano…" (desktop). Il clic sul radio "Misto" non cambia lo stato. Non ancora diagnosticato: il rilancio singolo è stato interrotto. Va capito se è un bug (la preferenza si ripristina dopo il salvataggio) o un problema di timing del test.
2. **12 test saltati e 3 non eseguiti** nella suite e2e: capire quali sono e perché. Quelli di `/dev/review` si saltano in build di produzione e vanno provati con `npm run test:e2e:dev`.
3. **Ingresso alle Impostazioni da mobile**: oggi c'è solo nella sidebar desktop. Proposta: icona account accanto al chip anno nell'header delle Statistiche, così la Home resta identica al mockup. *Decisione tua*, se preferisci un altro punto.
4. **Wrapper provvisorio delle letture**: B7 segnala che `src/lib/client/reading.ts` ha ancora un wrapper diretto sull'endpoint, B2 dice di averlo sostituito con `submitReadingOp`. Da verificare nel codice.
5. **Errori permanenti della coda offline** (`OutboxRejectedError`): verificare che il dettaglio libro mostri il messaggio giusto invece di un errore generico.
6. **Coerenza delle cover custom**: B6 ha verificato che `/api/covers/<path>` coincide con l'URL costruito da B1; controllare a occhio nel browser con una cover caricata.

### 2.2 Fase C — integrazione e rifinitura
7. **Flusso completo** da utente nuovo: registrazione → aggiunta libro → inizio lettura → aggiornamento pagina → fine → recensione → Bingo → Quote Card. Un test e2e unico che attraversa i moduli scritti da agenti diversi.
8. **Revisione visiva** di ogni schermata contro `docs/mockup/CHECKLIST.md` (390px e 1280px), con un agente che non ha scritto quel codice.
9. **Accessibilità**: target touch ≥ 44×44 (oggi sotto: celle del calendario ~32px, stelle delle valutazioni per genere 30×44), focus trap e ESC nei sheet, contrasto AA, `prefers-reduced-motion` e `data-motion` (`Modal.svelte` legge solo la preferenza di sistema).
10. **Prestazioni**: LCP, INP, CLS sulla Home con l'utente demo; il doppio fetch degli scaffali (il contratto non espone il cursore della prima pagina).
11. **Sicurezza**: CSP (servono due script inline in `app.html`), rate limit sugli endpoint di metadata, `BODY_SIZE_LIMIT=6M` in produzione per l'upload delle cover.
12. **Stati vuoti e errori** su tutte le pagine con un utente appena registrato (nessun libro).

### 2.3 Documenti finali richiesti dalla spec
13. `README.md` (oggi è solo il titolo): prerequisiti, installazione, Docker/Postgres, variabili d'ambiente, Open Library e Google Books, avvio, test, migration, PWA, build, deploy, note su fotocamera/HTTPS.
14. `IMPLEMENTATION_REPORT.md`: cosa è completato, deviazioni, test eseguiti, problemi rimasti, chiavi ancora da configurare.
15. `.env.example` completo e aggiornato (oggi manca `BODY_SIZE_LIMIT` in chiaro e le note sui provider).

### 2.4 Dati e versionamento
16. **Seed demo vs. numeri del mockup Statistiche**: il mockup mostra 14 libri nel genere più letto e un autore con 3 libri; il seed ne produce 7 e 2. *Decisione tua*: adeguare il seed (più dati artificiali) o lasciare i numeri realistici.
17. **Streak del seed**: la serie corrente di 23 giorni dipende dalla data; dopo l'ultimo giorno di attività (29 settembre 2026) scende a 0.
18. **Versionamento**: nessun commit fatto. Da proporre: branch GitButler `<nome>/<descrizione>` con commit per area (fondamenta e tema, database e auth, Home, dettaglio e letture, recensione, esplora, statistiche, catalogo, offline e impostazioni, documenti). Nessun push se non lo chiedi.
19. **Pulizia**: cartella `build/` e `test-results/` da ignorare o eliminare; processi di sviluppo degli agenti già fermati.

### 2.5 Miglioramenti noti, non bloccanti
- Card Serie nel dettaglio: i volumi "letti/mancanti" sono dedotti da numero e totale, non da cosa c'è in libreria (servirebbe una funzione del database).
- Streak delle pagine degli anni passati: mostra la serie corrente e il record globali, non quelli dell'anno.
- Cambio genere via drag su un libro recensito: il reset dei voti specifici è segnalato solo dopo, senza conferma preventiva.
- Tema personalizzato su un dispositivo nuovo: un frame con il tema predefinito al primo accesso.
- Google Books risponde 429 senza `GOOGLE_BOOKS_API_KEY`: il fallback su Open Library funziona, ma per risultati completi serve la chiave.
- Il mockup non ha "In pausa" nello sheet dello stato né "Rimuovi dai prossimi" nello sheet Sposta: sono aggiunte nostre nello stesso stile.

---

## 3. Limiti che non si risolvono qui
- **Telefoni reali** (Safari/Chrome mobile): drag con il dito, fotocamera e installazione della PWA si provano solo in emulazione.
- **Scanner con fotocamera vera**: testato con una fotocamera finta; richiede HTTPS o localhost.
- **Open Library**: raggiungibile dal computer di sviluppo; in produzione dipende dalla rete del server.
- **Deploy**: manca la scelta dell'host. Con `adapter-node` serve un ambiente Node/Docker con Postgres; Cloudflare, previsto dalla spec, non è compatibile con questa architettura.

---

## 4. Come riavviare tutto
```bash
docker compose up -d db --wait     # Postgres 17 sulla 5433
cp .env.example .env               # se manca
npm run db:migrate && npm run db:seed
npm run dev                        # http://localhost:5173
# account demo: demo@segnalibro.local / segnalibro-demo
```
Test: `npm run check`, `npm run lint`, `npm test`, `npm run test:contracts:db`, `npm run test:e2e` (build) oppure `npm run test:e2e:dev`.
**Non** lanciare `db:reset` se ci sono altri processi che usano il database.
