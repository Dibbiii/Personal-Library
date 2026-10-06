<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { BookSummary } from '$lib/contracts';
	import { getThemeController } from '$lib/themes/controller.svelte';
	import { spineSpecFor } from '$lib/book/palette';
	import { bindingFor, spineHeight } from '$lib/book/binding';
	import type { BookStatusBadge, SpineSpec } from '$lib/book/spine';
	import FormatIcon from './FormatIcon.svelte';

	interface Props extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
		book: BookSummary;
		/** Badge sopra il dorso: "In lettura" / "Prossimo". */
		badge?: BookStatusBadge | null;
		/** Libro appoggiato (10deg). Di default segue l'algoritmo; lo scaffale ne ammette uno. */
		lean?: boolean;
		/** Cerchietto cartaceo/digitale in basso (di default nascosto: i dorsi restano puliti). */
		showFormat?: boolean;
		/** Con href il dorso e' un link (tap -> dettaglio); senza, un elemento statico. */
		href?: string;
		/** Specifica gia' calcolata (evita di ricalcolarla). */
		spec?: SpineSpec;
	}

	let {
		book,
		badge = null,
		lean,
		showFormat = false,
		href,
		spec: given,
		class: className,
		...rest
	}: Props = $props();

	const theme = getThemeController();
	const spec = $derived(given ?? spineSpecFor(book, badge, theme?.key));
	const binding = $derived(bindingFor(book, theme?.key));
	const leaning = $derived(lean ?? false);
	const badgeLabel = $derived(
		badge === 'reading' ? 'In lettura' : badge === 'next' ? 'Prossimo' : null
	);
	// Area di tocco minima 44px in larghezza senza alterare il layout.
	const hit = $derived(Math.max(0, Math.ceil((44 - spec.spine.width) / 2)));
</script>

<svelte:element
	this={href ? 'a' : 'div'}
	{href}
	role={href ? undefined : 'img'}
	aria-label="{book.title}, di {book.author}{badgeLabel ? `, ${badgeLabel.toLowerCase()}` : ''}"
	class="spine {className ?? ''}"
	class:ink-dark={binding.ink === 'dark'}
	class:labelled={binding.label}
	class:lean={leaning}
	style:--w="{spec.spine.width}px"
	style:--h="{spineHeight(spec)}px"
	style:--bg={binding.background}
	style:--mh="{spec.spine.labelMaxHeight}px"
	style:--hit="{hit}px"
	data-variant={binding.variant}
	draggable="false"
	{...rest}
