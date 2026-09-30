<script lang="ts" module>
	export type CoverSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'fluid';

	/** Larghezze in px; l'altezza e' sempre 2:3 (xs 46x68, sm 64x96, md 84x124, lg 104x156, xl 126x189). */
	export const COVER_SIZES: Record<Exclude<CoverSize, 'fluid'>, readonly [number, number]> = {
		xs: [46, 68],
		sm: [64, 96],
		md: [84, 124],
		lg: [104, 156],
		xl: [126, 189]
	};

	export function coverDimensions(size: CoverSize | number): readonly [number, number] | null {
		if (size === 'fluid') return null;
		if (typeof size === 'number') return [size, Math.round(size * 1.5)];
		return COVER_SIZES[size];
	}
</script>

<script lang="ts">
	import type { BookSummary } from '$lib/contracts';
	import { getThemeController } from '$lib/themes/controller.svelte';
	import { resolveCoverUrl } from '$lib/book/cover-url';
	import { spineSpecFor } from '$lib/book/palette';
	import type { BookStatusBadge } from '$lib/book/spine';
	import FormatIcon from './FormatIcon.svelte';

	interface Props {
		book: BookSummary;
		/** Dimensione predefinita, oppure la larghezza in px (altezza = 1.5x). `fluid` = 100% di larghezza. */
		size?: CoverSize | number;
		/** Cerchietto cartaceo/digitale in basso a destra. */
		showFormat?: boolean;
		/** Pillola "In lettura" / "Prossimo" in alto a sinistra. */
		badge?: BookStatusBadge | null;
		/** Numero in coda (1, 2, 3...) nel cerchio bordeaux in alto a sinistra. */
		queueNumber?: number;
		/** Above the fold: caricamento immediato. Altrimenti lazy. */
		priority?: boolean;
		/** Non usare mai l'immagine reale, solo il placeholder CSS (scaffali: niente download). */
		noImage?: boolean;
		class?: string;
	}

	let {
		book,
		size = 'md',
		showFormat = false,
		badge = null,
		queueNumber,
		priority = false,
		noImage = false,
		class: className
	}: Props = $props();

	const theme = getThemeController();
	const spec = $derived(spineSpecFor(book, badge, theme?.key));
	const dims = $derived(coverDimensions(size));
	const src = $derived(noImage ? null : resolveCoverUrl(book.cover));

	let failed = $state(false);
	$effect(() => {
		void src;
		failed = false;
	});

	const showImage = $derived(src !== null && !failed);
	const badgeLabel = $derived(
		badge === 'reading' ? 'In lettura' : badge === 'next' ? 'Prossimo' : null
	);
</script>

<div
	class="cover {className ?? ''}"
	class:fluid={dims === null}
	class:ink-dark={spec.cover.ink === 'dark'}
	class:has-image={showImage}
	data-pattern={spec.cover.pattern}
	role="img"
	aria-label="Copertina di {book.title}"
	style:--bg={spec.cover.background}
	style:--genre-dark="var(--genre-{book.genre.slug}-dark)"
	style:width={dims ? `${dims[0]}px` : undefined}
	style:height={dims ? `${dims[1]}px` : undefined}
>
	{#if showImage}
		<img
			{src}
			alt=""
			width={dims ? dims[0] : 106}
			height={dims ? dims[1] : 156}
			loading={priority ? 'eager' : 'lazy'}
			fetchpriority={priority ? 'high' : 'auto'}
			decoding="async"
			draggable="false"
			onerror={() => (failed = true)}
		/>
	{:else}
		<span class="line t1"></span>
		<span class="line t2"></span>
	{/if}

	{#if queueNumber !== undefined}
		<span class="queue-number" aria-hidden="true">{queueNumber}</span>
	{:else if badgeLabel}
		<span class="badge">{badgeLabel}</span>
	{/if}

	{#if showFormat}
		<FormatIcon format={book.format} size={20} class="format" />
	{/if}
</div>

<style>
	.cover {
		--t: color-mix(in srgb, var(--color-on-genre-white) 62%, transparent);
		--ov: color-mix(in srgb, var(--color-on-genre-white) 22%, transparent);
		position: relative;
		flex: none;
		box-sizing: border-box;
		overflow: hidden;
		border-radius: 3px 8px 8px 3px;
		background: var(--pattern, none), var(--bg);
		box-shadow:
			var(--shadow-cover),
			inset 4px 0 0 color-mix(in srgb, var(--color-shadow) 10%, transparent),
			inset 6px 0 0 color-mix(in srgb, var(--color-on-genre-white) 16%, transparent);
	}

	.cover.ink-dark {
		--t: color-mix(in srgb, var(--color-on-genre-ink) 50%, transparent);
		--ov: color-mix(in srgb, var(--color-on-genre-ink) 12%, transparent);
	}

	.cover.fluid {
		width: 100%;
		aspect-ratio: 34 / 50;
	}

	.cover[data-pattern='stripes'] {
		--pattern: repeating-linear-gradient(135deg, var(--ov) 0 6px, transparent 6px 14px);
	}

	.cover[data-pattern='circle'] {
		--pattern: radial-gradient(circle at 50% 64%, var(--ov) 0 24%, transparent 25%);
	}

	.cover[data-pattern='band-bottom'] {
		--pattern: linear-gradient(
			to bottom,
			transparent 0 64%,
			color-mix(in srgb, var(--genre-dark) 35%, transparent) 64% 100%
		);
	}

	.cover[data-pattern='band-mid'] {
		--pattern: linear-gradient(to bottom, transparent 60%, var(--ov) 60% 72%, transparent 72%);
	}

	.line {
		position: absolute;
		left: 18%;
		right: 14%;
		top: 13%;
		height: 4px;
		border-radius: 2px;
		background: var(--t);
	}

	.t2 {
		left: 26%;
		right: 22%;
		margin-top: 9px;
		opacity: 0.7;
	}

	img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* Costola e filo di luce anche sopra l'immagine reale */
	.has-image::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		pointer-events: none;
		box-shadow:
			inset 4px 0 0 color-mix(in srgb, var(--color-shadow) 10%, transparent),
			inset 6px 0 0 color-mix(in srgb, var(--color-on-genre-white) 16%, transparent);
	}

	.badge,
	.queue-number {
		position: absolute;
		z-index: 1;
		background: var(--color-primary);
		color: var(--color-on-primary);
		font-weight: 700;
		white-space: nowrap;
	}

	.badge {
		left: 6px;
		top: 6px;
		max-width: calc(100% - 12px);
		padding: 2px 7px;
		border-radius: 999px;
		font-size: 10px;
		line-height: 14px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.queue-number {
		left: 5px;
		top: 5px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		font-size: 12px;
		line-height: 1;
	}

	.cover :global(.format) {
		position: absolute;
		z-index: 1;
		right: 5px;
		bottom: 5px;
	}
</style>
