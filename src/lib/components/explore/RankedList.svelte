<script lang="ts">
	import CoverImage from '$lib/components/catalog/CoverImage.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { DiscoverBook, DiscoverRequest } from '$lib/catalog/discover';
	import { discoverSection } from './discover-load.svelte';

	interface Props {
		title: string;
		query: DiscoverRequest;
		/** Mostra la posizione (1, 2, 3…) accanto alla copertina. */
		numbered?: boolean;
		onopen: (book: DiscoverBook) => void;
		onseeall: () => void;
	}

	let { title, query, numbered = false, onopen, onseeall }: Props = $props();

	const uid = $props.id();
	const section = discoverSection(() => query);
	const compact = new Intl.NumberFormat('it-IT', { notation: 'compact', maximumFractionDigits: 1 });
</script>

<section class="ranked" aria-labelledby="{uid}-title">
	<header>
		<h2 id="{uid}-title">{title}</h2>
		<button type="button" class="see-all" onclick={onseeall} aria-label="Vedi tutti: {title}">
			Vedi tutti <Icon name="chevron-right" size={15} strokeWidth={2.2} />
		</button>
	</header>

	{#if section.loading && section.books.length === 0}
		<ol class="list" aria-busy="true" aria-label="Caricamento">
			{#each [0, 1, 2, 3, 4] as n (n)}<li class="skeleton"><span></span><i></i></li>{/each}
		</ol>
	{:else if section.error}
		<p class="note" role="alert">{section.error}</p>
	{:else}
		<ol class="list">
			{#each section.books as book, index (book.workId)}
				<li>
					<button type="button" class="row" onclick={() => onopen(book)}>
						{#if numbered}<span class="rank" aria-hidden="true">{index + 1}</span>{/if}
						<CoverImage src={book.coverUrl} width={44} height={66} />
						<span class="text">
							<span class="title">{book.title}</span>
							{#if book.authors[0]}<span class="author">{book.authors[0]}</span>{/if}
							{#if book.rating}
								<span class="rating">
									<Icon name="star" size={12} />
									{book.rating.toLocaleString('it-IT')}
									{#if book.ratingCount}<span>({compact.format(book.ratingCount)})</span>{/if}
								</span>
							{/if}
						</span>
					</button>
				</li>
			{/each}
		</ol>
	{/if}
</section>

<style>
	.ranked {
		padding: 18px 16px 12px;
		border-radius: var(--radius-xl);
		background: color-mix(in srgb, var(--color-card) 70%, transparent);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-border) 16%, transparent);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 8px;
	}

	h2 {
		min-width: 0;
		margin: 0;
		font-family: var(--font-display);
		font-size: 20px;
		white-space: nowrap;
		font-weight: 400;
		color: var(--color-primary);
	}

	.see-all {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		min-height: 32px;
		padding: 0 4px 0 8px;
		border: 0;
		border-radius: var(--radius-pill);
		background: transparent;
		white-space: nowrap;
		font-size: 12.5px;
		font-weight: 700;
		color: var(--color-primary);
	}

	.see-all:hover {
		background: var(--color-surface);
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 6px;
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		text-align: left;
		color: var(--color-text-primary);
	}

	.row:hover {
		background: var(--color-surface);
	}

	.row:focus-visible,
	.see-all:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 1px;
	}

	.rank {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		background: var(--color-surface);
		font-size: 14px;
		font-weight: 700;
		color: var(--color-primary);
	}

	.text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.title {
		overflow: hidden;
		font-size: 14px;
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.author {
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
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	.rating span {
		font-weight: 400;
	}

	.rating :global(svg) {
		color: var(--color-flame);
		fill: currentColor;
	}

	.note {
		margin: 0;
		font-size: 13.5px;
		color: var(--color-text-secondary);
	}

	.skeleton {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 6px;
		animation: pulse 1.4s ease-in-out infinite;
	}

	.skeleton span {
		width: 44px;
		height: 66px;
		border-radius: 3px 6px 6px 3px;
		background: var(--color-surface);
	}

	.skeleton i {
		flex: 1;
		height: 12px;
		border-radius: 6px;
		background: var(--color-surface);
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
</style>
