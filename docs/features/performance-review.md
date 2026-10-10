# Analisi delle ottimizzazioni del sito

Data: 8 ottobre 2026. Le sezioni 1–8 conservano la revisione iniziale e i risultati dell'implementazione. La sezione 9 documenta le successive correzioni, le nuove misure controllate e le verifiche finali; i limiti indicati nella valutazione iniziale descrivono quel momento, non lo stato attuale dei test.

**Stato aggiornato:** completate le verifiche locali e le correzioni sostenute dalle misure. La suite browser di produzione finale ha superato tutti i 150 casi applicabili in un'unica esecuzione. Il rendering progressivo riduce dell'81–88% il candidato INP di laboratorio nelle interazioni provate con 1.000 libri. Questo risultato non certifica i Core Web Vitals del sito pubblico, che non è stato distribuito durante il lavoro.

## Valutazione iniziale

Il lavoro ha prodotto benefici misurabili nella quantità di dati richiesta dal profilo e nel JavaScript caricato per la sua panoramica. Ha inoltre corretto problemi funzionali del precache, dei conteggi, della paginazione e della gestione di operazioni concorrenti.

**L'implementazione del piano è completa, ma il miglioramento della velocità percepita dell'intero sito non è dimostrato.** Il benchmark registra un LCP superiore alla baseline in 13 dei 16 casi a cache fredda senza service worker. Questo è il principale risultato da approfondire: non va nascosto dietro la riduzione dei byte, né attribuito automaticamente a una singola modifica.

Le verifiche funzionali sono numerose e hanno individuato errori reali, poi corretti. La copertura browser finale è però ricostruita da più esecuzioni e ripetizioni mirate: manca un'unica esecuzione completa finale con tutti i casi applicabili superati insieme.

La configurazione di compressione è stata verificata localmente attraverso un proxy isolato. Non è stato effettuato un deployment del sito pubblico, quindi il suo beneficio effettivo sul traffico di produzione resta da misurare.

## 1. Come sono stati misurati i risultati

Il benchmark confronta due build di produzione tramite preview locale:

- Otto route: libreria, profilo, citazioni, Esplora, ricerca, impostazioni, amici e un genere.
- Viewport 390×844 e 1280×800.
- Service worker consentito oppure bloccato.
- Cache fredda e calda.
- Cinque campioni per combinazione: 64 combinazioni e 320 visite per build, 640 complessive.
- Account temporaneo con 12 libri, senza citazioni o copertine personalizzate.

I file contengono tutti i campioni previsti e nessuna misura LCP o HTML pari a zero. Il confronto usa la mediana dei cinque campioni, mantenendo separate le condizioni.

