<script lang="ts">
	import CoverImage from '$lib/components/catalog/CoverImage.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { DiscoverBook } from '$lib/catalog/discover';

	interface Props {
		book: DiscoverBook;
		/** Il libro è già nella libreria dell'utente. */
		owned?: boolean;
		onopen: (book: DiscoverBook) => void;
	}

	let { book, owned = false, onopen }: Props = $props();

	const author = $derived(book.authors.slice(0, 2).join(', '));
</script>

<button type="button" class="card" onclick={() => onopen(book)}>
	<span class="cover">
		<CoverImage src={book.coverUrl} width={118} height={176} />
		{#if owned}
			<span class="owned"><Icon name="check" size={12} strokeWidth={2.8} />In libreria</span>
		{/if}
	</span>
	<span class="title">{book.title}</span>
	{#if author}<span class="author">{author}</span>{/if}
	{#if book.rating}
		<span class="rating">
			<Icon name="star" size={13} />
			{book.rating.toLocaleString('it-IT')}
		</span>
	{/if}
</button>

<style>
	.card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 3px;
		width: 118px;
		padding: 0;
		border: 0;
		background: transparent;
		text-align: left;
		color: var(--color-text-primary);
	}

	.cover {
		position: relative;
		display: block;
		margin-bottom: 7px;
		transition: transform var(--duration-fast) var(--ease-out);
	}

	.card:hover .cover {
		transform: translateY(-3px);
	}

	.card:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 4px;
		border-radius: var(--radius-sm);
	}

	.owned {
		position: absolute;
		left: 6px;
		bottom: 6px;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 8px 3px 6px;
		border-radius: var(--radius-pill);
		background: var(--color-primary);
		font-size: 11px;
		font-weight: 700;
		color: var(--color-on-primary);
	}

	.title {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		font-size: 13.5px;
		font-weight: 700;
		line-height: 1.25;
	}

	.author {
		max-width: 100%;
		overflow: hidden;
		font-size: 12.5px;
		color: var(--color-text-secondary);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.rating {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-top: 2px;
		font-size: 12.5px;
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	.rating :global(svg) {
		color: var(--color-flame);
		fill: currentColor;
	}
</style>
