// Pagina di cortesia precaricata dal service worker: nessuna idratazione, nessun dato.
// Se fosse idratata sotto un altro URL (quello che l'utente voleva aprire) il router cercherebbe i dati
// di quella pagina e fallirebbe di nuovo offline.
export const csr = false;
export const ssr = true;
