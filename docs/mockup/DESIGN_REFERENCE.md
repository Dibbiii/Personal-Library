# Segnalibro - Design Reference (pixel-level)

Fonte di verita': `Segnalibro_Work_Package/mockups/Segnalibro · Mockup scelti.html` (bundle auto-estraente: 8 pagine React/"dc-runtime" con **markup statico a stili inline**, nessuna interazione/JS di stato; solo `a:hover{color:#5A86CB}`). Tutti i numeri qui sotto sono letti dal markup originale e dal DOM renderizzato a 390px (DPR 2), non stimati. Il PDF e' la stampa dello stesso HTML (529px di larghezza = 1.356x): **nessuna differenza di contenuto** tra PDF e HTML.

Indice file in `docs/mockup/`:

| File | Contenuto |
|---|---|
| `screens/01..08-*.png` | render HTML a 390px @2x (780px di larghezza), 1 per schermata |
| `screens/pdf/*.png` | PNG del PDF (529px) |
| `screens/extra/*.png` | crop di dettaglio (@2x e @3x), stati senza overlay (`03b`, `04b`, `05b`), preview asset |
| `assets/*.svg` | illustrazioni, ruota, icone (sprite), con `var(--token)` |
| `assets/raw/` | font woff2 originali + markup originale per schermata (`raw/markup/*.html`, contiene hex: e' il riferimento grezzo) |
| `SPINES.md`, `spine-algorithm.ts`, `spine-prototype.html` | algoritmo dorsi |
| `CHECKLIST.md` | checklist di fedelta' per il revisore |

Frame del mockup (larghezza 390; altezze): Home 2380, Genere 1440, Sposta 1440, Soft-limit 844, Dettaglio+stato 1760, Esplora 2480, Statistiche 2282, Bingo 1560. La barra tab e' `position:absolute; bottom:0` dentro il frame (in app sara' fissa al viewport). Le altezze dei frame sono fisse: lo spazio vuoto sotto il contenuto (es. Statistiche 1806-2198) **non** e' design.

---

## 0. Scoperte critiche (leggere prima)

