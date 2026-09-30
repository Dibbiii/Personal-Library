<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { BookSummary } from '$lib/contracts';
	import { getThemeController } from '$lib/themes/controller.svelte';
	import { spineSpecFor } from '$lib/book/palette';
	import type { BookStatusBadge, SpineSpec } from '$lib/book/spine';
	import FormatIcon from './FormatIcon.svelte';

	interface Props extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
		book: BookSummary;
		/** Badge sopra il dorso: "In lettura" / "Prossimo". */
		badge?: BookStatusBadge | null;
		/** Libro appoggiato (10deg). Di default segue l'algoritmo; lo scaffale ne ammette uno. */
		lean?: boolean;
		/** Cerchietto cartaceo/digitale in basso. */
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
		showFormat = true,
		href,
		spec: given,
		class: className,
		...rest
	}: Props = $props();

	const theme = getThemeController();
	const spec = $derived(given ?? spineSpecFor(book, badge, theme?.key));
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
	class:ink-dark={spec.spine.ink === 'dark'}
	class:lean={leaning}
	style:--w="{spec.spine.width}px"
	style:--h="{spec.spine.height}px"
	style:--bg={spec.spine.background}
	style:--mh="{spec.spine.labelMaxHeight}px"
	style:--hit="{hit}px"
	draggable="false"
	{...rest}
>
	<span class="hit" aria-hidden="true"></span>
	<span class="title" aria-hidden="true"><span>{book.title}</span></span>
	{#if showFormat}
		<FormatIcon format={book.format} size={16} class="format" />
	{/if}
	{#if badgeLabel}<span class="badge" aria-hidden="true">{badgeLabel}</span>{/if}
</svelte:element>

<style>
	.spine {
		--bar: color-mix(in srgb, var(--color-on-genre-white) 45%, transparent);
		--ink: var(--color-on-genre-white);
		position: relative;
		display: block;
		flex: none;
		box-sizing: border-box;
		width: var(--w);
		height: var(--h);
		border-radius: 3px 3px 1px 1px;
		background:
			linear-gradient(
				90deg,
				color-mix(in srgb, var(--color-on-genre-white) 24%, transparent),
				transparent 28%,
				color-mix(in srgb, var(--color-shadow) 16%, transparent)
			),
			var(--bg);
		box-shadow: 3px 0 4px -1px color-mix(in srgb, var(--color-text-primary) 30%, transparent);
		color: var(--ink);
		text-decoration: none;
		-webkit-touch-callout: none;
		user-select: none;
	}

	.spine.ink-dark {
		--bar: color-mix(in srgb, var(--color-on-genre-ink) 28%, transparent);
		--ink: var(--color-on-genre-ink);
	}

	.spine.lean {
		margin-left: 6px;
		transform: rotate(10deg);
		transform-origin: bottom right;
	}

	.spine::before,
	.spine::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		height: 2px;
		background: var(--bar);
	}

	.spine::before {
		top: 9px;
	}

	.spine::after {
		top: 14px;
	}

	.hit {
		position: absolute;
		inset: 0 calc(-1 * var(--hit));
	}

	.title {
		position: absolute;
		left: 0;
		right: 0;
		top: 22px;
		bottom: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.title > span {
		display: block;
		max-height: var(--mh);
		overflow: hidden;
		font-size: 10.5px;
		font-weight: 700;
		line-height: 1;
		text-overflow: ellipsis;
		white-space: nowrap;
		writing-mode: vertical-rl;
		transform: rotate(180deg);
	}

	.spine :global(.format) {
		position: absolute;
		bottom: 6px;
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
</style>
