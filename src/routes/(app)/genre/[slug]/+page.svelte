<script lang="ts">
	import { page } from '$app/state';
	import GenreHeader from '$lib/components/genre/GenreHeader.svelte';
	import ShelfGrid from '$lib/components/genre/ShelfGrid.svelte';
	import SortBar from '$lib/components/genre/SortBar.svelte';
	import { sortCaption } from '$lib/components/genre/sort';
	import Button from '$lib/components/ui/Button.svelte';
	import { isGenreSlug } from '$lib/genres';
	import { buildAddHref } from '$lib/catalog/add-context';
	import { GENRE_DECOR } from '$lib/components/genre/decor';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Lo stato dell'ordine viene dalla risposta: nessun flash tra click e dati.
	const sort = $derived(data.view.sort);
	const [readSection, unreadSection] = $derived(data.view.sections);
	const queued = $derived(new Set(data.queuedIds));
	const slug = $derived(data.view.genre.slug);
	const empty = $derived(data.view.counts.total === 0);
</script>

<svelte:head><title>{data.view.genre.name} · Segnalibro</title></svelte:head>

{#if isGenreSlug(slug)}
	<div class="genre-page">
		<GenreHeader
			{slug}
			addHref={buildAddHref('/add', slug)}
			name={data.view.genre.name}
			total={data.view.counts.total}
			read={data.view.counts.read}
			unread={data.view.counts.unread}
		/>

		{#if empty}
			<section class="empty">
				<h2>Questo scaffale è ancora vuoto</h2>
				<p>Aggiungi un libro di questo genere per vederlo comparire qui.</p>
				<Button href={buildAddHref('/add', slug)}>Aggiungi un libro</Button>
			</section>
		{:else}
			<div class="toolbar"><SortBar {sort} path={page.url.pathname} /></div>

			<ShelfGrid
				title="Letti"
				books={readSection.books}
				count={readSection.count}
				caption={sortCaption(sort, true)}
				queuedIds={queued}
				priorityCount={3}
				emptyText="Nessun libro letto in questo genere, per ora."
				decor={unreadSection.count === 0 ? GENRE_DECOR[slug].slice(1) : []}
			/>
			<ShelfGrid
				title="Da leggere"
				books={unreadSection.books}
				count={unreadSection.count}
				caption={sortCaption(sort, false)}
				queuedIds={queued}
				priorityCount={readSection.count === 0 ? 3 : 0}
				emptyText="Hai letto tutti i libri di questo genere."
				decor={GENRE_DECOR[slug].slice(1)}
			/>
		{/if}
	</div>
{/if}

<style>
	.genre-page {
		display: flex;
		flex-direction: column;
		gap: 22px;
		padding: 16px 14px 28px;
	}

	.toolbar {
		padding: 0 4px;
	}

	/* Scaffale vuoto: card come le sezioni */
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 40px 20px;
		border-radius: var(--radius-sheet);
		background: color-mix(
			in srgb,
			var(--color-surface-elevated) 55%,
			var(--color-background-shelf)
		);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-border) 18%, transparent);
		color: var(--color-text-secondary);
		text-align: center;
	}

	.empty h2 {
		margin: 0;
		color: var(--color-text-primary);
		font-family: var(--font-display);
		font-size: 22px;
		font-weight: 400;
	}

	.empty p {
		margin: 0 0 8px;
		font-size: 14px;
		line-height: 20px;
	}

	@media (min-width: 1024px) {
		.genre-page {
			gap: 28px;
			padding: 24px 32px 40px;
		}
	}
</style>
