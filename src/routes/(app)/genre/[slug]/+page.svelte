<script lang="ts">
	import { page } from '$app/state';
	import GenreHeader from '$lib/components/genre/GenreHeader.svelte';
	import ShelfGrid from '$lib/components/genre/ShelfGrid.svelte';
	import SortBar from '$lib/components/genre/SortBar.svelte';
	import { sortCaption } from '$lib/components/genre/sort';
	import Button from '$lib/components/ui/Button.svelte';
	import { isGenreSlug } from '$lib/genres';
	import { buildAddHref } from '$lib/catalog/add-context';
	import Icon from '$lib/components/ui/Icon.svelte';
	import {
		TBR_SORT_FIELDS,
		captionFor,
		type TbrSortField,
		type TbrView
	} from '$lib/components/genre/tbr';
	import { GENRE_DECOR } from '$lib/components/genre/decor';
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import PageNavigation from '$lib/components/pagination/PageNavigation.svelte';

	let { data }: { data: PageData } = $props();

	// Lo stato dell'ordine viene dalla risposta: nessun flash tra click e dati.
	const sort = $derived(data.view.sort);
	const [readSection, unreadSection] = $derived(data.view.sections);
	const queued = $derived(new Set(data.queuedIds));
	const slug = $derived(data.view.genre.slug);
	const empty = $derived(data.view.counts.total === 0);

	// "Da leggere": ordine e vista indipendenti dai letti, e mai per voto (non c'è ancora).
	const tbrSort = $derived(data.view.unreadSort);
	let tbrView = $state<TbrView>('grid');
	const unreadBooks = $derived(unreadSection.books);
	function changeUnreadSort(field: TbrSortField) {
		const url = new URL(page.url);
		url.searchParams.set('unreadSort', field);
		url.searchParams.delete('unreadPage');
		void goto(`${url.pathname}${url.search}`, { noScroll: true, keepFocus: true });
	}
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
			<div class="toolbar">
				<SortBar {sort} path={page.url.pathname} search={page.url.search} />
			</div>

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
			<PageNavigation
				current={data.view.pages.read}
				total={readSection.count}
				pageSize={40}
				parameter="readPage"
				label="Pagine dei libri letti"
			/>
			<ShelfGrid
				title="Da leggere"
				books={unreadBooks}
				count={unreadSection.count}
				caption={captionFor(tbrSort)}
				queuedIds={queued}
				priorityCount={readSection.count === 0 ? 3 : 0}
				emptyText="Hai letto tutti i libri di questo genere."
				decor={GENRE_DECOR[slug].slice(1)}
				view={tbrView}
				showRating={false}
			>
				{#snippet controls()}
					<div class="tbr-sort" role="group" aria-label="Ordina i libri da leggere">
						{#each TBR_SORT_FIELDS as { field, label } (field)}
							<button
								type="button"
								class="chip"
								aria-pressed={tbrSort === field}
								onclick={() => changeUnreadSort(field)}>{label}</button
							>
						{/each}
					</div>
					<div class="tbr-view" role="group" aria-label="Vista dei libri da leggere">
						<button
							type="button"
							aria-pressed={tbrView === 'grid'}
							aria-label="Vista scaffale"
							onclick={() => (tbrView = 'grid')}><Icon name="grid" size={18} /></button
						>
						<button
							type="button"
							aria-pressed={tbrView === 'list'}
							aria-label="Vista elenco"
							onclick={() => (tbrView = 'list')}><Icon name="list" size={18} /></button
						>
					</div>
				{/snippet}
			</ShelfGrid>
			<PageNavigation
				current={data.view.pages.unread}
				total={unreadSection.count}
				pageSize={40}
				parameter="unreadPage"
				label="Pagine dei libri da leggere"
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

	.tbr-sort,
	.tbr-view {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.tbr-view {
		margin-left: auto;
		gap: 2px;
	}

	.chip,
	.tbr-view button {
		min-height: 36px;
		padding: 0 14px;
		border: 0;
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-text-primary);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}

	.tbr-view button {
		display: inline-flex;
		align-items: center;
		padding: 0 10px;
	}

	.chip[aria-pressed='true'],
	.tbr-view button[aria-pressed='true'] {
		background: var(--genre-current);
		color: var(--genre-current-on, var(--color-on-primary));
	}

	.chip:focus-visible,
	.tbr-view button:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
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