>
	<span class="hit" aria-hidden="true"></span>
	<span class="bands top" aria-hidden="true"></span>
	{#if binding.ornament !== 'none'}
		<svg class="ornament" viewBox="0 0 12 12" aria-hidden="true">
			{#if binding.ornament === 'diamond'}
				<path d="M6 1l3.2 5L6 11 2.8 6z" />
			{:else if binding.ornament === 'leaf'}
				<path d="M6 1c3 2.5 3 6.5 0 10C3 7.5 3 3.5 6 1z" /><path class="vein" d="M6 3v7" />
			{:else if binding.ornament === 'moon'}
				<path d="M8.5 1.6A4.6 4.6 0 1 0 8.5 10.4 3.6 3.6 0 1 1 8.5 1.6z" />
			{:else if binding.ornament === 'star'}
				<path d="M6 .8l1.3 3.9L11.2 6 7.3 7.3 6 11.2 4.7 7.3.8 6l3.9-1.3z" />
			{:else}
				<circle cx="6" cy="6" r="2.4" />
			{/if}
		</svg>
	{/if}
	<span class="title" aria-hidden="true"><span>{book.title}</span></span>
	<span class="bands bottom" aria-hidden="true"></span>
	{#if showFormat}
		<FormatIcon format={book.format} size={16} class="format" />
	{/if}
	{#if badgeLabel}<span class="badge" aria-hidden="true">{badgeLabel}</span>{/if}
</svelte:element>

<style>
	.spine {
		/* oro dei fregi e crema del titolo sulle rilegature scure */
		--gilt: var(--color-wood-detail-mid);
		--ink: var(--color-wood-detail-top);
		position: relative;
		display: block;
		flex: none;
		box-sizing: border-box;
		width: var(--w);
		height: var(--h);
		border-radius: 3px 3px 2px 2px;
		background:
			linear-gradient(
				90deg,
				color-mix(in srgb, var(--color-shadow) 22%, transparent),
				color-mix(in srgb, var(--color-on-genre-white) 14%, transparent) 22%,
				transparent 48%,
				color-mix(in srgb, var(--color-shadow) 18%, transparent)
			),
			var(--bg);
		box-shadow:
			2px 0 3px -1px color-mix(in srgb, var(--color-wood-ink) 35%, transparent),
			inset 0 1px 0 color-mix(in srgb, var(--color-on-genre-white) 20%, transparent);
		color: var(--ink);
		text-decoration: none;
		-webkit-touch-callout: none;
		user-select: none;
		transition: transform var(--duration-fast) var(--ease-out);
	}

	.spine.ink-dark {
		--gilt: color-mix(in srgb, var(--color-wood-ink) 70%, var(--bg));
		--ink: var(--color-wood-ink);
	}

	@media (hover: hover) {
		.spine:not(.lean):hover {
			transform: translateY(-6px);
		}
	}

	.spine.lean {
		margin-left: 6px;
		transform: rotate(10deg);
		transform-origin: bottom right;
	}

	/* Doppio filetto in alto e in basso */
	.bands {
		position: absolute;
		left: 3px;
		right: 3px;
		height: 6px;
		border-top: 1.5px solid var(--gilt);
		border-bottom: 1px solid var(--gilt);
		opacity: 0.9;
	}

	.bands.top {
		top: 8px;
	}

	.bands.bottom {
		bottom: 8px;
	}

	.ornament {
		position: absolute;
		top: 21px;
		left: 50%;
		width: 11px;
		height: 11px;
		margin-left: -5.5px;
		fill: var(--gilt);
		stroke: none;
	}

	.ornament .vein {
		fill: none;
		stroke: var(--bg);
		stroke-width: 0.8;
	}

	.hit {
		position: absolute;
		inset: 0 calc(-1 * var(--hit));
	}

	.title {
		position: absolute;
		left: 0;
		right: 0;
		top: 34px;
		bottom: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.title > span {
		display: block;
		max-height: calc(var(--h) - 58px);
		overflow: hidden;
		font-family: var(--font-display);
		font-size: 10.5px;
		font-weight: 400;
		line-height: 1;
		letter-spacing: 0.02em;
		text-overflow: ellipsis;
		white-space: nowrap;
		writing-mode: vertical-rl;
		transform: rotate(180deg);
	}

	/* Etichetta in pelle scura dietro il titolo */
	.labelled .title > span {
		padding: 6px 3px;
		border-radius: 2px;
		background: color-mix(in srgb, var(--color-wood-ink) 55%, var(--bg));
		box-shadow: 0 0 0 1px var(--gilt);
	}

	.spine :global(.format) {
		position: absolute;
		bottom: 18px;
		left: 50%;
		margin-left: -8px;
	}

	.badge {
		position: absolute;
		z-index: 8;
		bottom: 100%;
		left: 50%;
		margin-bottom: 5px;
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--color-primary);
		box-shadow: 0 3px 6px color-mix(in srgb, var(--color-text-primary) 30%, transparent);
		color: var(--color-on-primary);
		font-size: 10px;
		font-weight: 700;
		line-height: 14px;
		white-space: nowrap;
		transform: translateX(-50%);
	}

	@media (prefers-reduced-motion: reduce) {
		.spine {
			transition: none;
		}
	}
</style>
