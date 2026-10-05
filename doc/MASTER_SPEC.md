# SEGNALIBRO — MASTER IMPLEMENTATION SPECIFICATION
## Documento autoritativo da consegnare a ChatGPT Work

**Versione:** 1.0  
**Lingua UI:** italiano  
**Tipo di prodotto:** web app personale di tracking libri, progettata da subito multiutente  
**Target:** mobile-first PWA, responsive desktop  
**Stato:** specifica pronta per implementazione

---

# 0. Istruzioni per Work

Realizza l'applicazione completa descritta in questo documento.

Questo file è la **source of truth funzionale e architetturale**. Nel package sono presenti anche:

- `mockups/Segnalibro · Mockup scelti.pdf` — riferimento visuale principale;
- `mockups/Segnalibro · Mockup scelti.html` — mockup interattivo/bundle di riferimento;
- `supabase/migrations/001_schema.sql`;
- `supabase/migrations/002_rpc_layer.sql`;
- `supabase/migrations/003_rpc_contract_alignment.sql`;
- `supabase/migrations/004_reference_data.sql`;
- `technical-baseline/contract-layer-v2/` — contratti TypeScript/Zod, repository interfaces e contract test già preparati.

## Regole operative

1. **Non riprogettare il prodotto da zero.** Rispetta i mockup e le decisioni congelate qui.
2. Puoi correggere bug tecnici o incongruenze reali, ma documenta ogni deviazione significativa.
3. Prima di implementare il frontend, fai partire il database locale Supabase ed esegui tutte le migration in ordine.
4. Esegui i contract test presenti nel baseline; se una migration non passa, correggila mantenendo invariato il contratto pubblico salvo bug evidente.
5. Non hardcodare colori nei componenti o nelle route.
6. Non usare Supabase direttamente nei componenti Svelte: passa dal repository/data layer.
7. Non trasformare il progetto in microservizi e non introdurre infrastruttura non richiesta.
8. Mantieni performance e UX mobile come priorità.
9. Verifica su browser reali o emulati almeno Chrome mobile/Safari mobile e desktop.
10. Alla fine consegna un progetto avviabile, migration applicabili, `.env.example`, README di setup, test e istruzioni di deploy.
11. Se servono API key esterne, predisponi variabili ambiente e fallback; non bloccare tutto il progetto in attesa di segreti.
12. Tutto ciò che può essere implementato senza credenziali di produzione deve essere completato.

---

# 1. Visione del prodotto

**Segnalibro** è una libreria e diario di lettura personale.

Non deve sembrare un clone ridotto di Goodreads. La sua identità è:

> una libreria personale digitale, calda e fisica, combinata con un diario di lettura ricco.

La metafora principale è lo **scaffale**.

Ogni genere è uno scaffale orizzontale; gli scaffali sono impilati verticalmente. L'esperienza deve trasmettere la sensazione di guardare la propria libreria, non una tabella di record.

L'app nasce per uso personale, ma deve essere multiutente fin dalla prima migration.

---

# 2. Principi UX

- Mobile-first.
- Interfaccia italiana.
- Libri e autori mantengono titolo/nome originali.
- Tema chiaro, caldo, cozy.
- **Non Dark Academia.**
- Le interazioni devono essere piacevoli ma non decorative al punto da rallentare.
- Lo scrolling orizzontale degli scaffali è nativo.
- Le azioni importanti hanno sempre un'alternativa accessibile al gesture.
- Dati e stato devono restare comprensibili anche senza animazioni.
- Nessuna funzione social in V1.
- Libreria privata per default.

---

# 3. Navigazione primaria

Mobile: bottom navigation fissa con tre voci:

1. **Libreria**
2. **Esplora**
3. **Statistiche**

Desktop: la stessa navigazione diventa una sidebar persistente.

Non aggiungere voci primarie superflue. Impostazioni/account possono vivere in menu secondari.

---

# 4. Home — Libreria

La Home deve seguire il mockup.

## Header

- nome app “Segnalibro”;
- saluto opzionale con display name;
- icona fotocamera/scanner ISBN.

## Sezione “In lettura”

Mostrare tutti i libri attualmente in lettura:

- cover frontale reale;
- titolo;
- autore;
- percentuale;
- `p. X di Y`;
- accesso rapido all'aggiornamento pagina.

## Sezione “I prossimi 3”

Queue separata dalla libreria.

- posizioni 1, 2, 3;
- supporto a più di 3 libri;
- dopo il terzo, il limite è soft;
- visualmente i primi tre sono quelli principali;
- drag oppure riordino accessibile;
- placeholder “Trascina qui” quando utile.

Se l'utente prova ad aggiungere un quarto libro:

> Hai già N libri nelle prossime letture. Vuoi aggiungerlo comunque?

N deve essere il conteggio reale.

