<script lang="ts">
	import { draggable } from '$lib/actions/drag';
	import BookCover from '$lib/components/book/BookCover.svelte';
	import BookSpine from '$lib/components/book/BookSpine.svelte';
	import { layoutShelf } from '$lib/book/shelf-layout';
	import { getThemeController } from '$lib/themes/controller.svelte';
	import { GENRE_LABELS } from '$lib/genres';
	import { buildAddHref } from '$lib/catalog/add-context';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Decoration from './Decoration.svelte';
	import ShelfFrame from './ShelfFrame.svelte';
	import type { HomeState, ShelfState } from './home-state.svelte';
	import type { HomeDnd } from './home-dnd.svelte';

	interface Props {
		shelf: ShelfState;
		home: HomeState;
		dnd: HomeDnd;
	}

	let { shelf, home, dnd }: Props = $props();

	const theme = getThemeController();
	const slug = $derived(shelf.genre.slug);
	const items = $derived(
		layoutShelf({
			books: shelf.books,
			genre: slug,
			queuedIds: home.queuedIds,
			themeKey: theme?.key
		})
	);

	let scroller = $state<HTMLElement | null>(null);
	let sentinel = $state<HTMLElement | null>(null);

	// Paginazione keyset: quando la coda dello scaffale entra in vista, carica altri libri.
	$effect(() => {
		void shelf.books.length;
		if (!scroller || !sentinel || !shelf.hasMore || shelf.failed) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) void home.loadMore(slug);
			},
			{ root: scroller, rootMargin: '0px 320px 0px 320px' }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	});
</script>

<ShelfFrame
	title={GENRE_LABELS[slug]}
	href="/genre/{slug}"
	addHref={buildAddHref('/add', slug)}
	addLabel="Aggiungi un libro a {GENRE_LABELS[slug]}"
	accent="var(--genre-{slug})"
	genre={slug}
	woodBackdrop={false}
	target={dnd.hover === `genre:${slug}`}
	zone={dnd.genreZone(slug)}
	label="Scaffale {GENRE_LABELS[slug]}, {shelf.totalCount} {shelf.totalCount === 1
		? 'libro'
		: 'libri'}"
	bind:scroller
>
	{#each items as item (item.key)}
		{#if item.kind === 'deco'}
			<Decoration kind={item.deco} />
		{:else}
			<div
				class="item"
				class:source={dnd.draggingId === item.book.id}
				class:cover={item.kind === 'cover'}
				style:--pw={item.kind === 'spine' ? `${item.spec.spine.width}px` : '84px'}
				style:--ph={item.kind === 'spine' ? `${item.spec.spine.height}px` : '124px'}
				use:draggable={dnd.source({ kind: 'shelf-book', book: item.book })}
			>
				{#if item.kind === 'spine'}
					<BookSpine
						book={item.book}
						spec={item.spec}
						badge={item.status}
						lean={item.lean}
						href="/book/{item.book.id}"
					/>
				{:else}
					<a
						class="cover-link"
						href="/book/{item.book.id}"
						aria-label="{item.book.title}, di {item.book.author}"
					>
						<BookCover
							book={item.book}
							size="md"
							badge={item.status}
							showFormat
							noImage={item.noImage}
						/>
					</a>
				{/if}
			</div>
		{/if}
	{:else}
		<a
			class="empty"
			href={buildAddHref('/add', slug)}
			aria-label="Aggiungi un libro a {GENRE_LABELS[slug]}, scaffale vuoto"
		>
			<Icon name="book-plus" size={22} strokeWidth={2} />
			<span>Scaffale<br />vuoto</span>
		</a>
		<Decoration
			kind={slug === 'classics' || slug === 'fantasy-magical-gothic' ? 'plant' : 'candle'}
		/>
	{/each}

	{#if shelf.hasMore}
		<div class="sentinel" bind:this={sentinel}>
			{#if shelf.failed}
				<button type="button" onclick={() => home.loadMore(slug)}>Riprova</button>
			{:else if shelf.loading}
				<span class="loading" role="status" aria-label="Carico altri libri"></span>
			{/if}
		</div>
	{/if}
</ShelfFrame>

<style>
	.item {
		position: relative;
		display: flex;
		flex: none;
		touch-action: pan-x pan-y;
		-webkit-touch-callout: none;
		user-select: none;
	}

	.item.cover {
		margin: 0 8px;
	}

	.cover-link {
		display: block;
		border-radius: 3px 8px 8px 3px;
		color: inherit;
		text-decoration: none;
		-webkit-touch-callout: none;
	}

	/* Origine del drag: il libro sparisce e resta il segnaposto tratteggiato della stessa misura */
	.item.source > :global(*) {
		visibility: hidden;
	}

	.item.source::after {
		content: '';
		position: absolute;
		inset: 0;
		box-sizing: border-box;
		width: var(--pw);
		height: var(--ph);
		border: 2px dashed color-mix(in srgb, var(--g-dark) 55%, transparent);
		border-radius: 3px;
		background: color-mix(in srgb, var(--g) 14%, transparent);
	}

	.empty {
		display: flex;
		flex: none;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		box-sizing: border-box;
		width: 72px;
		height: 108px;
		margin: 0 8px;
		border: 2px dashed color-mix(in srgb, var(--color-divider) 70%, transparent);
		border-radius: 8px;
		background: color-mix(in srgb, var(--color-divider) 10%, transparent);
		color: var(--color-shelf-axis);
		font-size: 11px;
		font-weight: 600;
		line-height: 13px;
		text-align: center;
		text-decoration: none;
	}

	.empty:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 3px;
	}

	.sentinel {
		display: flex;
		flex: none;
		align-items: center;
		justify-content: center;
		align-self: center;
		width: 48px;
		height: 48px;
	}

	.sentinel button {
		padding: 6px 10px;
		border: 0;
		border-radius: 999px;
		background: var(--color-surface);
		font-size: 12px;
		font-weight: 700;
	}

	.loading {
		width: 18px;
		height: 18px;
		box-sizing: border-box;
		border: 2px solid color-mix(in srgb, var(--g) 35%, transparent);
		border-top-color: var(--g);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