1. **Font reali**: `Young Serif` (400, unico peso; titoli/serif) + `Figtree` (variable, pesi 400/500/600/700 usati). **Non** Fraunces + Inter come da MASTER_SPEC §39. Entrambi OFL, su Google Fonts e su Fontsource: `@fontsource/young-serif` e `@fontsource-variable/figtree`. I 4 woff2 originali (latin + latin-ext) sono in `assets/raw/`. Figtree e' un unico file variabile (wght 300-900) riusato per 400/500/600/700. Fallback nel mockup: `Young Serif, Georgia, serif` e `Figtree, system-ui, sans-serif`. Seguire il mockup: aggiornare §39 (decisione: mockup vince).
2. **Due bordeaux**: il mockup usa `#6C0820` per logo, bottoni, tab attiva, barre progresso, badge (quasi ovunque), mentre la spec dice primary `#570F1D`. `#570F1D` compare nel mockup solo per glifi piccoli (icona formato nei cerchietti, label card "Genere piu' letto", titoli libro in corsivo nel Bingo, contorno fiori DNF). Proposta: `--color-primary: #6C0820` (mockup), `--color-primary-deep: #570F1D` (valore spec). Da confermare col committente; fino ad allora **il mockup vince**.
3. **Colori del mockup senza token nella spec** (oltre al punto 2): vedi sezione 2.3 (tabella completa con nomi proposti). I piu' rilevanti: `#6B3A42` (testo secondario), `#3D5D91` (link/info), `#23100A` (inchiostro su colori genere chiari), `#3A2012` + gradiente legno `#D7AF98/#C39A83/#AE8570` (mensole), `#F6E6E2` (sfondo Home), `#FDF7F5` (surface-elevated), `#fbe5ea` (card Bingo), `#e2dbd1` (Cimitero).
4. **Sfondo e chrome contestuali al genere** (vista Genere): pagina = `genre.light`; nav = `mix(light,dark,10%)`; bordo nav = `mix(light,dark,20%)`; linee mensola `mix(light,dark,16%)` -> `mix(light,dark,34%)`; testo su base `#2B1006` (token `--genre-current-on`). Derivati calcolabili, vedi 4.2.
5. **Stati/copy che differiscono dalla spec**: lo sheet "Stato di lettura" ha 5 voci (TBR, In lettura, Letto, Letto piu' di una volta, Non finito (DNF)) - **manca "In pausa"** della spec §6; lo sheet "Sposta il libro" non mostra "Rimuovi dai prossimi" (la spec lo prevede se il libro e' gia' nei prossimi): aggiungere con lo stesso stile delle altre righe (icona tile 42 + label 16/600).
6. **Calendario**: il mockup usa 2 generi = `linear-gradient(90deg, A 50%, B 50%)` con disco interno; per 3+ generi la spec impone `conic-gradient` (non presente nel mockup: estendere con lo stesso disco interno). Non esiste alcun "anello per oggi" nel mockup (vedi 8.4).
7. **Quirk del mockup da NON replicare**: in Home il nome "Assassinio sull'Orient Express" sotto "I prossimi 3" va a capo su 3 righe con ellissi a meta' (line-clamp 2 dichiarato ma rotto); implementare clamp a 2 righe.
8. Le stelle in Vista genere sono glifi testuali `★` (13px, letter-spacing 1px); nel Dettaglio sono SVG stella piena. Consigliato usare sempre l'SVG (`assets/icons-sprite.svg#star`) con lo stesso colore/alpha.

---

## 1. Fondamenti

### 1.1 Tipografia

| Ruolo | Famiglia | Peso | Dimensione / line-height | Note |
|---|---|---|---|---|
| Titolo app "Segnalibro" | Young Serif | 400 | 28 / 1.1 | colore primary |
| Titolo pagina tab (Esplora, Statistiche) | Young Serif | 400 | 32 (nessun LH esplicito) | colore primary |
| Titolo "Bookish Bingo" (con back) | Young Serif | 400 | 30 / 1.1 | primary |
| Titolo vista genere (H1) | Young Serif | 400 | 30 / 1.14 | bianco `#FFFFFF` su base genere |
| Titolo dettaglio libro | Young Serif | 400 | 27 / 1.15 (centrato); 24 / 1.15 (layout compatto con cover a sx) | text-primary |
| Titoli sezione (Ruota della Fortuna, Calendario 2026, Bookish Bingo, Citazioni, Le tue card, Letti/TBR) | Young Serif | 400 | 24 (Letti/TBR 24 / 1.1) | |
| Titolo card stats (valori) | Young Serif | 400 | 22 / 1.12 (genere, autore); 30 / 1.12 (mese, pagine); 24 / 1.12 (streak) | |
| Sheet/Dialog titoli | Young Serif | 400 | 20 (sheet); 19 / 1.3 centrato (soft-limit) | |
| Plancia scaffale (titolo genere) | Young Serif | 400 | 15.5 / 1.1 | colore legno `#3A2012`, `text-shadow:0 1px 0 rgba(255,255,255,.4)`, nowrap + ellipsis |
| Citazioni | Young Serif | 400 | 16 / 23 (Stats), 15 / 21 (Dettaglio) | |
| Label UI forti | Figtree | 700 | 12-17 | bottoni, tab attiva, badge |
| Label UI medie | Figtree | 600 | 12-16 | chip, tab inattiva, row sheet |
| Corpo | Figtree | 400 | 13-14 / 17-20 | |
| Micro (badge libro) | Figtree | 700 | 10 / 14 | |
| Uppercase tracked | Figtree | 700 | 12.5, `letter-spacing:.08em` ("GENERE"), 12.5 `.06em` ("ORDINA PER"), 11.5 `.07em` ("LA SORTE HA SCELTO") | |

Nessun altro letter-spacing. `font-variant-numeric` non usato (i numeri Young Serif sono old-style: "18.420", "2026" appaiono con cifre capitello nel glifo: **e' voluto**, non forzare tabular). Formato numeri: separatore migliaia "." (`18.420`, `1.008 pag.`), date `12 mar 2024 → 29 mar 2024`.

### 1.2 Raggi

| Uso | px |
|---|---|
| Cover/copertina | `3 8 8 3` (sx stretto = costola) |
| Dorso | `3 3 1 1` |
| Chip/pill standard | metà altezza (h28 -> 14, h32 -> 16, h36 -> 18, h38 -> 19, h40 -> 20) |
| Card Home progresso | 14 |
| Card riga (serie, date, cimitero header) | 20 |
| Card sezione (dettaglio) | 22 (Recensione 24) |
| Card principale (wheel, cimitero, bingo card) | 28 |
| Header genere | `0 0 32 32` |
| Sheet | `28 28 0 0`; dialog 28 |
| Bottoni primari grandi | 16-18 (Sposta 18; azioni 16; Bingo tile 12) |
| Slot "Trascina qui" | 8; placeholder dorso 3; placeholder dialog 6 |
| Lapide | `52 52 10 10` |
| Cerchi (pallini, nav dot, radio) | 50% |

### 1.3 Ombre e bagliori (tutti usano `rgb(52,10,14)` = text-primary `#340A0E` con alpha)

| Nome | Valore |
|---|---|
| Cover | `0 8px 10px -5px rgba(T,.45), inset 4px 0 0 rgba(0,0,0,.10), inset 6px 0 0 rgba(255,255,255,.16)` |
| Dorso | `3px 0 4px -1px rgba(T,.3)` |
| Card progresso Home | `0 6px 12px -6px rgba(T,.3)` |
| Plancia scaffale | `inset 0 1px 0 rgba(255,255,255,.4), 0 14px 16px -8px rgba(T,.42)` |
| LED linea (3px) | `0 0 10px 2px rgba(G,.75), 0 6px 22px 4px rgba(G,.4)` (G = colore genere) |
| LED gradiente verticale | `linear-gradient(to top, rgba(G,.36), rgba(G,.10) 50%, rgba(G,0))`, altezza = altezza scaffale |
| Bottone Sposta | `0 10px 20px -8px rgba(primary,.7)` |
| Sheet | `0 -10px 40px rgba(T,.28)` |
| Dialog | `0 24px 60px rgba(T,.4)` |
| Scrim | `rgba(T,.5)` |
| Wheel | `filter: drop-shadow(0 14px 14px rgba(T,.25))` |
| Header genere | `0 16px 34px -8px rgba(base,.65), 0 4px 0 0 rgba(base,.5)` |
| Mini-card quote | `0 8px 14px -6px rgba(T,.45)` / `.4` |
| Lapide | `0 8px 12px -6px rgba(#323522,.4)` |
| Ghost drag | `filter: drop-shadow(0 20px 14px rgba(T,.4))` |

Implementare con `color-mix(in srgb, var(--color-text-primary) 45%, transparent)` per non scrivere colori letterali.

### 1.4 Dimensioni touch (px)
Back/more 44; camera 48; chip ordinamento/filtri 40; year-pill Bingo 40; tab item: zona `flex:1` x 84 di altezza (pill visiva 60x32); riga sheet azione 60 (icon tile 42); riga genere nel sottomenu 44; radio stato 48; bottone Sposta 58; bottoni dialog 50; bottoni sheet stato 52; bottoni risultato ruota 50; "Crea Quote Card" 46; "Aggiungi rilettura/citazione" 46; chip tag 38; aggettivo 36; cella Bingo = cerchio ~73 (aspect-ratio 1, 4 colonne); autore (link) `min-height:24`.

### 1.5 Layout globale
- Larghezza mobile 390. Gutter laterale **20** (Genere, Dettaglio, Esplora, Stats, Bingo); **16** per la griglia progresso Home e header Dettaglio; scaffali Home `padding:0 18` (11 per "I prossimi" con margini item 7).
- Tab bar: `height 84; padding 8 12 14; background background; border-top 1px surface; z-index 5`; 3 item `flex:1; column; center; gap 4`. Pill icona 60x32 radius 16, icona 22 stroke 1.9. Attiva: pill `background: primary`, icona `background`, label 12/14 **700** color primary. Inattiva: pill trasparente, icona+label `#323522` (shelf-axis), label 12/14 **600**. Label: "Libreria", "Esplora", "Statistiche". Icone: library (scaffale), compass, bar-chart. Nella vista Genere la tab attiva resta **Libreria** e la barra e' ricolorata (vedi 4.2). Le schermate Dettaglio (sheet e stato) **non** mostrano la tab bar; il frame soft-limit si'.
- Bingo: tab attiva = Statistiche (e' raggiunta da Statistiche), back verso Statistiche.

---

## 2. Colori

### 2.1 Mappatura sui token di MASTER_SPEC §21

| Token | Valore spec | Valore nel mockup | Dove |
|---|---|---|---|
| `--color-background` | `#FAF1EE` | `#FAF1EE` | sfondo Dettaglio/Esplora/Stats/Bingo, nav, testo su primary, dischetti formato (alpha .92) |
| `--color-surface` | `#F2DCDB` | `#F2DCDB` | card, chip neutri, tile icone back/camera/more, separatori sheet |
| `--color-accent` | `#F2AEBC` | `#F2AEBC` | glow LED Home "In lettura", cerchi bingo completati, riga radio selezionata (alpha .4), puntatore ruota, cerchio touch drag (alpha .55), petali |
| `--color-text-primary` | `#340A0E` | `#340A0E` | tutto il testo principale e base delle ombre |
| `--color-primary` | `#570F1D` | **`#6C0820`** (differenza!) | vedi 0.2 |
| `--color-secondary` | `#6F2B34` | **non usato** | il testo secondario del mockup e' `#6B3A42` |
| `--color-shadow` / icons dark | `#111506` | **non usato** | le ombre sono `rgb(52,10,14)` |
| shelf axis / dark olive | `#323522` | `#323522` | icone/label tab inattive, badge contatori (tag, "7 su 16"), testo slot "Trascina qui", bordi chip (alpha .3), radio (alpha .5), Cimitero |
| divider / icone inattive | `#81815D` | `#81815D` | LED "I prossimi", tile icone stats (alpha .22), stato TBR, serie "letto", terreno cimitero, slot dashed (alpha .7/.1) |
| `--color-surface-elevated` | (senza valore) | `#FDF7F5` | card progresso Home, card citazione Stats |
| `--color-text-secondary` | (senza valore) | `#6B3A42` | sottotitoli, autori Home, descrizioni, helper |
| `--color-on-primary` | (senza valore) | `#FAF1EE` | |
| `--color-info` | (senza valore) | `#3D5D91` (+ hover `#5A86CB`, tint bg `rgba(90,134,203,.14)`) | autore (link), "3/3", "Vedi tutte", chip "1ª lettura"/"Rilettura"/"p. 48" |
| `--color-overlay` | (senza valore) | `rgba(52,10,14,.5)` | scrim sheet/dialog |
| `--color-success/warning/danger` | | non presenti nel mockup | |

### 2.2 Palette generi (identica alla spec, verificata)
Usati **base** ovunque (LED, pallini, chip, ruota, calendario), **light** come sfondo pagina genere e dot chip dettaglio, **dark** per bande/chip/tag. Nessuna deviazione dai valori della spec. Colore "ink" sulle tinte: `#23100A` o `#FFFFFF` scelto per contrasto massimo (vedi SPINES.md); `#2B1006` per il testo su base nella pagina genere (Mitologia), `#3F2A5C`/`#E6DCF0` per tag Fantasy.

### 2.3 Colori NON coperti da token (proposta nomi)

| Hex nel mockup | Uso | Token proposto |
|---|---|---|
| `#6C0820` | primary reale (vedi 0.2) | `--color-primary` (e `--color-primary-deep: #570F1D`) |
| `#6B3A42` | testo secondario | `--color-text-secondary` |
| `#3D5D91` / `#5A86CB` / `rgba(90,134,203,.14)` | link/info, hover, tint | `--color-info`, `--color-info-hover`, `--color-info-tint` |
| `#FDF7F5` | surface elevata | `--color-surface-elevated` |
| `#F6E6E2` (+ 16 blob radiali, vedi 3.1) | sfondo Home | `--color-background-shelf` |
| `#23100A` | inchiostro su tinte chiare (dorsi, cover, ruota, giorni calendario) | `--color-on-genre-ink` (il bianco `#FFFFFF` = `--color-on-genre-white`) |
| `#3A2012` | testo plancia | `--color-wood-ink` |
| `#D7AF98 / #C39A83 / #AE8570` | gradiente plancia legno | `--color-wood-top / -mid / -bottom` |
| `#EBD0BC / #DDB9A2 / #C9A08A` | mensola nel Dettaglio (`#C9A08A` anche contorno cera candela) | `--color-wood-detail-top / -mid / -bottom` (o riuso wood + alpha); `#C9A08A` -> `--color-wax-edge` |
| `#E8843A` fiamma, `#FBE3CC` cuore fiamma | candela (coincidono con base/light Distopia ma sono decorativi) | `--color-flame`, `--color-flame-core` |
| `#656648`, `#949475`, `#D98565` | foglie e bordo vaso | `--color-leaf-dark`, `--color-leaf-light`, `--color-pot-rim` (vaso `#C4694A` = base Mitologia -> `--color-pot`) |
| `#DDBFBB` | maniglia sheet | `--color-sheet-handle` |
| `#fbe5ea` | sfondo card Bingo (nel sorgente `#FCE4F3` sovrascritto) | `--color-bingo-card` |
| `#e2dbd1` | sfondo Cimitero DNF | `--color-graveyard-bg` |
| `#F6EAE7 -> #E6D2CF` | gradiente lapide | `--color-tomb-top / -bottom` |
| `#DCEEF8`, `#23506E` | mini quote card Contemporanea (= light/dark genere) | usare i token genere |
| Derivati genere vista Genere: nav `#e7ccc0`, bordo nav `#d9baae`, linea mensola `#dfc1b5 -> #c6a294` | calcolabili: `color-mix(in srgb, light, dark N%)` con N = 10, 20, 16, 34 | `--genre-current-nav-bg/-nav-border/-line-top/-line-bottom` |

Regola spec: nessun hex nei componenti. Tutti i valori sopra vanno nel file del tema `segnalibro` come token; le tonalita' dei dorsi si derivano a runtime (SPINES.md).

---

## 3. HOME (Libreria)  -  `screens/01-home.png`, `extra/01a..01i`

Frame 390 x 2380. Background pagina: `#F6E6E2` + **16 gradienti radiali sfumati** `radial-gradient(ellipse Wpx Hpx at Xpx Ypx, COLOR, transparent 72%)` sparsi (ellissi 78-146 x 31-64 px) con 3 colori: `rgba(242,174,188,.3)` (accent), `rgba(242,220,219,.9)` (surface), `rgba(255,255,255,.35)`. Sono "nuvole blush" decorative ai lati; posizioni nel mockup es. (278,1046), (390,1907), (17,1522), (238,417)... Implementazione: un `::before` assoluto con 8-10 blob fissi (non serve la posizione esatta).

Sequenza verticale (y = offset nel frame, h = altezza; misurati):

| Blocco | y | h |
|---|---|---|
| Header | 0 | 96 (content 64 + padding 20/12) |
| Spacer | 96 | 18 |
| Scaffale "In lettura" (area libri) | 114 | 224 |
| Plancia "In lettura" | 338 | 42 |
| Griglia progresso (2 card) | 380 | 98 (padding 16 16 0) |
| Spacer | 478 | 28 |
| Scaffale "I prossimi 3" | 506 | 162 |
| Plancia "I prossimi 3" | 668 | 42 |
| Riga titoli sotto la plancia | 710 | 58 |
| Spacer | 768 | 28 |
| Scaffale Classici | 796 | 168 (+42 plancia a 964, + spacer 26) |
| Mitologia | 1032 / plancia 1200 | |
| Distopia | 1268 / plancia 1436 | |
| Thriller | 1504 / plancia 1672 | |
| Fantasy | 1740 / plancia 1908 | |
| Romance (drag target) | 1976 h210 / plancia | |
| Contemporanea | 2212 / plancia 2380 | |
| Tab bar (frame) | 2296 | 84 |

Ogni blocco scaffale: `[area libri 168][plancia 42][spacer 26]` = 236 di passo. Nella demo il frame e' "tagliato" dalla tab bar: l'ultimo scaffale finisce sotto la nav (scroll).

### 3.1 Header (y 0-96)
- Contenitore `display:flex; justify-content:space-between; align-items:center; padding:20px 20px 12px; height:64` (content-box).
- Sinistra: riga `gap 8, color primary`: icona **bookmark** 24px stroke 2 (`assets/logo-segnalibro.svg`) + "Segnalibro" (Young Serif 28/1.1). Sotto: "Ciao Alessandra, cosa leggi oggi?" Figtree 13px `#6B3A42`, margin-top 2.
- Destra: bottone circolare 48x48, bg surface, icona **camera** 22px stroke 1.9 colore primary; `aria-label="Scansiona il codice ISBN"`.

### 3.2 Scaffale "In lettura"
- Contenitore scroll orizzontale (`.hs`: scrollbar nascosta), riga interna `position:relative; isolation:isolate; display:flex; align-items:flex-end; gap:2px; width:max-content; min-width:100%; padding:0 18px; height:224`.
- Fondo: gradiente LED verticale accent (altezza 224) + linea 3px accent con glow (vedi 1.3): colore LED = **`#F2AEBC` (accent)**, non un genere.
- Elementi (tutti `margin:0 8px`, allineati al fondo): cover **Dune 104x156**, candela (46x72), cover **Le otto montagne 104x156**, pianta (56x86). Cover = vedi 3.6 (Dune: base Distopia x.86 `#c87232` + righe; Otto montagne: `#86bde2` + righe scure). Icona formato: cerchio 20px `right:5 bottom:5` (alpha .92) con book-open 12px. **Niente badge** qui.
- Plancia: bottone full-width h42, `padding 0 14`, gradiente legno, `gap 10`: pallino LED 10px (colore = accent con glow `0 0 9px 2px rgba(accent,.9)`, bordo `1.5px rgba(255,255,255,.55)`), titolo "In lettura" (Young Serif 15.5), chevron-right 16 stroke 2.6 colore `#3A2012`; a destra pill "2 libri" (h26, padding 0 10, radius 13, bg `rgba(250,241,238,.88)`, 12/700, colore text-primary).
- Sotto: griglia 2 colonne `gap 12; padding 16 16 0`. Card: `padding 10 12; radius 14; bg #FDF7F5; shadow 0 6px 12px -6px`. Titolo 13/16 **700** ellipsis nowrap; autore 11.5/15 `#6B3A42`; barra `margin-top 7; h6; radius 3; bg surface`, fill primary con `width = %`; testo `11/15 #6B3A42 margin-top 3`: "30% · p. 214 di 712" e "62% · p. 164 di 264". (Dune: Frank Herbert; Le otto montagne: Paolo Cognetti.)

### 3.3 "I prossimi 3"
- Scaffale h162, `padding 0 11`, item `margin 0 7`, LED colore **divider `#81815D`** (glow .36/.1/0, linea 3px, stesse ombre con alpha).
- 3 cover **72x108** con pattern (vedi SPINES.md: Circe = fascia bassa scura, Il problema dei tre corpi = cerchio, Assassinio = fascia centrale scura) e **badge numerico**: cerchio 22x22 `left:5 top:5`, bg primary, testo `#FAF1EE` 12/700 ("1","2","3").
- Slot vuoto **"Trascina qui"**: 72x108, `border:2px dashed rgba(#81815D,.7); background:rgba(#81815D,.1); radius 8; column center gap 4; colore #323522`; icona plus 20 stroke 2 + testo 11/13 **600** centrato "Trascina<br>qui".
- Dopo lo slot: tazza fumante (46x50, `assets/mug.svg`).
- Plancia: pallino `#81815D`, titolo "I prossimi 3", chevron, pill destra **"3 su 3"** (stile pill come "2 libri"). Il numero e' dinamico ("1 su 3", ... ; oltre i 3: soft limit).
- Sotto la plancia riga titoli: `display:flex; padding:14px 11px 0; height:44` (content-box => 58): per ogni slot `width 72; margin 0 7; 11/14 700; -webkit-line-clamp:2` (titolo libro, colore text-primary). Testi: "Circe", "Il problema dei tre corpi", "Assassinio sull'Orient Express".

### 3.4 Scaffali per genere (7)
Ordine e copy titoli: Classici; Mitologia, Epica e Retelling; Distopia e Fantascienza; Thriller, Gialli e Mistero; Fantasy, Realismo Magico e Gotico; Romance, Young Adult e New Adult; Narrativa Contemporanea e Storica. Il titolo e' un `<a href=Genere>` (il primo e' `<button>`): tutta la plancia e' toccabile (h42 >= 44? e' 42: estendere l'area di tocco a 44 senza cambiare l'aspetto).
- Area libri: h168, `padding 0 18`, `gap 2`, LED = colore **base del genere**.
- Plancia: pallino LED colore base genere (10px, glow `0 0 9px 2px`), titolo, chevron. La pill di stato compare solo dove serve (In lettura, Prossimi 3, drag "Rilascia qui").
- Contenuto: sequenza di dorsi/cover/decorazioni (vedi SPINES.md per il rendering esatto, dimensioni e tonalita').
- **Badge libro**: "In lettura"/"Prossimo" = pillola `background primary; color #FAF1EE; 10/14 700; radius 999`. Su **cover** (84x124): dentro, `left 6, top 6, padding 2 7`. Su **dorso**: sopra, `left 50%; bottom:100%; margin-bottom 5; translateX(-50%); padding 2 8; z-index 8; shadow 0 3px 6px rgba(T,.3)`.
- **Indicatore formato**: cerchio che contiene icona: cartaceo = `book-open`, digitale = `smartphone`; dorso: cerchio 16 (`bottom 6`, centrato, bg `rgba(250,241,238,.92)`, icona 10 stroke 2.2, colore `#570F1D`); cover: cerchio 20 (`right 5 bottom 5`, opacity .92, icona 12 stroke 2).
- **Stelle se recensito**: non mostrate negli scaffali Home (solo nella Vista genere e Dettaglio): mantenere cosi'.
- Decorazioni per scaffale (una per scaffale, margini `0 8`): Classici pianta (dopo il libro appoggiato), Mitologia candela, Distopia tazza, Thriller pila libri (80x46), Fantasy pianta, Romance candela, Contemporanea pila libri. Asset in `assets/`.

### 3.5 Stato drag (Fantasy/Romance in `extra/01g`)
- Libro sollevato ("La ragazza del treno", cover 84x124 Thriller): `position:absolute; left:150; top:-150` (relativo al wrapper dello scaffale bersaglio), `z-index 30; transform: rotate(-5deg) scale(1.16); transform-origin:50% 70%; filter: drop-shadow(0 20px 14px rgba(T,.4))`. E' "ghost" giallo pieno (non trasparente).
- Nello scaffale di origine (Thriller) resta un **placeholder**: rettangolo con la stessa larghezza del dorso (24x110), `border:2px dashed rgba(genre.dark,.55); background:rgba(genre.base,.14); radius 3`.
- **Cerchio di touch**: `position:absolute; left:174; top:-24; 44x44; radius 50%; background rgba(accent,.55); border 2px solid rgba(primary,.35); z-index 31` (posizione del dito sotto il ghost).
- **Scaffale bersaglio (Romance)**: wrapper `position:relative; z-index:10` con `box-shadow:0 0 0 3px rgba(base,.7), 0 0 38px 8px rgba(base,.55)` (anello + alone) che racchiude area libri + plancia; LED rinforzato: gradiente `.6/.2/0`, linea **5px** con `0 0 14px 3px rgba(base,.9), 0 8px 30px 8px rgba(base,.6)`; pallino plancia con glow `0 0 12px 3px`.
- Pill **"Rilascia qui"** nella plancia (a destra): `h28; padding 0 12; radius 14; gap 6; background genre.dark (#7A2444); color genre.light (#FADCE4); 12/700`, icona chevron-down 14 stroke 2.4.
- Il titolo dello scaffale bersaglio viene troncato con ellissi ("Romance, Young Adult e...") per fare spazio alla pill: `min-width:0` sul gruppo sinistro.

### 3.6 Cover frontale e dorsi  ->  SPINES.md

### 3.7 Testi Home (esatti)
"Segnalibro", "Ciao Alessandra, cosa leggi oggi?", "In lettura", "2 libri", "Dune", "Frank Herbert", "30% · p. 214 di 712", "Le otto montagne", "Paolo Cognetti", "62% · p. 164 di 264", "I prossimi 3", "3 su 3", "Trascina qui", "Prossimo", "In lettura", "Rilascia qui", "Libreria / Esplora / Statistiche". (Il saluto usa il display name; opzionale per la spec.)

### 3.8 Stati vuoti (Home)
Il mockup non ha schermate vuote dedicate. L'unico stato "vuoto" disegnato e' lo slot "Trascina qui" (prossimi). Per scaffale/libreria vuoti il committente non ha disegnato nulla: usare la plancia + l'area libri con il solo LED e, se serve, il placeholder tratteggiato (stile slot). Copy proposti (non da mockup, da confermare): "Nessun libro in lettura", "Questo scaffale e' ancora vuoto".

---

## 4. VISTA GENERE  -  `screens/02-genre.png` (Mitologia)

Frame 390 x 1440, sfondo = `genre.light` (`#F5DDD2`). Tokens contestuali: `--genre-current` (base `#C4694A`), `-light`, `-dark` (`#6B301D`), `-on` (`#2B1006`).

### 4.1 Header (y 0-214)
- Box: `background genre.base; border-radius 0 0 32 32; padding 16 20 26; shadow` (1.3). Riga 1 `flex space-between center`: back 44x44 cerchio `background genre.light; color genre.dark`, chevron-left 22 stroke 2.2; label **"GENERE"** 12.5/700 uppercase `letter-spacing .08em` colore `#2B1006`; spaziatore 44. H1 `margin:14 0 0`, Young Serif 30/1.14 bianco (va a capo: "Mitologia, Epica e Retelling").
- Pill contatori: riga `gap 8; margin-top 16`; pill `h30; padding 0 12; radius 15; background genre.dark; color genre.light; 12.5/700`: "9 libri", "6 letti", "3 da leggere".

### 4.2 Ordinamento
- Sezione `padding 22 20 0`: label "ORDINA PER" con icona sort 16 stroke 2 (gap 6), 12.5/700 uppercase `.06em` colore genre.dark.
- Chip (scroll orizzontale, `margin:10 -20 0; padding 0 20; gap 8`): **Titolo, Autore, Pagine, Voto, Data**. Chip: `h40; padding 0 16; radius 20; border 1.5px solid genre.base; 14px`. Inattivo: trasparente, colore genre.dark, 600. **Attivo ("Voto")**: `background genre.base; color #2B1006; 700; gap 6` con icona **arrow-down** 16 stroke 2.4 (desc). Il chip "Data" e' tagliato dal bordo (scroll).
- Nota: "L'ordine vale dentro ogni sezione: i libri letti restano sempre in cima." 12.5/17 colore genre.dark, margin-top 10.

### 4.3 Sezioni
- Testata sezione: `flex space-between center; padding 0 20; height 56; margin-top 10`. Sinistra: titolo Young Serif 24/1.1 genre.dark + badge contatore (`min-width 26; h26; padding 0 8; radius 13; background genre.base; color #2B1006; 13/700`). Destra: 12.5 genre.dark opacity .9: **"per voto, dal più alto"** (in "Letti") / **"per voto"** (in TBR).
- Sezione "Letti" (6) poi "TBR" (3), distanziate da uno spacer 10 (TBR header a y 968).
- Griglia: `position:relative; display:grid; grid-template-columns:repeat(3,1fr); gap 16; padding 0 20; height 268` per riga (colonna ~106 px). Cella: cover `margin-top:10; h156; width:100%` (vedi SPINES.md) poi blocco testo `margin-top 20; h74`:
  - titolo 13/16 700 genre.dark, nowrap+ellipsis
  - autore 12/15 genre.dark opacity .88 (margin-top 1)
  - "N pag." 12/15 opacity .88 (es. "412 pag.")
  - stelle `margin-top 3; h14`: `★` 13px letter-spacing 1px colore genre.base; stelle vuote `rgba(base,.28)`; aria-label "N stelle su 5". Solo libri recensiti (sezione Letti).
- **Linea mensola** per riga: `position:absolute; left 0; right 0; top:166; height 10; background linear-gradient(180deg, mix(light,dark,16%), mix(light,dark,34%)); border-top:2px solid genre.base; box-shadow: 0 -10px 22px -2px rgba(base,.6), 0 6px 12px -4px rgba(dark,.4)` (i piedi delle cover poggiano sulla linea: 10 + 156 = 166).
- **Badge**: "Prossimo" (come 3.4) sul libro TBR in coda (Circe).
- Varianti cover nella griglia (pattern per libro, vedi SPINES.md): La canzone di Achille `#cd8167` fascia bassa scura; Odissea base righe; Il silenzio delle ragazze `#a95a40` fascia centrale chiara; Il canto di Penelope `#a95a40` righe; Norse Mythology base fascia centrale; Lavinia base fascia centrale; Circe/Medea/Iliade `#a95a40/#a9583c/#a9583c` fascia bassa scura.
- Tab bar ricolorata: `background mix(light,dark,10%) #e7ccc0; border-top 1px mix(light,dark,20%) #d9baae`; tutto il testo/icone `genre.dark`; pill attiva `background genre.dark; color genre.light`; label attiva 700, inattive 600.
- Dati mock: Letti = La canzone di Achille (Madeline Miller, 412 pag., 5 stelle, digitale), Odissea (Omero, 496, 5), Il silenzio delle ragazze (Pat Barker, 368, 4), Il canto di Penelope (Margaret Atwood, 160, 4), Norse Mythology (Neil Gaiman, 304, 4, digitale), Lavinia (Ursula K. Le Guin, 352, 3); TBR = Circe (Madeline Miller, 432 pag., Prossimo), Medea. Voci (Christa Wolf, 288), Iliade (Omero, 640).

---

## 5. DETTAGLIO LIBRO E SHEET

### 5.1 Header comune (h 72 = 58 + 14)
`padding 14 16 0; height 58; flex space-between center`: back (44 cerchio surface, colore primary, chevron-left 22 sw 2.2, aria "Indietro"), titolo **"Dettaglio"** Figtree 15/700, bottone `more-horizontal` (44 cerchio surface, tre pallini r=1.2 pieni, aria "Altre azioni").

### 5.2 Variante "libro non letto" (`screens/03-move-sheet.png`, stato pulito `extra/03b-detail-no-sheet-tbr.png`)
- **Hero** 260x236, `margin:6 auto 0`: alone `radial-gradient(ellipse at 50% 100%, rgba(base,.55), rgba(base,0) 70%)` (h150, bottom 16); cover **126x189** (tonalita' shade genre `#6c4e90`, fascia centrale chiara) centrata `top:0`; mensola `left:0; right:0; bottom:16; h12; radius 4; background linear-gradient(180deg,#EBD0BC,#DDB9A2 55%,#C9A08A); shadow 0 0 18px 4px rgba(base,.55), 0 6px 10px -3px rgba(T,.3)`; linea LED `left 20; right 20; bottom 27; h3; radius 2; background base; shadow 0 0 12px 3px rgba(base,.8)`.
- Testi centrati `padding 10 24 0`: titolo Young Serif 27/1.15 "La paura del saggio"; autore link (Figtree 15/600 `#3D5D91`, margin-top 6) "Patrick Rothfuss"; chip `margin-top 14; gap 8; wrap; center`:
  - genere: `h32; padding 0 12; radius 16; bg base; color #FFFFFF; 13/600; gap 6` + pallino 9 colore `genre.light`: "Fantasy, Realismo Magico e Gotico"
  - stato: outline `border 1.5px solid #81815D; color #323522; bg transparent` + pallino 8 `#81815D`: "TBR"
  - formato: bg surface, color text-primary, icona smartphone 15 sw 2: "Digitale"
  - pagine: bg surface, icona file-text 15: "1.008 pag."
- **Card Recensione** (`margin 18 20 0; padding 20; radius 24; bg surface`): testata flex: "Recensione" Young Serif 20 + chip "Non ancora letto" (`h28; padding 0 12; radius 14; bg #FAF1EE; color #6B3A42; 12/600`); testo `margin 8 0 16; 14/20 #6B3A42`: **"Voto, tag e citazioni si sbloccano quando segni il libro come letto."**; bottone **"Sposta"**: `width 100%; h58; radius 18; bg primary; color #FAF1EE; 17/700; gap 12; shadow 0 10px 20px -8px rgba(primary,.7)` con tile 38x38 radius 12 `rgba(250,241,238,.16)` contenente icona `library` 24 sw 1.8, label, e chevron-up 18 sw 2.4 (aperto).
- **Card Serie** (`margin 14 20 0; padding 12 16; radius 20; bg surface; flex gap 14`): mini-dorsi (`gap 4; h54; align-items:flex-end`): volume letto 18x48 `bg #81815D` con check bianco 12 sw 2.6; volume corrente 18x54 `bg base` + glow `0 0 10px 1px rgba(base,.7)` con numero "2" bianco 11/700; volume mancante 18x48 tratteggiato `1.5px dashed rgba(#323522,.45)`. Raggi `3 5 5 3`. Testo: "Serie: Vol. 2 di 3" 15/700; "Le Cronache dell'Assassino del Re" 12.5/17 `#6B3A42` (mt 2).
- Scrim `rgba(T,.5)` su tutto il frame (z 30).

#### Sheet "Sposta il libro" (z 40)
`position:absolute; left/right/bottom 0; background #FAF1EE; radius 28 28 0 0; shadow 0 -10 40 rgba(T,.28); padding 10 20 24` (y 830, h 611 su 1440).
- Maniglia 40x4 radius 2 `#DDBFBB`, centrata, mb 12. Titolo "Sposta il libro" Young Serif 20. Sottotitolo = titolo libro 13px `#6B3A42` (margin `2 0 6`).
- Riga azione: `min-height 60; gap 14; padding 0` con tile 42x42 radius 14 bg surface colore primary, icona 22 sw 1.9; label `flex:1; 16/600`; chevron 18 colore `#323522` sw 2.2 (destra) o chevron-down 18 sw 2.4 (espandibile). Voci: **Segna come letto** (icona check; chevron-right), **Cambia genere** (icona tag; chevron-down espanso), **Metti nei prossimi** (icona bookmark; a destra pill outline "3 su 3": h28, padding 0 12, `1.5px solid #81815D`, color `#323522`, 12/600 - indica occupazione della coda). Separatori 1px surface tra le voci.
- Sottomenu "Cambia genere": `margin 0 0 6 56; padding 6; radius 16; bg surface`; 7 righe `h44; padding 0 12; gap 12; radius 12; label 14.5/500`, pallino 16 colore base con `box-shadow:0 0 8px 1px rgba(base,.6)`. Genere corrente: riga `background rgba(accent,.4)`, label 700, check 18 sw 2.6 primary a destra. Le label dei generi sono per esteso (vanno a capo su 2 righe per Fantasy/Romance/Contemporanea).
- **Mancano nel mockup** (richieste dalla spec): "Rimuovi dai prossimi" (mostrare al posto di "Metti nei prossimi" quando il libro e' in coda: stessa riga, icona bookmark pieno o x, senza pill).

### 5.3 Dialog soft-limit (`screens/04-soft-limit-dialog.png`, pulito `extra/04b`)
- Stessa base Dettaglio (card Recensione senza testo di lock qui: titolo + bottone "Sposta" 58 px, `margin-top 16`) + scrim `rgba(T,.5)` (z 30) + **dialog** `role=dialog aria-label="Prossime letture al completo"`: `left/right 35 (larghezza 320); top 232 (centrato verticalmente nel frame 844 => usare centratura)`, `background #FAF1EE; radius 28; padding 24 22 22; shadow 0 24 60 rgba(T,.4)`.
- Riga mini cover: `flex; align-items:flex-end; justify-content:center; gap 8; margin-bottom 18`: 3 cover **46x68** (stessi pattern dei prossimi), simbolo "+" (16 sw 2.4, colore `#323522`, `padding-bottom 26`), slot nuovo libro 46x68 tratteggiato `2px dashed rgba(base del libro,.8); bg rgba(base,.15); radius 6;` plus 18 colore `genre.dark`.
- Domanda: Young Serif 19/1.3 centrata, `margin 0 0 20`: **"Hai già 3 libri nelle prossime letture. Vuoi aggiungerlo comunque?"** (N = conteggio reale).
- Pulsanti in colonna `gap 10`, h50, radius 16, 16/700: **"Aggiungi comunque"** (bg primary, color `#FAF1EE`) e **"Annulla"** (trasparente, `border 1.5px solid rgba(primary,.45)`, color primary).

### 5.4 Dettaglio libro letto + sheet stato (`screens/05-book-detail-review.png`, pulito `extra/05b`)
- Header comune 5.1. Top compatto: `flex gap 16; padding 12 20 0; align-items:flex-start`. Colonna sx: cover **98x147** (tonalita' shade `#6c4e90`, fascia bassa scura `genre.dark` alpha .35, icona formato cerchio 20) con alone `left -12; right -12; bottom -10; h26; radial-gradient(ellipse at 50% 100%, rgba(base,.55), transparent 70%)`. Colonna dx: H1 Young Serif 24/1.15 "Il nome del vento"; autore 14/600 info "Patrick Rothfuss" (mt 4); chip (mt 10, gap 6, h28, radius 14, 12/600): "Fantasy" (bg base, bianco), "Cartaceo" (bg surface, icona book-open 15); "Serie: Vol. 1 di 3" 12.5/600 `#6B3A42` (mt 8); **bottone stato** (mt 10): `h40; padding 0 14; radius 20; border 1.5px solid #81815D; bg rgba(#81815D,.16); color #323522; 14/700; gap 8` con check 16 sw 2.6 + "Letto" + chevron-down 16 sw 2.4 (apre lo sheet stato).
- Card generiche (`margin 14 20 0; padding 18; radius 22; bg surface`), titolo card 15/700 (mb 12 nella testata).
  1. **"Il libro in 3 aggettivi *"** (asterisco primary, aria "obbligatorio") + contatore "3/3" 12.5/700 info. Campo: `padding 10; gap 8; wrap; radius 16; bg #FAF1EE; border 1.5px solid rgba(genre.dark,.35)`; aggettivi chip `h36; padding 0 10 0 14; radius 18; bg genre.dark (#3F2A5C); color genre.light (#E6DCF0); 14/600; gap 6` con x (plus ruotato 45deg, 14 sw 2.4): **Epico, Malinconico, Immersivo**. Helper 12.5 `#6B3A42` mt 8: "Campo obbligatorio: scrivine esattamente 3."
  2. **"Voto"**: 5 stelle SVG **36px** gap 4 (piena: fill+stroke base, sw 1.2; vuota: alpha .22), a destra "4" Young Serif 26 + "/5" 16 `#6B3A42`.
  3. **"Valutazioni specifiche"** + chip genere (`h26; padding 0 12; radius 13; bg genre.light; color genre.dark; 12/600`: "Fantasy"). Righe h40: label 14.5 + 5 stelle SVG **20px** gap 2: Worldbuilding 5, Sistema magico 5, Personaggi 4, Ritmo 3, Atmosfera 5 (per altri generi le categorie cambiano: spec §11).
  4. **"Date di lettura"**: righe `min-height 52; padding 0 14; gap 10; radius 14; bg #FAF1EE; mb 8`: icona calendar 20 sw 1.8 `#323522`, date `flex:1; 14/600` ("12 mar 2024 → 29 mar 2024", "3 gen 2026 → 18 gen 2026"), chip info tint (h26, radius 13, 12/600, bg `rgba(90,134,203,.14)`, colore info): "1ª lettura" / "Rilettura". Bottone tratteggiato `h46; radius 14; 1.5px dashed rgba(primary,.4); color primary; 14/700; gap 8` con plus 18: "Aggiungi rilettura".
  5. **"Tag tematici"**: chip `h38; padding 0 14; radius 19; 14/600; gap 6`: selezionati `bg genre.dark; color genre.light` con check 14 sw 2.6 (Magia, Formazione, Musica, Amicizia); non selezionati `border 1.5px solid rgba(genre.dark,.35); color genre.dark` (Viaggio, Vendetta, Perdita, Mistero, Famiglia). `gap 8` wrap.
  6. **"Citazioni preferite"**: riga `padding 14; radius 14; bg #FAF1EE; mb 10; flex gap 10`: icona quote 22 colore base, testo Young Serif 15/21 (con «» ), sotto chip info "p. 48"/"p. 302" (h26). Testi: «Certe storie si leggono due volte: la prima per sapere, la seconda per restare.» p. 48; «La musica è il modo più gentile di ricordare.» p. 302. Bottone tratteggiato "Aggiungi citazione".
- **Sheet "Stato di lettura"** (y 1366, h 395 su 1760): stesso guscio dello sheet Sposta. Titolo Young Serif 20 (mb 8). `role=radiogroup`: 5 righe `h48; padding 0 12; gap 14; radius 14; 16px`; radio 24x24 `border 2px solid rgba(#323522,.5)`; selezionato (Letto): `border primary` + punto interno 12 primary, riga `bg rgba(accent,.4)`, label 700. Voci in ordine: **TBR, In lettura, Letto, Letto più di una volta, Non finito (DNF)**. Azioni `flex gap 10; mt 16`: **"Annulla"** (outline, h52, radius 16, 16/700, `1.5px solid rgba(primary,.45)`) e **"Salva"** (bg primary, #FAF1EE).

---

## 6. ESPLORA  -  `screens/06-explore.png`, `extra/06a`, `06b`

- Titolo "Esplora" Young Serif 32 primary (`padding 20 20 4; height 60`). Sezione Ruota `padding 10 20 0`.
- "Ruota della Fortuna" Young Serif 24; descrizione 14/20 `#6B3A42` (mt 4): **"Non sai cosa leggere? Lascia scegliere alla sorte tra i libri che non hai ancora letto."**
- **Chip filtro** (scroll, `margin 14 -20 0; padding 0 20; gap 8`): **"Tutti i non letti"** attivo (`h40; padding 0 16; radius 20; bg primary; color #FAF1EE; 14/700`, `aria-pressed`), poi un chip per genere (`padding 0 14; border 1.5px solid rgba(#323522,.3); 14/600; gap 8`, pallino 11 colore base): Classici, Mitologia, Distopia, Thriller, Fantasy, Romance, Contemporanea (etichette abbreviate rispetto ai titoli completi). Multi-selezione: stato attivo di un genere non mostrato nel mockup -> proposta: `bg mix(base 14%)`, bordo base, testo text-primary 700.
- **Card ruota** (`mt 16; padding 18 16 16; radius 28; bg surface`): SVG `viewBox="0 -16 340 358"` reso **318x335** centrato, `aria-label="Ruota della Fortuna con 10 libri da leggere"`, drop-shadow. Struttura (file `assets/wheel.svg`): cerchio esterno r=168 fill primary; 24 puntini r=3.6 a raggio 158 (angoli ogni 15°, alternati accent/background, il primo a 0° = destra); 10 spicchi r=148 (36° ciascuno) con `stroke background 2.5`; il primo spicchio parte a 108° (da "ore 6" verso sinistra, senso orario) quindi lo spicchio **in alto centrato** e' il 5°. Colori spicchi in ordine: Mitologia, Distopia, Classici, Thriller, **Fantasy (in alto)**, Romance, Contemporanea, Mitologia, Distopia, Fantasy = `base` del genere del libro. Etichette: Figtree 700 12.5, `dominant-baseline:central`, posizionate con `translate(170 170) rotate(a) translate(±134,0)`: nel semicerchio sinistro (angoli 126...234) `rotate(a-180) translate(-134,0)` con `text-anchor:start` (testo leggibile), nel destro `rotate(a) translate(134,0)` con `text-anchor:end`; colore testo `#FFFFFF` su Classici/Fantasy, `#23100A` sugli altri (stessa regola contrasto dei dorsi). Etichette: Circe, Fahrenheit 451, Il Gattopardo, Orient Express, Rebecca, Royal Blue, Coccodrilli, Medea, Tre corpi, J. Strange (titoli abbreviati a 1-2 parole, ~14 caratteri). Hub centrale: cerchio r=40 fill primary stroke background 5, testo **"GIRA"** 15/700 `letter-spacing 1` colore background. **Puntatore** (triangolo in alto, punta verso il basso): `M156 -14 L184 -14 L170 24 Z`, fill accent, stroke primary 3.5 linejoin round. Animazione: ruotare il gruppo spicchi+testi (non puntatore/hub/bordo) con `transform: rotate()` e `transition` ease-out ~4s (non presente nel mockup statico).
- **Card risultato** (dentro la card ruota, `margin-top 18; padding 14; radius 20; bg #FAF1EE; flex gap 14; center`): cover **64x96** (righe, tonalita' light `#9375b6`, icona formato 20) + colonna: label **"LA SORTE HA SCELTO"** 11.5/700 uppercase `.07em` `#323522`; titolo Young Serif 21/1.15 "Rebecca" (mt 2); autore 13.5/600 info "Daphne du Maurier"; chip genere (mt 8; h26; radius 13; bg base; color bianco; 12/600) "Fantasy".
- **Azioni** (`flex gap 10; mt 12`): **"Gira ancora"** (flex 1, h50, radius 16, outline `1.5px solid rgba(primary,.45)`, color primary, 15/700, icona shuffle 20) e **"Metti nei prossimi"** (flex 1.2, bg primary, #FAF1EE, icona bookmark 20).
- **Calendario 2026** (`padding 32 20 0`): titolo "Calendario 2026" (Young Serif 24) + chip anno "2026" (h32, radius 16, bg surface, 13/600). Testo: **"Un pallino per ogni giorno di lettura. Se hai letto più generi lo stesso giorno, il pallino è diviso a metà."** 14/20 `#6B3A42` (mt 4). Legenda (`flex wrap; gap 6 14; mt 12`; 12px): pallino 10 + **Classici, Mitologia, Distopia, Thriller, Fantasy, Romance, Contemporanea**.
- **Mesi**: griglia 2 colonne `gap 12; mt 16`; card mese `padding 12; radius 18; bg surface`; nome mese 14/700 (mb 6) - Gennaio...Dicembre; intestazione giorni `grid 7; 10/12 600 #6B3A42; centrata` = **L M M G V S D** (settimana da lunedi'), mb 2; celle `grid 7; gap 2; height 24`.
  - Giorno senza letture: numero 10/600 `#6B3A42`.
  - Giorno con letture, 1 genere: disco **20x20** colore base, numero 9.5/700 `line-height 1` colore `#23100A` (`#FFFFFF` su Classici e Fantasy).
  - Giorno con 2 generi: disco 20 con `linear-gradient(90deg, A 50%, B 50%)` e **disco interno** `min-width 14; height 14; radius 7; bg #FAF1EE; color text-primary; 9.5/700; line-height 14` con il numero (per 3+ generi: `conic-gradient(A 0 33.3%, B 0 66.6%, C 0)` con lo stesso disco interno).
  - Celle vuote iniziali: `div` vuoti 24px.
  - Niente "oggi": vedi 8.4.
- Tab attiva: Esplora.

---

## 7. STATISTICHE  -  `screens/07-stats.png`, `extra/07a`, `07b`

- Header `padding 20 20 4; height 60; flex space-between`: "Statistiche" Young Serif 32 primary; chip anno **"2026"** (`h34; padding 0 12; radius 17; bg surface; 13/600`).
- Contenitore `padding 12 20 0; column; gap 12`. Card: `padding 16; radius 22; bg surface`. Testata: tile icona 30x30 radius 10 `bg rgba(#81815D,.22)` colore `#323522`, icona 18 sw 2, gap 8, label 13/700 colore `#570F1D` lh 15.
  1. **Genere più letto** (full width; icona book-open): valore "Mitologia, Epica e Retelling" Young Serif 22/1.12 (mt 12); riga `13/17 #6B3A42 mt 4` con pallino 9 (base, mr 6) "14 libri nel 2026"; **barra generi** `flex; gap 3; mt 14; h12`, segmenti `flex: N; radius 6` in ordine decrescente: Mitologia 14, Distopia 9, Fantasy 8, Contemporanea 7, Thriller 6, Romance 5, Classici 3.
  2. Griglia 2 colonne gap 12: **Autore dell'anno** (user) "Madeline Miller" (22) / "3 libri letti"; **Mese d'oro** (sun) "Marzo" (30) / "9 libri letti"; **Pagine totali** (file-text) "18.420" (30) / "pagine nel 2026"; **Streak di lettura** (flame) "23 giorni" (24) / "Record: 41 giorni".
  3. **Tag più usati** (icona tag) `mt 14` chip `gap 8; wrap`: `h36; padding 0 6 0 14; radius 18; bg #FAF1EE; 14/600; gap 8` + contatore `min-width 24; h24; radius 12; padding 0 6; bg #323522; color #FAF1EE; 12/700`: Amicizia 12, Magia 9, Viaggio 7, Formazione 6.
- **Bookish Bingo** (`padding 32 20 0`): testata "Bookish Bingo" Young Serif 24 + badge **"7 su 16"** (`h30; padding 0 12; radius 15; bg #323522; color #FAF1EE; 12.5/600`). Card link (`mt 12; padding 16; radius 22; bg surface; flex gap 18; center`): mini-griglia `grid 4 x 22px; gap 6` (completata: `bg accent; border 2px solid primary`; da fare: `border 1.5px solid rgba(primary,.45)`; stato = `1011 0100 1010 0100`), a destra: "La card del 2026" Young Serif 19/1.15; "Ancora 9 caselle per il bingo" 13/18 `#6B3A42`; barra (`mt 10; h8; radius 4; bg #FAF1EE`, fill primary 44%); "Apri la card" + chevron-right 16 (14/700 primary, mt 10).
- **Citazioni** (`padding 32 20 0`): testata "Citazioni" + link "Vedi tutte" (14/600 info). Card promo (`padding 16; radius 22; bg surface; flex gap 8; center`): "Condividi una citazione" 15/700; "Scegli una frase e trasformala in una card nei colori del genere." 13/18 `#6B3A42`; bottone "Crea Quote Card" (`mt 12; h46; padding 0 16; radius 16; bg primary; color #FAF1EE; 14.5/700; gap 8`, icona image 20). Anteprima 150x150 (`margin-left -10`): due mini-card 96x128 radius 10 (`padding 12 10`): Mitologia `bg base; rotate(-6deg); left 0; top 14; color #2B1006` con «Non ho scelto di restare: sono rimasta.» / "Circe / Mitologia"; Contemporanea `bg light #DCEEF8; border 1px solid rgba(base,.6); rotate(5deg); left 54; top 0; color dark #23506E` con «Certe montagne si salgono per tornare.» / "Le otto montagne / Contemporanea"; testo Young Serif 10.5/14, caption 8.5/11 700.
  - Card citazione (`padding 16; radius 20; bg #FDF7F5; border 1px solid surface; mt/gap 12`): icona quote 24 colore base del genere + testo Young Serif 16/23; riga meta `mt 12; padding-left 34; gap 8; 12.5 #6B3A42`: pallino 9 genere + **titolo** (bold text-primary) "· P. Rothfuss" + chip "p. 48" (info tint, h24, radius 12). Citazioni: «Certe storie si leggono due volte: la prima per sapere, la seconda per restare.» (Il nome del vento, P. Rothfuss, p. 48); «La montagna non chiede niente, ti lascia solo il passo.» (Le otto montagne, P. Cognetti, p. 131).
- **Cimitero DNF** (`padding 32 20 0`): contenitore `position:relative; padding 20 14 0; radius 28; bg #e2dbd1; border 1.5px solid rgba(#81815D,.35); overflow:hidden`. Petali sparsi: ellissi 9x6 accent, opacity .85, rotazioni 30/120/60/160/80deg (5 posizioni). Testata: tile 36 radius 12 `rgba(#81815D,.28)` + icona fiore 22 sw 1.8, titolo **"Cimitero DNF"** Young Serif 24 `#323522`; testo 14/20 `#323522` (margin 8 0 18): **"Libri lasciati a metà, senza rancore. Un fiore per ognuno."** Griglia 3 colonne `gap 10`: lapide ruotata (-2, 1.5, -1 deg): `h156; padding 26 8 10; radius 52 52 10 10; gradient 180deg #F6EAE7 -> #E6D2CF; border 1.5px solid rgba(#323522,.22); shadow; column center` con icona book-open 18 (opacity .7, `#323522`), titolo Young Serif 14/17 (mt 6), autore 11/14 `#6B3A42` (mt 2), filetto 28x1.5 `rgba(#323522,.3)` margin `8 0 6`, **"Riposa a pag. N"** 11/14 700 `#323522`. Dati: Ulisse / James Joyce / 112; Moby Dick / Herman Melville / 204; Il Silmarillion / J.R.R. Tolkien / 58 (il 3° titolo va su 2 righe). Terreno: riga `h46; margin -6 -14 0` con SVG ondulato 100% x 34 (`margin-top -14`, fill `#81815D` opacity .55). Fiori: 4 icone 22px (stroke `#570F1D` 1.6, nessun fill) posizionate `absolute` su uno strato `left 14; right 14`: (left 6, bottom 8), (128, 14), (236, 6), (318, 12).
- Tab attiva: Statistiche. Nessun cover nel Cimitero (lapidi con icona libro) - la spec §17 parla di cover: il mockup NON le mostra nelle lapidi (seguire il mockup).

---

## 8. BOOKISH BINGO  -  `screens/08-bingo.png`, `extra/08a`

- Header `padding 20 20 4; height 64; gap 12`: back (44, surface, primary, chevron-left 22 sw 2) verso Statistiche + titolo Young Serif 30/1.1 primary **"Bookish Bingo"**.
- **Tab anni** (`padding 14 20 0; gap 8; scroll`): pill `h40; padding 0 18; radius 20; 14/700`: **2026** attivo (bg primary, #FAF1EE), 2025 e 2024 outline (`1.5px solid rgba(#323522,.3)`), **"+ Nuova card"** tratteggiato (`1.5px dashed rgba(primary,.5)`, padding 0 14, plus 16 sw 2.4, colore primary). Il mockup mostra anche il 4° elemento tagliato dallo scroll.
- **Riepilogo** (`margin 16 20 0; padding 16; radius 22; bg surface`): "7 su 16" Young Serif 30/1.1; "Ancora 9 caselle per il bingo" 13/18 `#6B3A42`; tile trofeo 48 cerchio `rgba(#81815D,.22)` colore `#323522`, icona trophy 26; barra `mt 12; h8; radius 4; bg #FAF1EE; fill primary 44%`.
- **Card** (`margin 16 20 0; padding 22 14 20; radius 28; bg #fbe5ea`): titolo "La card del 2026" Young Serif 22 primary centrato (mb 18). Griglia **4x4** `gap 18 10`. Cella = `<button aria-pressed aria-label="<nome>: completato|da fare">` colonna `gap 7`:
  - Cerchio `width 100%; aspect-ratio 1/1` (~73px): **completata** `bg accent; border 2px solid primary`, icona 38 stroke primary sw 1.7, **badge check** `26x26; right -3; top -3; bg primary; border 2px solid #FAF1EE`, check 14 sw 3.2 (colore background). **Da fare**: trasparente, `border 1.5px solid rgba(primary,.55)`, icona 38 stroke `rgba(primary,.75)` sw 1.4.
  - Label 12/14 600 centrata; libro collegato (solo completate) 10.5/13 **italic** `#570F1D` nowrap+ellipsis.
  - Ordine, icone (`assets/icons-sprite.svg#id`; equivalente lucide), stato, libro:

| # | Casella | Icona (sprite id) | lucide | Stato | Libro collegato |
|---|---|---|---|---|---|
| 1 | Oltre 500 pagine | `book-open` (sw 1.7 variante con dorso) | `book-open` | fatto | Il Signore degli Anelli |
| 2 | Bestseller | `bingo-bestseller` | `medal` / `award` | da fare | |
| 3 | Diventato un film | `bingo-film` | `clapperboard` | fatto | Dune |
| 4 | Letto in digitale | `smartphone` | `smartphone` | fatto | Il problema dei tre corpi |
| 5 | 5 stelle | `bingo-hearts` (tre cuori) | `hearts`/custom (`heart` x3) | da fare | |
| 6 | Premio letterario | `trophy` | `trophy` | fatto | Circe |
| 7 | Poesia | `bingo-feather` | `feather` | da fare | |
| 8 | Narratore inaffidabile | `bingo-scribble` (matassa) | custom | da fare | |
| 9 | Un classico | `bingo-laurel` | custom (corona d'alloro) | fatto | Orgoglio e pregiudizio |
| 10 | Retelling mitologico | `bingo-temple` | `landmark` | da fare | |
| 11 | Thriller o giallo | `bingo-search` | `search` | fatto | La ragazza del treno |
| 12 | Titolo di una parola | `bingo-sparkle` | `sparkles` (singola) | da fare | |
| 13 | Dark Academia | `bingo-academia` | `church`/`school` | da fare | |
| 14 | Colpo di scena | `bingo-pulse` | `activity` | fatto | Il nome del vento |
| 15 | Letto in viaggio | `bingo-plane` | `send` | da fare | |
| 16 | Libro da BookTok | `bingo-music` | `music` | da fare | |

  Stato (riga per riga): `1011 0100 1010 0100` => 7 su 16. Nomi caselle con a-capo naturale ("Oltre 500 / pagine", "Diventato un / film", "Letto in / digitale").
- **Legenda** (`padding 14 20 0; flex wrap; gap 8 18; 12.5`): cerchio 16 "Da fare" (`1.5px solid rgba(primary,.55)`), cerchio 16 "Completata" (`bg accent; 2px solid primary`); testo `100% width; #6B3A42; lh 18`: **"Tocca una casella per spuntarla e collegarla a un libro letto."**
- **Le tue card** (`padding 30 20 0`): titolo Young Serif 24 (mb 12); righe `gap 10`: `padding 14 16; radius 20; bg surface; flex gap 16; center`: mini-griglia `4 x 9px; gap 4` (dischi 9px: pieni `bg accent; border 1.5px solid primary`; vuoti `1.5px solid rgba(primary,.4)`), anno Young Serif 20, sottotitolo 13 `#6B3A42`: **"2025" - "16 su 16 · Bingo completo!"**, **"2024" - "11 su 16 · Quasi!"**; chevron-right 20 primary sw 2.
- Tab attiva: Statistiche.

### 8.4 "Oggi" nel calendario
Il mockup non disegna un marcatore per oggi. Proposta (da confermare): cerchio 20px con contorno `2px solid primary` (senza riempimento) se non ci sono letture, o anello esterno `outline: 2px solid primary; outline-offset: 1px` se ci sono.

---

## 9. Iconografia (sprite `assets/icons-sprite.svg`, viewBox 24, stroke round)

Libreria consigliata: **lucide-react** (stile a tratto 2px arrotondato, compatibile) per le icone standard; le icone **custom** da mantenere dallo sprite perche' non esistono identiche in lucide: `library` (scaffale con 6 costole), `bingo-hearts`, `bingo-scribble`, `bingo-laurel`, `bingo-academia`, `bingo-temple` (lucide `landmark` e' simile), `bingo-bestseller`, `flower`, `quote` (lucide `quote` ha forma diversa), `bookmark` (lucide ok). Stroke width: tab 1.9, header back 2-2.2, chevron 2.4-2.6, check 2.6 (3.2 nel bingo), bingo 1.4 da fare / 1.7 fatto, tag e simili 2.

| Uso | sprite id | lucide |
|---|---|---|
| Logo / Metti nei prossimi | `bookmark` | `bookmark` |
| Scanner | `camera` | `camera` |
| Cartaceo / Genere piu' letto | `book-open` | `book-open` |
| Digitale | `smartphone` | `smartphone` |
| Pagine | `file-text` | `file-text` |
| Tab Libreria | `library` | custom (`library-big` simile) |
| Tab Esplora | `compass` | `compass` |
| Tab Statistiche | `bar-chart` | `chart-no-axes-column` / `bar-chart-2` |
| Back | `chevron-left` | `chevron-left` |
| Altre azioni | `more-horizontal` | `ellipsis` |
| Ordina | `sort` | `arrow-up-down` |
| Voto attivo | `arrow-down` | `arrow-down` |
| Segna come letto | `check` | `check` |
| Cambia genere / Tag | `tag` | `tag` |
| Date | `calendar` | `calendar` |
| Citazione | `quote` | custom |
| Gira ancora | `shuffle` | `shuffle` |
| Autore / Mese / Streak | `user` / `sun` / `flame` | stesse |
| Quote Card | `image` | `image` |
| Cimitero | `flower` | custom |
| Bingo trofeo | `trophy` | `trophy` |
| Stella | `star` | `star` (riempita) |
| Aggiungi / rimuovi aggettivo | `plus` (x = plus ruotato 45deg) | `plus` / `x` |

Font per le stelle testuali: evitare (glifo `★` dipende dal fallback); usare SVG.

---

## 10. Copy italiano completo (per schermata)
(Testi esatti; i dati di esempio sono solo mock.)

- **Home**: vedi 3.7.
- **Genere**: GENERE; Mitologia, Epica e Retelling; 9 libri; 6 letti; 3 da leggere; ORDINA PER; Titolo; Autore; Pagine; Voto; Data; L'ordine vale dentro ogni sezione: i libri letti restano sempre in cima.; Letti; per voto, dal più alto; TBR; per voto; N pag.; Prossimo.
- **Sposta**: Dettaglio; La paura del saggio; Patrick Rothfuss; Fantasy, Realismo Magico e Gotico; TBR; Digitale; 1.008 pag.; Recensione; Non ancora letto; Voto, tag e citazioni si sbloccano quando segni il libro come letto.; Sposta; Serie: Vol. 2 di 3; Le Cronache dell'Assassino del Re; Sposta il libro; Segna come letto; Cambia genere; Metti nei prossimi; 3 su 3.
- **Soft-limit**: Hai già 3 libri nelle prossime letture. Vuoi aggiungerlo comunque?; Aggiungi comunque; Annulla.
- **Dettaglio letto**: Il nome del vento; Cartaceo; Serie: Vol. 1 di 3; Letto; Il libro in 3 aggettivi *; 3/3; Epico; Malinconico; Immersivo; Campo obbligatorio: scrivine esattamente 3.; Voto; 4/5; Valutazioni specifiche; Worldbuilding; Sistema magico; Personaggi; Ritmo; Atmosfera; Date di lettura; 1ª lettura; Rilettura; Aggiungi rilettura; Tag tematici (Magia, Formazione, Musica, Amicizia, Viaggio, Vendetta, Perdita, Mistero, Famiglia); Citazioni preferite; Aggiungi citazione; Stato di lettura (TBR / In lettura / Letto / Letto più di una volta / Non finito (DNF)); Annulla; Salva.
- **Esplora**: Esplora; Ruota della Fortuna; descrizione (vedi 6); Tutti i non letti; GIRA; LA SORTE HA SCELTO; Gira ancora; Metti nei prossimi; Calendario 2026; legenda; mesi Gennaio...Dicembre; L M M G V S D.
- **Statistiche**: Statistiche; 2026; Genere più letto; 14 libri nel 2026; Autore dell'anno; 3 libri letti; Mese d'oro; 9 libri letti; Pagine totali; pagine nel 2026; Streak di lettura; 23 giorni; Record: 41 giorni; Tag più usati; Bookish Bingo; 7 su 16; La card del 2026; Ancora 9 caselle per il bingo; Apri la card; Citazioni; Vedi tutte; Condividi una citazione; Scegli una frase e trasformala in una card nei colori del genere.; Crea Quote Card; Cimitero DNF; Libri lasciati a metà, senza rancore. Un fiore per ognuno.; Riposa a pag. N.
- **Bingo**: Bookish Bingo; 2026 / 2025 / 2024; Nuova card; 7 su 16; Ancora 9 caselle per il bingo; La card del 2026; 16 caselle (vedi tabella); Da fare; Completata; Tocca una casella per spuntarla e collegarla a un libro letto.; Le tue card; 16 su 16 · Bingo completo!; 11 su 16 · Quasi!.

---

## 11. Differenze mockup vs MASTER_SPEC (riepilogo azionabile)

| Tema | Spec | Mockup | Decisione |
|---|---|---|---|
| Font | Fraunces + Inter | Young Serif + Figtree | seguire mockup |
| Primary | `#570F1D` | `#6C0820` (+ `#570F1D` per glifi) | seguire mockup, token aggiuntivo |
| Stato lettura | include "In pausa" | assente | aggiungere voce in stile identico |
| Sposta | "Rimuovi dai prossimi" se presente | assente | aggiungere |
| Calendario >2 generi | conic-gradient | solo 2 (gradient lineare) | conic con disco interno |
| Calendario oggi | non specificato | assente | proposta 8.4 |
| Cimitero | cover, titolo, autore, "Riposa a pag. X" | no cover (icona libro) | seguire mockup |
| Stelle scaffali Home | "stelle se recensito" | non mostrate nello scaffale | mostrare solo in Vista genere/Dettaglio (come mockup); se servono in Home, fuori scope mockup |
| Indicatore formato | "indicatore formato" | cerchietto con icona | implementato come mockup |
| Tab bar | 3 voci | 3 voci, nav ricolorata in vista Genere | come mockup |