## Scaffali per genere

Ordine:

1. Classici
2. Mitologia, Epica e Retelling
3. Distopia e Fantascienza
4. Thriller, Gialli e Mistero
5. Fantasy, Realismo Magico e Gotico
6. Romance, Young Adult e New Adult
7. Narrativa Contemporanea e Storica

Ogni scaffale:

- titolo genere toccabile;
- libri in horizontal scroll;
- leggero bagliore LED nel colore del genere;
- badge “In lettura” / “Prossimo”;
- indicatore formato;
- stelle se recensito.

## Decisione sui dorsi

Usare modalità **ibrida** come default:

- “In lettura” = cover frontali;
- “I prossimi” = cover frontali;
- scaffali normali = prevalentemente **dorsi generati via CSS**;
- se serve evidenziare/sele­zionare un libro, può apparire frontale.

Motivazioni:

- identità visiva più forte;
- Home più simile a una libreria reale;
- evita di scaricare decine/centinaia di cover;
- rende la Home più performante.

Il dorso può derivare deterministicamente da `bookId`, titolo, autore e genere per creare variazioni coerenti di larghezza/decorazione.

L'utente potrà in futuro scegliere `hybrid | spines | covers`; lo schema lo supporta già.

---

# 5. Vista genere

Toccando il nome del genere:

- tema contestuale ricolorato;
- nome genere;
- contatori:
  - libri totali;
  - letti;
  - da leggere;
- ordinamento:
  - Titolo;
  - Autore;
  - Pagine;
  - Voto;
  - Data.

Regola importante:

> “Letti” resta sempre sopra “Da leggere”. L'ordinamento agisce dentro ciascuna sezione.

Griglia di cover con:

- titolo;
- autore;
- pagine;
- stelle, se recensito;
- badge stato quando necessario.

Su desktop usare più colonne, senza perdere la struttura delle sezioni.

---

# 6. Dettaglio libro

Mostrare:

- cover;
- titolo;
- autore;
- chip genere;
- formato;
- pagine;
- stato;
- serie, se presente;
- `Vol. N di M`, se noto;
- posizione queue, se presente.

## Azioni

### Stato di lettura

Bottom sheet con rappresentazione comprensibile di:

- Da leggere;
- In lettura;
- In pausa;
- Letto;
- Letto più di una volta;
- DNF.

Internamente non tutti questi valori sono stati memorizzati: alcuni sono derivati dalle Reading.

### Pulsante “Sposta”

Apre:

- Segna come letto;
- Cambia genere;
- Metti nei prossimi;
- rimuovi dai prossimi, se già presente.

“Cambia genere” mostra i 7 generi con pallino/indicatore tematico.

## Review bloccata

Se non esiste almeno una lettura completata:

> Voto, tag e citazioni si sbloccano quando segni il libro come letto.

La review si abilita in base a `completedReadingsCount >= 1`, non allo stato corrente, perché un libro già letto può essere in rilettura.

---

# 7. Letture e riletture

Un libro può avere più Reading.

Esempio:

- prima lettura;
- rilettura 1;
- rilettura 2.

Ogni Reading ha:

- start;
- end;
- pagina iniziale;
- pagina corrente;
- stato `active | paused | completed | dnf`.

“Letto più di una volta” viene **derivato** dal numero di Reading completate.

Non duplicare questo stato come fonte di verità indipendente.

---

# 8. Tracking pagina e storico

Aggiornare:

`p. 214 → p. 247`

crea un **Progress Event immutabile**.

Ogni evento:

- UUID generato dal client;
- readingId;
- tipo;
- pagina;
- delta contabile;
- timestamp;
- localDate.

Tipi:

- `progress`;
- `correction`;
- `finish`;
- `dnf`.

## Correzioni

Una correzione può avere delta negativo.

Esempio:

- 120 → 180 = +60;
- correzione 180 → 170 = -10.

Non significa “lettura negativa”: corregge il totale precedentemente registrato.

## Idempotenza

L'UUID evento è la idempotency key.

Retry della stessa operazione non deve creare doppio conteggio.

---

# 9. Offline

Non rendere tutta l'app offline-first.

V1 deve però supportare offline per l'operazione più utile:

> aggiornamento pagina / finish / DNF.

Usare IndexedDB come outbox.

Evento client:

```ts
{
  eventId,
  readingId,
  page,
  occurredAt,
  localDate,
  operation
}
```

Al ritorno online:

- sync;
- retry idempotente;
- rimozione dalla outbox solo dopo ack server.

Il database resta la source of truth.

---

# 10. Review

Una review appartiene al `user_book`.

Contiene:

- esattamente 3 aggettivi;
- voto generale 1–5;
- rating specifici del genere;
- tag tematici;
- citazioni.

