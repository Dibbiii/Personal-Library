<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { dropzone, type DropZoneOptions } from '$lib/actions/drag';
	import type { GenreSlug } from '$lib/contracts';

	interface Props {
		title: string;
		/** Con href tutta la plancia e' un link (vista genere). */
		href?: string;
		/** Azione indipendente dal link della plancia e dallo scroll dei libri. */
		addHref?: string;
		addLabel?: string;
		/** Colore dell'indicatore (espressione CSS / token). */
		accent: string;
		/** Altezza dell'area libri: 224 per In lettura e I prossimi, 168 per genere. */
		height?: number;
		/** Padding orizzontale della riga (18 scaffali, 11 prossimi). */
		inset?: number;
		/** Pill a destra nella plancia ("2 libri", "3 su 3"). */
		pill?: string;
		/** Genere: fornisce i colori della pill "Rilascia qui". */
		genre?: GenreSlug;
		/** Durante il drag: questo scaffale e' il bersaglio evidenziato. */
		target?: boolean;
		/** Chevron decorativo come nel mockup (le planche non cliccabili lo mostrano senza azione). */
		chevron?: boolean;
		/** Bersaglio di drop. */
		zone?: DropZoneOptions<never>;
		/** Il fondo della libreria può essere condiviso tra gli scaffali per genere. */
		woodBackdrop?: boolean;
		/** Descrizione accessibile dell'area libri. */
		label?: string;
		scroller?: HTMLElement | null;
		children: Snippet;
		/** Contenuto sotto la plancia (titoli dei prossimi). */
		below?: Snippet;
		onscroll?: (event: Event) => void;
		class?: string;
	}

	let {
		title,
		href,
		addHref,
		addLabel,
		accent,
		height = 168,
		inset = 18,
		pill,
		genre,
		target = false,
		chevron = true,
		zone,
		woodBackdrop = true,
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
	class:wood-backdrop={woodBackdrop}
	style:--g={accent}
	style:--g-dark={genre ? `var(--genre-${genre}-dark)` : undefined}
	style:--g-light={genre ? `var(--genre-${genre}-light)` : undefined}
	aria-label={label ?? title}
	use:dropzone={zone ?? neverAccepts}
>
	<div class="scroller" data-shelf-scroller bind:this={scroller} {onscroll}>
		<div class="row" style:height="{height}px" style:padding-inline="{inset}px">
			{@render children()}
		</div>
	</div>

	{#if addHref}
		<div class="plank with-action">
			{#if href}
				<a class="plank-link" {href}>
					{@render plank()}
				</a>
			{:else}
				<div class="plank-link">{@render plank()}</div>
			{/if}
			<a class="add" href={addHref} aria-label={addLabel ?? `Aggiungi un libro a ${title}`}>
				<Icon name="book-plus" size={20} strokeWidth={2} />
			</a>
		</div>
	{:else if href}
		<a class="plank" {href}>
			{@render plank()}
		</a>
	{:else}
		<div class="plank">
			{@render plank()}
		</div>
	{/if}

	{@render below?.()}
</section>

{#snippet plank()}
	<span class="left">
		<span class="dot" aria-hidden="true"></span>
		<span class="title">{title}</span>
		{#if chevron}<Icon name="chevron-right" size={16} strokeWidth={2.6} />{/if}
	</span>
	{#if target}
		<span class="drop-pill" role="status">
			<Icon name="chevron-down" size={14} strokeWidth={2.4} />
			Rilascia qui
		</span>
	{:else if pill}
		<span class="pill">{pill}</span>
	{/if}
{/snippet}

<style>
	.block {
		position: relative;
		border-radius: 2px;
		transition: box-shadow var(--duration-fast) var(--ease-out);
	}

	.block.target {
		z-index: 10;
		box-shadow:
			0 0 0 3px color-mix(in srgb, var(--g) 70%, transparent),
			0 0 38px 8px color-mix(in srgb, var(--g) 55%, transparent);
	}

	.scroller {
		position: relative;
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: none;
		overscroll-behavior-x: contain;
	}

	.wood-backdrop .scroller {
		background: var(--gradient-wood-back);
	}

	.wood-backdrop .scroller::before {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: var(--color-wood-ink);
		opacity: 0.38;
		-webkit-mask: url('/textures/wood-grain.svg') repeat;
		mask: url('/textures/wood-grain.svg') repeat;
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

	.plank {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		box-sizing: border-box;
		width: 100%;
		height: 42px;
		padding: 0 14px;
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--color-wood-detail-top) 60%, transparent),
				transparent 27%,
				color-mix(in srgb, var(--color-wood-bottom) 28%, transparent) 100%
			),
			var(--gradient-wood);
		box-shadow:
			0 6px 0 -2px var(--color-wood-bottom),
			0 15px 17px -5px color-mix(in srgb, var(--color-wood-ink) 50%, transparent);
		color: var(--color-wood-ink);
		text-decoration: none;
	}

	.plank::before {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: var(--color-wood-ink);
		opacity: 0.32;
		-webkit-mask: url('/textures/wood-front.svg') repeat;
		mask: url('/textures/wood-front.svg') repeat;
	}

	/* area di tocco 44px senza cambiare l'aspetto */
	a.plank::after {
		content: '';
		position: absolute;
		inset: -1px 0;
	}

	.with-action {
		padding: 0 6px 0 0;
		gap: 0;
	}

	.plank-link {
		position: relative;
		z-index: 1;
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		min-width: 0;
		min-height: 44px;
		padding: 0 8px 0 14px;
		color: inherit;
		text-decoration: none;
	}

	.add {
		position: relative;
		z-index: 1;
		display: inline-flex;
		flex: 0 0 44px;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		color: var(--g-light, var(--color-on-primary));
		text-decoration: none;
	}

	/* Disco ~32px centrato nell'area di tocco 44px: stessa coppia g-dark/g-light della pill "Rilascia qui", glow come il dot del genere. */
	.add::before {
		content: '';
		position: absolute;
		z-index: -1;
		inset: 6px;
		border-radius: 50%;
		background: var(--g-dark, var(--color-primary));
		box-shadow:
			0 0 9px 2px color-mix(in srgb, var(--g) 40%, transparent),
			inset 0 1px 0 color-mix(in srgb, var(--color-on-genre-white) 30%, transparent);
		transition:
			background var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}

	.add:hover::before {
		background: color-mix(
			in srgb,
			var(--g-dark, var(--color-primary)) 80%,
			var(--g-light, var(--color-on-primary))
		);
	}

	.add:active::before {
		transform: scale(0.92);
	}

	a.plank:focus-visible,
	a.plank-link:focus-visible,
	.add:focus-visible {
		outline: 2px solid var(--color-wood-ink);
		outline-offset: -2px;
	}

	.left {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}

	.dot {
		flex: none;
		width: 10px;
		height: 10px;
		box-sizing: border-box;
		border: 1.5px solid color-mix(in srgb, var(--color-on-genre-white) 55%, transparent);
		border-radius: 50%;
		background: var(--g);
		box-shadow: 0 0 9px 2px color-mix(in srgb, var(--g) 90%, transparent);
	}

	.target .dot {
		box-shadow: 0 0 12px 3px color-mix(in srgb, var(--g) 90%, transparent);
	}

	.title {
		overflow: hidden;
		font-family: var(--font-display);
		font-size: 15.5px;
		line-height: 1.1;
		text-overflow: ellipsis;
		text-shadow: 0 1px 0 color-mix(in srgb, var(--color-on-genre-white) 40%, transparent);
		white-space: nowrap;
	}

	.left :global(svg) {
		flex: none;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		flex: none;
		box-sizing: border-box;
		height: 26px;
		padding: 0 10px;
		border-radius: 13px;
		background: color-mix(in srgb, var(--color-background) 88%, transparent);
		color: var(--color-text-primary);
		font-size: 12px;
		font-weight: 700;
		white-space: nowrap;
	}

	.drop-pill {
		display: inline-flex;
		align-items: center;
		flex: none;
		gap: 6px;
		box-sizing: border-box;
		height: 28px;
		padding: 0 12px;
		border-radius: 14px;
		background: var(--g-dark, var(--color-primary));
		color: var(--g-light, var(--color-on-primary));
		font-size: 12px;
		font-weight: 700;
		white-space: nowrap;
	}
</style>