La scelta della build di produzione in preview segue le indicazioni di [SvelteKit sulle verifiche prestazionali](https://svelte.dev/docs/kit/performance#Diagnosing-issues). Il preview esclude però Traefik: i risultati applicativi e quelli della compressione sono due verifiche distinte.

### Cosa significano le metriche

| Metrica         | Significato e limite                                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTML            | Dimensione del documento decodificato dal browser, non dimensione compressa sulla rete.                                                                               |
| JavaScript      | Somma delle dimensioni decodificate delle risorse `.js` osservate nella pagina prima della rilevazione; non misura il tempo CPU impiegato a eseguirle.                |
| Byte trasferiti | Somma delle informazioni di trasferimento esposte dal browser per navigazione e risorse. Cache e limitazioni delle risorse esterne possono influire sul valore.       |
| Richieste       | Numero di voci delle risorse osservate, che può includere caricamenti dalla cache; non equivale sempre al numero di richieste HTTP effettivamente arrivate al server. |
| TTFB            | Tempo fra avvio della richiesta e primo byte della risposta.                                                                                                          |
| LCP             | Tempo di visualizzazione del contenuto principale, osservato fino al punto di rilevazione dopo `networkidle`.                                                         |
| Nodi DOM        | Numero degli elementi presenti nel documento al momento della rilevazione.                                                                                            |

Le distinzioni fra byte decodificati, trasferiti e risorse osservate sono descritte in [MDN: PerformanceResourceTiming](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming).

### Limiti dell'esperimento

Il browser gira sulla macchina locale, senza limitazioni controllate di CPU o rete. La baseline ha condiviso parte delle risorse con altri controlli. Cinque campioni e una mediana riducono l'influenza di singoli valori anomali, ma non rendono le due sessioni perfettamente equivalenti e non dimostrano una relazione causale fra ciascuna modifica e ciascun tempo.

La baseline contiene già la correzione del precache: questo confronto non misura il beneficio di quella correzione rispetto alla configurazione PWA precedente.

Lo script esegue navigazioni complete e ricaricamenti, non misura tutti i passaggi interni dell'app. Non registra INP, CLS, utilizzo della memoria o tempo di esecuzione JavaScript. Non può quindi certificare reattività, stabilità visiva o consumo di memoria dell'intero sito.

I Core Web Vitals comprendono LCP, INP e CLS; la loro valutazione sul campo considera il 75° percentile, separando mobile e desktop. Le mediane locali qui riportate non sostituiscono quella valutazione. Fonte: [Google: Web Vitals](https://web.dev/articles/vitals).

## 2. Benefici quantitativi dimostrati

### Profilo: meno dati e meno JavaScript

Cache fredda, service worker bloccato. Le mediane dei byte sono uguali nei due viewport:

| Metrica                     | Prima     | Dopo      | Variazione |
| --------------------------- | --------- | --------- | ---------- |
| HTML                        | 106,3 KiB | 97,8 KiB  | −8,0%      |
| JavaScript della pagina     | 342,6 KiB | 309,2 KiB | −9,7%      |
| Byte trasferiti complessivi | 238,3 KiB | 227,8 KiB | −4,4%      |
| Risorse osservate           | 61        | 62        | +1         |

La panoramica carica meno codice perché statistiche, ruota, calendario e libri abbandonati vengono importati quando si apre la relativa scheda. La load universale attende il componente selezionato, conservando il rendering sul server. Questo segue il principio di [caricamento selettivo documentato da SvelteKit](https://svelte.dev/docs/kit/performance#Reducing-code-size-Selective-loading).

Le verifiche SSR confermano il contenuto delle schede nella risposta HTML. La riduzione dei byte è osservabile anche con service worker attivo; il miglioramento dei tempi non è invece uniforme fra le diverse condizioni di cache.

### Database: nuovo riepilogo del profilo

Il test dedicato utilizza 5.000 libri e 601 citazioni, con cinque campioni per chiamata:

| Misura                            | Vecchia Home, limite 100 libri | Nuovo riepilogo del profilo |
| --------------------------------- | ------------------------------ | --------------------------- |
| JSON restituito                   | 41.952 byte                    | 2.299 byte                  |
| Mediana della chiamata RPC locale | 41,90 ms                       | 29,50 ms                    |

La riduzione del JSON è **94,5%**. Le due risposte hanno contratti diversi: il nuovo riepilogo conserva i conteggi globali e restituisce soltanto le anteprime necessarie, invece dei dettagli di 100 libri. Il risultato non significa che il sito sia diventato il 94,5% più veloce.

Il dato sui tempi riguarda la chiamata RPC locale completa nel test, non il caricamento di una pagina e non la latenza di produzione. Le query SQL rappresentative di generi e citazioni impiegano 2,321 ms e 0,627 ms dopo `ANALYZE`. Questi ultimi valori riguardano due query semplificate, non l'intero endpoint o tutte le istruzioni delle RPC.

Non sono stati introdotti indici senza un beneficio misurato. La scelta è proporzionata al campione disponibile; per carichi diversi occorre esaminare i piani delle query effettive.

## 3. Risultati meno favorevoli

### JavaScript e risorse sulle altre pagine

Cache fredda, service worker bloccato; valori uguali nei due viewport:

| Pagina       | JavaScript prima → dopo, KiB | Risorse prima → dopo             |
| ------------ | ---------------------------- | -------------------------------- |
| Libreria     | 362,4 → 363,4                | 58 → 59                          |
| Citazioni    | 286,9 → 289,7                | 57 → 60                          |
| Esplora      | 374,9 → 376,0                | 96 → 97 mobile; 99 → 100 desktop |
| Ricerca      | 354,9 → 356,0                | 60 → 61                          |
| Impostazioni | 308,5 → 309,6                | 60 → 61                          |
| Amici        | 289,8 → 290,7                | 59 → 60                          |
| Generi       | 320,3 → 324,0                | 55 → 58                          |

L'aumento di JavaScript è circa 0,3–1,2%. Le nuove funzioni condivise e i controlli di paginazione introducono codice e risorse aggiuntive. È un costo contenuto, ma reale: il caricamento iniziale di queste pagine non è diventato più leggero nel campione misurato.

Il numero di nodi DOM non diminuisce nel campione con 12 libri: per esempio, la libreria passa da 1.825 a 1.830 elementi. La paginazione limita invece i risultati su raccolte grandi, verificate con test distinti; non è corretto dedurre dal piccolo benchmark una riduzione generale del lavoro di rendering.

### LCP: risultato da approfondire

Fra le 16 combinazioni di pagina e viewport a cache fredda senza service worker, la mediana LCP peggiora in 13, migliora in 2 e resta uguale in 1.

| Pagina    | Mobile prima → dopo | Desktop prima → dopo |
| --------- | ------------------- | -------------------- |
| Libreria  | 192 → 272 ms        | 196 → 312 ms         |
| Profilo   | 172 → 220 ms        | 240 → 208 ms         |
| Citazioni | 120 → 152 ms        | 140 → 172 ms         |
| Esplora   | 1.032 → 1.100 ms    | 188 → 252 ms         |

Nella libreria l'aumento è di 80 ms su mobile e 116 ms su desktop. È una regressione osservata nell'esperimento, non una prova che gli utenti reali abbiano lo stesso rallentamento. La causa non è stata isolata: non si può attribuirla con certezza ai font, al nuovo modulo condiviso, al carico della macchina o ad altri fattori.

Serve una traccia del caricamento che identifichi l'elemento LCP e separi attesa della risposta, download delle risorse e ritardo di rendering. Riferimenti: [Google: Largest Contentful Paint](https://web.dev/articles/lcp) e [SvelteKit: strumenti di diagnosi](https://svelte.dev/docs/kit/performance#Diagnosing-issues).

## 4. Valutazione delle singole modifiche

| Area              | Valutazione sostenuta dalle verifiche                                                                                                                                                     | Costo o limite                                                                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dati mirati       | Profilo e coda evitano risposte generiche sovradimensionate. I conteggi coprono l'intera libreria; Esplora riconosce anche i libri oltre i vecchi limiti.                                 | Aggregazioni, contesto dei libri posseduti e raccolte complete di una scheda possono ancora crescere con la libreria. Payload ridotto non significa lavoro SQL costante.                    |
| Paginazione       | Citazioni a 30 elementi e generi a 40 per sezione. Test su totali completi, ordinamento deterministico, pagine indipendenti, filtri e navigazione indietro.                               | Nuovi controlli aumentano leggermente il codice iniziale. Manca un confronto dei tempi browser prima/dopo su raccolte grandi.                                                               |
| Copertine WebP    | Varianti private a 128, 320 e 768 px; originale conservato, immagini piccole non ingrandite. Test su decoding, accesso per proprietario, richieste concorrenti e cancellazione.           | Generare tre varianti richiede CPU, spazio e tempo durante l'upload; le immagini preesistenti hanno un costo di generazione alla prima richiesta. Mancano misure su fotografie realistiche. |
| JavaScript e font | Import dinamici delle schede del profilo e preload limitato ai due font latini principali. Beneficio quantitativo dimostrato sul JavaScript del profilo.                                  | Non è stato isolato il contributo dei font; non è dimostrato un miglioramento complessivo del rendering iniziale.                                                                           |
| Invalidazione     | Dipendenze mirate e raggruppamento delle notifiche; test sulla concorrenza e funzionamento offline. Evita di richiedere indiscriminatamente tutte le load attive.                         | Non è stato misurato il numero di chiamate risparmiate nei flussi interattivi rispetto alla versione precedente.                                                                            |
| PWA               | Eliminati duplicati manuali e revisioni basate sull'orologio; pagina offline prerenderizzata. Verificati attivazione, precache, ricaricamento offline e sincronizzazione senza duplicati. | Il precache completo resta consistente: la build finale registra 157 elementi e 2.163,70 KiB secondo Workbox. Non è una misura del traffico compresso effettivo dell'installazione.         |
| Compressione      | Configurazione Traefik verificata con 2.11 e 3.6, includendo risposte piccole, contenuti già compressi e streaming.                                                                       | Test su fixture isolate; nessuna misura delle risposte del sito pubblico aggiornato.                                                                                                        |

La scelta di comprimere nel reverse proxy segue la [documentazione ufficiale di adapter-node](https://svelte.dev/docs/kit/adapter-node#Compressing-responses). Il test conferma l'arrivo del primo blocco prima della fine dello streaming, ma non quantifica il risparmio dell'intero sito.

La configurazione delle immagini usa `withoutEnlargement`, coerentemente con [Sharp: resize](https://sharp.pixelplumbing.com/api-resize/). Il limite di due trasformazioni simultanee è locale al processo; non coordina eventuali repliche diverse dell'app.

La paginazione usa `LIMIT/OFFSET` con un ordinamento deterministico. PostgreSQL precisa che le righe saltate da `OFFSET` devono comunque essere calcolate. È quindi sensato misurare le pagine profonde prima di valutare altre strategie, senza introdurre una migrazione a cursori per principio. Fonte: [PostgreSQL 17: LIMIT e OFFSET](https://www.postgresql.org/docs/17/queries-limit.html).

## 5. Qualità del codice e problemi corretti

Le modifiche rispettano l'architettura esistente: repository lato server, validazione dei contratti, componenti separati dall'accesso al database e migration additive. Non aggiungono servizi esterni o nuove dipendenze. I componenti continuano a usare i token del tema.

La review e le ripetizioni hanno individuato due condizioni di concorrenza:

1. **Notifica persa nell'invalidazione.** Una nuova richiesta poteva arrivare dopo la fine del ciclo ma prima della chiusura della promessa. Il finalizzatore ora attende anche quel gruppo successivo. Il test unitario riproduce l'intervallo, oltre ai casi di notifiche simultanee, richiesta in corso ed errore.
2. **Preferenze sovrascritte nell'interfaccia.** Due salvataggi ravvicinati potevano restituire lo stato completo in un ordine sfavorevole. I gruppi movimento e scaffali sono ora disabilitati durante il salvataggio. Il test browser trattiene una risposta e verifica la persistenza di entrambe le scelte dopo il reload.

È stata inoltre applicata una migration correttiva per utilizzare `added_at` nell'attività della coda. Entrambe le migration `213` e `214` sono necessarie per l'app aggiornata.

Questi interventi migliorano la correttezza e l'affidabilità. Il blocco temporaneo delle preferenze, in particolare, serializza le operazioni: non è un'ottimizzazione della velocità del salvataggio.

## 6. Verifiche effettuate e copertura reale

| Verifica                            | Risultato disponibile                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Tipi e componenti                   | `npm run check`: 0 errori e 0 warning.                                                                      |
| Suite Vitest                        | 518 superati, 86 saltati nella configurazione standard.                                                     |
| Contratti dedicati database/storage | 19 superati; fixture con 5.000 libri, 601 citazioni e utenti separati.                                      |
| Browser di produzione               | 146 casi distinti verificati attraverso esecuzioni complete, ripetizioni e due nuovi casi delle preferenze. |
| Ultima ripetizione browser mirata   | 40/40 superati su impostazioni, PWA, paginazione e profilo dopo l'ultima correzione.                        |
| Recensioni in sviluppo              | 8/8 superati su mobile e desktop.                                                                           |
| Build di produzione                 | Completata dopo le correzioni applicative.                                                                  |
| ESLint applicativo e colori         | Codice applicativo, test, script e configurazioni controllati; controllo colori superato.                   |
| Compressione isolata                | Verificata con Traefik 2.11 e 3.6.                                                                          |
| Controllo visivo                    | Screenshot dei generi controllati a 390×844 e 1280×800.                                                     |

I numeri delle diverse righe non vanno sommati: alcuni test sono presenti in più esecuzioni e i 40 browser mirati ripetono parte dei casi già contati.

L'ultima esecuzione completa di produzione registrata contiene **143 superati, 1 fallito e 14 saltati**. Il caso fallito, legato a un selettore di test non aggiornato, è stato corretto e superato nella ripetizione. Sono poi state verificate le correzioni applicative con esecuzioni mirate, inclusi i due nuovi casi delle preferenze. Questo sostiene la copertura dichiarata, ma non equivale a una singola esecuzione completa finale verde.

Le 14 esclusioni di produzione comprendono 8 test della route di sviluppo, successivamente eseguiti con successo, 2 test che richiedono il bridge SBN e 4 esclusioni legate al dispositivo. Gli 86 test saltati dalla suite Vitest standard non vanno interpretati come test superati; i contratti dedicati sono stati eseguiti separatamente e coprono soltanto il relativo sottoinsieme.

Il lint globale non è verde: sono stati rilevati problemi di formattazione preesistenti in 352 file e due errori `no-useless-escape` in un file della baseline tecnica archiviata. Le verifiche applicative separate sono passate. Non è corretto descrivere l'intero repository come privo di problemi di lint.

## 7. Verifiche successive, in ordine di priorità

| Priorità    | Attività                                                                                                                       | Motivo e risultato atteso                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Alta        | Ripetere il confronto LCP in condizioni controllate e acquisire tracce delle pagine peggiorate, iniziando dalla libreria.      | Identificare l'elemento LCP e il ritardo effettivo prima di modificare font, preload o caricamento dei moduli.                               |
| Alta        | Eseguire tutta la suite browser applicabile in un'unica esecuzione sulla versione finale.                                      | Consolidare le verifiche aggregate e documentare esplicitamente gli eventuali prerequisiti mancanti.                                         |
| Media       | Misurare INP e CLS nei flussi di ricerca, navigazione, cambio scheda e aggiornamento delle letture.                            | Valutare reattività e stabilità visiva, che il benchmark attuale non registra.                                                               |
| Media       | Ripetere le misure browser con raccolte grandi e copertine reali, includendo upload e prima lettura di una cover preesistente. | Quantificare beneficio della paginazione, dimensioni delle immagini, costo di generazione e tempi d'interazione.                             |
| Media       | Misurare query e risposte complete dei flussi più costosi, comprese pagine profonde e contesto Esplora su librerie grandi.     | Distinguere costo di aggregazione, accesso ai dati, costruzione del JSON e trasferimento.                                                    |
| Al rilascio | Applicare le migration prima della nuova app e verificare compressione e streaming lungo il percorso reale di produzione.      | Confermare che la configurazione del proxy raggiunga il sito e che il vantaggio osservato sulla fixture si traduca nelle risposte effettive. |
| Bassa       | Gestire separatamente il debito di formattazione e lint preesistente.                                                          | Rendere il controllo globale utilizzabile senza confondere interventi di stile e modifiche prestazionali.                                    |

Queste sono raccomandazioni della revisione, non attività già eseguite. Non emerge dai dati un motivo per introdurre nuovi servizi di cache, aggiornare automaticamente le dipendenze o aggiungere indici senza ulteriori misure.

## 8. Riferimenti del progetto e riproducibilità

- [Descrizione dell'implementazione, contratti e fonti](performance.md).
- [Script del benchmark](../../scripts/performance-audit.mjs) e [confronto delle mediane](../../scripts/compare-performance.mjs).
- [Contratti database e misurazione RPC](../../tests/contracts/performance.contracts.test.ts).
- [Test browser della paginazione e del profilo](../../tests/e2e/performance.spec.ts).
- [Test impostazioni e offline](../../tests/e2e/offline-settings.spec.ts).
- [Load dati del profilo](<../../src/routes/(app)/profile/profile-load.server.ts>) e [import dei componenti](../../src/lib/profile/load-components.ts).
- [Generazione delle copertine](../../src/lib/server/storage/variants.ts) e [raggruppamento delle invalidazioni](../../src/lib/client/refresh-data.ts).

Gli artefatti locali in `.tempo/performance/` sono ignorati dal versionamento. Il file [comparison.md](../../.tempo/performance/comparison.md) contiene tutte le 16 righe a cache fredda senza service worker; `comparison.json` conserva tutte le 64 combinazioni. `baseline.json` e `optimized.json` contengono i 640 campioni grezzi; `db-read-models.json` contiene tempi RPC e piani SQL. I log delle suite, della build e dei controlli statici sono nella stessa directory.

Se si condivide questo report tramite il repository, i dati grezzi vanno conservati o allegati separatamente: i collegamenti agli artefatti ignorati funzionano nel workspace locale, ma non garantiscono che quei file siano presenti in un altro checkout.

La consultazione delle fonti ha tenuto conto di SvelteKit 2.70.3 e Sharp 0.35.5 presenti nel progetto. La documentazione SvelteKit corrente e i risultati Context7 includono riferimenti alla versione 3; sono stati usati per verificare i principi di misura e caricamento selettivo, senza proporre API della nuova versione o migrazioni automatiche.

## 9. Verifiche successive e stato finale

### Correzioni basate sulle evidenze

- **Font:** l'import Young Serif usa ora `400.css`, con i corretti `unicode-range`. Gli import separati dei subset assegnavano a entrambi l'intero intervallo Unicode. Nelle visite italiane senza service worker vengono richiesti due font invece di tre; i caratteri estesi continuano a caricare il subset necessario. Verificato su mobile e desktop, secondo [Fontsource: subset](https://fontsource.org/docs/getting-started/subsets).
- **Rendering della libreria:** ricerca e ordinamento considerano tutti i dati, mentre ciascuno scaffale mostra gruppi di 24 risultati. La griglia carica il gruppo successivo quando entra nell'area osservata; la lista offre un pulsante accessibile. Una risposta asincrona non azzera più il gruppo già aperto: il reset dipende da filtro, ordine e modalità di visualizzazione. È rendering progressivo, non virtualizzazione: il DOM può crescere continuando a scorrere. La gestione delle dipendenze segue [Svelte: effect](https://svelte.dev/docs/svelte/$effect).
- **Precisione del cursore:** il binding della data del cursore preserva i microsecondi tramite `text` e conversione PostgreSQL, evitando la conversione attraverso `Date` che li troncava. Il difetto poteva escludere libri con la stessa data di creazione, anche con ricerca completa. Il contratto controlla due pagine distinte con timestamp `.123456`. Fonti: [Postgres.js: serializzazione](https://github.com/porsager/postgres/blob/master/src/types.js) e [PostgreSQL 17: precisione temporale](https://www.postgresql.org/docs/17/datatype-datetime.html).
- **Stabilità del dettaglio:** tre schede scheletro grandi diventavano una piccola riga quando mancavano informazioni pubbliche, spostando la recensione. Il caricamento usa ora una riga compatta con altezza minima condivisa con lo stato vuoto. La correzione segue [Google: ridurre CLS](https://web.dev/articles/optimize-cls); la misura riguarda questo caso preciso, non ogni possibile risposta ricca dei cataloghi.

La revisione finale ha controllato anche risposte ritardate, paginazione completa, isolamento delle copertine, validazione dei percorsi di pulizia e ripristino dopo le mutazioni. I problemi riprodotti sono stati corretti; non sono stati introdotti indici, cache o dipendenze senza un beneficio dimostrato.

### Condizioni e confronti controllati

Il nuovo [benchmark controllato](../../scripts/performance-controlled.mjs) usa build di produzione, service worker bloccato, CPU rallentata 4 volte, latenza 40 ms e banda 200.000 byte/s in download e 100.000 in upload. I viewport sono 390×844 e 1280×800; cache fredda e ripetizione calda sono separate. Le comparazioni verificano condizioni, numero dei campioni e corrispondenza delle iterazioni tramite [lo script di confronto](../../scripts/compare-controlled-performance.mjs).

Il confronto dei font usa cinque campioni per condizione su libreria e profilo: 40 visite per versione, con 12 libri. **LCP non migliora uniformemente:** nella libreria mobile fredda passa da 952 a 1.004 ms, desktop fredda da 1.128 a 1.048 ms; nelle altre condizioni ci sono miglioramenti e peggioramenti. Questi risultati non cancellano le regressioni della prima analisi e non provano un'accelerazione generale del sito. Il caricamento di un font in meno è invece verificato direttamente. Fonti metodologiche: [Google: LCP](https://web.dev/articles/optimize-lcp), [INP](https://web.dev/articles/inp) e [CLS](https://web.dev/articles/cls).

Per il rendering si usano tre campioni per condizione, 1.000 libri, 601 citazioni e una copertina reale condivisa. Il confronto è fra rendering completo e rendering progressivo, entrambi con font e cursore già corretti: **non è la versione originaria con il cursore difettoso**. Ogni ricerca aspetta tutti i 112 risultati attesi; il primo smoke test che non li raggiungeva è escluso dal confronto.

| Viewport e cache | Candidato INP prima → dopo | Durata del flusso prima → dopo |
| ---------------- | -------------------------- | ------------------------------ |
| Mobile fredda    | 4.552 → 888 ms             | 18.321 → 4.601 ms              |
| Mobile calda     | 6.200 → 752 ms             | 20.529 → 5.028 ms              |
| Desktop fredda   | 4.576 → 648 ms             | 18.611 → 5.105 ms              |
| Desktop calda    | 5.208 → 752 ms             | 19.511 → 6.080 ms              |

Le mediane indicano una riduzione dell'81–88% del candidato INP e del 69–75% della durata del flusso ricerca/lista/griglia. LCP a freddo resta sostanzialmente invariato: 908 → 912 ms mobile e 956 → 972 ms desktop. Le durate derivano da Event Timing raggruppato per interazione: sono **candidati INP di laboratorio, non INP sul campo**. Il tempo complessivo dei task oltre 50 ms raccolto dallo script non è il TBT di Lighthouse. Una misura assente resta `null`, non viene trattata come zero.

Il candidato INP residuo di 648–888 ms sotto CPU 4× resta elevato. Una traccia diagnostica trova prevalentemente ritardo di presentazione, con processing di circa 1–12 ms e presentazione di 456–799 ms per le interazioni peggiori della libreria. Non basta a identificare un ulteriore intervento preciso da applicare senza misure aggiuntive.

### Dettaglio, ricerca e raccolte grandi

Nel dettaglio senza informazioni pubbliche, tre campioni per condizione mostrano CLS a cache calda da **0,129 a 0 su mobile** e da **0,048 a 0 su desktop**. A freddo il risultato finale è circa 0,00017 mobile e 0,034 desktop. I candidati INP finali del salvataggio avanzamento sono 144–304 ms.

La ricerca ISBN/titolo provata registra candidati di 48–72 ms e una sola chiamata API per ciascun flusso digitazione più Invio. La risposta del catalogo è simulata e vuota: questa verifica controlla il client, **non la latenza dei fornitori**. Inoltre l'intercettazione Playwright disabilita la cache HTTP: qui “calda” indica la ripetizione della navigazione, non una prova della cache delle risposte HTTP.

Lo smoke test delle altre pagine con raccolta grande ha esercitato profilo, citazioni, genere, impostazioni, Esplora e amici. Una visita mobile fredda a Esplora ha registrato LCP di circa 7,4 secondi, contro circa 1 secondo desktop: è un singolo campione esposto alla variabilità dei fornitori e non dimostra una causa o una regressione generale.

La fixture contiene tutti i libri nello stesso genere, metà letti e metà non letti, senza cronologia delle letture completate. Le 601 citazioni appartengono a un solo libro. Queste scelte stressano conteggi e paginazione, ma non rappresentano tutte le distribuzioni reali.

### Copertine e compressione dell'app

Una copertina pubblica reale, scaricata una volta tramite [Open Library Covers API](https://openlibrary.org/dev/docs/api/covers), pesa 50.473 byte. Le varianti WebP pesano 5.170 byte a 128 px, 23.088 a 320 px e 40.640 a 768 px. Upload e analisi iniziale richiedono circa 331 ms; la prima generazione della variante preesistente a 320 px circa 59 ms. Sono singole misure locali. La stessa immagine è condivisa dai 1.000 libri: **non sono state provate 1.000 foto diverse o fotografie da diversi megabyte**.

Lo [script di compressione](../../scripts/verify-compression.mjs) verifica ora anche l'app vera dietro un proxy locale isolato, oltre alla fixture. Con Traefik 2.11, HTML 231.058 → 24.819 byte e JSON 5.534 → 776 byte; Traefik 3.6 conferma circa gli stessi risparmi. Verificati JavaScript gzip, `Vary`, copertina privata WebP non ricompressa e accesso anonimo negato. Il primo chunk della fixture arriva in circa 29 ms, prima del secondo dopo 800 ms.

Questa prova **non attraversa il deployment pubblico**, TLS o eventuali ulteriori intermediari. Lo streaming verificato è quello della fixture controllata: non certifica ancora il timing dei dati bibliografici differiti lungo il percorso pubblico dell'app. Fonti: [Traefik 2.11 Compress](https://doc.traefik.io/traefik/v2.11/middlewares/http/compress/) e [configurazione corrente](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/compress/).

### RPC complete e pagine profonde

Cinque campioni con 5.000 libri e 601 citazioni, senza il benchmark browser contemporaneo. Tempi mediani della chiamata completa, inclusi trasporto locale e costruzione/lettura JSON; non sono tempi puri di esecuzione SQL.

| Chiamata                          | Mediana  | JSON         |
| --------------------------------- | -------- | ------------ |
| Home precedente                   | 66,89 ms | 41.952 byte  |
| Nuovo riepilogo                   | 14,89 ms | 2.297 byte   |
| Contesto completo Esplora         | 54,06 ms | 447.842 byte |
| Genere, prima pagina              | 43,01 ms | 33.133 byte  |
| Genere, pagina 63 letti/non letti | 32,63 ms | 16.732 byte  |
| Citazioni, prima pagina           | 15,06 ms | 9.799 byte   |
| Citazioni, pagina 21              | 22,58 ms | 464 byte     |

La pagina finale ha meno elementi: non è un confronto a payload uguale con la prima. Il contesto Esplora resta proporzionale al numero dei libri per riconoscere tutti i titoli posseduti. I piani SQL separati sono rappresentativi e più semplici delle RPC complete; non giustificano nuovi indici da soli. Vedi [PostgreSQL: EXPLAIN](https://www.postgresql.org/docs/17/using-explain.html).

### Verifiche finali e riproducibilità

| Controllo finale                               | Risultato                                      |
| ---------------------------------------------- | ---------------------------------------------- |
| Build di produzione                            | Completata; precache 157 risorse, 2.164,21 KiB |
| `npm run check`                                | 0 errori, 0 warning                            |
| Vitest completo                                | 518 superati, 87 esclusi                       |
| Contratti database/storage dedicati            | 20 superati                                    |
| Playwright produzione, unica esecuzione finale | 150 superati, 14 esclusi, 7,9 minuti           |
| Playwright recensioni in sviluppo, senza retry | 8 superati su mobile/desktop, 50,8 secondi     |
| ESLint applicazione/test/script e colori       | Superati                                       |
| Compressione con app reale locale              | Superata con Traefik 2.11 e 3.6                |

I 14 casi browser esclusi comprendono 8 test della route di sviluppo, 2 test con bridge SBN non configurato e 4 casi specifici del dispositivo. Le 87 esclusioni Vitest dipendono dalla configurazione/prerequisiti; la suite dedicata ne verifica un sottoinsieme con database attivo. Questi numeri appartengono a suite diverse e non vanno sommati come casi unici.

La prima suite completa di questo approfondimento aveva 149 successi e un errore nell'aspettativa del nuovo test desktop: la griglia aveva già caricato il secondo gruppo, mostrando 48 risultati invece di 24. Corretto il test per ammettere quel prefetch previsto, è stata ripetuta **l'intera suite** con l'esito sopra. La regressione per risposta HTTP ritardata verifica che i 48 risultati aperti non tornino a 24 quando arrivano altri dati.

La prima esecuzione delle recensioni in sviluppo ha incontrato due timeout nella registrazione iniziale, poi superati al retry. Il log non identifica con certezza la causa. A server già avviato è stata ripetuta l'intera suite con `E2E_MODE=dev` e `--retries=0`: tutti gli 8 casi sono passati. Il risultato finale non dipende dai retry; l'instabilità della prima esecuzione resta documentata in `e2e-dev-followup.log`.

Il lint globale mantiene il debito preesistente descritto nella sezione iniziale. Non è stata riformattata l'intera base di codice. Sono stati controllati gli screenshot mobile/desktop delle modifiche nello stile corrente; non costituisce una nuova certificazione visiva di ogni pagina contro tutti i mockup.

Esempi PowerShell, con database locale già migrato e preview di produzione attivo sulla porta 4173:

```powershell
$env:PERFORMANCE_BOOKS='1000'
$env:PERFORMANCE_SAMPLES='3'
$env:PERFORMANCE_ROUTES='/library'
$env:PERFORMANCE_INTERACTIONS='1'
$env:PERFORMANCE_COVER='.tempo/performance/real-cover.jpg'
node scripts/performance-controlled.mjs nuova-misura

$env:COMPRESS_APP_ORIGIN='http://localhost:4173'
$env:COMPRESS_COVER='.tempo/performance/real-cover.jpg'
node scripts/verify-compression.mjs

$env:RUN_DB_CONTRACT_TESTS='1'
npx vitest run tests/contracts/performance.contracts.test.ts tests/contracts/storage.contracts.test.ts
```

Lo script di confronto richiede due etichette con condizioni identiche: `node scripts/compare-controlled-performance.mjs prima dopo`. Non usare comandi di reset del database condiviso. Gli script creano account propri e ne eliminano dati e copertine alla fine.

Artefatti locali principali: `controlled-before.json`, `controlled-after.json`, `large-render-before.json`, `large-render-after.json`, `large-render-before-comparison.json`, `controlled-interactions-final.json`, `controlled-interactions-comparison.json`, `controlled-shift-diagnosis.json`, `db-read-models.json` e i log `*-followup.log` in `.tempo/performance/`. Questi file sono ignorati dal versionamento e vanno allegati separatamente per condividere i dati grezzi.

Le verifiche locali richieste sono completate. Restano fuori dalle conclusioni la misurazione sul campo dei Core Web Vitals, la conferma della compressione/streaming sul sito pubblico, copertine numerose e pesanti e risposte bibliografiche ricche. Non viene dichiarata una velocità ottimale per l'intero sito: il beneficio più solido osservato riguarda le interazioni della libreria grande e i payload ridotti.
