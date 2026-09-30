# Dorsi e cover generate via CSS - specifica implementabile

Riferimenti: `spine-algorithm.ts` (funzioni pure, testate con `node --experimental-strip-types`), `spine-prototype.html` (CSS statico che riproduce gli scaffali della Home; screenshot `screens/spine-prototype.png` a 390px @2x da confrontare con `screens/extra/01c..01i`), markup originale `assets/raw/markup/01-home.html`.

Tutti i valori sotto sono **estratti dal mockup** (markup inline), tranne dove marcato **[DECISIONE]**: parti che il mockup non permette di dedurre (la funzione hash originale non e' nel bundle: i valori del mockup sono fissi) e che sono quindi definite qui in modo deterministico.

## 1. Due rappresentazioni dello stesso libro

| | Dorso (di costa) | Cover frontale generata |
|---|---|---|
| Dove | scaffali genere (default) | scaffali: libri In lettura/Prossimo e ogni tanto uno "evidenziato"; Vista genere (griglia); Dettaglio; Ruota; dialog; prossimi |
| Forma | larghezza 24/28/32/36 x altezza 110...134 | proporzione 2:3 (84x124, 104x156, 72x108, 64x96, 98x147, 126x189, 46x68, larghezza 100% x 156) |
| Raggio | `3px 3px 1px 1px` | `3px 8px 8px 3px` |

Modalita' ibrida (spec §4): In lettura e Prossimi = cover frontali (con badge); scaffali normali = dorsi; un libro puo' comparire frontale senza badge se "evidenziato" (nel mockup: Il Gattopardo, Rebecca, Io prima di te, La ragazza del treno) => `featured`.

## 2. Anatomia del DORSO

```
.spine {                                   /* w,h,bg sono custom property per-libro */
  position: relative; flex: none; width: var(--w); height: var(--h);
  border-radius: 3px 3px 1px 1px;
  background: linear-gradient(90deg, rgba(255,255,255,.24), transparent 28%, rgba(0,0,0,.16)), var(--bg);
  box-shadow: 3px 0 4px -1px color-mix(in srgb, var(--color-text-primary) 30%, transparent);
}
/* due filetti orizzontali 2px a top:9px e top:14px, larghi quanto il dorso */
.spine::before, .spine::after { content:""; position:absolute; left:0; right:0; height:2px; background: var(--bar); }
.spine::before { top: 9px }  .spine::after { top: 14px }
/* titolo verticale: contenitore assoluto top:22px bottom:28px, flex-center, overflow hidden */
.spine__title { position:absolute; left:0; right:0; top:22px; bottom:28px; display:flex; align-items:center; justify-content:center; overflow:hidden }
.spine__title > span {                      /* leggibile dal basso verso l'alto */
  display:block; writing-mode: vertical-rl; transform: rotate(180deg);
  font: 700 10.5px/1 Figtree; white-space: nowrap; max-height: var(--mh); /* = height - 52 */
  overflow:hidden; text-overflow: ellipsis; color: var(--ink);
}
/* indicatore formato: cerchio 16px centrato, bottom:6px, bg rgba(background,.92), colore #570F1D (primary-deep), icona 10px sw 2.2 */
```

- **Larghezze**: 24, 28, 32, 36. **Altezze**: 110, 116, 122, 128, 134 (passo 6). `--mh = h - 52` (58, 64, 70, 76, 82): l'ellissi taglia il titolo ("Orgoglio ...", "Il ritratto di...", "Il fu Mattia Pas...").
- **Gap** tra elementi di scaffale: 2px; le cover e le decorazioni hanno `margin: 0 8px`; i dorsi nessun margine.
- **Filetti (`--bar`)**: inchiostro chiaro => `rgba(255,255,255,.45)`; scuro => `rgba(35,16,10,.28)` (= `color-mix(on-genre-ink 28%)`).
- **Titolo (`--ink`)**: `#FFFFFF` (inchiostro chiaro) o `#23100A` (scuro).
- **Libro appoggiato (`lean`)**: `transform: rotate(10deg); transform-origin: bottom right; margin-left: 6px` (nel mockup: Madame Bovary 32x128, Fahrenheit 451 36x134, Jonathan Strange 28x110; ne appare al massimo **1 per scaffale**, sempre ad angolo +10deg, sempre affiancato a una decorazione che riempie lo spazio).
- **Badge su dorso**: pillola sopra il dorso (`bottom:100%; margin-bottom:5px`, centrata, z 8), vedi DESIGN_REFERENCE 3.4. Il dorso con badge non cambia altezza.

## 3. Anatomia della COVER

```
.cover {
  position: relative; width: var(--w); height: var(--h); border-radius: 3px 8px 8px 3px; overflow: hidden;
  background: var(--pattern), var(--bg);
  box-shadow: 0 8px 10px -5px color-mix(in srgb, var(--color-text-primary) 45%, transparent),
              inset 4px 0 0 rgba(0,0,0,.10),       /* costola scura */
              inset 6px 0 0 rgba(255,255,255,.16); /* filo di luce */
}
/* due "righe di titolo" stilizzate */
.cover .t1 { position:absolute; left:18%; right:14%; top:13%; height:4px; border-radius:2px; background: var(--t) }
.cover .t2 { position:absolute; left:26%; right:22%; top:13%; margin-top:9px; height:4px; border-radius:2px; background: var(--t); opacity:.7 }
/* --t: inchiostro chiaro rgba(255,255,255,.62) | scuro rgba(35,16,10,.5)
   --ov: sovrapposizione del pattern: chiaro rgba(255,255,255,.22) | scuro rgba(35,16,10,.12) */
```

### 3.1 Pattern (4 nel mockup; "liscio" = nessun pattern, non presente ma previsto come fallback)
| id | CSS `--pattern` | Visto in |
|---|---|---|
| `stripes` (righe diagonali) | `repeating-linear-gradient(135deg, var(--ov) 0 6px, transparent 6px 14px)` | Dune, Il Gattopardo, Odissea, Rebecca, Le otto montagne |
| `circle` (cerchio decorativo) | `radial-gradient(circle at 50% 64%, var(--ov) 0 24%, transparent 25%)` | Il problema dei tre corpi, La ragazza del treno |
| `band-bottom` (fascia bassa scura) | `linear-gradient(to bottom, transparent 0 64%, color-mix(in srgb, var(--genre-dark) 35%, transparent) 64% 100%)` (rgba(107,48,29,.35) per Mitologia, rgba(63,42,92,.35) per Fantasy) | Circe, La canzone di Achille, Medea, Iliade, Il nome del vento |
| `band-mid` (fascia centrale) | `linear-gradient(to bottom, transparent 60%, var(--ov) 60% 72%, transparent 72%)` | Assassinio sull'Orient Express, Il silenzio delle ragazze, Norse Mythology, Lavinia, La paura del saggio |

### 3.2 Inchiostro cover vs dorso (attenzione: regole diverse)
- **Dorso/ruota/calendario**: scegliere tra `#FFFFFF` e `#23100A` quello con **contrasto WCAG maggiore** sullo sfondo. Verificato su 22/22 tonalita' del mockup (es. `#C4694A` => scuro; `#a95a40` => bianco).
- **Cover**: bianco se luminanza relativa del fondo < 0.40, scuro altrimenti. Verificato su 12/12 cover (`#C4694A` cover => bianco!, `#E0B62B`/`#86bde2` => scuro). Funzione `pickCoverInk` in `spine-algorithm.ts`.

### 3.3 Badge e formato sulla cover
Badge dentro (`left:6; top:6; padding:2px 7px`); cerchio formato 20px in basso a destra (`right:5; bottom:5; opacity:.92`, icona 12). Numero di coda (prossimi): cerchio 22 `left:5; top:5`, bg primary, 12/700.

## 4. Colore: tonalita' derivate dalla palette genere

Dal genere si ricavano 4 tonalita' (tutte verificate contro i valori del mockup, tolleranza +-1 su un canale per arrotondamento):

| Tonalita' | Formula | Esempio Mitologia (base `#C4694A`, dark `#6B301D`) | Altri riscontri nel mockup |
|---|---|---|---|
| `base` | `genre.base` | `#C4694A` | |
| `light` | `mix(base, bianco, 16%)` | `#cd8167` | Classici `#9e785b`, Distopia `#ec985a`, Thriller `#e5c24d`, Fantasy `#9375b6`, Romance `#e587a1`, Contemporanea `#86bde2` |
| `shade` | `base x 0.86` = `mix(base, nero, 14%)` | `#a95a40` | Classici `#785134`, Distopia `#c87232` (Dune cover), Fantasy `#6c4e90`, Contemporanea `#5f97bd` |
| `deep` | `mix(base, genre.dark, 30%)` (arrotondamento per difetto) | `#a9583c` | Classici `#785032`, Distopia `#c76f2d`, Thriller `#bd9923`, Fantasy `#6b4c91`, Romance `#c15978` |

Nel mockup ogni scaffale usa 3-4 tonalita' (Classici e Mitologia tutte e 4; Thriller base/deep/light; Romance base/light/deep; Contemporanea base/light/shade). Le fasce scure delle cover usano `genre.dark` a alpha .35 (non una tonalita').

