<script lang="ts">
	import type { QuotePreview } from '$lib/contracts';
	import QuoteListItem from './QuoteListItem.svelte';
	import QuotePromo from './QuotePromo.svelte';

	interface Props {
		quotes: QuotePreview[];
		/** Quante citazioni mostrare sotto la card promo. */
		limit?: number;
		oncreate: () => void;
	}

	let { quotes, limit = 2, oncreate }: Props = $props();
</script>

<section class="quotes" aria-labelledby="quotes-heading">
	<div class="head">
		<h2 id="quotes-heading">Citazioni</h2>
		<a href="/quotes">Vedi tutte</a>
	</div>

	<QuotePromo {quotes} {oncreate} />

	{#if quotes.length > 0}
		<div class="list">
			{#each quotes.slice(0, limit) as quote (quote.id)}
				<QuoteListItem {quote} />
			{/each}
		</div>
	{/if}
</section>

<style>
	.quotes {
		min-width: 0;
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	h2 {
		font-size: 24px;
		line-height: 1.1;
		color: var(--color-text-primary);
	}

	.head a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		color: var(--color-info);
		font-size: 14px;
		font-weight: 600;
		text-decoration: none;
	}

	.head a:hover {
		color: var(--color-info-hover);
		text-decoration: underline;
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 12px;
	}
</style>