Le letture/riletture possono in futuro avere note proprie, ma la review principale resta unica per libro dell'utente.

## Tre aggettivi

Obbligatori, esattamente 3.

UI tipo chip:

`[Epico ×] [Malinconico ×] [Immersivo ×]`

Evitare duplicati case-insensitive.

---

# 11. Rating specifici per genere

Usare dimension keys stabili e versionabili.

## Classici

- Stile di scrittura
- Personaggi
- Temi
- Ritmo
- Impatto

## Mitologia, Epica e Retelling

- Reinterpretazione
- Personaggi
- Atmosfera
- Ritmo
- Mondo mitologico

## Distopia e Fantascienza

- Concept
- Worldbuilding
- Coerenza
- Personaggi
- Ritmo

## Thriller, Gialli e Mistero

- Tensione
- Mistero
- Colpi di scena
- Ritmo
- Finale

## Fantasy, Realismo Magico e Gotico

- Worldbuilding
- Elemento fantastico / Sistema magico
- Personaggi
- Ritmo
- Atmosfera

## Romance, Young Adult e New Adult

- Chimica
- Personaggi
- Relazione
- Emozione
- Ritmo

## Narrativa Contemporanea e Storica

- Personaggi
- Stile
- Ambientazione
- Temi
- Impatto emotivo

Se un libro recensito cambia genere:

- mantenere voto generale;
- mantenere 3 aggettivi;
- mantenere tag;
- mantenere citazioni;
- **resettare rating specifici** incompatibili;
- avvisare la UI tramite `reviewScoresReset`.

---

# 12. Tag tematici iniziali

Predefiniti:

- Amicizia
- Amore
- Avventura
- Crescita
- Famiglia
- Formazione
- Guerra
- Identità
- Magia
- Mistero
- Musica
- Natura
- Perdita
- Politica
- Potere
- Religione
- Vendetta
- Solitudine
- Sopravvivenza
- Tradimento
- Trauma
- Viaggio
- Morte
- Memoria
- Libertà
- Società
- Tecnologia

Non creare centinaia di tag in V1.

---

# 13. Citazioni

Per ogni citazione:

- testo;
- pagina opzionale;
- libro.

Statistiche/Extra deve avere:

- elenco globale citazioni;
- “Vedi tutte”;
- Quote Card.

## Quote Card

Generare client-side tramite Canvas o equivalente browser.

Contenuto:

- citazione;
- titolo;
- autore;
- branding minimo Segnalibro;
- colori del genere derivati dal tema attivo.

Esportare PNG.

Non serve backend grafico.

---

# 14. Esplora

## Ruota della Fortuna

Pool:

- solo libri non letti;
- filtro “Tutti i non letti”;
- filtro uno o più generi.

Dopo scelta:

- Gira ancora;
- Metti nei prossimi.

Animazione con SVG/CSS, non libreria grafica pesante.

## Calendario annuale

12 mesi.

Un giorno con attività di lettura mostra un pallino/marker.

- 1 genere → colore pieno;
- più generi → segmenti con `conic-gradient`.

Il calendario deriva dai Progress Event reali.

Non inferire automaticamente che l'utente abbia letto tutti i giorni tra `started_at` e `finished_at`.

---

# 15. Statistiche

Per anno:

- Genere più letto;
- Tag più usati;
- Autore dell'anno;
- Mese d'oro;
- Pagine totali;
- Streak corrente;
- record streak.

Calcolo server-side/PostgreSQL.

## Streak

Un giorno conta se c'è almeno un Progress Event reale.

Le letture storiche inserite a posteriori non devono inventare una serie di giorni di lettura.

---

# 16. Bookish Bingo

16 caselle.

Ogni board è annuale.

L'utente assegna manualmente un libro letto a una casella.

Esempi dal concept:

- Oltre 500 pagine;
- Bestseller;
- Diventato un film;
- Letto in digitale;
- 5 stelle;
- Premio letterario;
- Poesia;
- Narratore inaffidabile;
- Un classico;
- Retelling mitologico;
- Thriller o giallo;
- Titolo di una parola;
- Dark Academia;
- Colpo di scena;
- Letto in viaggio;
- Libro da BookTok.

La DB operation deve accettare solo libri con almeno una lettura completata.

---

# 17. Cimitero DNF

Tono delicato, non cupo.

Mostrare:

- cover;
- titolo;
- autore;
- “Riposa a pag. X”.

Nel Cimitero principale entrano i libri con:

- ultimo stato DNF;
- nessuna lettura completata precedente.

Se un libro era già stato completato e una rilettura viene DNF, non deve comparire nel Cimitero principale.

---

# 18. Aggiunta libri

Tre modi:

1. scanner ISBN;
2. ricerca titolo/autore;
3. inserimento manuale.

L'utente conferma sempre:

- genere;
- formato;
- serie;
- eventuale numero volume.

---

# 19. Metadata e cover reali

## Modello bibliografico

Separare:

- **Work** = opera;
- **Edition** = edizione specifica;
- **UserBook** = libro nella libreria del singolo utente.

Esempio:

```text
Dune (Work)
 ├─ Mondadori / IT / ISBN A / 688 p
 └─ Ace / EN / ISBN B / 896 p
```

Pagine, ISBN, lingua e cover appartengono all'edizione.

## Open Library

Usare come sorgente primaria/aperta per:

- ricerca;
- work/edition IDs;
- ISBN;
- cover quando presente.

Per una cover ISBN può essere usato il Covers endpoint.

Non fare crawling massivo.

## Google Books

Usare come enrichment/fallback:

- query ISBN;
- titolo/autore;
- publisher;
- pageCount;
- immagini quando Open Library manca.

API key solo server-side.

## Strategia ISBN

```text
scan
 -> normalize/check ISBN
 -> query Open Library + Google Books
 -> merge candidati
 -> auto-preselect se edition match forte
 -> user confirm
```

## Strategia titolo + autore

Query provider in parallelo.

Normalizzare e deduplicare con cautela.

Ranking basato su:

1. ISBN esatto;
2. titolo;
3. autore;
4. lingua;
5. cover disponibile;
6. pagine/editore/data.

**Titolo + autore non è sufficiente per fare merge automatico di due Edition.**

Mostrare 3–5 candidati rilevanti quando l'edizione non è certa.

## Cover override

Il dettaglio deve offrire “Cambia copertina”.

Precedenza:

1. cover custom utente (`coverStoragePath`);
2. URL provider (`coverUrl`);
3. placeholder locale.

Upload custom in Supabase Storage.

---

# 20. Scanner ISBN

Usare progressivamente:

1. `BarcodeDetector` se supportato;
2. fallback ZXing lazy-loaded.

Supportare EAN-13/ISBN.

Fotocamera solo in contesto HTTPS.

ZXing non deve entrare nel bundle iniziale se non necessario.

---

# 21. Tema e design tokens

Il design è theme-aware fin dal primo componente.

Il tema attuale dei mockup è il tema built-in:

- key: `segnalibro`;
- name: `Segnalibro`.

## Regola assoluta

> Nessun componente o route può contenere colori letterali.

Colori `#hex`, `rgb`, `hsl`, ecc. sono ammessi solo nelle definizioni theme.

Usare design token semantici:

- `--color-background`
- `--color-surface`
- `--color-surface-elevated`
- `--color-text-primary`
- `--color-text-secondary`
- `--color-text-muted`
- `--color-primary`
- `--color-on-primary`
- `--color-secondary`
- `--color-accent`
- `--color-border`
- `--color-divider`
- `--color-icon`
- `--color-icon-muted`
- `--color-shadow`
- `--color-overlay`
- `--color-success`
- `--color-warning`
- `--color-danger`
- `--color-info`

## Tema Segnalibro — palette default

- background: `#FAF1EE`
- surface/card: `#F2DCDB`
- accent: `#F2AEBC`
- text primary: `#340A0E`
- primary: `#570F1D`
- secondary: `#6F2B34`
- shadow/icons dark: `#111506`
- shelf axis/dark olive: `#323522`
- divider/inactive icons: `#81815D`

Nota: `#81815D` non va usato per piccolo testo se non supera contrasto.

## Palette generi del tema Segnalibro

### Classici
- base `#8B5E3C`
- light `#EADCCB`
- dark `#4A2E1A`

### Mitologia, Epica e Retelling
- base `#C4694A`
- light `#F5DDD2`
- dark `#6B301D`

### Distopia e Fantascienza
- base `#E8843A`
- light `#FBE3CC`
- dark `#7A3E0E`

### Thriller, Gialli e Mistero
- base `#E0B62B`
- light `#FAF0C4`
- dark `#6B5410`

### Fantasy, Realismo Magico e Gotico
- base `#7E5BA8`
- light `#E6DCF0`
- dark `#3F2A5C`

### Romance, Young Adult e New Adult
- base `#E0708F`
- light `#FADCE4`
- dark `#7A2444`

### Narrativa Contemporanea e Storica
- base `#6FB0DC`
- light `#DCEEF8`
- dark `#23506E`

Ogni palette dispone anche di token `onBase` / `onLight` validati per contrasto.

## Genere contestuale

La pagina genere espone:

- `--genre-current`;
- `--genre-current-light`;
- `--genre-current-dark`;
- `--genre-current-on`.

I componenti usano questi, non slug/colori hardcoded.

## Tema custom

I temi built-in sono nel codice.

Il DB salva:

- `theme_key`, oppure
- `custom_theme_id`.

