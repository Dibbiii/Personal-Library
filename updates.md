1. manca il + , non riesco ad aggiungere libri se la mensola non è vuota
2. Votazioni con mezzi numeri!!!!!! Devo poter mettere come voto 3.50 o 4.75 quindi anche le stelline si devono poi colorare di conseguenza
3. a volte quando cerco i libri non me li trova, oppure mi trova delle edizioni vecchie. ho parlato con gemini che mi ha detto così: 
    - **Italiano**
        
        Non esiste purtroppo un **singolo catalogo globale universale e centralizzato** che contenga ogni singola edizione esistente al mondo ed sia al 100% open access e privo di lacune.
        
        Il motivo è strutturale: i grandi aggregatori privati (come Amazon/Goodreads) non mettono a disposizione API pubbliche gratuite per motivi commerciali, mentre i servizi open/free soffrono di limiti specifici:
        
        - **Google Books API:** Ha un limite di chiamate, copre bene le novità e i titoli internazionali, ma spesso omette i meta-dati delle edizioni italiane specifiche o non restituisce il codice ISBN esatto per l'edizione che possiedi.
        - **Open Library (Internet Archive):** È fantastica e open access, ma essendo basata sui contributi degli utenti e delle biblioteche americane, sulle novità o sulle edizioni italiane locali registra forti ritardi o dati incompleti.
        
        Per risolvere definitivamente il problema sul tuo sito web, **la soluzione migliore usata dai developer è implementare un sistema di ricerca a cascata (fallback) o integrare nuove fonti dati aperte e gratuite**.
        
        ---
        
        ### Le migliori alternative e integrazioni gratuite
        
        #### 1. OPAC SBN (Servizio Bibliotecario Nazionale Italiano)
        
        Se leggi molti libri in italiano o edizioni italiane specifiche, l'OPAC SBN è il catalogo definitivo. Raccoglie i dati di oltre 7.500 biblioteche italiane e contiene oltre 21 milioni di schede.
        
        - **Perché usarlo:** Trova praticamente qualsiasi edizione, traduzione o riedizione stampata e distribuita in Italia.
        - **Accessibilità:** È interrogabile gratuitamente tramite protocolli standard di catalogo (come **Z39.50** o **SRU/SRW**) messi a disposizione dall'ICCU.
        
        #### 2. Inventaire.io API
        
        È una piattaforma open-source e collaborativa costruita sopra **Wikidata** e **Open Library**.
        
        - **Perché usarlo:** Combina i dati di Wikidata, Open Library e dei contributi degli utenti. È totalmente open access, ha ottime API JSON e gestisce molto bene le edizioni locali e le traduzioni rispetto alla classica Open Library.
        
        #### 3. ISBNDB (Opzione Freemium / A pagamento)
        
        Non è 100% open access, ma è il database commerciale di codici ISBN più imponente al mondo. Ha un piano API a pagamento, ma per progetti personali molto specifici viene usato quando si vuole la garanzia assoluta di trovare la copertina e il barcode di qualsiasi libro appena uscito.
        
        ---
        
        ### La soluzione ideale per il tuo sito: "A Cascata" (Fallback System)
        
        Anziché fare affidamento su una sola fonte, puoi programmare il pulsante dello **Scanner ISBN / Ricerca** del tuo sito in modo che interroghi le fonti in sequenza fino a quando non trova l'edizione esatta:
        
        1. **Chiamata 1 $\rightarrow$ Google Books API:** Cerca l'ISBN. Se trova l'edizione completa con copertina, compila la scheda.
        2. **Chiamata 2 (se la prima fallisce) $\rightarrow$ Open Library API:** Interroga `<https://openlibrary.org/api/books?bibkeys=ISBN>:...`.
        3. **Chiamata 3 (se fallisce) $\rightarrow$ OPAC SBN / Inventaire API:** Cerca nel catalogo delle biblioteche italiane per recuperare titolo, autore e anno dell'edizione esatta.
        4. **Fallback manuale (Aggiunta rapida):** Se nessuna API restituisce la copertina dell'edizione specifica in tuo possesso (cosa che accade spesso con le copertine flessibili o le riedizioni speciali), il sito fa apparire un semplice form di fallback per incollare l'immagine o scattare la foto alla copertina del tuo volume.
    - **Inglese**
        
        Per i libri in lingua inglese la situazione è fortunatamente molto più ricca e strutturata, poiché il mercato anglosassone ha digitalizzato i propri cataloghi in modo estremamente capillare. Tuttavia, anche lì la frammentazione dei diritti d'autore crea qualche piccolo ostacolo per le copertine o per edizioni specifiche (come le edizioni speciali o quelle tascabili da collezione).
        
        Ecco i migliori cataloghi open access e API gratuite per coprire al 100% i libri in inglese:
        
        ---
        
        ### 1. Library of Congress (LoC) API
        
        La Biblioteca del Congresso degli Stati Uniti offre API pubbliche e completamente gratuite.
        
        - **Perché usarla:** È il catalogo bibliografico più imponente al mondo per le pubblicazioni in lingua inglese. Ogni libro stampato o registrato negli USA o nel Regno Unito ha una scheda ufficiale qui.
        - **Vantaggi:** Dati bibliografici perfetti (titoli esatti, serie, sottotitoli, numero di pagine, anno di pubblicazione, autori).
        - **Limite:** Spesso non fornisce l'immagine ad alta risoluzione della copertina per motivi di copyright.
        
        ### 2. Worldcat (via ISBNdb o OCLC API)
        
        Worldcat è il più grande database bibliografico mondiale (gestito da OCLC).
        
        - **Perché usarlo:** Raccoglie i dati di migliaia di biblioteche anglosassoni, universitarie e internazionali.
        - **Vantaggi:** Trova qualsiasi edizione in inglese, comprese quelle rare, indipendenti o passate fuori catalogo.
        
        ### 3. Goodreads / StoryGraph Scraping & Web Search APIs
        
        Poiché Goodreads ha chiuso le sue API pubbliche ufficiali qualche anno fa, molti sviluppatori per siti personali utilizzano:
        
        - **Custom Search API (Google / DuckDuckGo):** Si programma una query diretta per cercare la stringa `ISBN + "Goodreads"` o `ISBN + "Amazon UK/US"`.
        - **Open Library Books API + Covers API:** Per i libri in inglese Open Library è nettamente più aggiornata rispetto alle edizioni italiane, e l'API dedicata alle copertine (`<https://covers.openlibrary.org/b/isbn/> [ISBN]-L.jpg`) trova quasi sempre le immagini in alta risoluzione.
        
        ---
        
        ### Architettura ideale per il tuo sito (Italiano + Inglese)
        
        Per far sì che lo scanner o la ricerca del tuo sito non fallisca mai (sia che inquadri un romanzo italiano che un thriller in lingua originale), la sequenza di chiamate API in background dovrebbe essere questa:
        
        ```
        [Inquadri il Barcode ISBN]
               │
               ├── 1. Google Books API (Ottima per inglese + italiano)
               │      └─ Trovato? -> Salva Titolo, Autore, Copertina.
               │
               ├── 2. Open Library API / Covers API (Eccellente per edizioni UK/US)
               │      └─ Trovato? -> Salva e completa i dati mancanti.
               │
               ├── 3. Library of Congress / OPAC SBN (Database bibliografici ufficiali)
               │      └─ Trovato? -> Recupera i dati di testo certi se manca la copertina.
               │
               └── 4. Fallback Manuale / Carica Foto
                      └─ Se l'edizione è recentissima o ha una variante di copertina unica,
                         puoi scattare una foto al libro col telefono e usarla come copertina!
        ```
        
        Con questo sistema a 3 livelli più il caricamento manuale di riserva, il tuo sito sarà in grado di riconoscere e catalogare in un secondo qualsiasi libro della tua libreria, sia in italiano che in inglese!
        
