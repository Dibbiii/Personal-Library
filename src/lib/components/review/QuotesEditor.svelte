<script lang="ts">
	import type { Quote } from '$lib/contracts/reviews';
	import Button from '$lib/components/ui/Button.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import {
		QUOTE_BODY_MAX,
		QUOTE_ERROR_MESSAGES,
		parseQuoteForm,
		sortQuotes
	} from '$lib/review/quotes';
	import { ReviewApiError, addQuoteRequest, deleteQuoteRequest, updateQuoteRequest } from './api';
	import ReviewCard from './ReviewCard.svelte';

	interface Props {
		bookId: string;
		quotes: Quote[];
		onchange: (quotes: Quote[]) => void;
	}

	let { bookId, quotes, onchange }: Props = $props();

	const uid = $props.id();

	/** `null` = form chiuso, `'new'` = nuova citazione, altrimenti l'id della citazione in modifica. */
	let editing = $state<string | 'new' | null>(null);
	let body = $state('');
	let page = $state('');
	let formError = $state<string | null>(null);
	let busy = $state(false);
	let pendingDelete = $state<Quote | null>(null);
	let deleteBusy = $state(false);
	let listError = $state<string | null>(null);
	let bodyField = $state<HTMLTextAreaElement>();

	function openNew() {
		editing = 'new';
		body = '';
		page = '';
		formError = null;
		queueMicrotask(() => bodyField?.focus());
	}

	function openEdit(quote: Quote) {
		editing = quote.id;
		body = quote.body;
		page = quote.page === null ? '' : String(quote.page);
		formError = null;
		queueMicrotask(() => bodyField?.focus());
	}

	function close() {
		editing = null;
		formError = null;
	}

	function messageOf(error: unknown): string {
		return error instanceof ReviewApiError ? error.message : 'Qualcosa è andato storto. Riprova.';
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (busy || editing === null) return;
		const parsed = parseQuoteForm(body, page);
		if (!parsed.ok) {
			formError = QUOTE_ERROR_MESSAGES[parsed.error];
			return;
		}
		busy = true;
		formError = null;
		try {
			if (editing === 'new') {
				const created = await addQuoteRequest({ bookId, body: parsed.body, page: parsed.page });
				onchange(sortQuotes([created, ...quotes]));
			} else {
				const id = editing;
				const updated = await updateQuoteRequest(id, { body: parsed.body, page: parsed.page });
				onchange(quotes.map((q) => (q.id === id ? updated : q)));
			}
			close();
		} catch (error) {
			formError = messageOf(error);
		} finally {
			busy = false;
		}
	}

	async function confirmDelete() {
		const target = pendingDelete;
		if (!target) return;
		deleteBusy = true;
		listError = null;
		try {
			await deleteQuoteRequest(target.id);
			onchange(quotes.filter((q) => q.id !== target.id));
			pendingDelete = null;
		} catch (error) {
			pendingDelete = null;
			listError = messageOf(error);
		} finally {
			deleteBusy = false;
		}
	}
</script>

