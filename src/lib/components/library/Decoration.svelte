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

	const round = (n: number) => Math.round(n * 10) / 10;

	interface Frond {
		d: string;
		tone: 'dark' | 'light';
		leaflets: { x: number; y: number; r: number; l: number; w: number }[];
	}

	/** Felce: fronde ad arco (curva quadratica dal colletto) con foglioline ai due lati. */
	function frond(angle: number, length: number, tone: Frond['tone']): Frond {
		const [x0, y0] = [42, 54];
		const a = (angle * Math.PI) / 180;
		const droop = length * 0.5 * Math.pow(Math.abs(angle) / 75, 1.3);
		const end = [x0 + length * Math.sin(a) * 1.05, y0 - length * Math.cos(a) + droop];
		const ctrl = [x0 + length * 0.55 * Math.sin(a * 0.7), y0 - length * 0.95 * Math.cos(a * 0.5)];
		const point = (t: number, i: 0 | 1) =>
			(1 - t) ** 2 * [x0, y0][i]! + 2 * (1 - t) * t * ctrl[i]! + t ** 2 * end[i]!;
		const slope = (t: number, i: 0 | 1) =>
			2 * (1 - t) * (ctrl[i]! - [x0, y0][i]!) + 2 * t * (end[i]! - ctrl[i]!);
		const leaflets: Frond['leaflets'] = [];
		for (let t = 0.12; t < 0.97; t += 0.07) {
			const heading = (Math.atan2(slope(t, 1), slope(t, 0)) * 180) / Math.PI;
			const l = round(9 * (1 - 0.55 * t));
			const w = round(2.8 * (1 - 0.4 * t));
			for (const side of [-62, 62]) {
				leaflets.push({
					x: round(point(t, 0)),
					y: round(point(t, 1)),
					r: round(heading + side + 90),
					l,
					w
				});
			}
		}
		const d = `M${x0} ${y0}Q${round(ctrl[0]!)} ${round(ctrl[1]!)} ${round(end[0]!)} ${round(end[1]!)}`;
		return { d, tone, leaflets };
	}

	const FERN_FRONDS: Frond[] = [
		frond(-75, 38, 'dark'),
		frond(75, 38, 'dark'),
		frond(-48, 42, 'dark'),
		frond(48, 42, 'dark'),
		frond(-20, 44, 'dark'),
		frond(22, 42, 'dark'),
		frond(-62, 32, 'light'),
		frond(62, 32, 'light'),
		frond(-34, 36, 'light'),
		frond(34, 36, 'light'),
		frond(-6, 38, 'light'),
		frond(10, 32, 'light')
	];

	// Succulenta: rosetta in tre giri, dal fondo (larghi) al centro (piccoli).
	const ROSETTE = [
		{ angles: [-82, -56, -28, 0, 28, 56, 82], l: 15, w: 6.5, y: 31 },
		{ angles: [-62, -31, 0, 31, 62], l: 11, w: 5.5, y: 31 },
		{ angles: [-26, 0, 26], l: 7, w: 4, y: 30.5 }
	];

	// Pothos: ciuffo sopra il vaso e foglie lungo i tralci che ricadono oltre la mensola.
	const POTHOS_TOP: Leaf[] = [
		{ x: 38, y: 46, r: -4, l: 26, w: 13, tone: 'dark' },
		{ x: 30, y: 46, r: -42, l: 22, w: 12, tone: 'dark' },
		{ x: 46, y: 46, r: 42, l: 22, w: 12, tone: 'dark' },
		{ x: 24, y: 47, r: -76, l: 18, w: 10, tone: 'dark' },
		{ x: 52, y: 47, r: 76, l: 18, w: 10, tone: 'dark' },
		{ x: 34, y: 46, r: -20, l: 20, w: 11, tone: 'light' },
		{ x: 42, y: 46, r: 22, l: 20, w: 11, tone: 'light' },
		{ x: 27, y: 47, r: -58, l: 16, w: 9, tone: 'light' },
		{ x: 49, y: 47, r: 58, l: 16, w: 9, tone: 'light' }
	];
	/** Foglie che ricadono sul bordo del vaso, davanti all'orlo. */
	const POTHOS_RIM: Leaf[] = [
		{ x: 26, y: 47, r: -118, l: 12, w: 7.5, tone: 'light' },
		{ x: 50, y: 47, r: 118, l: 12, w: 7.5, tone: 'light' },
		{ x: 40, y: 47.5, r: 160, l: 11, w: 7, tone: 'dark' }
	];
	const POTHOS_VINES = [
		'M22 47C14 53 12 66 14 78S12 92 16 98',
		'M54 47C62 53 64 62 62 74S64 86 60 92'
	];
	const POTHOS_HANGING: Leaf[] = [
		{ x: 17, y: 52, r: 215, l: 10, w: 6.5, tone: 'dark' },
		{ x: 13, y: 62, r: 145, l: 10, w: 6.5, tone: 'light' },
		{ x: 14, y: 72, r: 205, l: 10, w: 6.5, tone: 'dark' },
		{ x: 13, y: 82, r: 150, l: 9.5, w: 6, tone: 'light' },
		{ x: 15, y: 93, r: 195, l: 9, w: 6, tone: 'dark' },
		{ x: 59, y: 52, r: 145, l: 10, w: 6.5, tone: 'light' },
		{ x: 63, y: 62, r: 212, l: 10, w: 6.5, tone: 'dark' },
		{ x: 62, y: 72, r: 155, l: 10, w: 6.5, tone: 'light' },
		{ x: 63, y: 82, r: 205, l: 9.5, w: 6, tone: 'dark' },
		{ x: 61, y: 90, r: 170, l: 9, w: 6, tone: 'light' }
	];
	const POTHOS_FRONT: Leaf[] = [
		{ x: 28, y: 58, r: 205, l: 10, w: 6.5, tone: 'light' },
		{ x: 27, y: 70, r: 150, l: 10, w: 6.5, tone: 'dark' },
		{ x: 27, y: 81, r: 200, l: 9.5, w: 6, tone: 'light' }
	];

	// Cactus: file di spine sulle tre coste.
	const CACTUS_SPINES = [24, 30, 36, 42, 48, 54, 60, 66].flatMap((y, i) =>
		[23.4, 28, 32.6].map((x, j) => ({ x, y: y + ((i + j) % 2) * 3 }))
	);
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
{:else if kind === 'bust'}
	<svg class="deco" width="60" height="82" viewBox="0 0 60 82" aria-hidden="true">
		<defs>
			<linearGradient id="{uid}-stone" x1="0" x2="1" y1="0" y2="0">
				<stop offset="0" class="s-stone-light" />
				<stop offset="0.55" class="s-stone" />
				<stop offset="1" class="s-stone-shade" />
			</linearGradient>
		</defs>
		<ellipse class="shadow" cx="30" cy="79.5" rx="21" ry="2.4" />
		<rect class="stone-dark" x="9" y="73" width="42" height="6" rx="1.5" />
		<rect x="13" y="61" width="34" height="12" fill="url(#{uid}-stone)" />
		<rect class="stone-mid" x="10" y="57" width="40" height="5" rx="1.5" />
		<rect class="highlight" x="12" y="57.8" width="18" height="1.2" rx=".6" />
		<path d="M10 57c0-9 6-14 13-16l7-2 7 2c7 2 13 7 13 16z" fill="url(#{uid}-stone)" />
		<path class="fold" d="M13 54c6-5 13-9 22-10M20 56.5c6-3 13-6 22-7M40 45c3 3 5 7 6 11" />
		<path d="M25 33h10l1.5 8.5c-2 1.5-4 2-6.5 2s-4.5-.5-6.5-2z" fill="url(#{uid}-stone)" />
		<path class="stone-shade-fill" d="M33 34h2l1.5 7.5c-1 .8-2 1.2-3 1.5z" />
		<ellipse cx="30" cy="23" rx="10" ry="12.5" fill="url(#{uid}-stone)" />
		<path
			class="stone-shade-fill"
			d="M36 15c3 4 4.5 10 2 16.5-1.5 3.4-4.4 5.6-8 6 4.2-3 6.2-8 6.2-13.5 0-3.2-.2-5.8-.2-9z"
		/>
		{#each [[21, 17.5, 3.6], [23.5, 12.5, 3.6], [28, 9.8, 3.6], [33, 10.2, 3.6], [37, 13.2, 3.4], [39.3, 18, 3]] as [x, y, r], i (i)}
			<circle class="stone-mid" cx={x} cy={y} {r} />
		{/each}
		{#each [[25.5, 14.5], [30.5, 12.8], [35, 15]] as [x, y], i (i)}
			<circle class="stone-curl" cx={x} cy={y} r="2.6" />
		{/each}
		<path
			class="fold"
			d="M24.5 21.5c1.5-1 3-1 4 0M31.5 21.5c1.5-1 3-1 4 0M30 22.5v6c0 .9 1 1.1 1.7.7M27.5 31.5c1.6.9 3.4.9 5 0"
		/>
	</svg>
{:else if kind === 'succulent'}
	<svg class="deco" width="54" height="50" viewBox="0 0 54 50" aria-hidden="true">
		<defs>
			<linearGradient id="{uid}-succ" x1="0" x2="0" y1="1" y2="0">
				<stop offset="0" class="s-succ-base" />
				<stop offset="0.7" class="s-succ" />
				<stop offset="1" class="s-succ-tip" />
			</linearGradient>
			<linearGradient id="{uid}-glaze" x1="0" x2="1" y1="0" y2="0">
				<stop offset="0" class="s-glaze-light" />
				<stop offset="0.55" class="s-glaze" />
				<stop offset="1" class="s-glaze-shade" />
			</linearGradient>
		</defs>
		<ellipse class="shadow" cx="27" cy="47.6" rx="18" ry="2" />
		<path d="M9 33h36l-2.5 11a4 4 0 0 1-4 3h-21a4 4 0 0 1-4-3z" fill="url(#{uid}-glaze)" />
		<rect class="glaze-rim" x="7" y="30.5" width="40" height="5" rx="2.5" />
		<path class="glaze-band" d="M10.6 39.5h32.8l-.4 2H11z" />
		{#each ROSETTE as ring, r (r)}
			{#each ring.angles as angle, i (i)}
				<path
					class="succ-leaf"
					d={leaf(ring.l, ring.w)}
					fill="url(#{uid}-succ)"
					transform="translate(27 {ring.y}) rotate({angle})"
				/>
			{/each}
		{/each}
	</svg>
{:else if kind === 'cactus'}
	<svg class="deco" width="56" height="90" viewBox="0 0 56 90" aria-hidden="true">
		<defs>
			<linearGradient id="{uid}-pot" x1="0" x2="1" y1="0" y2="0">
				<stop offset="0" class="s-pot-light" />
				<stop offset="0.55" class="s-pot" />
				<stop offset="1" class="s-pot-shade" />
			</linearGradient>
		</defs>
		<ellipse class="shadow" cx="28" cy="87.6" rx="17" ry="2.2" />
		<path class="cactus-arm" d="M23 52H18.5a3.5 3.5 0 0 1-3.5-3.5V37" />
		<path class="cactus-arm" d="M33 44h4.5a3.5 3.5 0 0 0 3.5-3.5V31" />
		<path class="arm-rib" d="M15 46.5V38M41 39.5V32" />
		<path class="cactus" d="M21.5 70V22a6.5 6.5 0 0 1 13 0v48z" />
		<path class="cactus-shade" d="M31.5 16.3a6.5 6.5 0 0 1 3 5.7v48h-3z" />
		<path class="rib" d="M25.2 17.5V70M30.8 17.5V70" />
		{#each CACTUS_SPINES as s, i (i)}
			<circle class="spine-dot" cx={s.x} cy={s.y} r=".6" />
		{/each}
		{#each [-64, -32, 0, 32, 64] as angle, i (i)}
			<ellipse
				class="petal"
				cx="28"
				cy="10.5"
				rx="2.4"
				ry="4.2"
				transform="rotate({angle} 28 14.5)"
			/>
		{/each}
		<circle class="flower-core" cx="28" cy="14.2" r="1.9" />
		<path
			d="M15 71h26l-3 14a3.5 3.5 0 0 1-3.5 2.8h-13A3.5 3.5 0 0 1 18 85z"
			fill="url(#{uid}-pot)"
		/>
		<rect class="pot-rim" x="13" y="67" width="30" height="6" rx="3" />
		<rect class="highlight" x="16" y="68.2" width="12" height="1.6" rx=".8" />
	</svg>
{:else if kind === 'trailing'}
	<svg class="deco drape" width="76" height="86" viewBox="0 14 76 86" aria-hidden="true">
		<defs>
			<linearGradient id="{uid}-vase" x1="0" x2="1" y1="0" y2="0">
				<stop offset="0" class="s-vase-light" />
				<stop offset="0.55" class="s-vase" />
				<stop offset="1" class="s-vase-shade" />
			</linearGradient>
		</defs>
		{#each POTHOS_TOP as l, i (i)}
			<g transform="translate({l.x} {l.y}) rotate({l.r})">
				<path class={l.tone === 'dark' ? 'leaf-dark' : 'leaf-light'} d={leaf(l.l, l.w)} />
				<path class="vein" d="M0 -2L0 {-l.l * 0.8}" />
			</g>
		{/each}
		<ellipse class="shadow" cx="38" cy="69" rx="17" ry="2" />
		<path d="M22 49h32l-3.5 17.5a4 4 0 0 1-4 3.3H29.5a4 4 0 0 1-4-3.3z" fill="url(#{uid}-vase)" />
		<rect class="ceramic-rim" x="19" y="45" width="38" height="6.5" rx="3.2" />
		<path class="ceramic-band" d="M23.3 57h29.4l-.4 2.4H23.7z" />
		{#each POTHOS_RIM as l, i (i)}
			<g transform="translate({l.x} {l.y}) rotate({l.r})">
				<path class={l.tone === 'dark' ? 'leaf-dark' : 'leaf-light'} d={leaf(l.l, l.w)} />
				<path class="vein" d="M0 -1.5L0 {-l.l * 0.78}" />
			</g>
		{/each}
		{#each POTHOS_VINES as d, i (i)}
			<path class="vine" {d} />
		{/each}
		{#each POTHOS_HANGING as l, i (i)}
			<g transform="translate({l.x} {l.y}) rotate({l.r})">
				<path class={l.tone === 'dark' ? 'leaf-dark' : 'leaf-light'} d={leaf(l.l, l.w)} />
				<path class="vein" d="M0 -1.5L0 {-l.l * 0.78}" />
			</g>
		{/each}
		<path class="vine" d="M31 48C27 60 29 72 26.5 86" />
		{#each POTHOS_FRONT as l, i (i)}
			<g transform="translate({l.x} {l.y}) rotate({l.r})">
				<path class={l.tone === 'dark' ? 'leaf-dark' : 'leaf-light'} d={leaf(l.l, l.w)} />
				<path class="vein" d="M0 -1.5L0 {-l.l * 0.78}" />
			</g>
		{/each}
	</svg>
{:else if kind === 'fern'}
	<svg class="deco" width="84" height="86" viewBox="0 0 84 86" aria-hidden="true">
		<defs>
			<linearGradient id="{uid}-vase" x1="0" x2="1" y1="0" y2="0">
				<stop offset="0" class="s-vase-light" />
				<stop offset="0.55" class="s-vase" />
				<stop offset="1" class="s-vase-shade" />
			</linearGradient>
		</defs>
		<ellipse class="shadow" cx="42" cy="83.6" rx="22" ry="2.4" />
		{#each FERN_FRONDS as f, i (i)}
			<g class={f.tone === 'dark' ? 'fern-dark' : 'fern-light'}>
				<path class="frond-stem" d={f.d} />
				{#each f.leaflets as l, j (j)}
					<path d={leaf(l.l, l.w)} transform="translate({l.x} {l.y}) rotate({l.r})" />
				{/each}
			</g>
		{/each}
		<path d="M24 57h36l-4 22.5a5 5 0 0 1-5 4H33a5 5 0 0 1-5-4z" fill="url(#{uid}-vase)" />
		<rect class="ceramic-rim" x="21" y="52.5" width="42" height="7" rx="3.5" />
		<rect class="highlight" x="24" y="54" width="16" height="1.6" rx=".8" />
		<path class="ceramic-band" d="M25.8 67h32.4l-.4 2.6H26.2z" />
	</svg>
{:else if kind === 'hourglass'}
	<svg class="deco" width="40" height="62" viewBox="0 0 40 62" aria-hidden="true">
		<ellipse class="shadow" cx="20" cy="60" rx="17" ry="2" />
		<rect class="post" x="5" y="7" width="3" height="47" rx="1" />
		<path
			class="glass"
			d="M10.5 7.5C10.5 18 18 22 18.6 30.5 18 39 10.5 43 10.5 54h19c0-11-7.5-15-8.1-23.5C22 22 29.5 18 29.5 7.5z"
		/>
		<path class="sand" d="M13.4 15.5c1.8 5 5.2 8 6.6 10.6 1.4-2.6 4.8-5.6 6.6-10.6z" />
		<path class="sand-stream" d="M20 26.5V48" />
		<path class="sand" d="M11.4 54c1-5.6 5-7.8 8.6-9.2 3.6 1.4 7.6 3.6 8.6 9.2z" />
		<path class="glass-shine" d="M13.5 10.5c.4 4 2 7 3.5 9M13.5 50.5c.5-3 1.8-5.2 3.4-6.8" />
		<rect class="post" x="32" y="7" width="3" height="47" rx="1" />
		<rect class="plate" x="2" y="2" width="36" height="5.5" rx="2" />
		<rect class="plate" x="2" y="53" width="36" height="5.5" rx="2" />
		<rect class="highlight" x="4" y="2.8" width="18" height="1.2" rx=".6" />
		<rect class="highlight" x="4" y="53.8" width="18" height="1.2" rx=".6" />
	</svg>
{:else if kind === 'lantern'}
	<svg class="deco" width="48" height="72" viewBox="0 0 48 72" aria-hidden="true">
		<defs>
			<radialGradient id="{uid}-glow">
				<stop offset="0" class="s-glow" />
				<stop offset="1" class="s-glow-out" />
			</radialGradient>
			<radialGradient id="{uid}-pane" cx="0.5" cy="0.45" r="0.7">
				<stop offset="0" class="s-pane-core" />
				<stop offset="1" class="s-pane" />
			</radialGradient>
		</defs>
		<circle cx="24" cy="40" r="24" fill="url(#{uid}-glow)" />
		<ellipse class="shadow" cx="24" cy="70" rx="18" ry="2" />
		<circle class="ring" cx="24" cy="6" r="3.6" />
		<rect class="brass-dark" x="15" y="9.5" width="18" height="3" rx="1.5" />
		<path class="brass" d="M11 20h26l-5-8H16z" />
		<rect class="brass-dark" x="11" y="20" width="26" height="40" rx="2" />
		<rect x="14.5" y="23" width="19" height="34" rx="1" fill="url(#{uid}-pane)" />
		<rect class="lantern-wax" x="21" y="44" width="6" height="13" rx="1" />
		<path
			class="flame"
			d="M24 34c2.2 2.7 2.8 4.6 1.7 6.2a2 2 0 0 1-3.4 0c-1.1-1.6-.5-3.5 1.7-6.2z"
		/>
		<path class="glass-shine" d="M17 26v12" />
		<rect class="brass" x="9" y="60" width="30" height="6" rx="2" />
		<rect class="brass-dark" x="11" y="66" width="26" height="3.5" rx="1" />
		<rect class="highlight" x="11" y="61" width="14" height="1.3" rx=".6" />
	</svg>
{:else if kind === 'bookends'}
	<svg class="deco" width="48" height="64" viewBox="0 0 48 64" aria-hidden="true">
		<defs>
			<linearGradient id="{uid}-bronze" x1="0" x2="1" y1="0" y2="0">
				<stop offset="0" class="s-bronze-light" />
				<stop offset="0.5" class="s-bronze" />
				<stop offset="1" class="s-bronze-shade" />
			</linearGradient>
		</defs>
		<ellipse class="shadow" cx="24" cy="61.8" rx="21" ry="2" />
		<rect class="plate" x="3" y="55" width="42" height="6" rx="2" />
		<path d="M12 30l-1.5-13 9 7zM36 30l1.5-13-9 7z" fill="url(#{uid}-bronze)" />
		<path d="M9 55C6 41 8 26 24 22c16 4 18 19 15 33z" fill="url(#{uid}-bronze)" />
		<circle class="owl-face" cx="18" cy="32.5" r="7" />
		<circle class="owl-face" cx="30" cy="32.5" r="7" />
		<circle class="owl-eye" cx="18" cy="32.5" r="3.6" />
		<circle class="owl-eye" cx="30" cy="32.5" r="3.6" />
		<circle class="owl-glint" cx="19.2" cy="31.3" r="1.1" />
		<circle class="owl-glint" cx="31.2" cy="31.3" r="1.1" />
		<path class="owl-beak" d="M22.5 37h3L24 41z" />
		<path class="owl-line" d="M11 41c3 4 4 9 3 14M37 41c-3 4-4 9-3 14" />
		<path class="owl-feather" d="M20 46q2 2 4 0q2 2 4 0M18 50q2 2 4 0q2 2 4 0q2 2 4 0" />
	</svg>
{:else if kind === 'figurine'}
	<svg class="deco" width="40" height="76" viewBox="0 0 40 76" aria-hidden="true">
		<defs>
			<linearGradient id="{uid}-stone" x1="0" x2="1" y1="0" y2="0">
				<stop offset="0" class="s-stone-light" />
				<stop offset="0.55" class="s-stone" />
				<stop offset="1" class="s-stone-shade" />
			</linearGradient>
		</defs>
		<ellipse class="shadow" cx="20" cy="73.8" rx="15" ry="2" />
		<rect class="plinth" x="8" y="60" width="24" height="13" rx="1.5" />
		<rect class="plinth-top" x="7" y="58" width="26" height="3.5" rx="1.2" />
		<ellipse
			cx="20"
			cy="10.5"
			rx="5.6"
			ry="7.2"
			fill="url(#{uid}-stone)"
			transform="rotate(-8 20 10)"
		/>
		<path d="M18 15.5h4v4h-4z" fill="url(#{uid}-stone)" />
		<path
			d="M14 19c-3 .5-4 3-3.5 6l1.5 12c.5 4 2.5 6 3 10l.5 11h9l.5-11c.5-4 2.5-6 3-10l1.5-12c.5-3-.5-5.5-3.5-6z"
			fill="url(#{uid}-stone)"
		/>
		<path
			class="stone-shade-fill"
			d="M25 19c3 .5 4 3 3.5 6l-1.5 12c-.5 4-2.5 6-3 10l-.5 11h-1.6l.9-11c.6-4 2.6-6 3-10l1.4-12c.3-2.6-.3-4.6-2.1-6z"
		/>
		<path
			class="fold"
			d="M12.5 31c5 2.5 10 2.5 15 0M13.2 35.5c4.5 2 9 2 13.6 0M20 46v12M21.2 6.5v5"
		/>
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

	/* pothos: i tralci scendono oltre la mensola */
	.deco.drape {
		margin-bottom: -30px;
	}

	/* pietra / marmo (busto, statuetta) */
	.s-stone-light {
		stop-color: color-mix(in srgb, var(--color-wood-detail-top) 25%, var(--color-on-genre-white));
	}

	.s-stone {
		stop-color: color-mix(in srgb, var(--color-wood-detail-top) 55%, var(--color-on-genre-white));
	}

	.s-stone-shade {
		stop-color: color-mix(in srgb, var(--color-wood-detail-mid) 60%, var(--color-wax-edge));
	}

	.stone-mid {
		fill: color-mix(in srgb, var(--color-wood-detail-top) 72%, var(--color-wax-edge));
	}

	.stone-curl {
		fill: color-mix(in srgb, var(--color-wood-detail-top) 45%, var(--color-on-genre-white));
	}

	.stone-dark {
		fill: color-mix(in srgb, var(--color-wood-detail-mid) 55%, var(--color-wax-edge));
	}

	.stone-shade-fill {
		fill: color-mix(in srgb, var(--color-wax-edge) 35%, transparent);
	}

	.fold {
		fill: none;
		stroke: color-mix(in srgb, var(--color-wax-edge) 70%, transparent);
		stroke-width: 1;
		stroke-linecap: round;
	}

	.plinth {
		fill: color-mix(in srgb, var(--color-wood-bottom) 60%, var(--color-wood-ink));
	}

	.plinth-top {
		fill: var(--color-wood-bottom);
	}

	/* succulenta */
	.s-succ-base {
		stop-color: color-mix(in srgb, var(--color-leaf-light) 65%, var(--color-leaf-dark));
	}

	.s-succ {
		stop-color: color-mix(in srgb, var(--color-leaf-light) 70%, var(--color-on-genre-white));
	}

	.s-succ-tip {
		stop-color: color-mix(in srgb, var(--color-accent) 55%, var(--color-pot-rim));
	}

	.succ-leaf {
		stroke: color-mix(in srgb, var(--color-leaf-dark) 35%, transparent);
		stroke-width: 0.6;
	}

	.s-glaze-light {
		stop-color: color-mix(
			in srgb,
			var(--genre-contemporary-historical) 40%,
			var(--color-on-genre-white)
		);
	}

	.s-glaze {
		stop-color: color-mix(
			in srgb,
			var(--genre-contemporary-historical) 60%,
			var(--color-wood-detail-top)
		);
	}

	.s-glaze-shade {
		stop-color: color-mix(
			in srgb,
			var(--genre-contemporary-historical-dark) 55%,
			var(--genre-contemporary-historical)
		);
	}

	.glaze-rim {
		fill: color-mix(in srgb, var(--genre-contemporary-historical) 45%, var(--color-on-genre-white));
	}

	.glaze-band {
		fill: color-mix(in srgb, var(--genre-contemporary-historical-dark) 35%, transparent);
	}

	/* cactus */
	.cactus {
		fill: color-mix(in srgb, var(--color-leaf-dark) 72%, var(--color-leaf-light));
	}

	.cactus-arm {
		fill: none;
		stroke: color-mix(in srgb, var(--color-leaf-dark) 72%, var(--color-leaf-light));
		stroke-width: 7;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.cactus-shade {
		fill: color-mix(in srgb, var(--color-leaf-dark) 80%, var(--color-wood-ink));
		opacity: 0.55;
	}

	.rib,
	.arm-rib {
		fill: none;
		stroke: color-mix(in srgb, var(--color-leaf-light) 80%, var(--color-on-genre-white));
		stroke-width: 0.9;
		stroke-linecap: round;
		opacity: 0.6;
	}

	.spine-dot {
		fill: var(--color-wood-detail-top);
	}

	.petal {
		fill: var(--color-accent);
	}

	.flower-core {
		fill: color-mix(in srgb, var(--color-flame) 55%, var(--color-flame-core));
	}

	/* pothos e felce */
	.vine {
		fill: none;
		stroke: var(--color-leaf-dark);
		stroke-width: 1.2;
		stroke-linecap: round;
	}

	.ceramic-rim {
		fill: color-mix(in srgb, var(--color-wood-detail-top) 45%, var(--color-on-genre-white));
	}

	.ceramic-band {
		fill: color-mix(in srgb, var(--color-leaf-dark) 45%, transparent);
	}

	.fern-dark {
		fill: var(--color-leaf-dark);
		stroke: var(--color-leaf-dark);
	}

	.fern-light {
		fill: color-mix(in srgb, var(--color-leaf-light) 80%, var(--color-leaf-dark));
		stroke: color-mix(in srgb, var(--color-leaf-light) 80%, var(--color-leaf-dark));
	}

	.fern-dark path:not(.frond-stem),
	.fern-light path:not(.frond-stem) {
		stroke: none;
	}

	.frond-stem {
		fill: none;
		stroke-width: 1;
		stroke-linecap: round;
	}

	/* clessidra */
	.post {
		fill: var(--color-wood-bottom);
	}

	.plate {
		fill: var(--color-wood-mid);
	}

	.glass {
		fill: color-mix(in srgb, var(--color-on-genre-white) 30%, transparent);
		stroke: color-mix(in srgb, var(--color-on-genre-white) 75%, var(--color-wax-edge));
		stroke-width: 1;
	}

	.glass-shine {
		fill: none;
		stroke: color-mix(in srgb, var(--color-on-genre-white) 70%, transparent);
		stroke-width: 1.2;
		stroke-linecap: round;
	}

	.sand {
		fill: color-mix(in srgb, var(--color-wood-detail-mid) 70%, var(--color-flame));
	}

	.sand-stream {
		fill: none;
		stroke: color-mix(in srgb, var(--color-wood-detail-mid) 70%, var(--color-flame));
		stroke-width: 0.9;
	}

	/* lanterna */
	.ring {
		fill: none;
		stroke: color-mix(in srgb, var(--color-wood-bottom) 75%, var(--color-wood-ink));
		stroke-width: 1.8;
	}

	.brass {
		fill: color-mix(in srgb, var(--color-wood-detail-mid) 70%, var(--color-flame));
	}

	.brass-dark {
		fill: color-mix(in srgb, var(--color-wood-bottom) 75%, var(--color-wood-ink));
	}

	.s-pane-core {
		stop-color: var(--color-flame-core);
	}

	.s-pane {
		stop-color: color-mix(in srgb, var(--color-flame) 55%, var(--color-flame-core));
	}

	.lantern-wax {
		fill: color-mix(in srgb, var(--color-flame-core) 60%, var(--color-on-genre-white));
	}

	/* fermalibri a gufo */
	.s-bronze-light {
		stop-color: color-mix(in srgb, var(--color-wood-detail-mid) 75%, var(--color-on-genre-white));
	}

	.s-bronze {
		stop-color: color-mix(in srgb, var(--color-wood-detail-mid) 70%, var(--color-flame));
	}

	.s-bronze-shade {
		stop-color: var(--color-wood-bottom);
	}

	.owl-face {
		fill: color-mix(in srgb, var(--color-wood-detail-top) 80%, var(--color-flame-core));
	}

	.owl-eye {
		fill: color-mix(in srgb, var(--color-wood-ink) 88%, var(--color-wood-bottom));
	}

	.owl-glint {
		fill: var(--color-on-genre-white);
	}

	.owl-beak {
		fill: color-mix(in srgb, var(--color-flame) 60%, var(--color-wood-bottom));
	}

	.owl-line,
	.owl-feather {
		fill: none;
		stroke: color-mix(in srgb, var(--color-wood-bottom) 80%, var(--color-wood-ink));
		stroke-width: 1.4;
		stroke-linecap: round;
	}

	.owl-feather {
		stroke-width: 1;
		opacity: 0.7;
	}
</style>
