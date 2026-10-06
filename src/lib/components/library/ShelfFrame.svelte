<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { dropzone, type DropZoneOptions } from '$lib/actions/drag';
	import type { GenreSlug } from '$lib/contracts';

	interface Props {
		title: string;
		/** Link "Vedi tutti" nell'intestazione (vista genere). */
		href?: string;
		/** Colore del pallino (espressione CSS / token). */
		accent: string;
		/** Altezza dell'area libri: 224 per In lettura e I prossimi, 168 per genere. */
		height?: number;
		/** Padding orizzontale della riga di libri. */
		inset?: number;
		/** Pill accanto al titolo ("2 libri", "3 su 3"). */
		pill?: string;
		/** Genere: fornisce i colori della pill "Rilascia qui". */
		genre?: GenreSlug;
		/** Durante il drag: questo scaffale e' il bersaglio evidenziato. */
		target?: boolean;
		/** Bersaglio di drop. */
		zone?: DropZoneOptions<never>;
		/** Vista elenco: niente mensola, il contenuto va a capo. */
		list?: boolean;
		/** Descrizione accessibile dell'area libri. */
		label?: string;
		scroller?: HTMLElement | null;
		children: Snippet;
		/** Contenuto sotto la mensola (titoli dei prossimi). */
		below?: Snippet;
		onscroll?: (event: Event) => void;
		class?: string;
	}

	let {
		title,
		href,
		accent,
		height = 168,
		inset = 18,
		pill,
		genre,
		target = false,
		zone,
		list = false,
		label,
		scroller = $bindable(null),
		children,
		below,
		onscroll,
		class: className
	}: Props = $props();

	const neverAccepts: DropZoneOptions<never> = { accepts: () => false };
</script>

<section
	class="block {className ?? ''}"
	class:target
	class:list
	style:--g={accent}
	style:--g-dark={genre ? `var(--genre-${genre}-dark)` : undefined}
	style:--g-light={genre ? `var(--genre-${genre}-light)` : undefined}
	aria-label={label ?? title}
	use:dropzone={zone ?? neverAccepts}