Custom theme = JSON token validato, **mai CSS arbitrario**.

Versionare lo schema dei token con `schemaVersion`.

## No flash del tema

Applicare il tema prima del rendering visibile.

Conservare una selezione minima anche in cookie per SSR/initial document:

```text
sb-theme=segnalibro
```

Il profilo DB resta la sorgente persistente.

---

# 22. Stack tecnico congelato

## Frontend

- Svelte 5
- SvelteKit
- TypeScript
- Vite
- Tailwind CSS solo come utility/layout dove utile
- CSS custom properties per design system/theming
- Zod per boundary/runtime contracts

Non trasformare Tailwind nella sorgente dei colori di prodotto: i colori devono arrivare dai theme tokens.

## Backend/data

- Supabase
- PostgreSQL
- Supabase Auth
- Row Level Security
- Supabase Storage

## PWA

- `@vite-pwa/sveltekit`
- manifest;
- service worker;
- installazione standalone;
- app shell e asset statici cached;
- progress outbox IndexedDB.

## Test

- Vitest
- Playwright
- contract tests reali su Supabase locale.

## Hosting

Preferenza:

- frontend/SvelteKit su Cloudflare quando compatibile con le feature usate;
- Supabase hosted per DB/Auth/Storage.

Se l'adapter Cloudflare crea problemi reali con una feature necessaria, è accettabile usare Vercel/Node, ma documentare la scelta. Non cambiare stack senza motivo.

---

# 23. Tecnologie da NON introdurre in V1

Non usare:

- backend Rust/Axum;
- microservizi;
- Redis;
- Kafka;
- Elasticsearch;
- GraphQL;
- Kubernetes;
- realtime websocket sempre acceso;
- AI/recommendation engine;
- social graph.

Non risolvono un problema reale di questa app in V1.

---

# 24. Architettura frontend

Dipendenza obbligatoria:

```text
Svelte component
      ↓
Repository interface
      ↓
RPC / server endpoint
      ↓
PostgreSQL / external provider
```

Un componente non deve:

- importare Supabase client per query dominio;
- conoscere nomi tabelle;
- conoscere nomi RPC;
- costruire query PostgREST;
- hardcodare colori;
- fidarsi di response non validate.

Usare i contratti presenti in:

`technical-baseline/contract-layer-v2/src/lib/contracts/`

e le repository interface in:

`src/lib/data/repositories.ts`.

---

# 25. API contract

Ogni read model e mutation response ha:

```ts
{
  contractVersion: 1,
  ...
}
```

Regole:

- JSON frontend in camelCase;
- DB in snake_case;
- UUID come stringhe UUID;
- ID catalogo PostgreSQL bigint come stringhe al boundary JS;
- scalar/object noto ma mancante = `null`;
- collezione vuota = `[]`;
- non omettere proprietà documentate.

Ogni payload server viene validato con Zod.

Errore di schema = `CONTRACT`.

---

# 26. Database

Le migration autoritative incluse nel package sono:

1. `001_schema.sql`
2. `002_rpc_layer.sql`
3. `003_rpc_contract_alignment.sql`
4. `004_reference_data.sql`

Work deve:

1. avviare Supabase locale;
2. applicare tutte le migration;
3. correggere eventuali incompatibilità SQL reali;
4. eseguire contract test;
5. non modificare il boundary pubblico senza aggiornare contemporaneamente Zod e test.

## Modello principale

```text
User
 ├─ Profile
 ├─ Preferences
 ├─ UserBooks
 │   ├─ Edition
 │   │   └─ Work
 │   │       └─ Authors
 │   ├─ Readings[]
 │   │   └─ ProgressEvents[]
 │   ├─ Review
 │   │   ├─ ReviewScores[]
 │   │   └─ Tags[]
 │   └─ Quotes[]
 ├─ ReadingQueue[]
 ├─ BingoBoards[]
 └─ CustomThemes[]
```

---

# 27. Stato libro vs queue

Queue/TBR non è uno stato libro.

Usare `reading_queue` separata.

Il lifecycle presentato in UI è in buona parte derivato dalla history:

- zero Reading complete/open → unread;
- Reading open active → reading;
- Reading open paused → paused;
- almeno una completed e nessuna open → finished;
- zero completed + ultimo terminale DNF → dnf.

“Letto più di una volta” = `completedReadingsCount >= 2`.

---

# 28. Proiezioni denormalizzate consentite

In `user_books` sono intenzionalmente cache:

- `lifecycle_state`;
- `completed_readings_count`;
- `review_rating`;
- `last_finished_at`;
- `last_activity_at`.

La source of truth resta:

- `readings`;
- `reviews`;
- `reading_progress_events`.

Le proiezioni servono a rendere veloci Home e viste.

Non aggiungere altre denormalizzazioni finché non c'è una query reale che le giustifica.

