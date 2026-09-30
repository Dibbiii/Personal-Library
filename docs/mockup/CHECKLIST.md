# Checklist di fedelta' visiva (revisore finale)

Metodo: per ogni schermata, aprire l'app a **390px di larghezza, DPR 2** e confrontare con `screens/NN-*.png` (render HTML del mockup, 780px) e con i crop `screens/extra/`. Un punto e' OK solo se la misura coincide (tolleranza +-1px, colore identico al token). Valori di riferimento in `DESIGN_REFERENCE.md`. Nessun hex nei componenti (solo nel tema). Legenda: [G] = bloccante, [M] = media, [m] = minore.

## 0. Globale
- [ ] [G] Font: Young Serif 400 per titoli/serif, Figtree variable per UI (non Fraunces/Inter); self-host woff2 con `font-display: swap`, subset latin + latin-ext.
- [ ] [G] Nessun colore letterale nei componenti; tutti i colori da token (`--color-*`, `--genre-*`), incluse le ombre (`color-mix` su `--color-text-primary`).
- [ ] [G] Primary = `#6C0820` come nel mockup (o decisione documentata sul doppio bordeaux con `#570F1D`).
- [ ] [G] Tab bar: 84px, 3 voci (Libreria / Esplora / Statistiche), pill 60x32 attiva bordeaux con icona chiara, label 12/14 700 attiva e 600 inattiva, colore inattivo `#323522`; visibile nelle tab e nel soft-limit, assente nei due sheet di Dettaglio.
- [ ] [M] Gutter 20px ovunque (16 per la griglia progresso Home e per l'header Dettaglio).
- [ ] [M] Touch target >= 44px anche dove il visivo e' piu' piccolo (plancia 42 -> 44, dorsi, tab).
- [ ] [m] Scroll orizzontale con scrollbar nascosta (`scrollbar-width:none`).
- [ ] [m] Nessuna animazione decorativa non presente nel mockup oltre a: rotazione ruota, sheet/dialog, drag.

## 1. Home
Header
- [ ] Icona segnalibro 24 + "Segnalibro" Young Serif 28/1.1 bordeaux; saluto 13px `#6B3A42` "Ciao {nome}, cosa leggi oggi?"
- [ ] Bottone fotocamera 48x48 circolare, sfondo surface, icona camera 22
- [ ] Sfondo Home `#F6E6E2`-like con nuvole blush (non bianco piatto)
In lettura
- [ ] Due cover **grandi 104x156**, frontali, leggermente ombreggiate (ombra verso il basso, costola scura a sx, filo di luce)
- [ ] Candela accesa con alone rosa e fiamma arancio tra le cover; pianta in vaso a destra
- [ ] Gradiente LED **rosa (accent)** verticale + linea 3px con glow sopra la plancia
- [ ] Plancia legno 42px con gradiente, pallino LED rosa a sx, titolo Young Serif 15.5, chevron, pill "2 libri" a dx
- [ ] Card progresso 2 colonne: titolo 13/700, autore 11.5, barra 6px bordeaux su surface, testo "30% · p. 214 di 712"
I prossimi 3
- [ ] 3 cover 72x108 con badge numerico 22px (1/2/3) in alto a sx; pattern distinti (fascia bassa, cerchio, fascia centrale)
- [ ] Slot tratteggiato 72x108 "+ Trascina qui" (2px dashed olive, bg olive 10%)
- [ ] Tazza fumante dopo lo slot; LED olive `#81815D`
- [ ] Plancia "I prossimi 3" con pill "3 su 3"; titoli sotto la plancia 11/14 700 a 2 righe con clamp (non 3)
Scaffali per genere (7, ordine della spec)
- [ ] Ogni plancia: pallino con glow del colore genere, titolo Young Serif, chevron; toccabile, naviga alla Vista genere
- [ ] LED (gradiente + linea) nel colore base del genere
- [ ] Dorsi: larghezze 24/28/32/36, altezze 110...134, filetti a 9px e 14px, titolo verticale dal basso, ellissi, cerchietto formato in basso
- [ ] Contrasto titolo corretto (bianco/scuro) per ogni tonalita'
- [ ] 4 pattern cover riconoscibili (righe 135deg, cerchio, fascia bassa, fascia centrale)
- [ ] Un libro appoggiato (10deg) in alcuni scaffali; decorazioni: pianta, candela, tazza, pila libri
- [ ] Badge "In lettura"/"Prossimo" a pillola bordeaux: dentro la cover (alto-sx) o sopra il dorso
- [ ] Icona formato: book-open (cartaceo) / smartphone (digitale)
Drag
- [ ] Libro sollevato: ghost 84x124 ruotato -5deg, scala 1.16, ombra forte, z-index sopra
- [ ] Placeholder tratteggiato nello scaffale d'origine
- [ ] Cerchio di touch rosa 44px sotto il ghost
- [ ] Scaffale bersaglio: anello 3px + alone nel colore genere, LED piu' intenso (5px), pill "Rilascia qui" (dark/light del genere) sulla plancia, titolo troncato
Non-mockup
- [ ] Nessuna stella negli scaffali; nessun cover reale salvo evidenziati (ibrido)

## 2. Vista genere
- [ ] Sfondo pagina = genre.light; header genre.base con angoli inferiori 32, ombra forte + riga 4px
- [ ] Back 44 circolare light/dark; label "GENERE" uppercase tracking .08em; H1 bianco Young Serif 30
- [ ] 3 pill contatori (dark su light): "N libri", "N letti", "N da leggere"
- [ ] Riga "ORDINA PER" con icona; chip Titolo/Autore/Pagine/**Voto (attivo, pieno, freccia giu')**/Data; scroll orizzontale, ultimo tagliato
- [ ] Nota "L'ordine vale dentro ogni sezione..."
- [ ] Sezioni "Letti" (con badge contatore) sopra "TBR"; sottotitolo destro "per voto, dal più alto" / "per voto"
- [ ] Griglia 3 colonne gap 16, cover alta 156 larga 100%, testo: titolo troncato 13/700, autore, "N pag.", stelle (solo letti)
- [ ] Linea mensola sotto ogni riga (10px, bordo superiore base 2px, glow verso l'alto)
- [ ] Badge "Prossimo" dentro la cover TBR
- [ ] Tab bar ricolorata dal genere (sfondo e bordo derivati), Libreria attiva
- [ ] Ordinamento: Letti sempre sopra TBR; l'ordine agisce dentro la sezione

## 3. Sposta / Dettaglio (non letto)
- [ ] Header: back 44, "Dettaglio" 15/700, more 44
- [ ] Hero: cover 126x189, alone radiale del genere, mensola 12px con linea LED viola, titolo Young Serif 27 centrato, autore blu `#3D5D91`
- [ ] Chip: genere pieno (pallino chiaro), "TBR" outline, "Digitale" e "N pag." surface con icone
- [ ] Card Recensione: titolo + chip "Non ancora letto"; testo di blocco esatto; bottone "Sposta" 58px con tile icona e chevron-up
- [ ] Card Serie con mini-dorsi 18px (letto con check, corrente con numero e glow, mancante tratteggiato) + "Serie: Vol. 2 di 3"
- [ ] Scrim `rgba(T,.5)` e sheet dal basso: radius 28, maniglia 40x4, titolo + sottotitolo libro
- [ ] Voci: Segna come letto (check), Cambia genere (tag, chevron-down, **sottomenu con 7 generi + pallino con glow + genere corrente evidenziato con check**), Metti nei prossimi (bookmark + pill "3 su 3")
- [ ] (spec) "Rimuovi dai prossimi" quando il libro e' in coda

## 4. Soft-limit
- [ ] Dialog centrato 320px, radius 28, ombra
- [ ] 3 mini-cover 46x68 + "+" + slot tratteggiato del colore genere
- [ ] Testo Young Serif 19 centrato con N reale: "Hai già N libri nelle prossime letture. Vuoi aggiungerlo comunque?"
- [ ] "Aggiungi comunque" pieno / "Annulla" outline, 50px

## 5. Dettaglio letto + sheet stato
- [ ] Layout compatto: cover 98x147 a sx con alone; titolo 24, autore, chip Fantasy/Cartaceo, "Serie: Vol. 1 di 3", bottone stato outline con check + chevron
- [ ] "Il libro in 3 aggettivi *" con contatore "3/3", campo con chip scuri (x), helper obbligatorio
- [ ] Voto: 5 stelle da 36px + "4/5" (numero Young Serif 26)
- [ ] Valutazioni specifiche: label genere, 5 righe con 5 stelle da 20px
- [ ] Date di lettura: righe con calendario, intervallo con "→", chip "1ª lettura"/"Rilettura", bottone tratteggiato "Aggiungi rilettura"
- [ ] Tag tematici: selezionati pieni scuri con check, non selezionati outline
- [ ] Citazioni: icona virgolette del colore genere, testo serif con «», chip "p. N", bottone "Aggiungi citazione"
- [ ] Sheet stato: radio 24px, selezionato con riga rosa 40% e punto bordeaux; 5 voci (+ "In pausa" se la spec lo richiede); Annulla/Salva 52px

## 6. Esplora
- [ ] Titolo "Esplora" 32 bordeaux; "Ruota della Fortuna" 24 + descrizione
- [ ] Chip filtro: "Tutti i non letti" pieno, poi 7 generi con pallino (scroll)
- [ ] Ruota: bordo bordeaux con 24 puntini alternati rosa/chiaro, 10 spicchi con i colori genere e bordo chiaro 2.5, testi Figtree 700 ruotati e leggibili (chiaro su Classici/Fantasy, scuro sugli altri), hub centrale "GIRA", **puntatore rosa in alto con bordo bordeaux**
- [ ] Ombra sotto la ruota; card risultato: cover 64x96, "LA SORTE HA SCELTO" uppercase, titolo serif, autore blu, chip genere
- [ ] "Gira ancora" (outline + shuffle) e "Metti nei prossimi" (pieno + bookmark)
- [ ] Calendario 2026: titolo + chip anno, descrizione, legenda 7 generi, 12 mesi in 2 colonne, L M M G V S D (lunedi' primo), gennaio parte da giovedi'
- [ ] Giorni: disco 20px colore genere, numero 9.5/700 (bianco su Classici/Fantasy), giorni senza lettura solo numero 10/600; 2 generi = meta' e meta' con disco interno chiaro; 3+ generi conic
- [ ] Tab Esplora attiva

## 7. Statistiche
- [ ] Titolo 32 + chip "2026"
- [ ] Card "Genere più letto" full width con barra segmentata (flex per conteggio, radius 6)
- [ ] Griglia 2x2: Autore dell'anno, Mese d'oro, Pagine totali (18.420), Streak (23 giorni / Record: 41 giorni); tile icona 30px olive tenue, label 13/700 bordeaux scuro
- [ ] "Tag più usati": chip chiari con contatore scuro in pallino
- [ ] "Bookish Bingo" + badge scuro "7 su 16"; card link con mini-griglia 4x4 (stato esatto `1011 0100 1010 0100`), titolo, sottotitolo, barra 44%, "Apri la card ›"
- [ ] "Citazioni" + "Vedi tutte" blu; card promo con bottone "Crea Quote Card" e due mini-card ruotate (-6deg / +5deg) nei colori genere
- [ ] Due citazioni in card elevate con pallino genere, titolo in grassetto, autore abbreviato, chip pagina
- [ ] Cimitero DNF: sfondo oliva chiaro con bordo, petali rosa, titolo serif con tile fiore, 3 lapidi ad arco (ruotate leggermente) con icona libro, titolo, autore, filetto, "Riposa a pag. N"; terreno ondulato e 4 fiori bordeaux
- [ ] Tab Statistiche attiva

## 8. Bingo
- [ ] Header con back + "Bookish Bingo" 30 bordeaux
- [ ] Tab anni: 2026 pieno, 2025/2024 outline, "+ Nuova card" tratteggiato
- [ ] Riepilogo "7 su 16" + trofeo in cerchio olive + barra 44%
- [ ] Card rosa pallido (`--color-bingo-card`), titolo "La card del 2026"
- [ ] Griglia 4x4 di cerchi con aspect-ratio 1, icone corrette (vedi tabella in DESIGN_REFERENCE §8): libro aperto, medaglia 1, ciak, smartphone / tre cuori, trofeo, piuma, matassa / corona d'alloro, tempio, lente, scintilla / chiesa-torre, battito, aeroplanino, nota
- [ ] Completate: fondo rosa + bordo bordeaux 2px + icona bordeaux + badge check 26px in alto a dx; da fare: bordo 1.5 al 55% + icona al 75%
- [ ] Label 12/600 e libro collegato in corsivo 10.5 con ellissi (solo completate)
- [ ] Legenda (Da fare / Completata) + frase di aiuto
- [ ] "Le tue card": righe con mini-griglia 9px, anno serif, "16 su 16 · Bingo completo!", "11 su 16 · Quasi!", chevron
- [ ] Tab Statistiche attiva

## 9. Verifica automatica consigliata (Playwright)
- Screenshot a 390x844 (e full-page) delle route vs `screens/` con soglia `maxDiffPixelRatio` bassa per le zone statiche (header, tab bar, sheet); ignorare cover reali e immagini.
- Test di contrasto dorsi: ogni tonalita' x inchiostro >= 3:1.
- Test no-hex: grep degli hex fuori dai file tema.
- Test a11y: nomi accessibili di dorsi (`aria-label`), `aria-pressed` su chip/celle, `role=radiogroup` nello stato lettura, `role=dialog` nel soft-limit.
