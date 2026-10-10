<script lang="ts">
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import QuoteListItem from '$lib/components/stats/QuoteListItem.svelte';
	import { countLabel } from '$lib/components/stats/format';
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import PageNavigation from '$lib/components/pagination/PageNavigation.svelte';

	let { data }: { data: PageData } = $props();

	const books = $derived(data.books);
	const visible = $derived(data.quotes);
	function changeBook(event: Event) {
		const id = (event.currentTarget as HTMLSelectElement).value;
		const url = new URL(page.url);
		if (id) url.searchParams.set('book', id);
		else url.searchParams.delete('book');
		url.searchParams.delete('page');
		void goto(`${url.pathname}${url.search}`, { keepFocus: true });
	}

	// Quote Card: il codice Canvas entra nel bundle solo al primo uso (import dinamico).
	type CreatorComponent = typeof import('$lib/components/quotes/QuoteCardCreator.svelte').default;
	let Creator = $state<CreatorComponent | null>(null);
	let creatorQuoteId = $state<string | null>(null);
	let creatorOpen = $state(false);
	let loading = false;

	async function openCreator(quoteId: string) {
		if (loading) return;
		loading = true;
		try {
			Creator ??= (await import('$lib/components/quotes/QuoteCardCreator.svelte')).default;
			creatorQuoteId = quoteId;
			creatorOpen = true;
		} finally {
			loading = false;
		}
	}

	const creatorQuotes = $derived(
		creatorQuoteId ? data.quotes.filter((quote) => quote.id === creatorQuoteId) : []
	);
</script>

<svelte:head><title>Citazioni · Segnalibro</title></svelte:head>

<PageHeader
	title="Citazioni"
	subtitle={data.total > 0 ? countLabel(data.total, 'citazione', 'citazioni') : ''}
	backHref="/profile?tab=stats"
/>

<div class="page" data-testid="quotes-page">
	{#if books.length === 0}
		<div class="empty" data-testid="quotes-empty">
			<Icon name="quote" size={28} strokeWidth={1.8} />
			<p>
				Ancora nessuna citazione. Aprendo un libro letto puoi salvare le frasi che vuoi ricordare e
				trasformarle in card da condividere.
			</p>
			<a href="/library">Vai alla libreria</a>
		</div>
	{:else}
		{#if books.length > 1}
			<label class="filter">
				<span>Libro</span>
				<select value={data.bookId ?? ''} onchange={changeBook} data-testid="quotes-filter">
					<option value="">Tutti i libri ({books.length})</option>
					{#each books as book (book.id)}
						<option value={book.id}>{book.title}</option>
					{/each}
				</select>
			</label>
		{/if}

		<ul class="list">
			{#each visible as quote (quote.id)}
				<li>
					<QuoteListItem {quote}>
						{#snippet action()}
							<button
								type="button"
								class="create"
								onclick={() => openCreator(quote.id)}
								data-testid="quote-create"
							>
								<Icon name="image" size={20} strokeWidth={1.9} />
								Crea Quote Card
							</button>
						{/snippet}
					</QuoteListItem>
				</li>
			{/each}
		</ul>
		{#if visible.length === 0}<p>Nessuna citazione per questo libro.</p>{/if}
		<PageNavigation
			current={data.page}
			total={data.total}
			pageSize={data.pageSize}
			label="Pagine delle citazioni"
		/>
	{/if}
</div>

{#if Creator}
	<Creator open={creatorOpen} quotes={creatorQuotes} onclose={() => (creatorOpen = false)} />
{/if}

<style>
	.page {
		padding: 4px var(--page-gutter) 24px;
	}

	.filter {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-width: 420px;
		margin-bottom: 16px;
		font-size: 12.5px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-text-secondary);
	}

	.filter select {
		min-height: 44px;
		padding: 0 12px;
		border: 1.5px solid color-mix(in srgb, var(--color-shelf-axis) 30%, transparent);
		border-radius: 14px;
		background: var(--color-background);
		font-size: 14px;
		letter-spacing: 0;
		text-transform: none;
	}

	.list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
		gap: 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.create {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 46px;
		padding: 0 16px;
		border: 0;
		border-radius: 16px;
		background: var(--color-primary);
		color: var(--color-on-primary);
		font-size: 14.5px;
		font-weight: 700;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		max-width: 480px;
		margin: 24px auto;
		padding: 28px 20px;
		border-radius: 22px;
		background: var(--color-surface);
		color: var(--color-text-secondary);
		text-align: center;
	}

	.empty p {
		margin: 0;
		font-size: 14px;
		line-height: 20px;
	}

	.empty a {
		font-weight: 700;
		color: var(--color-primary);
	}
</style>
