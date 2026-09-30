<script lang="ts">
	import type { BookSummary } from '$lib/contracts/books';
	import {
		WHEEL_CENTER,
		WHEEL_SLICE_RADIUS,
		labelFontSize,
		labelMaxChars,
		polar,
		shortTitle,
		sliceLabelLayout,
		slicePath
	} from '$lib/explore/wheel';

	interface Props {
		/** Libri disegnati sulla ruota (già limitati a un campione). */
		slices: readonly BookSummary[];
		/** Rotazione assoluta in gradi (senso orario). */
		rotation: number;
		/** Durata della rotazione in ms; 0 = senza animazione. */
		duration?: number;
		spinning?: boolean;
		/** Descrizione accessibile, es. "10 libri da leggere". */
		description: string;
		onspin: () => void;
	}

	let { slices, rotation, duration = 0, spinning = false, description, onspin }: Props = $props();

	const count = $derived(slices.length);
	const fontSize = $derived(labelFontSize(count));
	const maxChars = $derived(labelMaxChars(count));

	// 24 puntini sul bordo, alternati rosa/chiaro, il primo a 0° (destra).
	const dots = Array.from({ length: 24 }, (_, i) => ({
		...polar(158, i * 15),
		accent: i % 2 === 0
	}));
</script>

<div class="wheel" class:spinning>
	<svg viewBox="0 -16 340 358" role="img" aria-label="Ruota della Fortuna con {description}">
		<circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r="168" fill="var(--color-primary)" />
		{#each dots as dot, i (i)}
			<circle
				cx={dot.x}
				cy={dot.y}
				r="3.6"
				fill={dot.accent ? 'var(--color-accent)' : 'var(--color-background)'}
			/>
		{/each}

		<g
			class="spin"
			style:transform="rotate({rotation}deg)"
			style:transition={duration > 0
				? `transform ${duration}ms cubic-bezier(0.12, 0.62, 0.08, 1)`
				: 'none'}
		>
			<circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r={WHEEL_SLICE_RADIUS} fill="none" />
			{#each slices as book, i (book.id)}
				{@const path = slicePath(i, count)}
				{#if path}
					<path
						d={path}
						fill="var(--genre-{book.genre.slug})"
						stroke="var(--color-background)"
						stroke-width="2.5"
					/>
				{:else}
					<circle
						cx={WHEEL_CENTER}
						cy={WHEEL_CENTER}
						r={WHEEL_SLICE_RADIUS}
						fill="var(--genre-{book.genre.slug})"
						stroke="var(--color-background)"
						stroke-width="2.5"
					/>
				{/if}
			{/each}
			{#each slices as book, i (book.id)}
				{@const layout = sliceLabelLayout(i, count)}
				<text
					transform={layout.transform}
					text-anchor={layout.anchor}
					dominant-baseline="central"
					font-family="var(--font-ui)"
					font-size={fontSize}
					font-weight="700"
					fill="var(--genre-{book.genre.slug}-on-base)"
				>
					{shortTitle(book.title, maxChars)}
				</text>
			{/each}
		</g>

		<circle
			cx={WHEEL_CENTER}
			cy={WHEEL_CENTER}
			r="40"
			fill="var(--color-primary)"
			stroke="var(--color-background)"
			stroke-width="5"
		/>
		<text
			x={WHEEL_CENTER}
			y={WHEEL_CENTER}
			text-anchor="middle"
			dominant-baseline="central"
			font-family="var(--font-ui)"
			font-size="15"
			font-weight="700"
			letter-spacing="1"
			fill="var(--color-background)"
		>
			GIRA
		</text>
		<path
			d="M156 -14 L184 -14 L170 24 Z"
			fill="var(--color-accent)"
			stroke="var(--color-primary)"
			stroke-width="3.5"
			stroke-linejoin="round"
		/>
	</svg>

	<button
		class="hub"
		type="button"
		aria-label="Gira la ruota"
		disabled={spinning || count === 0}
		onclick={onspin}
	></button>
</div>

<style>
	.wheel {
		position: relative;
		width: 100%;
		max-width: 318px;
		margin: 0 auto;
		aspect-ratio: 340 / 358;
		filter: drop-shadow(0 14px 14px color-mix(in srgb, var(--color-text-primary) 25%, transparent));
	}

	svg {
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
	}

	.spin {
		transform-box: fill-box;
		transform-origin: center;
		will-change: transform;
	}

	/* Bottone reale sopra il mozzo dell'SVG: 80/340 della larghezza, centrato su (170,170) */
	.hub {
		position: absolute;
		left: 50%;
		top: calc((170 + 16) / 358 * 100%);
		width: calc(80 / 340 * 100%);
		aspect-ratio: 1;
		transform: translate(-50%, -50%);
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: transparent;
		cursor: pointer;
	}

	.hub:disabled {
		cursor: progress;
	}

	.hub:focus-visible {
		outline: 3px solid var(--color-accent);
		outline-offset: 3px;
	}

	@media (min-width: 1024px) {
		.wheel {
			max-width: 400px;
		}
	}
</style>