---

# 29. RLS e sicurezza

Ogni tabella user-owned deve essere protetta da RLS.

Usare `user_id` diretto dove utile anche se derivabile, perché:

- rende le policy semplici;
- facilita indici;
- permette composite FK che impediscono cross-user references.

Catalogo globale: read per utenti autenticati, write solo server/domain layer.

Mutazioni complesse devono passare da RPC transazionali.

Funzioni `SECURITY DEFINER` solo quando necessarie:

- `search_path = ''`;
- verifica esplicita `auth.uid()`;
- revoke EXECUTE a public/anon;
- grant solo ad authenticated o service role secondo necessità.

API key esterne mai nel browser.

---

# 30. RPC/read models principali

Implementare/mantenere:

- `get_library_home`
- `get_shelf_page`
- `get_genre_view`
- `get_book_detail`
- `get_explore_pool`
- `get_reading_calendar`
- `get_year_stats`
- `get_stats_dashboard`
- `get_bingo_board`
- `queue_add`
- `queue_remove`
- `queue_move`
- `start_reading`
- `pause_reading`
- `resume_reading`
- `record_progress`
- `correct_progress`
- `finish_reading`
- `mark_dnf`
- `add_completed_reading`
- `change_book_genre`
- `save_review`
- Bingo assignment
- theme selection

La Home deve arrivare idealmente da **una RPC**.

---

# 31. Queue concurrency

La queue ha `UNIQUE(user_id, position)` deferrable.

Le operazioni di reorder devono essere transazionali e serializzate per utente.

Il soft limit 3 non deve essere rappresentato tramite errore.

`queue_add` deve comunicare:

- `added`;
- `alreadyQueued`;
- `requiresConfirmation`.

---

# 32. Shelf pagination

Per gli scaffali usare keyset pagination, non OFFSET.

Cursor:

```ts
{
  createdAt,
  id
}
```

Indice:

`(user_id, genre_id, created_at DESC, id DESC)`.

La Home carica un numero limitato per scaffale, default circa 24, e `hasMore`.

Virtualizzazione avanzata solo se misurazioni reali la rendono necessaria.

---

# 33. Drag & Drop

Non usare HTML5 Drag & Drop come soluzione principale mobile.

Usare Pointer Events.

Gesture:

- pressione lunga ~350–450ms;
- piccolo threshold di movimento;
- lift visual;
- ghost;
- target shelf highlight;
- release;
- auto-scroll vicino ai bordi.

Conflitto gesture:

- movimento orizzontale normale → scroll shelf;
- long press + movimento → drag.

Sempre disponibile alternativa “Sposta” nel dettaglio.

Testare su telefoni reali.

---

# 34. Responsive desktop

Non usare un “telefono centrato” su desktop.

## Desktop

- sidebar;
- content max-width circa 1200–1400px;
- scaffali lunghi;
- detail book a 2 colonne:
  - cover/meta;
  - review;
- Esplora:
  - Ruota e calendario affiancabili;
- Statistiche:
  - card grid.

La personalità mobile deve rimanere, ma desktop deve sfruttare lo spazio.

---

# 35. Componenti principali

Costruire almeno:

- `AppShell`
- `BottomNavigation`
- `DesktopSidebar`
- `Shelf`
- `BookSpine`
- `BookCover`
- `BookCard`
- `GenreChip`
- `StatusChip`
- `FormatBadge`
- `RatingStars`
- `RatingDimension`
- `ReadingProgress`
- `ReadingHistory`
- `BottomSheet`
- `ConfirmDialog`
- `BookSearch`
- `BookSearchResult`
- `ISBNScanner`
- `ReadingCalendar`
- `FortuneWheel`
- `BingoGrid`
- `QuoteCard`

Non mettere la logica dominio direttamente in `+page.svelte`.

---

# 36. Route consigliate

```text
/
  -> redirect /library

/auth
/auth/login
/auth/register

/library
/genre/[slug]
/book/[id]

/add
/add/search
/add/scan
/add/manual

/explore

/stats
/stats/[year]

/bingo/[year]

/quotes
/settings
```

---

# 37. Ricerca interna

Non usare Algolia/Elasticsearch.

Per biblioteca personale:

- trigram per titolo/autore;
- Postgres full-text solo se necessario in futuro.

Il DB ha già indici trigram previsti.

---

# 38. Performance

Obiettivi:

- LCP < 2.5s su condizioni ragionevoli;
- INP < 200ms;
- CLS < 0.1;
- scroll shelf fluido;
- no layout shift delle cover;
- Home con 1 RPC principale;
- scanner lazy-loaded;
- chart/quote/bingo code non indispensabile lazy-loaded;
- cover sotto fold lazy;
- `decoding="async"`;
- dimensioni immagine riservate.