`mix` e' interpolazione lineare in sRGB; in produzione usare `color-mix(in srgb, var(--genre-base) 86%, black)` ecc. oppure calcolare in JS con `mix()` (il nero/bianco come costanti matematiche, non colori di tema).

## 5. Algoritmo deterministico **[DECISIONE]**

Input: `bookId, title, author, genre, pages, format, status`. Output: vedi `SpineSpec` in `spine-algorithm.ts`.

```
seed  = FNV-1a32( bookId + "|" + title + "|" + author + "|" + genre )
r     = mulberry32(seed)                       // PRNG seedabile
wJit  = floor(r()*3) - 1                       // -1, 0, +1
wIdx  = clamp( pagesBucket(pages) + wJit, 0, 3 )   // 24, 28, 32, 36
         pagesBucket: <200 => 0 ; <350 => 1 ; <500 => 2 ; >=500 => 3 ; null => 1
hIdx  = floor(r()*5)                           // 110,116,122,128,134
tone  = TONES[floor(r()*5)]  con TONES = [base, base, light, shade, deep]   // base piu' frequente
lean  = r() < 0.06                             // poi lo scaffale ne ammette max 1 (vedi 6)
pattern   = PATTERNS[floor(r()*4)]             // stripes, circle, band-bottom, band-mid
coverTone = r()<0.75 ? base : (r()<0.5 ? light : shade)
featured  = r() < 0.08
renderAs  = (status != null || featured) ? "cover" : "spine"
badge     = reading => "In lettura" ; next => "Prossimo" ; else null
```