{#snippet form()}
	<form class="form" onsubmit={submit} novalidate>
		<label class="field" for="{uid}-body">
			<span>Testo della citazione</span>
			<textarea
				id="{uid}-body"
				bind:this={bodyField}
				bind:value={body}
				rows="4"
				maxlength={QUOTE_BODY_MAX}
				placeholder="Copia qui la frase che ti è rimasta addosso"
				aria-invalid={formError !== null}></textarea>
		</label>
		<label class="field page" for="{uid}-page">
			<span>Pagina (facoltativa)</span>
			<input
				id="{uid}-page"
				bind:value={page}
				type="text"
				inputmode="numeric"
				autocomplete="off"
				maxlength="5"
				placeholder="Es. 48"
			/>
		</label>
		{#if formError}<p class="error" role="alert">{formError}</p>{/if}
		<div class="actions">
			<Button variant="secondary" size="sm" disabled={busy} onclick={close}>Annulla</Button>
			<Button type="submit" size="sm" loading={busy}>Salva</Button>
		</div>
	</form>
{/snippet}

<ReviewCard title="Citazioni preferite">
	{#if quotes.length === 0 && editing !== 'new'}
		<p class="empty">Ancora nessuna citazione: aggiungi la frase che vuoi ricordare.</p>
	{/if}

	{#if listError}<p class="error" role="alert">{listError}</p>{/if}

	<ul class="list">
		{#each quotes as quote (quote.id)}
			<li class="quote" data-testid="quote-item">
				{#if editing === quote.id}
					<div class="editing">{@render form()}</div>
				{:else}
					<span class="mark"><Icon name="quote" size={22} strokeWidth={1.9} /></span>
					<div class="content">
						<blockquote>«{quote.body}»</blockquote>
						<div class="meta">
							{#if quote.page !== null}<span class="page">p. {quote.page}</span>{/if}
							<span class="tools">
								<button
									type="button"
									class="tool"
									aria-label="Modifica citazione"
									onclick={() => openEdit(quote)}
								>
									<Icon name="pencil" size={18} />
								</button>
								<button
									type="button"
									class="tool"
									aria-label="Elimina citazione"
									onclick={() => (pendingDelete = quote)}
								>
									<Icon name="trash" size={18} />
								</button>
							</span>
						</div>
					</div>
				{/if}
			</li>
		{/each}
	</ul>

	{#if editing === 'new'}
		<div class="quote new">{@render form()}</div>
	{:else}
		<button type="button" class="add" onclick={openNew}>
			<Icon name="plus" size={18} strokeWidth={2.2} />
			Aggiungi citazione
		</button>
	{/if}
</ReviewCard>

<ConfirmDialog
	open={pendingDelete !== null}
	title="Eliminare la citazione?"
	description="La frase verrà rimossa da questo libro. Non si può annullare."
	confirmLabel="Elimina"
	busy={deleteBusy}
	onconfirm={confirmDelete}
	oncancel={() => (pendingDelete = null)}
/>

<style>
	.list {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.list:not(:empty) {
		margin-bottom: 10px;
	}

	.quote {
		display: flex;
		gap: 10px;
		box-sizing: border-box;
		padding: 14px;
		border-radius: 14px;
		background: var(--color-background);
	}

	.quote.new {
		margin-bottom: 0;
	}

	.editing {
		flex: 1;
		min-width: 0;
	}

	.mark {
		display: inline-flex;
		flex-shrink: 0;
		color: var(--genre-current);
	}

	.content {
		flex: 1;
		min-width: 0;
	}

	blockquote {
		margin: 0;
		font-family: var(--font-display);
		font-size: 15px;
		line-height: 21px;
		color: var(--color-text-primary);
		overflow-wrap: anywhere;
		white-space: pre-line;
	}

	.meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-top: 8px;
	}

	.page {
		display: inline-flex;
		align-items: center;
		height: 26px;
		padding: 0 12px;
		border-radius: 13px;
		background: var(--color-info-tint);
		color: var(--color-info);
		font-size: 12px;
		font-weight: 600;
	}

	.tools {
		display: inline-flex;
		margin: -8px -10px -8px auto;
	}

	.tool {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--tap-size);
		height: var(--tap-size);
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: var(--color-text-secondary);
		cursor: pointer;
	}

	.add {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		box-sizing: border-box;
		width: 100%;
		height: 46px;
		border: 1.5px dashed color-mix(in srgb, var(--color-primary) 40%, transparent);
		border-radius: 14px;
		background: transparent;
		color: var(--color-primary);
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
	}

	.empty {
		margin: 0 0 12px;
		font-size: 14px;
		line-height: 20px;
		color: var(--color-text-secondary);
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	textarea,
	input {
		box-sizing: border-box;
		width: 100%;
		padding: 10px 12px;
		border: 1.5px solid color-mix(in srgb, var(--genre-current-dark) 35%, transparent);
		border-radius: 12px;
		background: var(--color-surface-elevated);
		color: var(--color-text-primary);
		font-family: var(--font-display);
		font-size: 16px;
		line-height: 22px;
		resize: vertical;
	}

	input {
		font-family: var(--font-ui);
		min-height: var(--tap-size);
	}

	.page input {
		max-width: 140px;
	}

	.error {
		margin: 0 0 8px;
		font-size: 13px;
		font-weight: 600;
		color: var(--color-danger);
	}

	.form .error {
		margin: 0;
	}

	.actions {
		display: flex;
		gap: 10px;
		justify-content: flex-end;
	}
</style>
