# Design system e componenti condivisi

## Regole

- Nessun colore letterale fuori da `src/lib/themes/`. `npm run lint:colors` fallisce su `#hex`,
  `rgb()/hsl()/oklch()...`, nomi colore CSS nelle proprietà di colore e classi Tailwind colorate.
- Sfondi, ombre e bagliori si compongono con `color-mix(in srgb, var(--token) N%, transparent)`.
- Testo UI = `var(--font-ui)` (Figtree), titoli = `var(--font-display)` (Young Serif, peso 400:
  `h1`-`h3` lo applicano già).
- Target touch >= 44px (`--tap-size`), focus visibile globale, `prefers-reduced-motion` gestito in
  `src/app.css` (e `data-motion="reduce"` su `<html>` per la preferenza utente).

## Token

Generati dal tema (`themeToCssVariables`, tutti `--color-<nome-in-kebab>`): `background`, `surface`,
`surface-elevated`, `text-primary|secondary|muted`, `primary`, `primary-deep`, `on-primary`,
`primary-subtle`, `secondary`, `accent`, `on-accent`, `border`, `divider`, `icon`, `icon-muted`,
`shelf-axis`, `shadow`, `overlay`, `success|warning|danger|info` (+ `on-*`), `info-hover`,
`on-genre-ink`, `on-genre-white`, `sheet-handle`, `background-shelf` (fondo Home), `bingo-card`,
`graveyard-bg`, `tomb-top|bottom`, legno (`wood-ink`, `wood-top|mid|bottom`,
`wood-detail-top|mid|bottom`), decorazioni (`wax-edge`, `flame`, `flame-core`, `leaf-dark|light`,
`pot`, `pot-rim`); per ogni genere `--genre-<slug>`, `-light`, `-dark`, `-on-base`, `-on-light`.

Derivati (`src/lib/styles/tokens.css`): `--color-card`, `--color-text-link`, `--color-info-tint`,
`--color-nav-inactive` (= shelf-axis), `--color-primary-hover|outline|tint`,
`--color-surface-pressed`, `--color-scrim`, `--gradient-wood`, `--gradient-wood-detail`,
`--shadow-card|cover|plank|button|sheet|dialog`, `--radius-xs..sheet|pill`, `--tap-size`,
`--nav-height`, `--sidebar-width`, `--content-max`, `--page-gutter`, `--ease-out`,
`--duration-fast|base`.

### Genere contestuale

Su un contenitore: `<div data-genre="fantasy-magical-gothic">` oppure
`style={genreScopeStyle(slug)}` (`$lib/genres`). Dentro si usano `--genre-current`,
`--genre-current-light`, `--genre-current-dark`, `--genre-current-on` (testo su base),
`--genre-current-on-light` e i derivati della vista genere `--genre-current-nav-bg|nav-border|
line-top|line-bottom` (mix di light e dark come da mockup). Fuori da un contesto valgono il bordeaux/superfici del tema.

### Tema e no-flash

`hooks.server.ts` legge il cookie `sb-theme`, scrive `data-theme` su `<html>` e incorpora il CSS di
tutti i temi built-in nell'head (`%sb.themecss%` in `app.html`). Un piccolo script inline riallinea
`data-theme` al cookie se l'HTML arriva dalla cache del service worker.
Per cambiare tema da un componente: `getThemeController().selectBuiltin('chiave')` (aggiorna
`data-theme` e cookie); per un tema custom: `applyCustom(definition)` (JSON rivalidato con Zod,
variabili inline). Il salvataggio nel profilo (RPC `set_theme_selection`) è a carico del repository
`themes`. Nuovo tema built-in: aggiungerlo in `src/lib/themes/` e in `builtinThemes`
(`registry.ts`); `tests/unit/theme.test.ts` verifica schema e contrasto AA.

### Helper dei generi

`GENRE_ORDER`, `GENRE_LABELS`, `GENRE_SHORT_LABELS`, `isGenreSlug`, `genreScopeStyle` sono in `$lib/genres`.

## Layout (`$lib/components/layout/`)

| Componente         | Props                                    | Note                                            |
| ------------------ | ---------------------------------------- | ----------------------------------------------- |
| `AppShell`         | `children`, `userLabel?: string \| null` | Già usato da `src/routes/(app)/+layout.svelte`  |
| `BottomNavigation` | nessuna                                  | Fissa, <1024px. Pill bordeaux sulla voce attiva |
| `DesktopSidebar`   | `userLabel?`                             | >=1024px. Include Impostazioni ed Esci (POST)   |

