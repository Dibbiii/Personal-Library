<script lang="ts">
	import type { BookSummary } from '$lib/contracts';
	import BookSpine from '$lib/components/book/BookSpine.svelte';
	import Decoration from '$lib/components/library/Decoration.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	interface Props {
		book: BookSummary;
		queuePosition: number | null;
	}

	/** "Nella mia libreria" (mockup dettaglio): il dorso del libro sul suo scaffale + dettagli. */
	let { book, queuePosition }: Props = $props();

	const FORMAT_LABELS = { physical: 'Cartaceo', digital: 'Digitale' } as const;
	const STATE_LABELS = {
		unread: 'Da leggere',
		reading: 'In lettura',
		paused: 'In pausa',
		finished: 'Letto',
		dnf: 'Non finito'
	} as const;
	const LANGUAGES: Record<string, string> = {
		it: 'Italiano',
		en: 'Inglese',
		fr: 'Francese',
		es: 'Spagnolo',
		de: 'Tedesco'
	};
	const dateFormat = new Intl.DateTimeFormat('it-IT', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});

	const placeState = $derived(
		queuePosition !== null && book.lifecycleState === 'unread'
			? `Prossimo (${queuePosition}º)`
			: STATE_LABELS[book.lifecycleState]
	);
	const language = $derived(
		book.language ? (LANGUAGES[book.language.toLowerCase()] ?? book.language.toUpperCase()) : null
	);
</script>

<section class="card" aria-labelledby="place-title">
	<header>
		<h2 id="place-title">Nella mia libreria</h2>
		<a class="link" href="/genre/{book.genre.slug}">
			Scaffale
			<Icon name="arrow-right" size={16} strokeWidth={2.2} />
		</a>
	</header>

	<div class="shelf" aria-hidden="true">
		<div class="row">
			<Decoration kind="stack" />
			<BookSpine {book} />
			<Decoration kind="succulent" />
			<span class="state">{placeState}</span>
		</div>
		<div class="plank"></div>
	</div>

	<dl class="details">
		<div>
			<dt>Titolo</dt>
			<dd>{book.title}</dd>
		</div>
		<div>
			<dt>Autore</dt>
			<dd>{book.author}</dd>
		</div>
		<div>
			<dt>Genere</dt>
			<dd><a href="/genre/{book.genre.slug}">{book.genre.name}</a></dd>
		</div>
		<div>
			<dt>Formato</dt>
			<dd>{FORMAT_LABELS[book.format]}</dd>
		</div>
		{#if book.pageCount}<div>
				<dt>Pagine</dt>
				<dd>{book.pageCount}</dd>
			</div>{/if}
		{#if language}<div>
				<dt>Lingua</dt>
				<dd>{language}</dd>
			</div>{/if}
		{#if book.series}
			<div>
				<dt>Serie</dt>
				<dd>
					{book.series.name}{#if book.series.number}
						({book.series.number}{book.series.total ? ` di ${book.series.total}` : ''}){/if}
				</dd>
			</div>
		{/if}
		{#if book.lastActivityAt}
			<div>
				<dt>Ultima attività</dt>
				<dd>{dateFormat.format(new Date(book.lastActivityAt))}</dd>
			</div>
		{/if}
	</dl>
</section>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 20px;
		border-radius: var(--radius-xl);
		background: var(--color-surface-elevated);
		box-shadow:
			0 0 0 1px color-mix(in srgb, var(--color-border) 18%, transparent),
			0 12px 30px -20px color-mix(in srgb, var(--color-shadow) 35%, transparent);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	h2 {
		margin: 0;
		color: var(--color-primary);
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 400;
	}

	.link,
	.details a {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--color-primary);
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}

	.link:hover,
	.details a:hover {
		text-decoration: underline;
	}

	.shelf {
		position: relative;
		padding: 14px 10px 0;
		border-radius: var(--radius-lg);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--color-surface) 50%, transparent),
			color-mix(in srgb, var(--color-surface) 90%, transparent)
		);
	}

	.row {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		min-height: 140px;
		pointer-events: none;
	}

	.state {
		align-self: center;
		margin-left: auto;
		padding: 5px 12px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		color: var(--color-primary);
		font-size: 12px;
		font-weight: 700;
	}

	.plank {
		height: 12px;
		margin: -4px -10px 0;
		border-radius: 3px 3px 6px 6px;
		background: var(--gradient-wood-detail);
		box-shadow:
			0 3px 0 -1px var(--color-wood-detail-bottom),
			0 10px 12px -8px color-mix(in srgb, var(--color-wood-ink) 50%, transparent);
	}

	.details {
		display: flex;
		flex-direction: column;
		margin: 0;
	}

	.details > div {
		display: grid;
		grid-template-columns: 120px minmax(0, 1fr);
		gap: 12px;
		padding: 8px 0;
		border-bottom: 1px solid color-mix(in srgb, var(--color-border) 25%, transparent);
		font-size: 13.5px;
	}

	.details > div:last-child {
		border-bottom: 0;
	}

	.details dt {
		color: var(--color-text-secondary);
	}

	.details dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
</style>
