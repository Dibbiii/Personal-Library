# Prestazioni del sito

Per i risultati aggiornati delle verifiche finali e i limiti delle misure, vedere la [sezione 9 della revisione prestazionale](performance-review.md#9-verifiche-successive-e-stato-finale). I numeri della prima verifica riportati sotto restano una fotografia storica.

## Implementazione

Le ottimizzazioni mantengono SSR, isolamento per utente e funzionamento offline. Non introducono servizi o dipendenze aggiuntive.

| Area               | Comportamento                                                                                                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PWA                | Manifest di precache generato dal plugin, senza duplicati manuali o revisioni basate sull'orologio. `/offline` è prerenderizzata senza attraversare le pagine private. Scanner e asset necessari offline restano disponibili.    |
| Compressione       | Middleware Traefik gzip per le risposte oltre 1.024 byte. Esclusi eventi, immagini e font già compressi. Nessuna compressione aggiunta al processo Node.                                                                         |
| Profilo            | Conteggi globali dal database e anteprime limitate: 5 preferiti, 3 libri per raccolta, 4 attività nella panoramica e 30 nella scheda attività. Calendario, citazioni, ruota e DNF sono richiesti solo dalle schede che li usano. |
| Esplora            | Tutti i titoli posseduti, con soli ID/titolo/autore, per evitare suggerimenti duplicati oltre il precedente limite dello scaffale. Due generi preferiti calcolati su tutta la libreria.                                          |
| Dettaglio e generi | La coda restituisce gli ID invece dell'intera Home. Le informazioni dei cataloghi nel dettaglio continuano a essere trasmesse in streaming.                                                                                      |
| Citazioni          | 30 elementi per pagina; conteggio e filtro libri completi, anche oltre 500 citazioni.                                                                                                                                            |
| Generi             | 40 elementi per ciascuna sezione. Paginazione indipendente di letti/da leggere, totali completi e ordine deterministico con ID come discriminante finale.                                                                        |
| Copertine          | Originale conservato; WebP a 128, 320 e 768 px, senza ingrandire immagini piccole. `srcset`/`sizes`, spazio riservato e caricamento differito mantenuti.                                                                         |
| JavaScript/font    | Import dinamico delle schede secondarie del profilo nella load universale, attendendo il componente per SSR. Preload dei soli due font WOFF2 latini principali; le altre varianti restano disponibili nel CSS.                   |
| Aggiornamenti      | Dipendenze `app:*` e invalidazioni mirate per letture, copertine e Bingo. Notifiche simultanee raggruppate; il ritorno in foreground dopo 30 secondi aggiorna anche account/impostazioni/amici.                                  |

## Contratti e URL

`RpcPerformanceRepository` espone `getProfileSummary(collections, activityLimit)`, `getProfileDnf()`, `getQueueSummary()`, `getDiscoveryContext()`, `getQuotesPage(page, bookId)` e `getGenrePages(input)`. Tutte le risposte sono validate dai contratti Zod in `src/lib/contracts/performance.ts`.

Le migration additive `213_performance_read_models.sql` e `214_profile_queue_activity.sql` vanno applicate entrambe prima di avviare l'app aggiornata. La seconda definisce l'attività della coda usando `added_at`. Le RPC precedenti restano disponibili per la compatibilità. Le nuove funzioni richiedono l'identità corrente, filtrano per utente e non concedono esecuzione al ruolo pubblico. PostgreSQL deve avere ICU per la collazione italiana numerica `private.it_numeric`.

- `/profile?tab=overview|stats|activity|wheel|calendar|dnf` (anche `/profile/[year]`).
- `/quotes?page=2&book=<uuid>`: cambiare libro azzera la pagina; il filtro include tutti i libri con citazioni.
- `/genre/[slug]?readPage=2&unreadPage=3&unreadSort=title|author|pages|date`: ogni sezione conserva pagina e ordine dell'altra. I parametri `sort`/`dir` continuano a ordinare i letti. Cambiare un ordine azzera solo la pagina corrispondente.
- Le pagine oltre l'ultima vengono redirette alla pagina valida; URL e navigazione indietro mantengono lo stato.
- `/api/covers/<path>?w=128|320|768`: autenticazione e proprietà come per l'originale; larghezze non ammesse restituiscono 404. Cache privata e immutabile, nessuna cache pubblica delle immagini personali.

## Copertine e concorrenza

Le nuove immagini generano le tre varianti prima di completare il salvataggio. Le immagini preesistenti generano una variante alla prima richiesta, senza migrazione dei percorsi nel database. Il limite resta 5 MiB e il decoder accetta fino a 40 milioni di pixel. File con firma valida ma contenuto non decodificabile vengono rifiutati.

Due trasformazioni al massimo possono lavorare contemporaneamente nel processo; richieste della stessa variante condividono il lavoro. I file vengono pubblicati con rinomina atomica. Eliminare una cover/account aspetta i lavori pendenti e rimuove anche i derivati. Se una variante preesistente non è generabile, l'interfaccia riprova l'originale e poi il placeholder. La coda è locale al processo: più repliche possono generare lo stesso derivato, mantenendo la scrittura atomica.

## Verifiche ripetibili

Le prove usano account temporanei eliminati alla fine, senza modificare i dati demo. Gli artefatti locali sono in `.tempo/performance/` e non fanno parte del codice distribuito.

- `npm run check`, `npm run lint:colors`, `npm test`, build di produzione.
- `RUN_DB_CONTRACT_TESTS=1 npx vitest run tests/contracts/performance.contracts.test.ts tests/contracts/storage.contracts.test.ts` (impostare la variabile con la sintassi della propria shell): 5.000 libri, 601 citazioni, isolamento fra utenti, conteggi/pagine/ordinamento, decoding e cancellazione cover. Non usare lo script che ricrea il database condiviso.
- `npx playwright test --workers=2`: suite mobile e desktop sulla build di produzione. I test riservati alle route di sviluppo o al bridge SBN assente vengono saltati esplicitamente.
- `node scripts/verify-compression.mjs`: proxy isolato; `TRAEFIK_TEST_IMAGE=traefik:v2.11` oppure `traefik:v3.6`. Controlla HTML, JSON, risposta piccola, immagine, contenuto già compresso, eventi e arrivo del primo blocco prima della fine dello streaming. Usa e rimuove solo il proprio container temporaneo.
- `node scripts/performance-audit.mjs baseline` prima delle ottimizzazioni applicative; stesso comando con `optimized` dopo. La baseline contiene già la correzione del precache PWA. Otto route, due viewport, service worker abilitato/bloccato, cache fredda/calda, cinque campioni: 320 visite per build. TTFB, LCP osservato fino a networkidle, byte HTML/JS/trasferiti, richieste e nodi DOM. `node scripts/compare-performance.mjs` verifica completezza e condizioni dei due campioni, quindi produce mediane in `comparison.json` e `comparison.md`.

Il benchmark è Chromium locale senza limitazione di CPU o rete, con 12 libri, e non misura i Core Web Vitals degli utenti reali. Il preview non passa dal proxy di produzione: la compressione è verificata separatamente. Tempi e LCP dipendono dal carico della macchina; la prova iniziale ha condiviso parte delle risorse con altri controlli. I byte del payload sono più affidabili per valutare la riduzione dei dati. Il precache completo resta intenzionalmente disponibile per l'offline.

Il test database registra cinque campioni e `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` dopo `ANALYZE` delle tabelle della fixture. Il riepilogo del profilo occupa circa 2,3 KB contro 42 KB della precedente Home a 100 libri (circa −94,5%). Sul campione locale le query rappresentative per generi e citazioni impiegano circa 2,3 ms e 0,6 ms: non sono stati aggiunti indici speculativi.

## Esiti delle verifiche

Il confronto finale contiene 320 visite per ciascuna build, tutte le 64 combinazioni previste e cinque campioni validi per combinazione. Gli artefatti completi sono `.tempo/performance/baseline.json`, `optimized.json`, `comparison.json` e `comparison.md`.

Per il profilo, con cache fredda e service worker bloccato, le mediane dei byte sono uguali nei due viewport:

| Metrica                     | Prima     | Dopo      | Variazione |
| --------------------------- | --------- | --------- | ---------- |
| HTML                        | 106,3 KiB | 97,8 KiB  | −8,0%      |
| JavaScript iniziale         | 342,6 KiB | 309,2 KiB | −9,7%      |
| Byte trasferiti complessivi | 238,3 KiB | 227,8 KiB | −4,4%      |
| Richieste di risorse        | 61        | 62        | +1         |

Nelle altre pagine il JavaScript aumenta di circa 0,3–1,2%, con una richiesta aggiuntiva per il modulo condiviso e tre per le pagine con i nuovi controlli di paginazione. Il campione con 12 libri e nessuna citazione non rappresenta la riduzione ottenuta paginando raccolte grandi, verificata separatamente dai contratti e dai test browser.

L'LCP locale non migliora uniformemente: nel profilo passa da 172 a 220 ms su mobile e da 240 a 208 ms su desktop; nella libreria passa da 192 a 272 ms e da 196 a 312 ms. Queste misure non dimostrano un'accelerazione generale del caricamento visibile. Le riduzioni di payload e JavaScript sono invece direttamente osservabili. La compressione del proxy resta esclusa dal confronto preview e il precache completo resta disponibile per l'offline.

| Controllo                                               | Esito                                                                                                                             |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Tipi e componenti (`npm run check`)                     | 0 errori, 0 warning                                                                                                               |
| Test Vitest completi                                    | 518 superati; 86 esclusi per prerequisiti/configurazione                                                                          |
| Contratti database e storage dedicati                   | 19 superati, con fixture isolate                                                                                                  |
| Browser produzione                                      | 146 casi verificati su mobile e desktop nelle esecuzioni complete e nelle ripetizioni dopo le correzioni; 14 esclusioni esplicite |
| Ultima ripetizione impostazioni/PWA/paginazione/profilo | 40 su 40 superati sulla build finale, compresa la risposta HTTP rallentata                                                        |
| Recensioni nella route di sviluppo                      | 8 su 8 superati su mobile e desktop, eseguiti separatamente con `E2E_MODE=dev`                                                    |
| Build di produzione                                     | Completata                                                                                                                        |
| Colori (`npm run lint:colors`)                          | Superato                                                                                                                          |
| ESLint codice applicativo, test e script                | Superato                                                                                                                          |
| Compressione isolata                                    | Superata con Traefik 2.11 e 3.6; streaming mantenuto                                                                              |

Le esclusioni browser di produzione comprendono 8 casi della route di sviluppo, 2 che richiedono il bridge SBN non configurato e 4 interazioni specifiche del dispositivo. Gli screenshot dei generi sono stati controllati a 390×844 e 1280×800.

Il comando globale `npm run lint` non è verde: il repository contiene problemi di formattazione preesistenti in 352 file; la scansione ESLint globale trova inoltre due `no-useless-escape` in un file della baseline tecnica archiviata. I file modificati vengono controllati separatamente, senza riformattare il repository o alterare l'archivio.

## Fonti ufficiali e compatibilità

Verificato con Svelte 5.57.1, SvelteKit 2.70.3, Vite 8.3.1, adapter-node 5.5.7, Sharp 0.35.5 e PostgreSQL 17 già installati. La documentazione corrente di SvelteKit include anche API della versione 3: l'implementazione usa e verifica i tipi delle API disponibili nella versione 2 del progetto.

- [SvelteKit: compressione tramite reverse proxy](https://svelte.dev/docs/kit/adapter-node#Compressing-responses).
- [Traefik 2.11: middleware Compress](https://doc.traefik.io/traefik/v2.11/middlewares/http/compress/) e [documentazione corrente](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/compress/).
- [SvelteKit: load universali, dati e invalidazione](https://svelte.dev/docs/kit/load), [navigazione](https://svelte.dev/docs/kit/$app-navigation), [prestazioni](https://svelte.dev/docs/kit/performance) e [preload dei link](https://svelte.dev/docs/kit/link-options).
- [Svelte: URLSearchParams reattivi](https://svelte.dev/docs/svelte/svelte-reactivity#SvelteURLSearchParams).
- [Workbox: precaching](https://developer.chrome.com/docs/workbox/modules/workbox-precaching) e [Vite PWA: SvelteKit](https://vite-pwa-org.netlify.app/frameworks/sveltekit).
- [Sharp: resize e withoutEnlargement](https://sharp.pixelplumbing.com/api-resize/) e [MDN: img, srcset, sizes e caricamento](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img).
- [PostgreSQL 17: LIMIT/OFFSET](https://www.postgresql.org/docs/17/queries-limit.html), [EXPLAIN](https://www.postgresql.org/docs/17/using-explain.html) e [collazioni ICU](https://www.postgresql.org/docs/17/collation.html).

I test di Esplora e calendario usano account e letture temporanei, evitando dipendenze dalle credenziali del demo. Il test multipart consente un solo ritentativo del trasporto dopo `ECONNRESET` (nessun ritentativo degli errori HTTP), come previsto da [Playwright APIRequestContext](https://playwright.dev/docs/api/class-apirequestcontext#api-request-context-post-option-max-retries).

La code review ha riprodotto e corretto una notifica persa fra la fine del ciclo di invalidazione e la chiusura della promessa. Il finalizzatore attende anche l'eventuale gruppo successivo; un test controlla specificamente quell'intervallo, oltre alle notifiche simultanee, durante un caricamento e dopo un errore. Il comportamento di attesa è documentato in [Promise.finally](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/finally).

La verifica ripetuta ha inoltre individuato una race nelle preferenze: la risposta completa di un salvataggio poteva sovrascrivere la scelta ottimistica di un altro. Movimento e modalità scaffali vengono ora disabilitati insieme solo durante il salvataggio, con ripristino anche dopo un errore. Il test browser trattiene una risposta HTTP e verifica che entrambe le scelte successive persistano dopo il reload; il blocco usa il comportamento nativo di [fieldset disabled](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/fieldset#disabled).

La configurazione proxy è pronta e testata localmente; non è stato effettuato un deployment del sito pubblico.

## Approfondimento finale: font, libreria e dettaglio

Young Serif usa l'import `400.css` con intervalli Unicode, così i subset vengono richiesti in base ai caratteri effettivi. La libreria ricerca e ordina sull'intera raccolta, ma rende gruppi di 24 libri: osservatore nella griglia e pulsante nella lista. Il limite visibile si azzera al cambio di filtro/ordine/vista, non all'arrivo di altri dati. Non è virtualizzazione e il numero dei nodi può crescere scorrendo.

Il binding RPC del timestamp del cursore usa `text::timestamptz` per conservare i microsecondi che la serializzazione attraverso `Date` troncava. Un contratto controlla pagine distinte con data `.123456`. Il caricamento delle informazioni pubbliche del libro usa un segnaposto compatto con altezza minima condivisa con lo stato vuoto, evitando il collasso delle vecchie schede scheletro quando mancano dati.

Gli script `performance-controlled.mjs` e `compare-controlled-performance.mjs` misurano condizioni CPU/rete fissate e confrontano campioni equivalenti. `verify-compression.mjs`, con `COMPRESS_APP_ORIGIN`, verifica anche HTML/JavaScript/JSON/copertine dell'app reale dietro il proxy locale. Metodologia, risultati, fonti ufficiali, comandi PowerShell e limitazioni sono nel report collegato sopra. Non sono state aggiunte dipendenze o migration per questo approfondimento.
