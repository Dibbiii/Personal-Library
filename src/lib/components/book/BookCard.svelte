<script lang="ts">
	import type { BookSummary } from '$lib/contracts';
	import RatingStars from '$lib/components/ui/RatingStars.svelte';
	import { bookStatus } from '$lib/book/palette';
	import type { BookStatusBadge } from '$lib/book/spine';
	import BookCover from './BookCover.svelte';

	interface Props {
		book: BookSummary;
		/** Il libro e' nella coda "I prossimi": mostra il badge "Prossimo". */
		queued?: boolean;
		/** Forza il badge; di default: "In lettura" se lifecycle=reading, "Prossimo" se `queued`. */
		badge?: BookStatusBadge | null;
		/** Link di destinazione (default: dettaglio libro). */
		href?: string;
		/** Above the fold. */
		priority?: boolean;
		showFormat?: boolean;
		class?: string;
	}

	let {
		book,
		queued = false,
		badge,
		href,
		priority = false,
		showFormat = true,
		class: className
	}: Props = $props();

	const status = $derived(badge === undefined ? bookStatus(book, queued) : badge);
	const target = $derived(href ?? `/book/${book.id}`);
</script>

<!-- Cella della griglia genere (mockup 02): cover, titolo, autore, pagine, stelle se recensito. -->
<a class="card {className ?? ''}" href={target} data-book-id={book.id}>
	<BookCover {book} size="fluid" badge={status} {showFormat} {priority} />
	<span class="text">
		<span class="title">{book.title}</span>
		<span class="meta">{book.author}</span>
		{#if book.pageCount}<span class="meta">{book.pageCount} pag.</span>{/if}
		{#if book.reviewRating}
			<span class="stars"><RatingStars value={book.reviewRating} size={13} /></span>
		{/if}
	</span>
</a>

<style>
	.card {
		display: block;
		min-width: 0;
		color: var(--genre-current-dark);
		text-decoration: none;
	}

	.text {
		display: block;
		margin-top: 20px;
		min-height: 74px;
	}

	.title {
		display: block;
		overflow: hidden;
		font-size: 13px;
		font-weight: 700;
		line-height: 16px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta {
		display: block;
		margin-top: 1px;
		overflow: hidden;
		font-size: 12px;
		line-height: 15px;
		opacity: 0.88;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.stars {
		display: block;
		margin-top: 3px;
		height: 14px;
		line-height: 0;
	}
</style>
