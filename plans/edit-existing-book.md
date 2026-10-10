# Plan: Modifica di un libro già inserito

**Workstream**: DEV-13
**Issue**: FEAT-191
**Status**: Active

## Obiettivo

Dal dettaglio di un libro in Libreria si può riaprire la personalizzazione, scegliere un’altra edizione e aggiornare i dati dello stesso libro.

## Criteri di accettazione

- Dal dettaglio si apre una modifica precompilata in cui si possono cambiare edizione, genere, formato e serie.
- Il salvataggio aggiorna il libro esistente senza cambiarne l’identità né perdere letture, recensione o posizione in coda; annullare non modifica i dati.

## Slice 1: Aggiornare in place l’edizione e la personalizzazione

**Valore**: chi legge può correggere i dati del libro senza eliminarlo e inserirlo di nuovo.
**Percorso di produzione**: dettaglio libro → scelta edizione e personalizzazione → endpoint autenticato di aggiornamento → aggiornamento della riga `user_books` esistente → ricaricamento del dettaglio.

**RED**

- Testare il contratto dell’aggiornamento, compresi i dati obbligatori quando viene scelta una nuova edizione.
- Testare che l’aggiornamento mantenga l’ID del libro e non duplichi un’edizione già presente.
- Verificare con un test del flusso che annullare non invii modifiche e che salvare invii genere, formato, serie ed eventuale nuova edizione.

**GREEN**

- Riutilizzare il selettore di edizione e i campi di personalizzazione già usati nell’inserimento.
- Aggiungere un aggiornamento per utente autenticato che modifichi la riga esistente e lasci intatte letture, recensione e coda.

**Verifica**

- Eseguire test unitari e di contratto pertinenti, `npm run check` e i test E2E del flusso quando l’ambiente lo consente.
- Verificare manualmente che annulla non persista dati e che il salvataggio conservi l’ID del libro.
- Fare una valutazione finale di refactoring senza estendere lo scope.
