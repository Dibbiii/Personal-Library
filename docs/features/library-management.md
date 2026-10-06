# Aggiunta ed eliminazione dei libri

## Aggiunta contestuale

Ogni scaffale Home ha un link `+` permanente nella plancia, separato dal link al genere e dallo scroller. Il segnaposto dello scaffale vuoto è un link alla stessa aggiunta. Il target minimo del `+` è 44×44 px.

Il `+` è disegnato come un disco nei colori del genere (coppia `genre.dark`/`genre.light`, come la pill "Rilascia qui") con icona `book-plus`; stessa icona anche nell'header del genere (disco scuro, distinto dal tasto indietro) e nel segnaposto dello scaffale vuoto.

L'header della pagina genere espone la stessa azione anche se la libreria contiene già libri. `/add?genre=<slug>` preserva il contesto nelle opzioni ricerca, scanner e inserimento manuale, nei fallback ISBN/titolo e nella navigazione indietro. `src/lib/catalog/add-context.ts` accetta solo generi validi. Il foglio di conferma preseleziona il genere ma permette di cambiarlo; l'aggiunta generica richiede ancora una scelta esplicita.

## Eliminazione

Nel dettaglio, **Altre azioni → Elimina dalla libreria** apre una conferma con focus iniziale su Annulla. La conferma dichiara che la rimozione è irreversibile e riguarda cronologia, recensioni, tag, citazioni e assegnazioni Bingo. Non è la rimozione dalla sola coda delle prossime letture.

`POST /api/library/remove` accetta esclusivamente `{ bookId }`. L'utente deriva dalla sessione, mai dal corpo. Il repository `library.removeBook(bookId)` usa la RPC autorizzata `remove_book`, introdotta dalla migration **108_remove_book.sql**. In una transazione:

1. Verifica l'appartenenza e blocca il libro.
2. Acquisisce il lock della coda dell'utente.
3. Memorizza gli ID delle letture e il percorso della copertina personalizzata.
4. Svuota solo le assegnazioni Bingo del libro, preservando sfide, caselle e card.
5. Elimina il libro: le foreign key rimuovono letture/eventi, recensioni/voti, tag, citazioni e voce in coda.
6. Compatta le posizioni della coda.

La risposta pubblica è `{ contractVersion: 1, bookId, readingIds, clearedBingoCells }`. Il percorso cover resta interno al server. Catalogo globale, edizioni e dati degli altri utenti non vengono eliminati.

Dopo il commit l'endpoint rimuove la cover custom tramite storage con controllo di appartenenza. Se il filesystem fallisce, la rimozione database resta confermata e il server registra il percorso per una pulizia successiva: non esiste un job automatico di recupero.

## Online e dati locali

L'eliminazione non è ottimistica e non si accoda offline. `withBookRemovalGuard` verifica IndexedDB prima della richiesta, sotto il lock usato dalla sincronizzazione: blocca pending e failed dell'utente riferiti alle letture del libro. Se IndexedDB non è verificabile, non invia la richiesta. Gli altri libri non bloccano la rimozione.

Dopo successo la bozza locale della recensione viene rimossa e si naviga al genere con invalidazione della destinazione, senza ricaricare il dettaglio ormai cancellato. Se la navigazione fallisce, il dialog distingue la cancellazione già completata da un errore di cancellazione e permette di tornare al genere senza ripetere la delete.

Il controllo offline riguarda il dispositivo corrente e gli ID di lettura nel dettaglio caricato: non può conoscere code non sincronizzate su altri dispositivi. Eventi tardivi per letture eliminate vengono rifiutati dal server. Il fallback senza Web Locks non garantisce esclusione tra schede browser.

## Test

- `tests/unit/add-context.test.ts`: validazione e propagazione del genere/fallback.
- `tests/unit/book-removal.test.ts`: offline, pending/failed, storage indisponibile, lock e isolamento delle letture.
- `tests/unit/library-removal-api.test.ts`: repository, sessione, risposta, errori e cover dopo commit.
- `tests/contracts/library-removal.contracts.test.ts`: schemi e, con `RUN_DB_CONTRACT_TESTS=1`, cascade, Bingo, coda e isolamento utenti.
- `tests/e2e/library-management.spec.ts`: aggiunta da scaffale/genere, preselezione modificabile, annullamento/eliminazione e blocco offline su mobile e desktop.

L'estensione introduce azioni non previste dai mockup originali e conserva i token e i componenti esistenti. In deploy applicare le migration prima di usare l'eliminazione; non serve un reset dei dati.