Le voci sono in `src/lib/navigation.ts` (`NAV_ITEMS`, `isNavActive`). Libreria resta attiva su
`/library`, `/genre`, `/book`, `/add`; Statistiche su `/stats`, `/bingo`, `/quotes`.
`AppShell` riconosce due route: `/library` (fondo `--color-background-shelf` a tutta pagina) e
`/genre/[slug]` (imposta `data-genre`, fondo = `--genre-current-light` e barra/pill di navigazione
ricolorate dal genere). Il contenuto della pagina è dentro `<main id="main">` con `max-width: var(--content-max)`; le pagine
aggiungono solo il proprio padding orizzontale (`var(--page-gutter)`).

## UI (`$lib/components/ui/`)

Tutti usano Svelte 5 (runes, snippet). Le icone sono `Icon` + `icons.ts` (tratto 24x24 dei mockup).

```ts
// Icon
{ name: IconName; size?: number = 22; strokeWidth?: number = 1.9; label?: string; class?: string }
// Senza label è decorativa (aria-hidden). Nuove icone: aggiungere il markup a ICONS in icons.ts.

// Button (rest = attributi di <button>; con href diventa <a>)
{ variant?: 'primary'|'secondary'|'ghost' = 'primary'; size?: 'sm'|'md'|'lg' = 'md';
  fullWidth?: boolean; href?: string; loading?: boolean; icon?: Snippet; children: Snippet }
// sm = 44px, md = 50px (dialog), lg = 58px (pulsante "Sposta")

// IconButton (cerchio chiaro come back/more dei mockup)
{ icon: IconName; label: string /* obbligatoria, aria-label */; variant?: 'soft'|'ghost';
  size?: 44|48; href?: string; iconSize?: number; onclick?... }

// Chip (generico)
{ variant?: 'soft'|'outline'|'solid'|'dark'; size?: 'sm'|'md'|'lg'; selected?: boolean;
  onclick?; href?; onremove?: () => void; removeLabel?: string; icon?: Snippet; children: Snippet }
// selected rende il chip un toggle (aria-pressed). onremove aggiunge la X (i 3 aggettivi).

// GenreChip
{ slug: GenreSlug; label?: string; variant?: 'filled'|'soft'|'outline' = 'filled';
  selected?: boolean; onclick?; href?; size?: 'sm'|'md'|'lg' }

// StatusChip
{ status: LifecycleState | 'queued'; completedReadingsCount?: number; size?: 'sm'|'md' }
// finished con completedReadingsCount >= 2 mostra "Letto più di una volta"; unread = "TBR".

// FormatBadge
{ format: 'physical'|'digital'; variant?: 'chip'|'icon' }   // icon = pallino sul dorso/cover

// RatingStars (usa --genre-current per il colore)
{ value: number | null (bindable); max?: number = 5; size?: number = 18; readonly?: boolean = true;
  clearable?: boolean; label?: string = 'Voto'; onchange?: (v: number | null) => void }
// readonly: role=img "4 stelle su 5". Interattivo: radiogroup, frecce/Home/End, target 44px.

// Card
{ as?: 'div'|'section'|'article'; tone?: 'surface'|'elevated'; padding?: 'none'|'md'|'lg'; children; class? }

// PageHeader (titolo serif bordeaux + sottotitolo, back opzionale)
{ title: string; subtitle?: string; backHref?: string; actions?: Snippet }

// TextField
{ label: string; name: string; value?: string (bindable); error?: string | null; hint?: string;
  ...attributi di <input> (type, autocomplete, required...) }

// BottomSheet (handle, angoli 28px, focus trap, ESC, restore focus, scroll lock)
{ open: boolean; title: string; subtitle?: string; onclose: () => void; children: Snippet; footer?: Snippet }

// ConfirmDialog (role=alertdialog, focus iniziale su "Annulla")
{ open: boolean; title: string; description?: string; confirmLabel: string; cancelLabel?: string = 'Annulla';
  onconfirm: () => void; oncancel: () => void; busy?: boolean; illustration?: Snippet }
```

`open` è controllato dal genitore: `<BottomSheet open={sheetOpen} onclose={() => (sheetOpen = false)}>`.
`Modal.svelte` è la base interna condivisa (portal, scrim, trap del focus, ESC); non va usato
direttamente. Esempi vivi di tutti i componenti: `/dev/components` (solo in `npm run dev`).

