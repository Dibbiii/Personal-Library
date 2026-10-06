<script lang="ts">
	import type { BookSummary, CurrentlyReadingBook } from '$lib/contracts';
	import BookCover from '$lib/components/book/BookCover.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import RatingStars from '$lib/components/ui/RatingStars.svelte';
	import { resolveCoverUrl } from '$lib/book/cover-url';

	interface Props {
		book: BookSummary;
		/** Lettura in corso: mostra avanzamento e "aggiorna pagina". */
		reading?: CurrentlyReadingBook['reading'] | null;
		/** Il libro e' gia' nei prossimi. */
		queued?: boolean;
		/** Con questa callback compare il "+" per aggiungerlo ai prossimi. */
		onqueue?: (() => void) | undefined;
	}

	/** Scheda scura di un libro (mockup Libreria): copertina, dati, avanzamento, azioni. */
	let { book, reading = null, queued = false, onqueue }: Props = $props();

	const FORMAT_LABELS = { physical: 'Cartaceo', digital: 'Digitale' } as const;
	const STATE_LABELS = {
		unread: 'Da leggere',
		reading: 'In lettura',
		paused: 'In pausa',
		finished: 'Letto',
		dnf: 'Abbandonato'
	} as const;
	const dateFormat = new Intl.DateTimeFormat('it-IT', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});

	const total = $derived(reading?.totalPages ?? book.pageCount);
	const percent = $derived.by(() => {
		if (!reading) return null;
		const value = reading.progressPercent;
		if (value !== null) return Math.max(0, Math.min(100, Math.round(value)));
		return total ? Math.min(100, Math.round((reading.currentPage / total) * 100)) : null;
	});
	const art = $derived(resolveCoverUrl(book.cover));
	const series = $derived(
		book.series ? `${book.series.name}${book.series.number ? ` #${book.series.number}` : ''}` : null
	);
	const status = $derived(
		queued && book.lifecycleState === 'unread' ? 'Nei prossimi' : STATE_LABELS[book.lifecycleState]
	);
	const canQueue = $derived(
		onqueue !== undefined && !queued && !reading && book.lifecycleState !== 'reading'
	);
</script>

<article
	class="hero"
	style:--g="var(--genre-{book.genre.slug})"
	aria-labelledby="hero-title-{book.id}"
