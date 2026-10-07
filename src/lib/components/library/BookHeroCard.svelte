<script lang="ts">
	import type { BookSummary, CurrentlyReadingBook, GenreSlug } from '$lib/contracts';
	import BookCover from '$lib/components/book/BookCover.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import RatingStars from '$lib/components/ui/RatingStars.svelte';
	import { resolveCoverUrl } from '$lib/book/cover-url';
	import { GENRE_LABELS, GENRE_ORDER } from '$lib/genres';

	interface Props {
		book: BookSummary;
		/** Lettura in corso: mostra avanzamento e "aggiorna pagina". */
		reading?: CurrentlyReadingBook['reading'] | null;
		/** Il libro e' gia' nei prossimi. */
		queued?: boolean;
		onstart?: (() => void) | undefined;
		onqueue?: (() => void) | undefined;
		onunqueue?: (() => void) | undefined;
		onmove?: ((slug: GenreSlug) => void) | undefined;
	}

	/** Scheda scura di un libro (mockup Libreria): copertina, dati, avanzamento, azioni. */
	let {
		book,
		reading = null,
		queued = false,
		onstart,
		onqueue,
		onunqueue,
		onmove
	}: Props = $props();

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

	let moving = $state(false);

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
	const inProgress = $derived(reading !== null || book.lifecycleState === 'reading');
	const status = $derived(
		queued && book.lifecycleState === 'unread' ? 'Nei prossimi' : STATE_LABELS[book.lifecycleState]
	);
	const startLabel = $derived(book.lifecycleState === 'finished' ? 'Rileggi' : 'Inizia a leggere');
	const otherGenres = $derived(GENRE_ORDER.filter((slug) => slug !== book.genre.slug));
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

	{#if moving && onmove}
		<div class="move" role="group" aria-label="Sposta {book.title} in un altro genere">
			<span class="move-label">Sposta in</span>
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

	<div class="cta">
		<a class="primary" href="/book/{book.id}">
			<Icon name="book-open" size={18} strokeWidth={2.1} />
			Vedi dettagli
		</a>
		<a
			class="round"
			href="/book/{book.id}#review"
			aria-label="Vai alla recensione di {book.title}"
			data-tip="Recensione"
		>
			<Icon name="pencil" size={18} />
		</a>
		{#if book.completedReadingsCount > 0}
			<a
				class="round"
				href="/book/{book.id}#history"
				aria-label="Vedi cronologia letture di {book.title}"
				data-tip="Cronologia"
			>
				<Icon name="calendar" size={18} />
			</a>
		{/if}
		{#if inProgress}
			<a
				class="round"
				href="/book/{book.id}#progress"
				aria-label="Aggiorna la pagina di {book.title}"
				data-tip="Aggiorna pagina"
			>
				<Icon name="bookmark" size={19} />
			</a>
		{:else if onstart && book.lifecycleState !== 'dnf'}
			<button
				type="button"
				class="round"
				aria-label="{startLabel}: {book.title}"
				data-tip={startLabel}
				onclick={onstart}
			>
				<Icon name="book-open" size={19} />
			</button>
		{/if}
		{#if !inProgress && queued && onunqueue}
			<button
				type="button"
				class="round on"
				aria-label="Togli {book.title} dai prossimi"
				data-tip="Togli dai prossimi"
				onclick={onunqueue}
			>
				<Icon name="check" size={20} strokeWidth={2.2} />
			</button>
		{:else if !inProgress && !queued && onqueue}
			<button
				type="button"
				class="round"
				aria-label="Aggiungi {book.title} ai prossimi"
				data-tip="Aggiungi ai prossimi"
				onclick={onqueue}
			>
				<Icon name="plus" size={20} strokeWidth={2.1} />
			</button>
		{/if}
		{#if onmove}
			<button
				type="button"
				class="round"
				class:on={moving}
				aria-label="Sposta in un altro genere"
				aria-expanded={moving}
				data-tip="Sposta in un altro genere"
				onclick={() => (moving = !moving)}
			>
				<Icon name="more-horizontal" size={20} />
			</button>
		{/if}
	</div>
</article>

<style>
	.hero {
		--ink: var(--color-text-primary);
		--ink-soft: var(--color-text-secondary);
		--glass: var(--color-surface);
		--base: var(--color-surface-elevated);
		position: relative;
		isolation: isolate;
		display: flex;
		flex-direction: column;
		gap: 16px;
		box-sizing: border-box;
		padding: 20px;
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--color-border) 35%, transparent);
		border-radius: var(--radius-xl);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--g) 8%, var(--base)),
			var(--base) 52%
		);
		box-shadow:
			0 22px 44px -22px color-mix(in srgb, var(--color-shadow) 42%, transparent),
			0 3px 10px color-mix(in srgb, var(--color-shadow) 8%, transparent);
		color: var(--ink);
	}

	/* La copertina fa da illustrazione solo sul bordo destro: scurita e sfumata, non disturba il testo. */
	.art {
		position: absolute;
		z-index: -1;
		inset: 0 0 0 55%;
		background-position: center 30%;
		background-size: cover;
		filter: blur(8px) saturate(0.8);
		opacity: 0.1;
		-webkit-mask-image: linear-gradient(90deg, transparent, var(--color-overlay));
		mask-image: linear-gradient(90deg, transparent, var(--color-overlay));
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
		box-shadow: 0 10px 22px color-mix(in srgb, var(--color-shadow) 24%, transparent);
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
		text-shadow: none;
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

	.move {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		padding: 10px;
		border-radius: var(--radius-md);
		border: 1px solid color-mix(in srgb, var(--color-border) 25%, transparent);
		background: var(--color-surface);
	}

	.move-label {
		margin-right: 4px;
		color: var(--ink-soft);
		font-size: 12px;
		font-weight: 700;
	}

	.move button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 32px;
		padding: 0 10px;
		border: 0;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		color: var(--ink);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
	}

	.move button:hover {
		background: var(--color-primary-tint);
	}

	.move .dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--dot);
	}

	.cta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		padding-top: 14px;
		border-top: 1px solid color-mix(in srgb, var(--color-border) 24%, transparent);
	}

	.primary,
	.round {
		position: relative;
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
		text-shadow: none;
	}

	.round {
		width: 48px;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--color-border) 45%, transparent);
		background: var(--color-surface-elevated);
		color: var(--color-text-primary);
		cursor: pointer;
	}

	.round.on {
		border-color: transparent;
		background: var(--color-primary-tint);
		color: var(--color-primary);
	}

	/* Etichetta dell'icona: appare con hover o focus, sopra il pulsante */
	.round[data-tip]::after {
		content: attr(data-tip);
		position: absolute;
		bottom: calc(100% + 8px);
		left: 50%;
		padding: 4px 9px;
		border-radius: var(--radius-sm);
		background: var(--color-text-primary);
		color: var(--color-surface-elevated);
		font-size: 12px;
		font-weight: 700;
		white-space: nowrap;
		text-shadow: none;
		opacity: 0;
		pointer-events: none;
		transform: translate(-50%, 4px);
		transition:
			opacity var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}

	.round:hover::after,
	.round:focus-visible::after {
		opacity: 1;
		transform: translate(-50%, 0);
	}

	.primary:hover {
		background: var(--color-primary-hover);
	}

	.round:hover {
		border-color: color-mix(in srgb, var(--color-primary) 42%, transparent);
		background: var(--color-primary-tint);
		color: var(--color-primary);
	}

	.round.on:hover {
		background: color-mix(in srgb, var(--color-primary) 18%, var(--color-surface-elevated));
	}

	.primary:active,
	.round:active {
		transform: scale(0.96);
	}

	.primary:focus-visible,
	.round:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 3px;
	}

	@media (prefers-reduced-motion: reduce) {
		.primary,
		.round,
		.round[data-tip]::after {
			transition: none;
		}
	}
</style>
