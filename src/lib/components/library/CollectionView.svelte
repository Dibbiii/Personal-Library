<script lang="ts">
	import type { BookSummary } from '$lib/contracts';
	import BookCover from '$lib/components/book/BookCover.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	interface Props {
		title: string;
		description: string;
		books: BookSummary[];
	}

	let { title, description, books }: Props = $props();
	const headingId = $props.id();
	const count = $derived(books.length);
</script>

<section class="collection" aria-labelledby={headingId}>
	<header class="head">
		<div>
			<p class="eyebrow">Libreria</p>
			<h2 id={headingId}>{title}</h2>
			<p class="description">{description}</p>
		</div>
		<a class="back" href="/library">
			<Icon name="chevron-left" size={18} strokeWidth={2.2} />
			Tutti gli scaffali
		</a>
	</header>

	<p class="count" aria-label="{count} {count === 1 ? 'libro' : 'libri'}">
		{count}
		{count === 1 ? 'libro' : 'libri'}
	</p>

	{#if count === 0}
		<p class="empty">Nessun libro in questa raccolta.</p>
	{:else}
		<ul class="grid" role="list">
			{#each books as book, index (book.id)}
				<li>
					<a class="book" href="/book/{book.id}" aria-label="{book.title}, di {book.author}">
						<BookCover {book} size="fluid" showFormat priority={index < 3} />
						<span class="title">{book.title}</span>
						<span class="author">{book.author}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.collection {
		box-sizing: border-box;
		padding: 20px;
		border-radius: var(--radius-sheet);
		background: color-mix(
			in srgb,
			var(--color-surface-elevated) 65%,
			var(--color-background-shelf)
		);
		box-shadow:
			0 0 0 1px color-mix(in srgb, var(--color-border) 18%, transparent),
			0 10px 30px -18px color-mix(in srgb, var(--color-shadow) 25%, transparent);
	}

	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
	}

	.eyebrow,
	.description,
	.count,
	.empty {
		margin: 0;
		color: var(--color-text-secondary);
	}

	.eyebrow {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	h2 {
		margin: 4px 0 0;
		font-family: var(--font-display);
		font-size: 30px;
		font-weight: 400;
		line-height: 1.1;
	}

	.description {
		margin-top: 8px;
		font-size: 14px;
		line-height: 20px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 44px;
		padding: 0 12px;
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-text-primary);
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
		white-space: nowrap;
	}

	.back:focus-visible,
	.book:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 3px;
	}

	.count {
		margin-top: 20px;
		font-size: 13px;
		font-weight: 700;
	}

	.empty {
		margin-top: 20px;
		font-size: 14px;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
		gap: 22px 14px;
		margin: 16px 0 0;
		padding: 0;
		list-style: none;
	}

	.book {
		display: block;
		min-width: 0;
		border-radius: 3px 8px 8px 3px;
		color: var(--color-text-primary);
		text-decoration: none;
	}

	.title,
	.author {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.title {
		margin-top: 8px;
		font-size: 13px;
		font-weight: 700;
	}

	.author {
		margin-top: 2px;
		color: var(--color-text-secondary);
		font-size: 12px;
	}

	@media (min-width: 768px) {
		.collection {
			padding: 28px;
		}

		.grid {
			grid-template-columns: repeat(auto-fill, 128px);
			gap: 26px;
		}
	}
</style>
