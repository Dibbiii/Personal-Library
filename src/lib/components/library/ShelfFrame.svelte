<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { dropzone, type DropZoneOptions } from '$lib/actions/drag';
	import type { GenreSlug } from '$lib/contracts';

	interface Props {
		title: string;
		/** Con href tutta la plancia e' un link (vista genere). */
		href?: string;
		/** Colore del LED (espressione CSS / token). */
		accent: string;
		/** Altezza dell'area libri: 224 In lettura, 162 I prossimi, 168 scaffali. */
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
		accent,
		height = 168,
		inset = 18,
		pill,
		genre,
		target = false,
		chevron = true,
		zone,
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
	style:--g={accent}
	style:--g-dark={genre ? `var(--genre-${genre}-dark)` : undefined}
	style:--g-light={genre ? `var(--genre-${genre}-light)` : undefined}
	aria-label={label ?? title}
	use:dropzone={zone ?? neverAccepts}
>
	<div class="scroller" data-shelf-scroller bind:this={scroller} {onscroll}>
		<div
			class="row"
			style:height="{height}px"
			style:padding-inline="{inset}px"
			style:--h="{height}px"
		>
			{@render children()}
		</div>
	</div>

	{#if href}
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
		isolation: isolate;
		display: flex;
		align-items: flex-end;
		box-sizing: border-box;
		width: max-content;
		min-width: 100%;
		gap: 2px;
	}

	/* LED: gradiente verticale + linea 3px con bagliore leggero, nel colore --g */
	.row::before {
		content: '';
		position: absolute;
		z-index: -1;
		inset: auto 0 0 0;
		height: 100%;
		background: linear-gradient(
			to top,
			color-mix(in srgb, var(--g) 36%, transparent),
			color-mix(in srgb, var(--g) 10%, transparent) 50%,
			transparent
		);
	}

	.row::after {
		content: '';
		position: absolute;
		z-index: -1;
		inset: auto 0 0 0;
		height: 3px;
		background: var(--g);
		box-shadow:
			0 0 10px 2px color-mix(in srgb, var(--g) 75%, transparent),
			0 6px 22px 4px color-mix(in srgb, var(--g) 40%, transparent);
	}

	.target .row::before {
		background: linear-gradient(
			to top,
			color-mix(in srgb, var(--g) 60%, transparent),
			color-mix(in srgb, var(--g) 20%, transparent) 50%,
			transparent
		);
	}

	.target .row::after {
		height: 5px;
		box-shadow:
			0 0 14px 3px color-mix(in srgb, var(--g) 90%, transparent),
			0 8px 30px 8px color-mix(in srgb, var(--g) 60%, transparent);
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
		background: var(--gradient-wood);
		box-shadow: var(--shadow-plank);
		color: var(--color-wood-ink);
		text-decoration: none;
	}

	/* area di tocco 44px senza cambiare l'aspetto */
	a.plank::after {
		content: '';
		position: absolute;
		inset: -1px 0;
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
