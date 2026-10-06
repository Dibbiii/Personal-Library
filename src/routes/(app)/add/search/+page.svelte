<script lang="ts">
	import { page } from '$app/state';
	import { buildAddHref, getAddContext } from '$lib/catalog/add-context';
	import AddBookConfirmSheet from '$lib/components/catalog/AddBookConfirmSheet.svelte';
	import BookSearch from '$lib/components/catalog/BookSearch.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { draftFromCandidate, type BookDraft } from '$lib/catalog/draft';
	import type { EditionCandidate } from '$lib/contracts/books';

	const context = $derived(getAddContext(page.url));

	let draft = $state<BookDraft | null>(null);
	let sheetOpen = $state(false);
	const initialQuery = $derived(page.url.searchParams.get('q') ?? '');

	// BookSearch è condiviso: arricchiamo qui i suoi link manuali, anche per apertura in nuova scheda.
	function contextualizeManualLinks(node: HTMLDivElement) {
		$effect(() => {
			const genre = context.genre;
			const origin = page.url.origin;
			function updateLinks() {
				for (const link of node.querySelectorAll<HTMLAnchorElement>('a[href]')) {
					const url = new URL(link.href);
					if (url.origin !== origin || url.pathname !== '/add/manual') continue;
					const href = buildAddHref('/add/manual', genre, url.searchParams);
					if (link.getAttribute('href') !== href) link.setAttribute('href', href);
				}
			}
			updateLinks();
			const observer = new MutationObserver(updateLinks);
			observer.observe(node, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ['href']
			});
			return () => observer.disconnect();
		});
	}

	function onselect(candidate: EditionCandidate, source: 'isbn' | 'search') {
		draft = draftFromCandidate(candidate, source);
		sheetOpen = true;
	}
</script>

<svelte:head><title>Cerca un libro · Segnalibro</title></svelte:head>

<div class="column">
	<PageHeader
		title="Cerca un libro"
		subtitle="Per titolo, autore o ISBN"
		backHref={context.backHref}
	/>
	<div class="content" use:contextualizeManualLinks>
		{#key initialQuery}
			<BookSearch {onselect} {initialQuery} />
		{/key}
	</div>
</div>

<AddBookConfirmSheet
	open={sheetOpen}
	{draft}
	initialGenre={context.genre}
	onclose={() => (sheetOpen = false)}
/>

<style>
	.column {
		max-width: 680px;
		margin-inline: auto;
		padding-bottom: 32px;
	}

	.content {
		padding: 4px var(--page-gutter) 0;
	}
</style>
