<script lang="ts">
	import type { DecorationKind } from '$lib/book/shelf-layout';

	/** Decorazioni dello scaffale in stile illustrato piatto (mockup Libreria). Colori solo da token. */
	let { kind }: { kind: DecorationKind } = $props();

	const uid = $props.id();

	/** Foglia a goccia con la base nell'origine, punta verso l'alto. */
	function leaf(length: number, width: number): string {
		const l = length;
		const w = width;
		return `M0 0C${w} ${-l * 0.28} ${w * 0.9} ${-l * 0.72} 0 ${-l}C${-w * 0.9} ${-l * 0.72} ${-w} ${-l * 0.28} 0 0Z`;
	}

	interface Leaf {
		x: number;
		y: number;
		r: number;
		l: number;
		w: number;
		tone: 'dark' | 'light';
	}

	// Pianta: foglie a ventaglio, prima quelle dietro (scure) poi quelle davanti (chiare).
	const PLANT_LEAVES: Leaf[] = [
		{ x: 36, y: 46, r: -6, l: 34, w: 15, tone: 'dark' },
		{ x: 29, y: 42, r: -46, l: 28, w: 13, tone: 'dark' },
		{ x: 43, y: 42, r: 44, l: 28, w: 13, tone: 'dark' },
		{ x: 22, y: 50, r: -96, l: 24, w: 11, tone: 'dark' },
		{ x: 50, y: 50, r: 100, l: 24, w: 11, tone: 'dark' },
		{ x: 33, y: 48, r: -26, l: 30, w: 13, tone: 'light' },
		{ x: 39, y: 48, r: 24, l: 30, w: 13, tone: 'light' },
		{ x: 26, y: 53, r: -68, l: 21, w: 10, tone: 'light' },
		{ x: 46, y: 53, r: 70, l: 21, w: 10, tone: 'light' },
		{ x: 36, y: 52, r: 4, l: 22, w: 10, tone: 'light' }
	];

	// Rami secchi del vaso: [x2, y2, controllo x, controllo y] partendo dal collo (35, 46).
	const BRANCHES = [
		{
			d: 'M35 46C33 32 24 20 14 8',
			leaves: [
				[26, 26, -40],
				[20, 17, -55],
				[15, 10, -30],
				[30, 34, -20]
			]
		},
		{
			d: 'M36 46C37 30 40 16 38 2',
			leaves: [
				[37, 32, 15],
				[39, 20, -10],
				[38, 8, 20],
				[36, 24, -35]
			]
		},
		{
			d: 'M37 46C42 34 52 26 62 18',
			leaves: [
				[46, 33, 50],
				[53, 27, 60],
				[60, 20, 40],
				[43, 38, 30]
			]
		}
	] as const;
</script>

