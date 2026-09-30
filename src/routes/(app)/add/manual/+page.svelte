<script lang="ts">
	import { page } from '$app/state';
	import AddBookConfirmSheet from '$lib/components/catalog/AddBookConfirmSheet.svelte';
	import ManualBookForm from '$lib/components/catalog/ManualBookForm.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import type { BookDraft } from '$lib/catalog/draft';

	let draft = $state<BookDraft | null>(null);
	let sheetOpen = $state(false);
	const initial = {
		title: page.url.searchParams.get('title') ?? '',
		isbn: page.url.searchParams.get('isbn') ?? ''
	};

	function onsubmit(next: BookDraft) {
		draft = next;
		sheetOpen = true;
	}
</script>

<svelte:head><title>Inserimento manuale · Segnalibro</title></svelte:head>

<div class="column">
	<PageHeader title="Aggiungi a mano" subtitle="Bastano titolo e autore" backHref="/add" />
	<div class="content">
		<ManualBookForm {initial} {onsubmit} />
	</div>
</div>

<AddBookConfirmSheet open={sheetOpen} {draft} onclose={() => (sheetOpen = false)} />

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
