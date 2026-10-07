<script lang="ts">
	import BookCover from '$lib/components/book/BookCover.svelte';
	import type { BookSummary } from '$lib/contracts';

	interface Props {
		book: BookSummary;
		page: number | null;
	}

	let { book, page }: Props = $props();
</script>

<a class="tomb" href="/book/{book.id}" data-testid="tombstone">
	<span class="cover"><BookCover {book} size="xs" /></span>
	<span class="title">{book.title}</span>
	<span class="author">{book.author}</span>
	<span class="rule" aria-hidden="true"></span>
	<span class="rest"
		>{#if page}Riposa a pag. {page}{:else}Riposa qui{/if}</span
	>
</a>

<style>
	.tomb {
		display: flex;
		flex-direction: column;
		align-items: center;
		box-sizing: border-box;
		min-width: 0;
		min-height: 212px;
		padding: 20px 8px 10px;
		border: 1.5px solid color-mix(in srgb, var(--color-text-secondary) 34%, transparent);
		border-radius: 52px 52px 10px 10px;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--color-surface-elevated) 88%, var(--color-text-secondary)),
			color-mix(in srgb, var(--color-surface) 78%, var(--color-text-secondary))
		);
		box-shadow: 0 8px 12px -6px color-mix(in srgb, var(--color-text-secondary) 42%, transparent);
		color: var(--color-shelf-axis);
		text-align: center;
		text-decoration: none;
	}

	.cover {
		display: block;
		width: 44px;
		filter: grayscale(0.18);
	}

	.title {
		margin-top: 6px;
		font-family: var(--font-display);
		font-size: 14px;
		line-height: 17px;
		color: var(--color-text-primary);
		overflow-wrap: break-word;
	}

	.author {
		margin-top: 2px;
		font-size: 11px;
		line-height: 14px;
		color: var(--color-text-secondary);
	}

	.rule {
		width: 28px;
		height: 1.5px;
		margin: 8px 0 6px;
		background: color-mix(in srgb, var(--color-shelf-axis) 30%, transparent);
	}

	.rest {
		font-size: 11px;
		font-weight: 700;
		line-height: 14px;
	}
</style>
