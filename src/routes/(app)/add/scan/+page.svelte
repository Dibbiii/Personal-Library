<script lang="ts">
	import AddBookConfirmSheet from '$lib/components/catalog/AddBookConfirmSheet.svelte';
	import BookSearchResult from '$lib/components/catalog/BookSearchResult.svelte';
	import ISBNScanner from '$lib/components/catalog/ISBNScanner.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { CatalogClientError, lookupIsbn } from '$lib/catalog/client';
	import { draftFromCandidate, type BookDraft } from '$lib/catalog/draft';
	import type { EditionCandidate } from '$lib/contracts/books';

	type Phase = 'scan' | 'lookup' | 'results' | 'notfound' | 'error';

	let phase = $state<Phase>('scan');
	let isbn = $state('');
	let candidates = $state<EditionCandidate[]>([]);
	let degraded = $state(false);
	let errorMessage = $state('');
	let draft = $state<BookDraft | null>(null);
	let sheetOpen = $state(false);

	async function onscan(code: string) {
		isbn = code;
		phase = 'lookup';
		errorMessage = '';
		try {
			const response = await lookupIsbn(code);
			candidates = response.candidates;
			degraded = response.degraded;

			if (candidates.length === 0) {
				phase = 'notfound';
				return;
			}
			phase = 'results';
			// Preselezione solo con ISBN identico: l'utente conferma comunque nello sheet.
			const best = candidates[0];
			if (response.exactMatch && best) choose(best);
		} catch (error) {
			errorMessage =
				error instanceof CatalogClientError ? error.message : 'Non riesco a cercare questo ISBN.';
			phase = 'error';
		}
	}

	function choose(candidate: EditionCandidate) {
		draft = draftFromCandidate(candidate, 'isbn');
		sheetOpen = true;
	}

	function again() {
		sheetOpen = false;
		phase = 'scan';
	}
</script>

<svelte:head><title>Scansiona ISBN · Segnalibro</title></svelte:head>

<div class="column">
	<PageHeader
		title="Scansiona ISBN"
		subtitle="Il codice a barre sul retro del libro"
		backHref="/add"
	/>

	<div class="content">
		{#if phase === 'scan'}
			<ISBNScanner {onscan} />
		{:else if phase === 'lookup'}
			<p class="status" role="status" aria-live="polite">
				<span class="spinner" aria-hidden="true"></span>
				Cerco l’ISBN {isbn}…
			</p>
		{:else if phase === 'results'}
			<p class="status-line" role="status">
				ISBN <strong>{isbn}</strong>
			</p>
			{#if degraded}
				<p class="inline-note">
					Uno dei servizi non ha risposto: i dati potrebbero essere incompleti.
				</p>
			{/if}
			<ul class="list">
				{#each candidates as candidate, index (candidate.isbn13 ?? candidate.providerIds.googleBooksId ?? index)}
					<li><BookSearchResult {candidate} onselect={choose} /></li>
				{/each}
			</ul>
			<div class="actions">
				<Button variant="secondary" fullWidth onclick={again}>Scansiona un altro libro</Button>
				<Button variant="ghost" fullWidth href={`/add/manual?isbn=${encodeURIComponent(isbn)}`}>
					Non è questo: inserisci a mano
				</Button>
			</div>
		{:else if phase === 'notfound'}
			<div class="notice" role="status">
				<h2>Non trovo questo ISBN</h2>
				<p>
					L’ISBN <strong>{isbn}</strong> non è nei cataloghi che consulto. Puoi aggiungerlo a mano: lo
					conserverò insieme al libro.
				</p>
				<div class="actions">
					<Button fullWidth href={`/add/manual?isbn=${encodeURIComponent(isbn)}`}
						>Inserisci a mano</Button
					>
					<Button variant="secondary" fullWidth onclick={again}>Scansiona di nuovo</Button>
				</div>
			</div>
		{:else}
			<div class="notice" role="alert">
				<h2>Ricerca non riuscita</h2>
				<p>{errorMessage}</p>
				<div class="actions">
					<Button fullWidth onclick={() => onscan(isbn)}>Riprova</Button>
					<Button
						variant="secondary"
						fullWidth
						href={`/add/manual?isbn=${encodeURIComponent(isbn)}`}
					>
						Inserisci a mano con questo ISBN
					</Button>
					<Button variant="ghost" fullWidth onclick={again}>Scansiona di nuovo</Button>
				</div>
			</div>
		{/if}
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

	.list {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.status,
	.status-line {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 0 0 14px;
		font-size: 14px;
		color: var(--color-text-secondary);
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2.5px solid var(--color-divider);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation-duration: 2.4s;
		}
	}

	.inline-note {
		margin: 0 0 12px;
		padding: 10px 14px;
		border-radius: 14px;
		background: var(--color-info-tint);
		font-size: 13px;
	}

	.notice {
		padding: 22px;
		border-radius: var(--radius-xl);
		background: var(--color-surface);
	}

	.notice h2 {
		font-size: 21px;
		line-height: 1.2;
	}

	.notice p {
		margin: 8px 0 16px;
		font-size: 14px;
		line-height: 1.45;
		color: var(--color-text-secondary);
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 18px;
	}

	.notice .actions {
		margin-top: 0;
	}
</style>