>
	<header class="head">
		<span class="dot" aria-hidden="true"></span>
		<h2 class="title">{title}</h2>
		{#if target}
			<span class="drop-pill" role="status">
				<Icon name="chevron-down" size={14} strokeWidth={2.4} />
				Rilascia qui
			</span>
		{:else if pill}
			<span class="pill">{pill}</span>
		{/if}
		<span class="actions">
			{#if href}
				<a class="all" {href} aria-label="Vedi tutti: {title}">
					<span>Vedi tutti</span>
					<Icon name="arrow-right" size={16} strokeWidth={2.2} />
				</a>
			{/if}
		</span>
	</header>

	{#if list}
		<div class="list-body">{@render children()}</div>
	{:else}
		<div class="scroller" data-shelf-scroller bind:this={scroller} {onscroll}>
			<div class="row" style:height="{height}px" style:padding-inline="{inset}px">
				{@render children()}
			</div>
		</div>
		<div class="plank" aria-hidden="true">
			<span class="plank-top"></span>
			<span class="plank-front"></span>
		</div>
	{/if}

	{@render below?.()}
</section>

<style>
	.block {
		position: relative;
		box-sizing: border-box;
		padding: 14px 0 22px;
		border-radius: var(--radius-sheet);
		background:
			radial-gradient(
				ellipse 70% 90% at 50% 100%,
				color-mix(in srgb, var(--color-surface-elevated) 60%, transparent),
				transparent 70%
			),
			color-mix(in srgb, var(--color-surface-elevated) 55%, var(--color-background-shelf));
		box-shadow:
			0 0 0 1px color-mix(in srgb, var(--color-border) 18%, transparent),
			0 10px 30px -18px color-mix(in srgb, var(--color-shadow) 25%, transparent);
		transition: box-shadow var(--duration-fast) var(--ease-out);
	}

	.block.list {
		padding-bottom: 16px;
	}

	.block.target {
		z-index: 10;
		box-shadow:
			0 0 0 3px color-mix(in srgb, var(--g) 70%, transparent),
			0 0 38px 8px color-mix(in srgb, var(--g) 45%, transparent);
	}

	.head {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		padding: 0 14px 0 20px;
	}

	.dot {
		flex: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--g);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--g) 18%, transparent);
	}

	.title {
		min-width: 0;
		margin: 0;
		overflow: hidden;
		color: var(--color-text-primary);
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 400;
		line-height: 1.15;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pill,
	.drop-pill {
		display: inline-flex;
		align-items: center;
		flex: none;
		gap: 6px;
		box-sizing: border-box;
		height: 28px;
		padding: 0 12px;
		border-radius: var(--radius-pill);
		font-size: 12px;
		font-weight: 700;
		white-space: nowrap;
	}

	.pill {
		background: color-mix(in srgb, var(--color-surface-elevated) 85%, transparent);
		color: var(--color-text-primary);
	}

	.drop-pill {
		background: var(--g-dark, var(--color-primary));
		color: var(--g-light, var(--color-on-primary));
	}

	.actions {
		display: flex;
		align-items: center;
		flex: none;
		gap: 6px;
		margin-left: auto;
	}

	.all {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		box-sizing: border-box;
		min-height: 36px;
		padding: 0 14px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		box-shadow: 0 2px 6px color-mix(in srgb, var(--color-shadow) 6%, transparent);
		color: var(--color-text-primary);
		font-size: 13px;
		font-weight: 600;
		text-decoration: none;
		transition: background-color var(--duration-fast) var(--ease-out);
	}

	.all:hover {
		background: var(--color-background);
	}

	/* area di tocco 44px */
	.all::after {
		content: '';
		position: absolute;
		inset: -4px;
	}

	.all:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.scroller {
		position: relative;
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: none;
		overscroll-behavior-x: contain;
	}

	.scroller::-webkit-scrollbar {
		display: none;
	}

	.row {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: flex-end;
		box-sizing: border-box;
		width: max-content;
		min-width: 100%;
		gap: 2px;
	}

	/* Ombra di contatto: dove i libri incontrano la mensola il muro si scurisce appena. */
	.scroller {
		background: linear-gradient(
			to top,
			color-mix(in srgb, var(--color-wood-ink) 12%, transparent),
			transparent 46px
		);
	}

	/*
	 * Mensola in legno chiaro: piano superiore in prospettiva (sotto ai libri, che ci poggiano sopra),
	 * bordo frontale con venatura e ombra portata sulla card.
	 */
	.plank {
		position: relative;
		z-index: 0;
		height: 28px;
		margin: -8px -8px 0;
	}

	.plank-top {
		position: absolute;
		top: 0;
		left: 10px;
		right: 10px;
		height: 10px;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--color-wood-detail-mid) 80%, var(--color-wood-ink)),
			var(--color-wood-detail-mid) 45%,
			var(--color-wood-detail-top)
		);
		clip-path: polygon(0.8% 0, 99.2% 0, 100% 100%, 0 100%);
	}

	.plank-front {
		position: absolute;
		top: 10px;
		left: 0;
		right: 0;
		height: 17px;
		overflow: hidden;
		border-radius: 2px 2px 7px 7px;
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--color-on-genre-white) 55%, transparent) 0 1px,
				color-mix(in srgb, var(--color-on-genre-white) 18%, transparent) 2px,
				transparent 45%,
				color-mix(in srgb, var(--color-wood-ink) 16%, transparent)
			),
			var(--gradient-wood-detail);
		box-shadow:
			0 3px 0 -1px color-mix(in srgb, var(--color-wood-detail-bottom) 85%, var(--color-wood-ink)),
			0 16px 18px -10px color-mix(in srgb, var(--color-wood-ink) 55%, transparent);
	}

	/* Venatura */
	.plank-front::before {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--color-wood-ink);
		opacity: 0.22;
		-webkit-mask: url('/textures/wood-front.svg') repeat-x;
		mask: url('/textures/wood-front.svg') repeat-x;
		-webkit-mask-size: auto 100%;
		mask-size: auto 100%;
	}

	/* Ombra morbida proiettata sotto la mensola */
	.plank::after {
		content: '';
		position: absolute;
		top: 100%;
		left: 4%;
		right: 4%;
		height: 16px;
		background: radial-gradient(
			ellipse 50% 100% at 50% 0,
			color-mix(in srgb, var(--color-wood-ink) 22%, transparent),
			transparent
		);
		pointer-events: none;
	}

	.list-body {
		padding: 6px 14px 0;
	}

	@media (min-width: 1024px) {
		.head {
			padding: 0 18px 0 24px;
		}

		.title {
			font-size: 23px;
		}

		.list-body {
			padding: 8px 20px 0;
		}
	}
</style>
