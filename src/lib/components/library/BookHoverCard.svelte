<script lang="ts">
	import type { BookSummary, CurrentlyReadingBook, GenreSlug } from '$lib/contracts';
	import Icon from '$lib/components/ui/Icon.svelte';
	import RatingStars from '$lib/components/ui/RatingStars.svelte';
	import { resolveCoverUrl } from '$lib/book/cover-url';
	import { GENRE_LABELS, GENRE_ORDER, GENRE_SHORT_LABELS } from '$lib/genres';

	interface Props {
		book: BookSummary;
		reading?: CurrentlyReadingBook['reading'] | null;
		queued?: boolean;
		onstart?: (() => void) | undefined;
		onqueue?: (() => void) | undefined;
		onunqueue?: (() => void) | undefined;
		onmove?: ((slug: GenreSlug) => void) | undefined;
	}

	/** Anteprima compatta al passaggio del mouse su un libro dello scaffale. */
	let {
		book,
		reading = null,
		queued = false,
		onstart,
		onqueue,
		onunqueue,
		onmove
	}: Props = $props();

	const STATE_LABELS = {
		unread: 'Da leggere',
		reading: 'In lettura',
		paused: 'In pausa',
		finished: 'Letto',
		dnf: 'Non finito'
	} as const;

	let moving = $state(false);

	const cover = $derived(resolveCoverUrl(book.cover));
	const total = $derived(reading?.totalPages ?? book.pageCount);
	const percent = $derived.by(() => {
		if (!reading) return null;
		if (reading.progressPercent !== null)
			return Math.max(0, Math.min(100, Math.round(reading.progressPercent)));
		return total ? Math.min(100, Math.round((reading.currentPage / total) * 100)) : null;
	});
	const inProgress = $derived(reading !== null || book.lifecycleState === 'reading');
	const status = $derived(
		queued && book.lifecycleState === 'unread' ? 'Nei prossimi' : STATE_LABELS[book.lifecycleState]
	);
	const canStart = $derived(!inProgress && onstart !== undefined && book.lifecycleState !== 'dnf');
	const otherGenres = $derived(GENRE_ORDER.filter((slug) => slug !== book.genre.slug));
</script>