LED/glow deve essere leggero.

Non usare blur enormi ripetuti su centinaia di elementi.

Dorsi CSS aiutano la Home a non scaricare centinaia di immagini.

---

# 39. Font

Preferenza:

- Fraunces Variable per titoli/editoriale;
- Inter Variable per UI.

Self-hosted WOFF2 se le licenze lo consentono.

Non includere molte varianti statiche.

---

# 40. Accessibilità

Obbligatorio:

- target touch >= 44×44;
- focus visibile;
- keyboard navigation desktop;
- bottom sheet con focus trap;
- ESC per chiudere quando appropriato;
- restore focus;
- stelle con aria-label;
- colori mai unico segnale;
- drag non unica modalità;
- `prefers-reduced-motion`;
- contrasto WCAG AA per testo normale.

Ogni tema built-in deve passare controllo contrasto.

---

# 41. Privacy

Private by default.

Nessuna libreria pubblica automatica.

Prevedere architetturalmente:

- export JSON completo;
- export CSV libri;
- delete account;
- cancellazione dati.

La UI completa di export/delete può essere implementata dopo il core, ma lo schema non deve impedirla.

---

# 42. Realtime

Non usare Supabase Realtime in V1.

Al ritorno in foreground:

- refresh dati rilevanti;
- sync outbox.

Aggiungere Realtime solo se nasce un requisito collaborativo reale.

---

# 43. Caching metadata esterni

Le chiamate Open Library / Google Books devono essere server-side.

Aggiungere cache applicativa con TTL:

- search title/author: 6–24h;
- lookup ISBN positivo: molto più lungo.

Non serve Redis: usare cache runtime/platform o una piccola tabella cache PostgreSQL se necessario.

Non fare scraping massivo.

---

# 44. Error model

Normalizzare gli errori repository in:

- `AUTH_REQUIRED`
- `NOT_FOUND`
- `CONFLICT`
- `VALIDATION`
- `RATE_LIMITED`
- `NETWORK`
- `SERVER`
- `CONTRACT`

La UI reagisce al codice.

Non fare parsing delle stringhe Postgres nei componenti.

---

# 45. Test

## Unit

Testare:

- ISBN normalization/checksum;
- ranking candidati;
- transition reading;
- progress correction;
- streak;
- theme validation;
- theme CSS generation.

## Contract

Il package include contract test Zod e DB.

Eseguire:

```bash
npm install
npm run typecheck
npm run test:contracts
```

Poi:

```bash
supabase start
supabase db reset
npm run test:contracts:db
```

I contract test di integrazione erano predisposti ma non sono stati eseguiti nell'ambiente in cui è stato creato questo package: **Work deve realmente eseguirli e correggere qualsiasi incompatibilità prima di procedere**.

## E2E Playwright

Copertura minima:

- login/register;
- aggiunta manuale;
- ricerca title/author;
- lookup ISBN;
- scanner quando testabile;
- start reading;
- progress;
- offline queued progress;
- pause/resume;
- finish;
- DNF;
- review;
- 3 aggettivi;
- tag/rating;
- quote;
- queue add/move/remove;
- soft limit;
- genre change;
- calendar;
- stats;
- bingo;
- theme switching;
- desktop nav;
- mobile nav.

---

# 46. PWA

Manifest e service worker fin dall'inizio.

Cache:

- app shell;
- fonts;
- icons;
- assets statici;
- pagine/metadata recenti dove opportuno.

IndexedDB:

- outbox progress;
- eventuale cache read-only.

Non fare optimistic mutation non-idempotenti senza strategia di recovery.

---

# 47. Ordine di implementazione

## Fase 0 — Bootstrap

- crea progetto SvelteKit;
- TypeScript strict;
- lint/format;
- Supabase local;
- env;
- PWA skeleton;
- copia contratti/baseline;
- applica migration 001–004;
- esegui contract tests.

**Exit criteria:** DB reset e contract suite passano.

## Fase 1 — Design system + Auth

- AppShell;
- tema Segnalibro;
- theme provider;
- CSS variables;
- auth/login/register;
- RLS smoke test;
- mobile bottom nav;
- desktop sidebar.

**Exit criteria:** nessun colore hardcoded fuori dai theme files.

## Fase 2 — Home

- repository;
- `get_library_home`;
- In lettura;
- queue;
- scaffali;
- spines CSS;
- responsive.

**Exit criteria:** Home real data, 1 RPC principale, fluida mobile.

## Fase 3 — Book detail + Reading

- detail;
- status bottom sheet;
- start/pause/resume;
- progress;
- finish;
- DNF;
- historical completed reading;
- offline outbox.

## Fase 4 — Catalog / Add Book

- server providers;
- Open Library;
- Google Books;
- ranking;
- search title/author;
- ISBN;
- scanner;
- manual add;
- cover picker;
- custom cover.

