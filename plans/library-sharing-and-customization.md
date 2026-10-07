# Plan: Personalizzazione e condivisione della libreria

**Status**: Active

## Perimetro confermato

- Rinominare e riordinare i 7 scaffali genere esistenti.
- Creare/modificare/cancellare Bookish Bingo personalizzabili con titolo e 16 caselle.
- Privacy indipendente per profilo, libreria, recensioni, statistiche, citazioni e attività.
- Amicizie tramite codice personale e link d'invito con accetta/rifiuta.
- Profilo e libreria degli amici filtrati dalla privacy.

## Slices

1. **Scaffali personalizzabili** — l'utente rinomina e riordina i sette scaffali e vede il nuovo ordine in libreria e sidebar; persistenza RPC e test DB.
2. **Bingo personalizzabile** — l'utente crea una card con titolo e 16 sfide, modifica titolo/sfide e cancella card; lettura e assegnazione esistenti restano compatibili.
3. **Identità condivisibile** — l'utente vede il proprio codice e può generare un link d'invito; il link mostra una richiesta autenticata/non autenticata in stato sicuro.
4. **Ciclo amicizia** — destinatario accetta/rifiuta, mittente vede lo stato, duplicati e auto-inviti sono rifiutati.
5. **Privacy** — impostazioni per campo, default privato; le viste amico espongono solo dati autorizzati.
6. **Profilo/libreria amici** — elenco amici, profilo condiviso e libreria filtrata; stati vuoti, rimozione amicizia e revoca privacy.

Ogni slice richiede test unitari/contrattuali, migration additiva, `npm run check` e test DB prima di procedere alla successiva.
