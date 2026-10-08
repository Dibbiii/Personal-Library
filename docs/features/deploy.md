# Deploy Docker di Segnalibro

Il progetto viene pubblicato su `https://personal-library.alessandrobrunoh.it`
tramite Docker Compose e Traefik. Il servizio `app` usa l'immagine
`ghcr.io/dibbiii/personal-libvrary:latest`: la grafia del registry è quella
già presente in `docker-compose.yml`.

Questa procedura aggiorna un'installazione esistente, con database, volumi
e rete esterna `proxy` già configurati. Eseguire i comandi dalla cartella
che contiene `docker-compose.yml` sul server, conservando il progetto Compose
già utilizzato (compreso un eventuale `-p` o `COMPOSE_PROJECT_NAME`).

## 1. Costruire e pubblicare l'immagine

Sul computer di sviluppo, nella cartella del repository:

```powershell
docker build --tag ghcr.io/dibbiii/personal-libvrary:icons-centered-20261007 .
docker push ghcr.io/dibbiii/personal-libvrary:icons-centered-20261007
docker tag ghcr.io/dibbiii/personal-libvrary:icons-centered-20261007 ghcr.io/dibbiii/personal-libvrary:latest
docker push ghcr.io/dibbiii/personal-libvrary:latest
```

Controllare che ciascun comando termini con successo prima di proseguire.
Se il registry richiede l'accesso, eseguire `docker login ghcr.io` con un
account autorizzato a pubblicare il pacchetto. Non salvare token nel repository.
Usare un nuovo tag di versione per i deploy successivi.

## 2. Aggiornare l'app sul server

Collegarsi via SSH e aprire la cartella dell'installazione. Salvare prima
l'immagine attualmente in uso, per poter tornare alla versione precedente:

```sh
previous_image=$(docker inspect --format '{{.Image}}' personal-library)
docker image tag "$previous_image" personal-library:before-icons-centered-20261007
docker compose pull app
docker compose up -d --no-deps app
docker compose ps app
docker compose logs --tail 80 app
```

Fermarsi se un comando fallisce. Per la correzione della centratura delle icone
non servono migrazioni, seed o reset. I volumi esistenti del database e delle
copertine rimangono associati ai servizi. Non eseguire `docker compose down -v`.

## 3. Verificare la pubblicazione

Aprire il sito e controllare queste risorse:

- `/icons/icon-512.png`: cuore con margini simmetrici.
- `/icons/icon-maskable-512.png`: cuore centrato con spazio per il ritaglio.
- `/icons/apple-touch-icon.png`: icona per la schermata Home su iOS.
- `/manifest.webmanifest`: riferimenti alle icone dell'app.

Per verificare il file effettivamente pubblicato, scaricarlo senza cache e
confrontarne lo SHA-256 con il corrispondente file in `static/icons/`.
L'icona della schermata Home va controllata anche sul telefono dopo il deploy.

## 4. Ripristinare la versione precedente

Sul server, nella stessa cartella e con lo stesso progetto Compose:

```sh
docker image tag personal-library:before-icons-centered-20261007 ghcr.io/dibbiii/personal-libvrary:latest
docker compose up -d --no-deps --pull never app
docker compose ps app
```

Questo ripristino agisce sul server corrente; non modifica il tag nel registry.