>
	{#if art}
		<div class="art" style:background-image="url('{art}')" aria-hidden="true"></div>
	{/if}

	<div class="body">
		<a class="cover" href="/book/{book.id}" tabindex="-1" aria-hidden="true">
			<BookCover {book} size={112} priority />
		</a>

		<div class="info">
			<h3 id="hero-title-{book.id}">{book.title}</h3>
			<p class="author">{book.author}</p>

			{#if book.reviewRating}
				<div class="rating">
					<RatingStars value={book.reviewRating} size={16} />
					<span>{book.reviewRating}/5</span>
				</div>
			{/if}

			<ul class="facts">
				{#if total}
					<li><Icon name="book-open" size={17} /> {total} pagine</li>
				{/if}
				{#if reading}
					<li>
						<Icon name="calendar" size={17} />
						<span>Iniziato il {dateFormat.format(new Date(reading.startedAt))}</span>
					</li>
				{:else if book.lastFinishedAt}
					<li>
						<Icon name="calendar" size={17} />
						<span>Finito il {dateFormat.format(new Date(book.lastFinishedAt))}</span>
					</li>
				{/if}
				{#if book.completedReadingsCount > 1}
					<li><Icon name="check" size={17} /> Letto {book.completedReadingsCount} volte</li>
				{/if}
			</ul>

			<ul class="chips">
				<li>{book.genre.name}</li>
				<li>{FORMAT_LABELS[book.format]}</li>
				{#if series}<li>{series}</li>{/if}
				{#if reading?.paused}
					<li class="paused">In pausa</li>
				{:else if !reading}
					<li class="status">{status}</li>
				{/if}
			</ul>

			{#if reading}
				<div class="progress">
					{#if percent !== null}
						<span
							class="bar"
							role="progressbar"
							aria-valuemin="0"
							aria-valuemax="100"
							aria-valuenow={percent}
							aria-label="Avanzamento"
						>
							<span class="fill" style:width="{percent}%"></span>
						</span>
					{/if}
					<span class="pages">
						{total ? `${reading.currentPage} / ${total} pagine` : `Pagina ${reading.currentPage}`}
					</span>
					{#if percent !== null}<span class="pct">{percent}%</span>{/if}
				</div>
			{/if}
		</div>
	</div>

	<div class="cta">
		<a class="primary" href="/book/{book.id}">
			<Icon name="book-open" size={18} strokeWidth={2.1} />
			Vedi dettagli
		</a>
		{#if reading}
			<a
				class="round"
				href="/book/{book.id}#progress"
				aria-label="Aggiorna la pagina di {book.title}"
				title="Aggiorna pagina"
			>
				<Icon name="bookmark" size={19} />
			</a>
		{/if}
		{#if canQueue}
			<button
				type="button"
				class="round"
				aria-label="Aggiungi {book.title} ai prossimi"
				title="Aggiungi ai prossimi"
				onclick={onqueue}
			>
				<Icon name="plus" size={20} strokeWidth={2.1} />
			</button>
		{/if}
	</div>
</article>

<style>
	.hero {
		--ink: var(--color-on-genre-white);
		--ink-soft: color-mix(in srgb, var(--color-on-genre-white) 78%, transparent);
		--glass: color-mix(in srgb, var(--color-on-genre-white) 14%, transparent);
		position: relative;
		isolation: isolate;
		display: flex;
		flex-direction: column;
		gap: 18px;
		box-sizing: border-box;
		padding: 18px;
		overflow: hidden;
		border-radius: var(--radius-xl);
		background:
			radial-gradient(
				ellipse 60% 90% at 100% 0%,
				color-mix(in srgb, var(--g) 40%, transparent),
				transparent 70%
			),
			color-mix(in srgb, var(--color-overlay) 92%, var(--g));
		box-shadow:
			0 24px 48px -18px color-mix(in srgb, var(--color-overlay) 70%, transparent),
			0 2px 6px color-mix(in srgb, var(--color-overlay) 30%, transparent);
		color: var(--ink);
	}

	/* La copertina stessa fa da illustrazione sul lato destro, sfumata nel fondo scuro. */
	.art {
		position: absolute;
		z-index: -1;
		inset: 0 0 0 38%;
		background-position: center 30%;
		background-size: cover;
		filter: blur(3px) saturate(1.15);
		opacity: 0.5;
		-webkit-mask-image: linear-gradient(90deg, transparent, var(--color-overlay) 65%);
		mask-image: linear-gradient(90deg, transparent, var(--color-overlay) 65%);
	}

	.body {
		display: flex;
		gap: 18px;
		min-width: 0;
	}

	.cover {
		flex: none;
		align-self: flex-start;
		border-radius: 3px 8px 8px 3px;
		box-shadow: 0 10px 22px color-mix(in srgb, var(--color-overlay) 60%, transparent);
	}

	.info {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
		max-width: 420px;
	}

	h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 22px;
		font-weight: 400;
		line-height: 1.15;
	}

	.author {
		margin: -4px 0 0;
		color: var(--ink-soft);
		font-size: 14px;
	}

	.rating {
		--genre-current: var(--color-flame);
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--ink-soft);
		font-size: 13px;
	}

	.facts,
	.chips {
		display: flex;
		flex-wrap: wrap;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.facts {
		gap: 6px 18px;
		color: var(--ink-soft);
		font-size: 13.5px;
	}

	.facts li {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.chips {
		gap: 6px;
	}

	.chips li {
		padding: 4px 11px;
		border-radius: var(--radius-pill);
		background: var(--glass);
		font-size: 12px;
		font-weight: 600;
	}

	.chips .status {
		background: color-mix(in srgb, var(--color-accent) 30%, transparent);
	}

	.chips .paused {
		background: var(--color-warning);
		color: var(--color-on-warning);
	}

	.progress {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 12px;
		margin-top: 4px;
		color: var(--ink-soft);
		font-size: 12px;
	}

	.bar {
		display: block;
		flex: 1 1 120px;
		max-width: 160px;
		height: 6px;
		overflow: hidden;
		border-radius: 3px;
		background: var(--glass);
	}

	.fill {
		display: block;
		height: 100%;
		border-radius: 3px;
		background: var(--color-accent);
	}

	.pct {
		margin-left: auto;
		color: var(--ink);
		font-weight: 700;
	}

	.cta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}

	.primary,
	.round {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		min-height: 48px;
		border-radius: var(--radius-pill);
		color: var(--ink);
		text-decoration: none;
		transition:
			background-color var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}

	.primary {
		gap: 10px;
		padding: 0 22px;
		background: var(--color-primary);
		box-shadow: 0 6px 16px color-mix(in srgb, var(--color-primary) 45%, transparent);
		color: var(--color-on-primary);
		font-size: 15px;
		font-weight: 700;
	}

	.round {
		width: 48px;
		padding: 0;
		border: 0;
		background: var(--glass);
		cursor: pointer;
	}

	.primary:hover {
		background: var(--color-primary-hover);
	}

	.round:hover {
		background: color-mix(in srgb, var(--color-on-genre-white) 24%, transparent);
	}

	.primary:active,
	.round:active {
		transform: scale(0.96);
	}

	.primary:focus-visible,
	.round:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.primary,
		.round {
			transition: none;
		}
	}
</style>