<article class="card" style:--g="var(--genre-{book.genre.slug})" aria-labelledby="hover-{book.id}">
	<a class="top" href="/book/{book.id}" aria-label="Apri la scheda di {book.title}">
		<span class="thumb" aria-hidden="true">
			{#if cover}<img src={cover} alt="" decoding="async" />{/if}
		</span>
		<div class="heading">
			<p class="eyebrow">
				<span class="dot" aria-hidden="true"></span>
				{GENRE_SHORT_LABELS[book.genre.slug]}
				<span class="sep" aria-hidden="true">·</span>
				<span class="status">{status}</span>
			</p>
			<h3 id="hover-{book.id}">{book.title}</h3>
			<p class="author">{book.author}</p>
			<p class="meta">
				{#if book.reviewRating}
					<span class="stars"><RatingStars value={book.reviewRating} size={13} /></span>
				{/if}
				{#if total}<span>{total} pagine</span>{/if}
				{#if book.series}
					<span>{book.series.name}{book.series.number ? ` #${book.series.number}` : ''}</span>
				{/if}
			</p>
		</div>
		<span class="go" aria-hidden="true"
			><Icon name="arrow-right" size={16} strokeWidth={2.2} /></span
		>
	</a>

	{#if reading}
		<div class="progress">
			<span class="bar" aria-hidden="true"><span style:width="{percent ?? 0}%"></span></span>
			<span>
				p. {reading.currentPage}{total ? ` di ${total}` : ''}{#if percent !== null}
					· <strong>{percent}%</strong>{/if}
			</span>
		</div>
	{/if}

	{#if moving && onmove}
		<div class="move" role="group" aria-label="Sposta {book.title} in un altro genere">
			{#each otherGenres as slug (slug)}
				<button
					type="button"
					style:--dot="var(--genre-{slug})"
					onclick={() => {
						moving = false;
						onmove(slug);
					}}
				>
					<span class="dot" aria-hidden="true"></span>{GENRE_LABELS[slug]}
				</button>
			{/each}
		</div>
	{/if}

	<div class="actions">
		{#if inProgress}
			<a class="action primary" href="/book/{book.id}#progress">
				<Icon name="bookmark" size={15} strokeWidth={2.2} /> Aggiorna pagina
			</a>
		{:else if canStart}
			<button type="button" class="action primary" onclick={onstart}>
				<Icon name="book-open" size={15} strokeWidth={2.2} />
				{book.lifecycleState === 'finished' ? 'Rileggi' : 'Inizia'}
			</button>
		{/if}
		{#if !inProgress && queued && onunqueue}
			<button type="button" class="action on" onclick={onunqueue} aria-label="Togli dai prossimi">
				<Icon name="check" size={15} strokeWidth={2.4} /> Nei prossimi
			</button>
		{:else if !inProgress && !queued && onqueue}
			<button type="button" class="action" onclick={onqueue}>
				<Icon name="plus" size={15} strokeWidth={2.4} /> Prossimi
			</button>
		{/if}
		{#if onmove}
			<button
				type="button"
				class="action"
				class:on={moving}
				aria-expanded={moving}
				onclick={() => (moving = !moving)}
			>
				<Icon name="library" size={15} /> Sposta
			</button>
		{/if}
	</div>
</article>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: 12px;
		box-sizing: border-box;
		padding: 14px;
		border: 1px solid color-mix(in srgb, var(--color-border) 30%, transparent);
		border-radius: var(--radius-lg);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--g) 9%, var(--color-surface-elevated)),
			var(--color-surface-elevated) 70px
		);
		box-shadow:
			0 22px 44px -18px color-mix(in srgb, var(--color-shadow) 45%, transparent),
			0 4px 12px color-mix(in srgb, var(--color-shadow) 10%, transparent);
		color: var(--color-text-primary);
	}

	.top {
		position: relative;
		display: flex;
		gap: 12px;
		min-width: 0;
		margin: -6px;
		padding: 6px 30px 6px 6px;
		border-radius: var(--radius-md);
		color: inherit;
		text-decoration: none;
		transition: background-color var(--duration-fast) var(--ease-out);
	}

	.top:hover {
		background: color-mix(in srgb, var(--color-primary) 6%, transparent);
	}

	.top:hover h3 {
		color: var(--color-primary);
	}

	.top:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.go {
		position: absolute;
		top: 6px;
		right: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: var(--color-surface);
		color: var(--color-primary);
		transition: transform var(--duration-fast) var(--ease-out);
	}

	.top:hover .go {
		transform: translateX(2px);
	}

	.thumb {
		flex: none;
		width: 52px;
		height: 78px;
		overflow: hidden;
		border-radius: 2px 6px 6px 2px;
		background:
			linear-gradient(
				90deg,
				color-mix(in srgb, var(--color-shadow) 18%, transparent) 0 4px,
				transparent 4px
			),
			color-mix(in srgb, var(--g) 80%, var(--color-wood-ink));
		box-shadow: 0 6px 12px -4px color-mix(in srgb, var(--color-shadow) 40%, transparent);
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.heading {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.eyebrow {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0 0 2px;
		color: var(--color-text-secondary);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.eyebrow .dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--g);
	}

	.sep {
		opacity: 0.6;
	}

	.status {
		color: var(--color-primary);
	}

	h3 {
		display: -webkit-box;
		margin: 0;
		overflow: hidden;
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: 400;
		line-height: 1.15;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.author {
		margin: 0;
		overflow: hidden;
		color: var(--color-text-secondary);
		font-size: 13px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px 10px;
		margin: 4px 0 0;
		color: var(--color-text-muted);
		font-size: 12px;
	}

	.stars {
		--genre-current: var(--color-flame);
		display: inline-flex;
	}

	.progress {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--color-text-secondary);
		font-size: 12px;
	}

	.bar {
		flex: 1;
		height: 6px;
		overflow: hidden;
		border-radius: 3px;
		background: var(--color-surface);
	}

	.bar span {
		display: block;
		height: 100%;
		border-radius: 3px;
		background: var(--color-primary);
	}

	.progress strong {
		color: var(--color-text-primary);
	}

	.move {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 10px;
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	.move button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 30px;
		padding: 0 10px;
		border: 0;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		color: var(--color-text-primary);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
	}

	.move button:hover {
		background: var(--color-background);
	}

	.move .dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--dot);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		padding-top: 10px;
		border-top: 1px solid color-mix(in srgb, var(--color-border) 22%, transparent);
	}

	.action {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		box-sizing: border-box;
		min-height: 34px;
		padding: 0 12px;
		border: 1px solid color-mix(in srgb, var(--color-border) 35%, transparent);
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		color: var(--color-text-primary);
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
		cursor: pointer;
		transition:
			background-color var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}

	.action:hover {
		border-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
		background: var(--color-primary-tint);
	}

	.action.primary {
		border-color: transparent;
		background: var(--color-primary);
		color: var(--color-on-primary);
	}

	.action.primary:hover {
		background: var(--color-primary-hover);
	}

	.action.on {
		border-color: transparent;
		background: var(--color-primary-tint);
		color: var(--color-primary);
	}

	.action:focus-visible,
	.move button:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
</style>
