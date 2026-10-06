<script lang="ts">
	import { onMount } from 'svelte';
	import GenreShelf from '$lib/components/library/GenreShelf.svelte';
	import HomeHeader from '$lib/components/library/HomeHeader.svelte';
	import LibraryToolbar from '$lib/components/library/LibraryToolbar.svelte';
	import ReadingNow from '$lib/components/library/ReadingNow.svelte';
	import UpNextQueue from '$lib/components/library/UpNextQueue.svelte';
	import { HomeDnd } from '$lib/components/library/home-dnd.svelte';
	import { HomeState } from '$lib/components/library/home-state.svelte';
	import BookPreviewPopover from '$lib/components/library/BookPreviewPopover.svelte';
	import { HoverPreview } from '$lib/components/library/hover-preview.svelte';
	import {
		isLibrarySort,
		matchesQuery,
		normalizeQuery,
		sortBooks,
		type LibrarySort,
		type LibraryView
	} from '$lib/components/library/library-filter';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally
	const home = new HomeState(data.home);
	const dnd = new HomeDnd(home);
	const preview = new HoverPreview();

	// Dopo un invalidate() la risposta cambia: riallinea lo stato locale.
	// svelte-ignore state_referenced_locally
	let loaded = data.home;
	$effect(() => {
		if (data.home === loaded) return;
		loaded = data.home;
		home.apply(data.home);
	});

	// Messaggi di esito (spostamenti, errori): spariscono da soli.
	$effect(() => {
		if (!home.message) return;
		const timer = setTimeout(() => (home.message = ''), 4500);
		return () => clearTimeout(timer);
	});

	let query = $state('');
	let sort = $state<LibrarySort>('recent');
	let view = $state<LibraryView>('grid');

	// Ordinamento e vista sono preferenze del singolo browser.
	const PREFS_KEY = 'segnalibro:library-view';
	let prefsReady = false;
	onMount(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
			if (isLibrarySort(saved.sort)) sort = saved.sort;
			if (saved.view === 'grid' || saved.view === 'list') view = saved.view;
		} catch {
			// storage non disponibile: restano i valori di default
		}
		prefsReady = true;
	});
	$effect(() => {
		const prefs = JSON.stringify({ sort, view });
		if (!prefsReady) return;
		try {
			localStorage.setItem(PREFS_KEY, prefs);
		} catch {
			// ignorato
		}
	});

	const needle = $derived(normalizeQuery(query));
	const searching = $derived(needle !== '');
	const customized = $derived(searching || sort !== 'recent');

	// Ricerca e ordinamento lavorano sull'intera libreria, non solo sulla prima pagina degli scaffali.
	$effect(() => {
		if (customized) void home.loadAll();
	});

	const sections = $derived(
		home.shelves
			.map((shelf) => ({
				shelf,
				books: customized
					? sortBooks(
							shelf.books.filter((book) => matchesQuery(book, needle)),
							sort
						)
					: undefined
			}))
			.filter((section) => !searching || (section.books?.length ?? 0) > 0)
	);
	const resultCount = $derived(
		sections.reduce((total, section) => total + (section.books?.length ?? 0), 0)
	);
	const stillLoading = $derived(
		customized && home.shelves.some((shelf) => shelf.hasMore && !shelf.failed)
	);
</script>

<svelte:head><title>Libreria · Segnalibro</title></svelte:head>

<div class="home">
	<div class="top">
		<div class="toolbar"><LibraryToolbar bind:query bind:sort bind:view /></div>
		<div class="header"><HomeHeader name={data.user?.displayName ?? null} /></div>
	</div>

	{#if searching}
		<p class="results" role="status">
			{#if stillLoading}
				Cerco in tutta la libreria…
			{:else if resultCount === 0}
				Nessun libro trovato per «{query.trim()}».
			{:else}
				{resultCount}
				{resultCount === 1 ? 'libro trovato' : 'libri trovati'} per «{query.trim()}»
			{/if}
		</p>
	{:else}
		<div class="pinned">
			<ReadingNow items={home.reading} />
			<UpNextQueue {home} {dnd} {preview} />
		</div>
	{/if}

	<div class="shelves">
		{#each sections as section (section.shelf.genre.slug)}
			<GenreShelf shelf={section.shelf} books={section.books} {view} {home} {dnd} {preview} />
		{/each}
	</div>

	<BookPreviewPopover {preview} {home} {dnd} />

	<p class="toast" role="status" aria-live="polite" class:visible={home.message !== ''}>
		{home.message}
	</p>
</div>

<style>
	.home {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 22px;
		padding: 20px 14px 28px;
	}

	.top {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	/* Mobile: prima il titolo, poi gli strumenti */
	.header {
		order: -1;
	}

	.pinned,
	.shelves {
		display: flex;
		flex-direction: column;
		gap: 22px;
	}

	.results {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 15px;
		font-weight: 600;
	}

	.toast {
		position: fixed;
		z-index: var(--z-overlay);
		left: 50%;
		bottom: calc(var(--nav-height) + 12px + env(safe-area-inset-bottom, 0px));
		max-width: min(92vw, 420px);
		margin: 0;
		padding: 10px 16px;
		border-radius: var(--radius-pill);
		background: var(--color-text-primary);
		box-shadow: var(--shadow-button);
		color: var(--color-background);
		font-size: 13px;
		font-weight: 600;
		opacity: 0;
		pointer-events: none;
		transform: translate(-50%, 8px);
		transition:
			opacity var(--duration-base) var(--ease-out),
			transform var(--duration-base) var(--ease-out);
	}

	.toast.visible {
		opacity: 1;
		transform: translate(-50%, 0);
	}

	@media (min-width: 1024px) {
		.home {
			gap: 28px;
			padding: 24px 32px 40px;
		}

		.top {
			gap: 28px;
		}

		.header {
			order: 0;
		}

		.pinned {
			gap: 28px;
		}

		.shelves {
			gap: 26px;
		}

		.toast {
			bottom: 28px;
		}
	}
</style>
