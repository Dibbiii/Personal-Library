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
		<Icon name="sort" size={18} strokeWidth={2} />
		Ordina per
	</p>
	<!-- Link veri: l'ordine vive nell'URL (condivisibile, funziona anche senza JavaScript). -->
	<nav class="segments" aria-label="Ordina i libri">
		{#each SORT_FIELDS as { field, label } (field)}
			{@const active = sort.field === field}
			<a
				class="segment"
				class:active
				href="{path}{nextSortQuery(sort, field)}"
				aria-current={active ? 'true' : undefined}
				data-sveltekit-replacestate
				data-sveltekit-noscroll
				data-sveltekit-keepfocus
			>
				{#if active}
					<span class="arrow" class:asc={sort.direction === 'asc'}>
						<Icon name="arrow-down" size={15} strokeWidth={2.4} />
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
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.label {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		color: var(--color-text-primary);
		font-size: 14px;
		font-weight: 700;
	}

	/* Gruppo segmentato come i controlli della toolbar della Libreria */
	.segments {
		display: flex;
		align-self: flex-start;
		gap: 2px;
		max-width: 100%;
		box-sizing: border-box;
		padding: 4px;
		overflow-x: auto;
		border: 1px solid color-mix(in srgb, var(--color-border) 35%, transparent);
		border-radius: var(--radius-md);
		background: var(--color-surface-elevated);
		box-shadow: 0 2px 8px color-mix(in srgb, var(--color-shadow) 5%, transparent);
		scrollbar-width: none;
	}

	.segments::-webkit-scrollbar {
		display: none;
	}

	.segment {
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: 6px;
		box-sizing: border-box;
		min-height: 40px;
		padding: 0 12px;
		border-radius: calc(var(--radius-md) - 4px);
		color: var(--color-text-secondary);
		font-size: 14px;
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
		transition:
			background-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.segment:hover {
		background: var(--color-surface);
		color: var(--color-text-primary);
	}

	.segment.active {
		background: var(--genre-current-dark);
		color: var(--genre-current-light);
		font-weight: 700;
	}

	.segment:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.arrow {
		display: inline-flex;
		transition: transform var(--duration-fast) var(--ease-out);
	}

	.arrow.asc {
		transform: rotate(180deg);
	}

	.note {
		margin: 0;
		color: var(--color-text-secondary);
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
		.segment {
			padding: 0 14px;
		}

		.sort {
			flex-direction: row;
			flex-wrap: wrap;
			align-items: center;
			gap: 10px 16px;
		}

		.segments {
			align-self: auto;
		}

		.note {
			margin-left: auto;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.segment,
		.arrow {
			transition: none;
		}
	}
</style>