## Fase 5 — Genre + movement

- genre view;
- sorting;
- queue operations;
- pointer drag;
- change genre;
- accessible move fallback.

## Fase 6 — Reviews

- 3 adjectives;
- rating;
- per-genre scores;
- tags;
- quotes;
- rereading history.

## Fase 7 — Explore

- Fortune Wheel;
- genre filter;
- calendar;
- multi-genre day marker.

## Fase 8 — Stats & Extras

- year dashboard;
- streak;
- Bingo;
- Quote Cards;
- DNF cemetery.

## Fase 9 — Themes & Settings hardening

- theme chooser;
- custom theme architecture/UI if time;
- no-flash theme;
- motion prefs;
- shelf mode.

## Fase 10 — Production hardening

- full Playwright;
- accessibility;
- performance profiling;
- phone testing;
- CSP;
- rate limiting metadata endpoints;
- export/delete account;
- deploy docs.

---

# 48. Acceptance criteria

Il progetto è considerato completato quando:

1. è avviabile localmente con istruzioni riproducibili;
2. tutte le migration si applicano da DB vuoto;
3. contract test passano;
4. le principali E2E passano;
5. auth multiutente funziona e un utente non vede dati di un altro;
6. Home corrisponde visivamente al mockup e resta fluida su mobile;
7. desktop ha layout dedicato;
8. non esistono colori hardcoded nei componenti/routes;
9. cambio tema funziona senza reload visibile;
10. scanner ha fallback;
11. search libro restituisce candidati reali;
12. cover reali vengono mostrate quando disponibili;
13. manual add funziona anche senza API esterne;
14. queue soft-limit funziona;
15. reading/re-reading/progress/correction sono consistenti;
16. offline progress sync non duplica eventi;
17. review resta sbloccata durante una rilettura;
18. cambio genere resetta solo i rating specifici incompatibili;
19. calendario/stats derivano da progress reali;
20. Bingo/Quote/DNF rispettano le regole definite;
21. PWA è installabile;
22. README spiega setup, env, test, migration e deploy.

---

# 49. Cose che Work può decidere autonomamente

Work può scegliere dettagli locali purché non cambino il prodotto:

- libreria di icone;
- micro-animation easing/duration;
- convenzioni file interne;
- helper per IndexedDB;
- provider di toast;
- esatta implementazione del cache adapter;
- component primitives accessibili.

Work NON deve cambiare autonomamente:

- stack principale;
- modello Work/Edition/UserBook;
- multiutente/RLS;
- separazione queue/status;
- event log delle letture;
- tema token-based;
- review/rating semantics;
- struttura principale delle pagine;
- comportamento soft-limit;
- provider strategy;
- repository boundary;
- contractVersion/Zod boundary.

---

# 50. Deliverable finale richiesto a Work

Consegnare:

```text
Segnalibro/
├── src/
├── static/
├── supabase/
│   └── migrations/
├── tests/
├── docs/
├── .env.example
├── package.json
├── README.md
└── ...
```

README finale con:

- prerequisiti;
- installazione;
- Supabase local;
- variabili ambiente;
- Open Library/Google Books setup;
- avvio dev;
- test;
- migration;
- PWA;
- build;
- deploy;
- note scanner camera/HTTPS.

Alla fine produrre anche un breve `IMPLEMENTATION_REPORT.md` con:

- cosa è stato completato;
- eventuali deviazioni;
- test eseguiti;
- problemi rimasti;
- credenziali/API key ancora da configurare.

---

# 51. Riferimenti nel package

Prima di scrivere UI, leggere:

1. `mockups/Segnalibro · Mockup scelti.pdf`
2. questo `MASTER_SPEC.md`
3. `technical-baseline/contract-layer-v2/docs/ARCHITECTURE_RULES.md`
4. `technical-baseline/contract-layer-v2/docs/RPC_CONTRACTS.md`
5. `technical-baseline/contract-layer-v2/docs/CONTRACT_TESTING.md`
6. migration SQL in `supabase/migrations/`

Ordine di autorità in caso di contrasto:

1. **MASTER_SPEC.md**
2. mockup per visual/interaction intent
3. contract layer per API shape
4. migration SQL
5. dettagli implementativi liberamente scelti da Work

---

# 52. Nota finale

L'obiettivo non è soltanto “far funzionare un book tracker”.

Il risultato deve sembrare una piccola app personale curata:

- immediatamente riconoscibile;
- piacevole da aprire;
- veloce;
- tattile su telefono;
- leggibile e utile su desktop;
- tecnicamente semplice ma robusta;
- pronta a diventare multiutente senza riscrittura.

La metafora della libreria, gli scaffali, i colori per genere e la review personale sono il cuore del prodotto. Preservarli.
