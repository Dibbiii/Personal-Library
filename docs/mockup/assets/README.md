# Asset del mockup Segnalibro

Tutti gli SVG usano `var(--token)` / `currentColor`: **vanno inlinati nel DOM** (componente React o `<svg><use href="sprite#id">` con stroke impostato sul contenitore). Se caricati come `<img>` le variabili CSS non ereditano e i colori spariscono. Anteprima con palette demo: `assets/preview.html` (screenshot in `screens/extra/assets-preview.png`).

| File | Cosa | Dimensione nativa | Token |
|---|---|---|---|
| `logo-segnalibro.svg` | segnalibro (logo header, "Metti nei prossimi") | 24, stroke 2 | `currentColor` |
| `candle.svg` | candela accesa con alone e fiamma | 46x72 | accent, flame, flame-core, shelf-axis, surface, wax-edge, background |
| `plant-pot.svg` | pianta in vaso | 56x86 | divider, leaf-dark, leaf-light, pot, pot-rim |
| `mug.svg` | tazza fumante | 46x50 | divider, primary, accent |
| `book-stack.svg` | pila di 3 libri orizzontali | 80x46 | divider, accent, primary |
| `flower-cross.svg` / `dnf-emblem.svg` | fiore (4 petali + centro) per Cimitero DNF | 24 (reso 22) | primary-deep / currentColor |
| `tombstone.svg` | lapide ad arco | 120x156 | tomb-top, tomb-bottom, shelf-axis (preferire il CSS sotto) |
| `cemetery-ground.svg` | terreno ondulato | 350x34 (100% x 34) | divider |
| `wheel.svg` | Ruota della Fortuna (10 spicchi d'esempio) | viewBox 340x358 -> 318x335 | primary, accent, background, `--genre-*-base`, on-genre-ink/white |
| `icons-sprite.svg` | 41 icone (tab, UI, Bingo) | 24, stroke round | `currentColor` |
| `raw/*.woff2` | Figtree variable (latin, latin-ext), Young Serif 400 (latin, latin-ext) | | |
| `raw/markup/*.html` | markup originale per schermata (pretty-printed, **contiene hex**: solo riferimento) | | |

## Token introdotti (non presenti nella spec §21)

`--color-flame #E8843A`, `--color-flame-core #FBE3CC`, `--color-wax-edge #C9A08A`, `--color-leaf-dark #656648`, `--color-leaf-light #949475`, `--color-pot #C4694A`, `--color-pot-rim #D98565`, `--color-primary-deep #570F1D`, `--color-on-genre-ink #23100A`, `--color-on-genre-white #FFFFFF`, `--tomb-top #F6EAE7`, `--tomb-bottom #E6D2CF`, `--color-shelf-axis #323522` (= `--color-icon`), `--color-divider #81815D`. I valori sono quelli del mockup e vanno **solo** nel file tema `segnalibro`.

Come usare lo sprite in React: `<svg width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><use href="/icons-sprite.svg#camera" /></svg>` oppure (consigliato) generare componenti React dai `<symbol>`; per le icone presenti in lucide usare lucide (mappa in `DESIGN_REFERENCE.md` §9).

## Illustrazioni disegnate in CSS nel mockup (non SVG)

**Cover / dorso / lapide / mensola / LED / ghost**: sono `div` con gradienti. Le regole CSS complete sono in `../SPINES.md` (cover, dorso, pattern) e sotto.

```css
/* Mensola in legno (plancia titolo scaffale) */
.plank {
  height: 42px; padding: 0 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px;
  background: linear-gradient(180deg, var(--color-wood-top), var(--color-wood-mid) 55%, var(--color-wood-bottom));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.4), 0 14px 16px -8px color-mix(in srgb, var(--color-text-primary) 42%, transparent);
  color: var(--color-wood-ink);
}
.plank__dot { width: 10px; height: 10px; border-radius: 50%; background: var(--g); border: 1.5px solid rgba(255,255,255,.55);
  box-shadow: 0 0 9px 2px color-mix(in srgb, var(--g) 90%, transparent); }

/* Bagliore LED sotto i libri: due livelli dentro la riga dello scaffale (isolation:isolate) */
.shelf::before { /* gradiente verticale, altezza = altezza scaffale */
  content:""; position:absolute; z-index:-1; inset:auto 0 0 0; height:100%;
  background: linear-gradient(to top, color-mix(in srgb, var(--g) 36%, transparent), color-mix(in srgb, var(--g) 10%, transparent) 50%, transparent); }
.shelf::after { /* linea 3px che poggia sul bordo inferiore */
  content:""; position:absolute; z-index:-1; inset:auto 0 0 0; height:3px; background: var(--g);
  box-shadow: 0 0 10px 2px color-mix(in srgb, var(--g) 75%, transparent), 0 6px 22px 4px color-mix(in srgb, var(--g) 40%, transparent); }

/* Lapide Cimitero DNF (larghezza 1/3 della griglia, ~101px) */
.tomb { height: 156px; padding: 26px 8px 10px; border-radius: 52px 52px 10px 10px; text-align: center;
  display: flex; flex-direction: column; align-items: center;
  background: linear-gradient(180deg, var(--tomb-top), var(--tomb-bottom));
  border: 1.5px solid color-mix(in srgb, var(--color-shelf-axis) 22%, transparent);
  box-shadow: 0 8px 12px -6px color-mix(in srgb, var(--color-shelf-axis) 40%, transparent); }
/* rotazioni: -2deg, 1.5deg, -1deg (ciclo) */

/* Petalo decorativo Cimitero */
.petal { position:absolute; width:9px; height:6px; border-radius:50%; background: var(--color-accent); opacity:.85; }

/* Calendario: giorno con 1 genere / 2 generi / 3+ generi (spec: conic-gradient) */
.cal-day { width:20px; height:20px; border-radius:50%; background: var(--g1); display:flex; align-items:center; justify-content:center; font: 700 9.5px/1 Figtree; }
.cal-day--multi { background: linear-gradient(90deg, var(--g1) 50%, var(--g2) 50%); }                 /* 2 generi (mockup) */
.cal-day--multi3 { background: conic-gradient(var(--g1) 0 33.33%, var(--g2) 0 66.66%, var(--g3) 0); } /* 3+ generi (spec) */
.cal-day--multi .num, .cal-day--multi3 .num { min-width:14px; height:14px; border-radius:7px; background: var(--color-background); color: var(--color-text-primary); line-height:14px; text-align:center; }

/* Nuvole blush di sfondo Home */
.home-bg { background:
  radial-gradient(ellipse 115px 63px at 278px 1046px, color-mix(in srgb, var(--color-accent) 30%, transparent), transparent 72%),
  radial-gradient(ellipse 130px 45px at 17px 1522px, color-mix(in srgb, var(--color-surface) 90%, transparent), transparent 72%),
  radial-gradient(ellipse 95px 64px at 108px 1284px, rgba(255,255,255,.35), transparent 72%),
  var(--color-background-shelf); /* +13 blob analoghi (78-146 x 31-64px) nel mockup; nessuna posizione e' critica */ }
```
