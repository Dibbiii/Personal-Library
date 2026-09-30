<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { SORT_FIELDS, nextSortQuery, type GenreSort } from './sort';

	interface Props {
		sort: GenreSort;
		/** Percorso della pagina (i link cambiano solo la query string). */
		path: string;
	}

	let { sort, path }: Props = $props();
</script>

<section class="sort" aria-labelledby="sort-label">
	<p id="sort-label" class="label">
		<Icon name="sort" size={16} strokeWidth={2} />
		ORDINA PER
	</p>
	<!-- Link veri: l'ordine vive nell'URL (condivisibile, funziona anche senza JavaScript). -->
	<nav class="chips" aria-label="Ordina i libri">
		{#each SORT_FIELDS as { field, label } (field)}
			{@const active = sort.field === field}
			<a
				class="chip"
				class:active
				href="{path}{nextSortQuery(sort, field)}"
				aria-current={active ? 'true' : undefined}
				data-sveltekit-replacestate
				data-sveltekit-noscroll
				data-sveltekit-keepfocus
			>
				{#if active}
					<span class="arrow" class:asc={sort.direction === 'asc'}>
						<Icon name="arrow-down" size={16} strokeWidth={2.4} />
					</span>
					<span class="sr-only">
						{sort.direction === 'asc' ? 'crescente' : 'decrescente'},
					</span>
				{/if}
				{label}
			</a>
		{/each}
	</nav>
	<p class="note">L'ordine vale dentro ogni sezione: i libri letti restano sempre in cima.</p>
</section>

<style>
	.sort {
		padding: 22px var(--page-gutter) 0;
		color: var(--genre-current-dark);
	}

	.label {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0;
		font-size: 12.5px;
		font-weight: 700;
		letter-spacing: 0.06em;
	}

	.chips {
		display: flex;
		gap: 8px;
		margin: 10px calc(-1 * var(--page-gutter)) 0;
		padding: 0 var(--page-gutter);
		overflow-x: auto;
		scrollbar-width: none;
	}

	.chips::-webkit-scrollbar {
		display: none;
	}

	.chip {
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: 6px;
		box-sizing: border-box;
		min-height: 40px;
		padding: 0 16px;
		border: 1.5px solid var(--genre-current);
		border-radius: 20px;
		color: var(--genre-current-dark);
		font-size: 14px;
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
	}

	.chip.active {
		background: var(--genre-current);
		color: var(--genre-current-on);
		font-weight: 700;
	}

	.arrow {
		display: inline-flex;
		transition: transform var(--duration-fast) var(--ease-out);
	}

	.arrow.asc {
		transform: rotate(180deg);
	}

	.note {
		margin: 10px 0 0;
		font-size: 12.5px;
		line-height: 17px;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	@media (min-width: 1024px) {
		.chips {
			flex-wrap: wrap;
			overflow: visible;
		}
	}
</style>
