<script lang="ts">
	import type { GenreSlug } from '$lib/contracts/enums';
	import { GENRE_ORDER, GENRE_SHORT_LABELS } from '$lib/genres';

	interface Props {
		/** Generi selezionati; vuoto = "Tutti i non letti". */
		selected: readonly GenreSlug[];
		ontoggle: (slug: GenreSlug) => void;
		onclear: () => void;
		/** Conteggio dei non letti per genere, usato solo per l'etichetta accessibile. */
		counts?: Partial<Record<GenreSlug, number>>;
	}

	let { selected, ontoggle, onclear, counts = {} }: Props = $props();
</script>

<div class="chips" role="group" aria-label="Filtra per genere">
	<button class="chip all" type="button" aria-pressed={selected.length === 0} onclick={onclear}>
		Tutti i non letti
	</button>
	{#each GENRE_ORDER as slug (slug)}
		{@const active = selected.includes(slug)}
		{@const count = counts[slug]}
		<button
			class="chip genre"
			class:active
			type="button"
			aria-pressed={active}
			aria-label={count === undefined
				? GENRE_SHORT_LABELS[slug]
				: `${GENRE_SHORT_LABELS[slug]}, ${count} non ${count === 1 ? 'letto' : 'letti'}`}
			style:--g="var(--genre-{slug})"
			onclick={() => ontoggle(slug)}
		>
			<span class="dot" aria-hidden="true"></span>
			{GENRE_SHORT_LABELS[slug]}
		</button>
	{/each}
</div>

<style>
	.chips {
		display: flex;
		gap: 8px;
		margin: 14px calc(var(--page-gutter) * -1) 0;
		padding: 0 var(--page-gutter) 2px;
		overflow-x: auto;
		scrollbar-width: none;
		scroll-snap-type: x proximity;
		scroll-padding-inline: var(--page-gutter);
	}

	.chips::-webkit-scrollbar {
		display: none;
	}

	.chip {
		position: relative;
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: 8px;
		box-sizing: border-box;
		height: 40px;
		padding: 0 14px;
		border: 1.5px solid color-mix(in srgb, var(--color-shelf-axis) 30%, transparent);
		border-radius: 20px;
		background: transparent;
		color: var(--color-text-primary);
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 600;
		white-space: nowrap;
		cursor: pointer;
		scroll-snap-align: start;
		transition:
			background-color var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}

	/* Area di tocco di 44px anche con chip alto 40px */
	.chip::after {
		content: '';
		position: absolute;
		inset: -2px -2px;
	}

	.all {
		padding: 0 16px;
	}

	.all[aria-pressed='true'] {
		border-color: var(--color-primary);
		background: var(--color-primary);
		color: var(--color-on-primary);
		font-weight: 700;
	}

	.dot {
		width: 11px;
		height: 11px;
		border-radius: 50%;
		background: var(--g);
	}

	/* Stato attivo dei generi: estensione del mockup (non mostrato) */
	.genre.active {
		border-color: var(--g);
		background: color-mix(in srgb, var(--g) 14%, transparent);
		font-weight: 700;
	}

	@media (min-width: 1024px) {
		.chips {
			flex-wrap: wrap;
			margin-inline: 0;
			padding-inline: 0;
			overflow: visible;
		}
	}
</style>