4. manca il modo per eliminare un libro
5. Devo poter modificare se un libro e cartaceo o digitale o entrambi
6. Ogni scaffale deve essere premibile, anche quello delle letture in corso e quello dei prossimi 3
7. Cambiare il nome in “Libreria” non segnalibro pls
8. spin the wheel: devo poter selezionare anche solo i cartacei
9. Manca il tasto salva nella schermata delle recensioni
10. statistiche: quanti libri ho letto in inglese? E non voglio lo streak di lettura. Vorrei anche una sezione tipo quanti libri non ho finito
11. Nelle quote card vorrei che in basso ci fosse titolo e autore, non il genere, e magari che le “” fossero tipo cosi: 
12. il calendario con i giorni non si aggiorna
13. mettere i 3 aggettivi nelle recensioni non deve essere vincolante, si deve poter salvare anche senza i tre aggettivi
14. modificare i tag: romantico - dark academia - plot-twist - inquietante- disturbante - contorto - claustrofobico - cupo - narratore inaffidabile - character-developement - slow-burn - enemies to lovers- friends to lovers - multi-pov - doppia linea temporale - crescita personale
15. aggiungere scaffale dedicato ai saggi (colore verde)
16. Devo poter visionare i libri nello scaffale anche in modalita elenco
17. modificare i simboli del cartaceo e digitale.
18. Nelle serie di volumi, i rettangoli accanto al libro che ho già inserito devono darmi la possibilità, se cliccati, di aggiungere gli altri libri della serie. Inoltre il numero del totale dei libri di una serie deve essere modificabile (metti che esce un nuovo libro di una serie lo devo poter aggiungere in seguito)
19. Nel cimitero dnf vorrei le tombe sul grigino e magari che si vedesse anche la copertina del libro
20. Nella sezione recensione del libro sarebbe carino poterci caricare una serie di foto che prendo man mano su pinterest o altro per creare una specie di moodboard del libro. A questa magari posso aggiungere le varie citazioni che ho salvato con font carini
21. Per il futuro, con l’intenzione di condividerla, l’ordine degli scaffali si dovrebbe poter cambiare, cosi come anche il loro titolo. Anche la bookish bingo card puo essere creata da zero.
