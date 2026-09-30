<script lang="ts">
	import type { BookSummary } from '$lib/contracts';
	import BookCard from '$lib/components/book/BookCard.svelte';

	interface Props {
		title: string;
		books: BookSummary[];
		count: number;
		caption: string;
		/** Id dei libri nella coda "I prossimi" (badge "Prossimo"). */
		queuedIds: ReadonlySet<string>;
		emptyText: string;
		/** I primi libri della pagina sono above the fold: caricamento immediato. */
		priorityCount?: number;
	}

	let { title, books, count, caption, queuedIds, emptyText, priorityCount = 0 }: Props = $props();

	const headingId = $props.id();
</script>

<section class="section" aria-labelledby={headingId}>
	<div class="head">
		<h2 id={headingId}>
			{title}
			<span class="count" aria-label="{count} {count === 1 ? 'libro' : 'libri'}">{count}</span>
		</h2>
		<span class="caption">{caption}</span>
	</div>

	{#if books.length === 0}
		<p class="empty">{emptyText}</p>
	{:else}
		<div class="shelf">
			<ul class="grid" role="list">
				{#each books as book, index (book.id)}
					<li class="cell">
						<BookCard {book} queued={queuedIds.has(book.id)} priority={index < priorityCount} />
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</section>

<style>
	.section {
		margin-top: 10px;
		color: var(--genre-current-dark);
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		box-sizing: border-box;
		height: 56px;
		padding: 0 var(--page-gutter);
	}

	h2 {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 0;
		font-size: 24px;
		line-height: 1.1;
		color: var(--genre-current-dark);
	}

	.count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 26px;
		height: 26px;
		padding: 0 8px;
		box-sizing: border-box;
		border-radius: 13px;
		background: var(--genre-current);
		color: var(--genre-current-on);
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
	}

	.caption {
		font-size: 12.5px;
		opacity: 0.9;
		text-align: right;
	}

	.empty {
		margin: 0;
		padding: 4px var(--page-gutter) 18px;
		font-size: 14px;
		line-height: 20px;
		opacity: 0.9;
	}

	/*
	 * Mensola: ogni riga ha passo fisso (copertina + testo) quindi la linea si disegna con un
	 * unico gradiente ripetuto, corretto per qualunque numero di colonne. La copertina è fluida
	 * (proporzione 34:50), quindi la sua altezza si ricava dalla larghezza del contenitore.
	 */
	.shelf {
		container-type: inline-size;
		--gap: 16px;
		--col: calc((100cqw - 2 * var(--page-gutter) - 2 * var(--gap)) / 3);
	}

	.grid {
		--cover-h: calc(var(--col) * 50 / 34);
		--line: calc(10px + var(--cover-h));
		--pitch: calc(var(--cover-h) + 112px);
		display: grid;
		grid-template-columns: repeat(3, var(--col));
		grid-auto-rows: var(--pitch);
		gap: 0 var(--gap);
		align-items: start;
		margin: 0;
		padding: 0 var(--page-gutter);
		list-style: none;
		background: linear-gradient(
				to bottom,
				transparent calc(var(--line) - 18px),
				color-mix(in srgb, var(--genre-current) 38%, transparent) var(--line),
				var(--genre-current) var(--line) calc(var(--line) + 2px),
				var(--genre-current-line-top) calc(var(--line) + 2px),
				var(--genre-current-line-bottom) calc(var(--line) + 12px),
				color-mix(in srgb, var(--genre-current-dark) 32%, transparent) calc(var(--line) + 12px),
				transparent calc(var(--line) + 24px)
			)
			0 0 / 100% var(--pitch) repeat-y;
	}

	.cell {
		min-width: 0;
		padding-top: 10px;
	}

	@media (min-width: 768px) {
		.shelf {
			--gap: 24px;
			--col: 132px;
		}

		.grid {
			grid-template-columns: repeat(auto-fill, var(--col));
			justify-content: start;
		}
	}
</style>
