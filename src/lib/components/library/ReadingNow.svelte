<script lang="ts">
	import type { CurrentlyReadingBook } from '$lib/contracts';
	import BookCover from '$lib/components/book/BookCover.svelte';
	import Decoration from './Decoration.svelte';
	import ShelfFrame from './ShelfFrame.svelte';

	interface Props {
		items: CurrentlyReadingBook[];
	}

	let { items }: Props = $props();

	const count = $derived(items.length);
	const pill = $derived(`${count} ${count === 1 ? 'libro' : 'libri'}`);

	function percent(entry: CurrentlyReadingBook): number | null {
		const value = entry.reading.progressPercent;
		return value === null ? null : Math.max(0, Math.min(100, Math.round(value)));
	}

	function progressText(entry: CurrentlyReadingBook): string {
		const pct = percent(entry);
		const { currentPage, totalPages } = entry.reading;
		const page = totalPages ? `p. ${currentPage} di ${totalPages}` : `p. ${currentPage}`;
		return pct === null ? page : `${pct}% · ${page}`;
	}
</script>

<div class="reading">
	<ShelfFrame
		title="In lettura"
		accent="var(--color-accent)"
		height={224}
		{pill}
		label="In lettura, {pill}"
	>
		{#each items as entry, index (entry.book.id)}
			<a
				class="cover-link"
				href="/book/{entry.book.id}"
				aria-label="{entry.book.title}, di {entry.book.author}"
			>
				<BookCover book={entry.book} size="lg" showFormat priority />
			</a>
			{#if index === 0}<Decoration kind="candle" />{/if}
		{/each}
		{#if count === 0}<Decoration kind="candle" />{/if}
		<Decoration kind="plant" />
	</ShelfFrame>

	{#if count > 0}
		<ul class="cards">
			{#each items as entry (entry.book.id)}
				{@const pct = percent(entry)}
				<li>
					<a
						class="card"
						href="/book/{entry.book.id}#progress"
						aria-label="Aggiorna la pagina di {entry.book.title}"
					>
						<span class="title">{entry.book.title}</span>
						<span class="author">{entry.book.author}</span>
						{#if pct !== null}
							<span
								class="bar"
								role="progressbar"
								aria-valuemin="0"
								aria-valuemax="100"
								aria-valuenow={pct}
								aria-label="Avanzamento"
							>
								<span class="fill" style:width="{pct}%"></span>
							</span>
						{/if}
						<span class="text">{progressText(entry)}</span>
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="none">Nessun libro in lettura. Scegline uno dai prossimi o dagli scaffali.</p>
	{/if}
</div>

<style>
	.cover-link {
		display: block;
		flex: none;
		margin: 0 8px;
		border-radius: 3px 8px 8px 3px;
		color: inherit;
		text-decoration: none;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 12px;
		margin: 0;
		padding: 16px 16px 0;
		list-style: none;
	}

	.card {
		display: block;
		box-sizing: border-box;
		min-width: 0;
		padding: 10px 12px;
		border-radius: 14px;
		background: var(--color-card);
		box-shadow: var(--shadow-card);
		color: var(--color-text-primary);
		text-decoration: none;
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

	.author {
		display: block;
		overflow: hidden;
		color: var(--color-text-secondary);
		font-size: 11.5px;
		line-height: 15px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.bar {
		display: block;
		height: 6px;
		margin-top: 7px;
		overflow: hidden;
		border-radius: 3px;
		background: var(--color-surface);
	}

	.fill {
		display: block;
		height: 100%;
		border-radius: 3px;
		background: var(--color-primary);
	}

	.text {
		display: block;
		margin-top: 3px;
		color: var(--color-text-secondary);
		font-size: 11px;
		line-height: 15px;
	}

	.none {
		margin: 16px 16px 0;
		color: var(--color-text-secondary);
		font-size: 13px;
	}
</style>