{#if kind === 'plant'}
	<svg class="deco" width="72" height="92" viewBox="0 0 72 92" aria-hidden="true">
		<defs>
			<linearGradient id="{uid}-pot" x1="0" x2="1" y1="0" y2="0">
				<stop offset="0" class="s-pot-light" />
				<stop offset="0.55" class="s-pot" />
				<stop offset="1" class="s-pot-shade" />
			</linearGradient>
		</defs>
		<ellipse class="shadow" cx="36" cy="89.5" rx="20" ry="2.5" />
		{#each PLANT_LEAVES as l, i (i)}
			<path class="stem" d="M36 56Q{(36 + l.x) / 2} {l.y + 8} {l.x} {l.y}" />
		{/each}
		{#each PLANT_LEAVES as l, i (i)}
			<g transform="translate({l.x} {l.y}) rotate({l.r})">
				<path class={l.tone === 'dark' ? 'leaf-dark' : 'leaf-light'} d={leaf(l.l, l.w)} />
				<path class="vein" d="M0 -2L0 {-l.l * 0.82}" />
			</g>
		{/each}
		<path d="M16 56h40l-4.5 29a5 5 0 0 1-5 4.2H25.5a5 5 0 0 1-5-4.2z" fill="url(#{uid}-pot)" />
		<rect class="pot-rim" x="13" y="52" width="46" height="8" rx="4" />
		<rect class="highlight" x="17" y="53.5" width="20" height="2" rx="1" />
		<path class="pot-band" d="M18.6 68h34.8l-.5 3.2H19.1z" />
	</svg>
{:else if kind === 'candle'}
	<svg class="deco" width="52" height="74" viewBox="0 0 52 74" aria-hidden="true">
		<defs>
			<radialGradient id="{uid}-glow">
				<stop offset="0" class="s-glow" />
				<stop offset="1" class="s-glow-out" />
			</radialGradient>
			<linearGradient id="{uid}-wax" x1="0" x2="1" y1="0" y2="0">
				<stop offset="0" class="s-wax-light" />
				<stop offset="0.6" class="s-wax" />
				<stop offset="1" class="s-wax-shade" />
			</linearGradient>
		</defs>
		<circle cx="26" cy="16" r="16" fill="url(#{uid}-glow)" />
		<path
			class="flame"
			d="M26 4c4.5 5.5 5.6 9.4 3.4 12.6a4 4 0 0 1-6.8 0C20.4 13.4 21.5 9.5 26 4z"
		/>
		<path
			class="flame-core"
			d="M26 10c2 2.6 2.4 4.4 1.4 5.8a1.7 1.7 0 0 1-2.8 0c-1-1.4-.6-3.2 1.4-5.8z"
		/>
		<path class="wick" d="M26 17.5v4" />
		<path d="M14 25h24v38H14z" fill="url(#{uid}-wax)" />
		<ellipse class="wax-top" cx="26" cy="25" rx="12" ry="3.2" />
		<path
			class="wax-top"
			d="M14 25c0 3.5 1 6 2.4 6 1.2 0 1.6-2 1.6-3.6 0 0 1 .8 3 .9 0 4 .8 7 2.4 7s2.2-3 2.2-6.6c2 .4 6 .2 8.4-.5 0 2 .6 3.4 1.8 3.4S38 29 38 25z"
		/>
		<ellipse class="dish" cx="26" cy="66" rx="20" ry="5" />
		<path class="dish-front" d="M6 66a20 5 0 0 0 40 0v2.2a20 5.5 0 0 1-40 0z" />
		<path class="dish-ring" d="M6.5 64.6a20 5 0 0 1 39 0" />
		<path class="dish-handle" d="M44.5 65.5c4.5-.5 6.5 1.5 5.5 3.6-.9 1.8-3.6 1.6-5.6.6" />
	</svg>
{:else if kind === 'mug'}
	<svg class="deco" width="54" height="58" viewBox="0 0 54 58" aria-hidden="true">
		<path class="steam" d="M17 4c-3 3.5 3 5.5 0 9.5s3 6 0 9" />
		<path class="steam" d="M26 1.5c-3 3.5 3 5.5 0 9.5s3 6 0 9" />
		<ellipse class="shadow" cx="22" cy="55.5" rx="18" ry="2.2" />
		<path class="mug-handle" d="M37 30h3.5a7 7 0 0 1 0 14H37" />
		<path class="mug" d="M6 26h32v21a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8z" />
		<path class="mug-shade" d="M30 26h8v21a8 8 0 0 1-8 8z" />
		<ellipse class="mug-rim" cx="22" cy="26" rx="16" ry="3.6" />
		<ellipse class="coffee" cx="22" cy="26.2" rx="13" ry="2.4" />
		<path class="mug-band" d="M6 38h32v3.5H6z" />
		<rect class="highlight" x="9.5" y="31" width="2.4" height="15" rx="1.2" />
	</svg>
{:else if kind === 'stack'}
	<svg class="deco" width="88" height="50" viewBox="0 0 88 50" aria-hidden="true">
		<ellipse class="shadow" cx="44" cy="48" rx="40" ry="2" />
		{#each [{ y: 34, x: 2, w: 82, h: 13, c: 'book-a' }, { y: 22, x: 7, w: 72, h: 12, c: 'book-b' }, { y: 10.5, x: 4, w: 76, h: 11.5, c: 'book-c' }] as b, i (i)}
			<g transform={i === 2 ? 'rotate(-2.5 42 16)' : undefined}>
				<rect class="pages" x={b.x + b.w - 6} y={b.y + 1.2} width="5" height={b.h - 2.4} rx="1" />
				<rect class={b.c} x={b.x} y={b.y} width={b.w - 4} height={b.h} rx="2.2" />
				<rect class="sheen" x={b.x + 1} y={b.y + 1} width={b.w - 6} height="2" rx="1" />
				<path
					class="trim"
					d="M{b.x + 7} {b.y + 2}v{b.h - 4}M{b.x + 10} {b.y + 2}v{b.h - 4}M{b.x + b.w - 14} {b.y +
						2}v{b.h - 4}M{b.x + b.w - 11} {b.y + 2}v{b.h - 4}"
				/>
				<rect
					class="label"
					x={b.x + b.w / 2 - 12}
					y={b.y + b.h / 2 - 2.5}
					width="20"
					height="5"
					rx="1"
				/>
			</g>
		{/each}
	</svg>
{:else if kind === 'vase'}
	<svg class="deco" width="72" height="98" viewBox="0 0 72 98" aria-hidden="true">
		<defs>
			<linearGradient id="{uid}-vase" x1="0" x2="1" y1="0" y2="0">
				<stop offset="0" class="s-vase-light" />
				<stop offset="0.55" class="s-vase" />
				<stop offset="1" class="s-vase-shade" />
			</linearGradient>
		</defs>
		{#each BRANCHES as branch, b (b)}
			<path class="branch" d={branch.d} />
			{#each branch.leaves as [x, y, r], i (i)}
				<path
					class={i % 2 === 0 ? 'dry-leaf' : 'dry-leaf-light'}
					d={leaf(9, 3.4)}
					transform="translate({x} {y}) rotate({r})"
				/>
			{/each}
		{/each}
		<ellipse class="shadow" cx="36" cy="95.5" rx="20" ry="2.5" />
		<path
			d="M29 46h14v5c0 2 1.5 3 4 4.6C55 60 60 67 60 76c0 11-10 19-24 19S12 87 12 76c0-9 5-16 13-20.4 2.5-1.6 4-2.6 4-4.6z"
			fill="url(#{uid}-vase)"
		/>
		<ellipse class="vase-rim" cx="36" cy="46" rx="8" ry="2.4" />
		<path class="vase-band" d="M13.4 70h45.2c.3 1.2.5 2.4.6 3.6H12.8c.1-1.2.3-2.4.6-3.6z" />
		<path class="highlight" d="M19 66c-1.5 3-2 6.5-1.6 10" />
	</svg>
{:else if kind === 'globe'}
	<svg class="deco" width="64" height="86" viewBox="0 0 64 86" aria-hidden="true">
		<defs>
			<clipPath id="{uid}-sphere"><circle cx="30" cy="34" r="22" /></clipPath>
		</defs>
		<ellipse class="shadow" cx="31" cy="83.5" rx="20" ry="2.4" />
		<g transform="rotate(-18 30 34)">
			<circle class="sphere" cx="30" cy="34" r="22" />
			<g clip-path="url(#{uid}-sphere)">
				<path
					class="land"
					d="M13 22c4-3 9-2 11 1s-1 6 2 8 6 1 6 5-5 4-6 8-5 6-8 3-1-7-4-9-6-1-6-5 1-8 5-11zM35 14c4 0 8 1 11 4s0 5-3 5-3 3-6 3-5-3-4-6-2-6 2-6zM39 34c3-1 7 0 9 3s1 8-2 11-6 2-7-1 1-5-1-7-2-5 1-6z"
				/>
				<path class="sphere-shade" d="M43 10a22 22 0 0 1 0 48a26 26 0 0 0 0-48z" />
				<path class="meridian" d="M30 12c-8 6-8 38 0 44M8 34h44" />
			</g>
			<path class="highlight" d="M17 22a16 16 0 0 1 8-6" />
			<path class="arc" d="M30 7A27 27 0 0 1 30 61" />
			<circle class="pin" cx="30" cy="7" r="2" />
		</g>
		<path class="stand" d="M38.5 60.5l2 1.2-6 9.3h-4z" />
		<ellipse class="base" cx="32" cy="78" rx="16" ry="4.5" />
		<path class="base-front" d="M16 78a16 4.5 0 0 0 32 0v2.4a16 4.8 0 0 1-32 0z" />
		<path class="stand" d="M29 70h7l1.5 7h-10z" />
		<ellipse class="highlight-fill" cx="27" cy="76.6" rx="6" ry="1.2" />
	</svg>
{/if}

<style>
	.deco {
		display: block;
		flex: none;
		margin: 0 8px;
		pointer-events: none;
		overflow: visible;
	}

	/* ombre e luci comuni */
	.shadow {
		fill: color-mix(in srgb, var(--color-wood-ink) 18%, transparent);
	}

	.highlight {
		fill: none;
		stroke: color-mix(in srgb, var(--color-on-genre-white) 55%, transparent);
		stroke-width: 2;
		stroke-linecap: round;
	}

	rect.highlight,
	.highlight-fill {
		fill: color-mix(in srgb, var(--color-on-genre-white) 45%, transparent);
		stroke: none;
	}

	/* pianta */
	.leaf-dark {
		fill: var(--color-leaf-dark);
	}

	.leaf-light {
		fill: var(--color-leaf-light);
	}

	.stem {
		fill: none;
		stroke: var(--color-leaf-dark);
		stroke-width: 1.3;
		stroke-linecap: round;
	}

	.vein {
		fill: none;
		stroke: color-mix(in srgb, var(--color-on-genre-white) 28%, transparent);
		stroke-width: 0.9;
		stroke-linecap: round;
	}

	.s-pot-light {
		stop-color: color-mix(in srgb, var(--color-pot-rim) 70%, var(--color-on-genre-white));
	}

	.s-pot {
		stop-color: var(--color-pot-rim);
	}

	.s-pot-shade {
		stop-color: var(--color-pot);
	}

	.pot-rim {
		fill: color-mix(in srgb, var(--color-pot-rim) 80%, var(--color-on-genre-white));
	}

	.pot-band {
		fill: color-mix(in srgb, var(--color-pot) 70%, var(--color-wood-ink));
		opacity: 0.35;
	}

	/* candela */
	.s-glow {
		stop-color: color-mix(in srgb, var(--color-flame) 45%, transparent);
	}

	.s-glow-out {
		stop-color: color-mix(in srgb, var(--color-flame) 0%, transparent);
	}

	.flame {
		fill: var(--color-flame);
	}

	.flame-core {
		fill: var(--color-flame-core);
	}

	.wick {
		fill: none;
		stroke: var(--color-wood-ink);
		stroke-width: 1.6;
		stroke-linecap: round;
	}

	.s-wax-light {
		stop-color: color-mix(in srgb, var(--color-flame-core) 40%, var(--color-on-genre-white));
	}

	.s-wax {
		stop-color: color-mix(in srgb, var(--color-flame-core) 70%, var(--color-on-genre-white));
	}

	.s-wax-shade {
		stop-color: color-mix(in srgb, var(--color-wax-edge) 55%, var(--color-flame-core));
	}

	.wax-top {
		fill: color-mix(in srgb, var(--color-flame-core) 55%, var(--color-wax-edge));
	}

	.dish {
		fill: var(--color-wood-detail-mid);
	}

	.dish-front {
		fill: var(--color-wood-detail-bottom);
	}

	.dish-ring {
		fill: none;
		stroke: color-mix(in srgb, var(--color-on-genre-white) 45%, transparent);
		stroke-width: 1;
	}

	.dish-handle {
		fill: none;
		stroke: var(--color-wood-detail-bottom);
		stroke-width: 2.2;
		stroke-linecap: round;
	}

	/* tazza */
	.steam {
		fill: none;
		stroke: color-mix(in srgb, var(--color-text-muted) 45%, transparent);
		stroke-width: 2;
		stroke-linecap: round;
	}

	.mug,
	.mug-handle {
		fill: var(--color-pot-rim);
	}

	.mug-handle {
		fill: none;
		stroke: var(--color-pot);
		stroke-width: 4;
	}

	.mug-shade {
		fill: color-mix(in srgb, var(--color-pot) 60%, transparent);
	}

	.mug-rim {
		fill: color-mix(in srgb, var(--color-pot-rim) 75%, var(--color-on-genre-white));
	}

	.coffee {
		fill: color-mix(in srgb, var(--color-wood-ink) 80%, var(--color-pot));
	}

	.mug-band {
		fill: color-mix(in srgb, var(--color-on-genre-white) 40%, transparent);
	}

	/* pila di libri */
	.pages {
		fill: color-mix(in srgb, var(--color-wood-detail-top) 70%, var(--color-on-genre-white));
	}

	.book-a {
		fill: color-mix(in srgb, var(--color-pot) 45%, var(--color-wood-ink));
	}

	.book-b {
		fill: var(--color-leaf-dark);
	}

	.book-c {
		fill: var(--color-pot);
	}

	.trim {
		fill: none;
		stroke: var(--color-wood-detail-mid);
		stroke-width: 1.1;
		stroke-linecap: round;
	}

	.sheen {
		fill: color-mix(in srgb, var(--color-on-genre-white) 22%, transparent);
	}

	.label {
		fill: color-mix(in srgb, var(--color-wood-detail-top) 80%, var(--color-on-genre-white));
		opacity: 0.85;
	}

	/* vaso con rami secchi */
	.branch {
		fill: none;
		stroke: var(--color-wood-bottom);
		stroke-width: 1.4;
		stroke-linecap: round;
	}

	.dry-leaf {
		fill: var(--color-wood-mid);
	}

	.dry-leaf-light {
		fill: color-mix(in srgb, var(--color-flame) 35%, var(--color-wood-detail-mid));
	}

	.s-vase-light {
		stop-color: color-mix(in srgb, var(--color-flame-core) 25%, var(--color-on-genre-white));
	}

	.s-vase {
		stop-color: color-mix(in srgb, var(--color-wood-detail-top) 35%, var(--color-on-genre-white));
	}

	.s-vase-shade {
		stop-color: color-mix(in srgb, var(--color-wood-detail-mid) 70%, var(--color-wax-edge));
	}

	.vase-rim {
		fill: color-mix(in srgb, var(--color-wood-detail-mid) 60%, var(--color-wood-bottom));
	}

	.vase-band {
		fill: color-mix(in srgb, var(--color-pot) 55%, transparent);
	}

	/* mappamondo */
	.sphere {
		fill: color-mix(in srgb, var(--color-wood-detail-top) 75%, var(--color-flame-core));
	}

	.land {
		fill: color-mix(in srgb, var(--color-flame) 55%, var(--color-wood-mid));
	}

	.sphere-shade {
		fill: color-mix(in srgb, var(--color-wood-ink) 14%, transparent);
	}

	.meridian {
		fill: none;
		stroke: color-mix(in srgb, var(--color-wood-ink) 18%, transparent);
		stroke-width: 0.8;
	}

	.arc {
		fill: none;
		stroke: var(--color-wood-bottom);
		stroke-width: 2.6;
		stroke-linecap: round;
	}

	.pin {
		fill: var(--color-wood-detail-mid);
	}

	.stand {
		fill: var(--color-wood-bottom);
	}

	.base {
		fill: var(--color-wood-mid);
	}

	.base-front {
		fill: var(--color-wood-bottom);
	}
</style>
