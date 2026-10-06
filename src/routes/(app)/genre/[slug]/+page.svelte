<script lang="ts">
	import { page } from '$app/state';
	import GenreHeader from '$lib/components/genre/GenreHeader.svelte';
	import ShelfGrid from '$lib/components/genre/ShelfGrid.svelte';
	import SortBar from '$lib/components/genre/SortBar.svelte';
	import { sortCaption } from '$lib/components/genre/sort';
	import Button from '$lib/components/ui/Button.svelte';
	import { isGenreSlug } from '$lib/genres';
	import { buildAddHref } from '$lib/catalog/add-context';
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
		<SortBar {sort} path={page.url.pathname} />

		<ShelfGrid
			title="Letti"
			books={readSection.books}
			count={readSection.count}
			caption={sortCaption(sort, true)}
			queuedIds={queued}
			priorityCount={3}
			emptyText="Nessun libro letto in questo genere, per ora."
		/>
		<ShelfGrid
			title="TBR"
			books={unreadSection.books}
			count={unreadSection.count}
			caption={sortCaption(sort, false)}
			queuedIds={queued}
			priorityCount={readSection.count === 0 ? 3 : 0}
			emptyText="Hai letto tutti i libri di questo genere."
		/>
	{/if}
{/if}

<style>
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 48px var(--page-gutter);
		text-align: center;
		color: var(--genre-current-dark);
	}

	.empty h2 {
		margin: 0;
		font-size: 22px;
		color: var(--genre-current-dark);
	}

	.empty p {
		margin: 0 0 8px;
		font-size: 14px;
		line-height: 20px;
	}
</style>
