<script lang="ts">
	import { seriesVolumeLabel, seriesVolumes } from '$lib/client/reading-logic';
	import { buildAddHref } from '$lib/catalog/add-context';
	import type { SeriesBook, SeriesRef } from '$lib/contracts';
	import { SvelteURLSearchParams } from 'svelte/reactivity';

	interface Props {
		series: SeriesRef;
		books: SeriesBook[];
		currentBookId: string;
	}

	let { series, books, currentBookId }: Props = $props();

	const orderedBooks = $derived(
		[...books].sort((a, b) => {
			if (a.number === null) return b.number === null ? a.title.localeCompare(b.title, 'it') : 1;
			if (b.number === null) return -1;
			return (
				a.number - b.number || a.title.localeCompare(b.title, 'it') || a.id.localeCompare(b.id)
			);
		})
	);
	const volumes = $derived(seriesVolumes(orderedBooks, series.total));
	const label = $derived(seriesVolumeLabel(series.number, series.total));

	function volumeNumber(number: number): string {
		return String(number).replace('.', ',');
	}

	function addVolumeHref(number: number): string {
		const params = new SvelteURLSearchParams({
			seriesName: series.name,
			seriesNumber: String(number)
		});
		if (series.total !== null) params.set('seriesTotal', String(series.total));
		return buildAddHref('/add/search', null, params);
	}
</script>

<section class="series" aria-label={`Serie ${series.name}`}>
	{#if volumes.length > 0}
		<ol class="spines" aria-label={`Volumi di ${series.name}`} role="list">
			{#each volumes as volume (volume.book?.id ?? `missing-${volume.number}`)}
				<li>
					{#if volume.book}
						<a
							class="spine {volume.book.id === currentBookId ? 'current' : 'present'}"
							href={`/book/${volume.book.id}`}
							aria-label={`Volume ${volumeNumber(volume.number)}: ${volume.book.title}`}
							aria-current={volume.book.id === currentBookId ? 'page' : undefined}
						>
							{volumeNumber(volume.number)}
						</a>
					{:else}
						<a
							class="spine missing"
							href={addVolumeHref(volume.number)}
							aria-label={`Aggiungi volume ${volumeNumber(volume.number)} alla serie ${series.name}`}
						>
							{volumeNumber(volume.number)}
						</a>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
	<div class="text">
		<p class="vol">Serie: {label ?? series.name}</p>
		{#if label}<p class="name">{series.name}</p>{/if}
	</div>
	{#if orderedBooks.length > 0}
		<ol class="book-list" aria-label={`Libri della serie ${series.name}`} role="list">
			{#each orderedBooks as book (book.id)}
				<li>
					<a
						href={`/book/${book.id}`}
						aria-current={book.id === currentBookId ? 'page' : undefined}
					>
						<span class="book-number">
							{book.number === null ? 'Volume non indicato' : `Vol. ${volumeNumber(book.number)}`}
						</span>
						<span>{book.title}</span>
					</a>
				</li>
			{/each}
		</ol>
	{/if}
</section>

<style>
	.series {
		display: grid;
		gap: 10px;
		box-sizing: border-box;
		padding: 12px 16px;
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}

	.spines {
		display: flex;
		align-items: flex-end;
		gap: 4px;
		height: 54px;
		min-width: 0;
		max-width: 100%;
		margin: 0;
		padding: 2px 0 6px;
		overflow-x: auto;
		list-style: none;
	}

	.spines li {
		flex: none;
	}

	.spine {
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		min-width: 28px;
		height: 48px;
		padding: 0 4px;
		border-radius: 3px 5px 5px 3px;
		color: var(--color-text-primary);
		font-size: 11px;
		font-weight: 700;
		text-decoration: none;
	}

	.spine.present {
		background: var(--color-divider);
	}

	.spine.current {
		height: 54px;
		background: var(--genre-current);
		color: var(--genre-current-on);
		box-shadow: 0 0 10px 1px color-mix(in srgb, var(--genre-current) 70%, transparent);
	}

	.spine.missing {
		border: 1.5px dashed color-mix(in srgb, var(--color-shelf-axis) 45%, transparent);
	}

	.spine:focus-visible,
	.book-list a:focus-visible {
		outline: 2px solid var(--color-text-primary);
		outline-offset: 2px;
	}

	.text {
		min-width: 0;
	}

	p {
		margin: 0;
	}

	.vol {
		font-size: 15px;
		font-weight: 700;
	}

	.name {
		margin-top: 2px;
		font-size: 12.5px;
		line-height: 17px;
		color: var(--color-text-secondary);
	}

	.book-list {
		display: grid;
		gap: 4px;
		max-height: 12rem;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		list-style: none;
	}

	.book-list a {
		display: grid;
		gap: 2px;
		padding: 5px 0;
		color: inherit;
		font-size: 12px;
		line-height: 16px;
		text-decoration: none;
	}

	.book-list a:hover span:last-child {
		text-decoration: underline;
	}

	.book-number {
		color: var(--color-text-secondary);
		font-size: 11px;
	}
</style>