- Stessa chiave => stesso output (nessun `Math.random()`, nessuna dipendenza dall'ordine): i dorsi non "ballano" al reload.
- La larghezza dipende dalle pagine solo in modo grossolano (spessore plausibile) con jitter: nel mockup la relazione non e' verificabile (dati fittizi), quindi e' una scelta di design.
- Non includere il titolo/autore solo nell'hash: sono anche il **contenuto** del dorso (titolo verticale troncato).
- Test da scrivere: determinismo, distribuzione (larghezza in {24..36}, altezza in {110..134}), inchiostro con contrasto >= 3:1 sui 7 generi x 4 tonalita', `labelMaxHeight = h-52`.

## 6. Composizione dello scaffale (come nella Home)

Riga: `display:flex; align-items:flex-end; gap:2px; padding:0 18px; height:168px; overflow-x:auto`, sopra il LED (gradiente + linea 3px del colore base del genere) e sotto la plancia in legno (42px).

Regole osservate nel mockup, da replicare:
1. Elementi in ordine di libreria (ordinamento utente/default); i libri con `status` sono cover in testa allo scaffale.
2. **Decorazione** (una per scaffale, `margin 0 8px`), posizionata dopo il 2°-5° elemento; tipo per genere nel mockup: Classici pianta, Mitologia candela, Distopia tazza fumante, Thriller pila libri, Fantasy pianta, Romance candela, Contemporanea pila libri (ciclo fisso per genere; la pila e' 80x46, candela 46x72, pianta 56x86, tazza 46x50). Asset: `assets/plant-pot.svg`, `candle.svg`, `mug.svg`, `book-stack.svg`.
3. **Libro appoggiato**: al piu' uno, subito prima di una decorazione (Classici: Bovary -> pianta; Distopia: Fahrenheit -> tazza; Fantasy: Jonathan -> dopo la cover Rebecca).
4. Niente stelle negli scaffali.
5. Scroll orizzontale senza scrollbar (`scrollbar-width:none`), le cover/dorsi tagliati dal bordo indicano continuita'. Paginazione/virtualizzazione: spec §32.
6. **Stato drag**: il dorso d'origine diventa un placeholder tratteggiato della stessa larghezza (`2px dashed color-mix(genre.dark 55%)`, `bg color-mix(genre.base 14%)`, radius 3, altezza del dorso); il libro sollevato diventa cover frontale ghost (84x124) con `rotate(-5deg) scale(1.16)`.

## 7. Dati di verifica (estratti, scaffale per scaffale)

Formato: `titolo  larghezzaxaltezza  fondo  inchiostro  [note]`. S = dorso, C = cover.

**Classici** (LED `#8B5E3C`): S Orgoglio e pregiudizio 28x110 `#785134` L digitale; S Il ritratto di Dorian Gray 28x116 `#785134` L; C Il Gattopardo 84x124 `#785134` righe; S I promessi sposi 24x116 `#8B5E3C` L; S Madame Bovary 32x128 `#9e785b` D **lean**; pianta; S Delitto e castigo 24x110 `#8B5E3C` L; S Il fu Mattia Pascal 36x134 `#785032` L digitale; S Il barone rampante 28x122 `#785134` L digitale.
**Mitologia** (`#C4694A`): C Circe 84x124 `#a95a40` fascia bassa, badge Prossimo; S La canzone di Achille 32x122 `#cd8167` D digitale; S Il silenzio delle ragazze 28x110 `#a95a40` L; candela; S Il canto di Penelope 28x110 `#a95a40` L; S Norse Mythology 24x128 `#C4694A` D digitale; S Lavinia 24x110 `#C4694A` D; S Medea. Voci 36x128 `#a9583c` L; S Iliade 36x134 `#a9583c` L.
**Distopia** (`#E8843A`): C Dune 84x124 `#c87232` righe, badge In lettura; S Il problema dei tre corpi 36x134 `#c76f2d` D digitale + badge Prossimo (sopra); S 1984 32x122 `#ec985a` D; S Il racconto dell'ancella 36x128 `#c76f2d` D; S Fahrenheit 451 36x134 `#c76f2d` D **lean**; tazza; S Neuromante 36x122 `#c76f2d` D; S Il mondo nuovo 36x110 `#c76f2d` D.
**Thriller** (`#E0B62B`): C Assassinio sull'Orient Express 84x124 `#E0B62B` fascia centrale scura, badge Prossimo; placeholder tratteggiato 24x110 (drag); S Il silenzio degli innocenti 24x128 `#E0B62B` D; S Uomini che odiano le donne 36x122 `#bd9923` D; pila libri; S Il giorno della civetta 32x116 `#e5c24d` D; S Dieci piccoli indiani 36x122 `#bd9923` D; S Il mastino dei Baskerville 32x122 `#e5c24d` D digitale.
**Fantasy** (`#7E5BA8`): S Il nome del vento 28x116 `#6c4e90` L; S La paura del saggio 28x128 `#6c4e90` L digitale; C Rebecca 84x124 `#9375b6` righe; pianta; S Cent'anni di solitudine 24x122 `#7E5BA8` L; S Lo Hobbit 24x116 `#7E5BA8` L digitale; S Jonathan Strange & il signor Norrell 28x110 `#6c4e90` L **lean**; S Il Signore degli Anelli 36x134 `#6b4c91` L.
**Romance** (`#E0708F`): C Io prima di te 84x124 `#E0708F` righe digitale; S Red, White & Royal Blue 24x122 `#E0708F` D digitale; candela; S Il duca e io 32x122 `#e587a1` D; S Colpa delle stelle 36x110 `#c15978` D; S Dopo di te 24x134 `#E0708F` D; S Il diario di Bridget Jones 32x134 `#e587a1` D digitale.
**Contemporanea** (`#6FB0DC`): C Le otto montagne 84x124 `#86bde2` righe scure, badge In lettura; S L'amica geniale 32x128 `#86bde2` D; S La storia 24x128 `#6FB0DC` D; pila libri; S Nel mare ci sono i coccodrilli 32x122 `#86bde2` D; S Cose che nessuno sa 28x110 `#5f97bd` D digitale; S Il cardellino 28x116 `#5f97bd` D; S La solitudine dei numeri primi 24x116 `#6FB0DC` D.

(D = inchiostro scuro `#23100A`, L = chiaro `#FFFFFF`.) Il prototipo `spine-prototype.html` ricostruisce i 7 scaffali con questi dati; i colori sono definiti in testa al file (`:root`) **solo come demo del tema**.

## 8. Checklist di implementazione dei dorsi
- [ ] Nessun hex nel componente: tutto da `--genre-<slug>-base|dark` + `--color-on-genre-ink|white`.
- [ ] Titolo verticale con ellissi, non spezzato; `max-height = h-52`.
- [ ] Icona formato: book-open (cartaceo) / smartphone (digitale) nel cerchio, sempre visibile anche sui dorsi corti.
- [ ] `aria-label` = titolo (il mockup usa `role="img"` + `aria-label`); area di tocco >= 44px in altezza (il dorso e' gia' 110+) e larghezza: estendere con `::after` trasparente a 44px min senza cambiare layout.
- [ ] Nessun dorso cambia altezza per stato (badge fuori dal box).
- [ ] Persistenza: l'output e' puro (derivato), non salvarlo a DB.
