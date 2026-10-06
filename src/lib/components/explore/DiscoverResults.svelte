<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { CatalogClientError, discoverBooks } from '$lib/catalog/client';
	import {
		findOwned,
		type DiscoverBook,
		type DiscoverRequest,
		type DiscoverSort
	} from '$lib/catalog/discover';
	import DiscoverCard from './DiscoverCard.svelte';

	interface Props {
		title: string;
		/** Query senza pagina né ordinamento: li gestisce l'elenco. */
		query: DiscoverRequest;
		owned: ReadonlyMap<string, string>;
		onopen: (book: DiscoverBook) => void;
		onback: () => void;
	}

	let { title, query, owned, onopen, onback }: Props = $props();

	const uid = $props.id();
	const PAGE_SIZE = 24;
	const SORTS: { value: DiscoverSort; label: string }[] = [
		{ value: 'relevance', label: 'Consigliato' },
		{ value: 'readinglog', label: 'Più letti' },
		{ value: 'rating', label: 'Voto più alto' },
		{ value: 'trending', label: 'In tendenza' },
		{ value: 'new', label: 'Più recenti' }
	];
	const numbers = new Intl.NumberFormat('it-IT');

	let sort = $state<DiscoverSort>('relevance');
	let books = $state<DiscoverBook[]>([]);
	let total = $state(0);
	let page = $state(1);
	let hasMore = $state(false);
	let loading = $state(true);
	let error = $state('');
	let controller: AbortController | undefined;

	async function load(next: number, base: DiscoverRequest, order: DiscoverSort) {
		controller?.abort();
		controller = new AbortController();
		const { signal } = controller;
		loading = true;
		error = '';
		try {
			const response = await discoverBooks(
				{ ...base, sort: order, page: next, limit: PAGE_SIZE },
				signal
			);
			const known = new Set(next === 1 ? [] : books.map((book) => book.workId));
			books = [
				...(next === 1 ? [] : books),
				...response.books.filter((book) => !known.has(book.workId))
			];
			total = response.total;
			hasMore = response.hasMore;
			page = next;
		} catch (caught) {
			if (caught instanceof DOMException && caught.name === 'AbortError') return;
			error =
				caught instanceof CatalogClientError ? caught.message : 'Non riesco a cercare i libri.';
		} finally {
			if (!signal.aborted) loading = false;
		}
	}

	$effect(() => {
		const base = query;
		const order = sort;
		void load(1, base, order);
		return () => controller?.abort();
	});
</script>

<section class="results" aria-labelledby="{uid}-title">
	<header>
		<button type="button" class="back" onclick={onback}>
			<Icon name="chevron-left" size={18} strokeWidth={2.2} /> Esplora
		</button>
		<div class="title-row">
			<div>
				<h2 id="{uid}-title">{title}</h2>
				<p class="count" aria-live="polite">
					{#if loading && books.length === 0}
						Cerco…
					{:else if !error}
						{total === 1 ? '1 libro' : `${numbers.format(total)} libri`}
					{/if}
				</p>
			</div>
			<label class="sort">
				<span>Ordina per</span>
				<span class="select">
					<select bind:value={sort}>
						{#each SORTS as item (item.value)}<option value={item.value}>{item.label}</option
							>{/each}
					</select>
					<Icon name="chevron-down" size={16} strokeWidth={2.2} />
				</span>
			</label>
		</div>
	</header>

	{#if error}
		<div class="note" role="alert">
			<p>{error}</p>
			<Button size="sm" variant="secondary" onclick={() => load(page, query, sort)}>Riprova</Button>
		</div>
	{:else if !loading && books.length === 0}
		<div class="note">
			<p class="strong">Nessun libro trovato.</p>
			<p>Prova a togliere qualche filtro, oppure aggiungi il libro a mano.</p>
			<Button size="sm" href="/add/manual">Inserisci a mano</Button>
		</div>
	{:else}
		<ul class="grid" aria-busy={loading}>
			{#each books as book (book.workId)}
				<li><DiscoverCard {book} owned={findOwned(book, owned) !== null} {onopen} /></li>
			{/each}
			{#if loading}
				{#each Array.from({ length: books.length === 0 ? 12 : 6 }, (_, i) => i) as n (n)}
					<li class="skeleton" aria-hidden="true"><span></span><i></i><i></i></li>
				{/each}
			{/if}
		</ul>
		{#if hasMore && !loading}
			<div class="more">
				<Button variant="secondary" onclick={() => load(page + 1, query, sort)}>
					Carica altri libri
				</Button>
			</div>
		{/if}
	{/if}
</section>

<style>
	.results {
		padding: 16px 18px 22px;
		border-radius: var(--radius-xl);
		background: color-mix(in srgb, var(--color-card) 70%, transparent);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-border) 16%, transparent);
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-height: 32px;
		margin-left: -6px;
		padding: 0 10px 0 4px;
		border: 0;
		border-radius: var(--radius-pill);
		background: transparent;
		font-size: 13.5px;
		font-weight: 700;
		color: var(--color-primary);
	}

	.back:hover {
		background: var(--color-surface);
	}

	.title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 10px 16px;
		margin-top: 6px;
	}

	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 26px;
		font-weight: 400;
		line-height: 1.15;
		color: var(--color-primary);
	}

	.count {
		min-height: 18px;
		margin: 4px 0 0;
		font-size: 13.5px;
		color: var(--color-text-secondary);
	}

	.sort {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--color-text-secondary);
	}

	.select {
		position: relative;
		display: inline-flex;
		align-items: center;
		color: var(--color-text-primary);
	}

	.select select {
		min-height: 36px;
		padding: 0 34px 0 14px;
		border: 1px solid color-mix(in srgb, var(--color-border) 45%, transparent);
		border-radius: var(--radius-pill);
		background: var(--color-card);
		font: inherit;
		font-size: 14px;
		font-weight: 600;
		color: inherit;
		appearance: none;
	}

	.select :global(svg) {
		position: absolute;
		right: 12px;
		pointer-events: none;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
		justify-items: center;
		gap: 22px 14px;
		margin: 20px 0 0;
		padding: 0;
		list-style: none;
	}

	.more {
		display: flex;
		justify-content: center;
		margin-top: 22px;
	}

	.note {
		margin-top: 18px;
		padding: 18px;
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		font-size: 14px;
		color: var(--color-text-secondary);
	}

	.note p {
		margin: 0 0 10px;
	}

	.note .strong {
		font-family: var(--font-display);
		font-size: 18px;
		color: var(--color-text-primary);
	}

	.skeleton {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 118px;
		animation: pulse 1.4s ease-in-out infinite;
	}

	.skeleton span {
		height: 176px;
		border-radius: 3px 8px 8px 3px;
		background: var(--color-surface);
	}

	.skeleton i {
		height: 11px;
		border-radius: 6px;
		background: var(--color-surface);
	}

	.skeleton i:last-child {
		width: 60%;
	}

	@keyframes pulse {
		50% {
			opacity: 0.55;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.skeleton {
			animation: none;
		}
	}

	.back:focus-visible,
	.select select:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
</style>