## Come aggiungere una pagina

1. Crea `src/routes/(app)/<percorso>/+page.svelte` (con shell) oppure fuori da `(app)` (senza shell).
2. Il guard in `hooks.server.ts` protegge tutto tranne `/auth/*`; i dati arrivano da `+page.server.ts`
   (`load`/`actions`) tramite `locals.repos`, mai dal database nel componente.
3. Usa `PageHeader`, `Card` e i token; niente colori letterali (`npm run lint:colors`).
4. Se la voce è nuova nella navigazione, aggiungila a `NAV_ITEMS` (solo 3 voci primarie previste).

## Book (`$lib/components/book/`)

Primitive dei libri, tutte con input `book: BookSummary` (`$lib/contracts`). Regole comuni: nessun
colore letterale, tutto deriva dai token del genere (`--genre-<slug>`, `--genre-<slug>-dark`); il
placeholder e il dorso escono da un algoritmo **deterministico** (`$lib/book/spine.ts`, seed =
`id|titolo|autore|genere`): stesso libro, stesso aspetto. Nessun dorso scarica immagini.

```ts
// BookCover: cover frontale (raggio 3/8/8/3, costola scura, filo di luce, ombra del mockup)
{ book: BookSummary;
  size?: 'xs'|'sm'|'md'|'lg'|'xl'|'fluid' | number = 'md';  // px di larghezza, altezza = 1.5x
  showFormat?: boolean = false;       // cerchietto cartaceo/digitale in basso a destra
  badge?: 'reading'|'next'|null;      // pillola "In lettura" / "Prossimo" in alto a sinistra
  queueNumber?: number;               // cerchio bordeaux 1/2/3 (al posto del badge), per "I prossimi"
  priority?: boolean = false;         // true: loading=eager + fetchpriority=high; false: lazy
  noImage?: boolean = false;          // solo placeholder CSS, mai l'immagine reale
  class?: string }
// Dimensioni: xs 46x68 · sm 64x96 · md 84x124 · lg 104x156 · xl 126x189 · fluid = 100% x (aspect 34/50)
//             numero: 72 -> 72x108, 98 -> 98x147 ...
// Immagine: cover custom (coverStoragePath -> /api/covers/<path>) > coverUrl > placeholder CSS
// (4 pattern: righe 135deg, cerchio, fascia bassa, fascia centrale; inchiostro bianco/scuro per luminanza).
// <img> con width/height riservati e decoding=async: nessun layout shift. Errore di rete -> placeholder.

// BookSpine: dorso CSS. Con href e' un <a> (tap -> dettaglio), senza un <div role="img">
{ book: BookSummary; badge?: 'reading'|'next'|null /* pillola SOPRA il dorso */;
  lean?: boolean /* appoggiato, rotate(10deg) */; showFormat?: boolean = true;
  href?: string; spec?: SpineSpec; ...attributi HTML (data-*, onclick) }
// Larghezza 24/28/32/36 (dalle pagine), altezza 110..134, due filetti, titolo verticale con ellissi,
// area di tocco >= 44px. Flex item: va messo in una riga `display:flex; align-items:flex-end; gap:2px`.

// BookCard: cella della griglia genere (mockup 02): cover fluid + titolo + autore + "N pag." + stelle
{ book: BookSummary; queued?: boolean /* badge "Prossimo" */; badge?: 'reading'|'next'|null /* override */;
  href?: string /* default /book/<id> */; priority?: boolean; showFormat?: boolean = true }
// Il testo usa --genre-current-dark: va dentro `data-genre` / genreScopeStyle (pagina genere).
// Badge automatico: "In lettura" se lifecycleState = reading. Stelle solo se reviewRating != null.

// FormatIcon: { format: 'physical'|'digital'; size?: 16|20 }  // cerchietto (16 dorso, 20 cover), posiziona il genitore
```

Helper (`$lib/book/`): `spine.ts` (`buildSpine`, `fnv1a`, `rng`, `toneCss`, `pickInk`...),
`palette.ts` (`spineSpecFor(book, status, themeKey?)`, `bookStatus(book, queued)`),
`cover-url.ts` (`resolveCoverUrl(cover)`), `shelf-layout.ts` (composizione dello scaffale Home).
Uso tipico della cover: `<BookCover {book} size="xl" priority showFormat />`;
nelle liste sotto la piega lasciare il default (lazy).
