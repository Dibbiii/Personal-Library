<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { QuotePreview } from '$lib/contracts';
	import { abbreviateAuthor } from './format';

	interface Props {
		quote: QuotePreview;
		/** Azione sotto la citazione (es. "Crea Quote Card"). */
		action?: Snippet;
	}

	let { quote, action }: Props = $props();
</script>

<article class="quote" style="--g: var(--genre-{quote.genre.slug})">
	<div class="row">
		<span class="mark"><Icon name="quote" size={24} strokeWidth={2} /></span>
		<blockquote>«{quote.body}»</blockquote>
	</div>
	<p class="meta">
		<span class="dot" aria-hidden="true"></span>
		<a class="title" href="/book/{quote.userBookId}">{quote.bookTitle}</a>
		<span class="author">· {abbreviateAuthor(quote.author)}</span>
		{#if quote.page}<span class="page">p. {quote.page}</span>{/if}
	</p>
	{#if action}<div class="action">{@render action()}</div>{/if}
</article>

<style>
	.quote {
		box-sizing: border-box;
		min-width: 0;
		padding: 16px;
		border-radius: 20px;
		background: var(--color-card);
		border: 1px solid var(--color-surface);
	}

	.row {
		display: flex;
		gap: 10px;
	}

	.mark {
		flex-shrink: 0;
		color: var(--g);
		line-height: 0;
		padding-top: 2px;
	}

	blockquote {
		margin: 0;
		font-family: var(--font-display);
		font-size: 16px;
		line-height: 23px;
		color: var(--color-text-primary);
		overflow-wrap: anywhere;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 8px;
		margin: 12px 0 0;
		padding-left: 34px;
		font-size: 12.5px;
		color: var(--color-text-secondary);
	}

	.dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--g);
		flex-shrink: 0;
	}

	.title {
		font-weight: 700;
		color: var(--color-text-primary);
		text-decoration: none;
	}

	.title:hover {
		text-decoration: underline;
	}

	.page {
		display: inline-flex;
		align-items: center;
		height: 24px;
		margin-left: auto;
		padding: 0 10px;
		border-radius: 12px;
		background: var(--color-info-tint);
		color: var(--color-info);
		font-size: 12.5px;
		font-weight: 700;
	}

	.action {
		margin-top: 14px;
		padding-left: 34px;
	}
</style>
