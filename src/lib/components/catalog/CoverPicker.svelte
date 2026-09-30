<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import CoverImage from './CoverImage.svelte';
	import {
		CatalogClientError,
		fetchCoverAlternatives,
		selectCover,
		uploadCover
	} from '$lib/catalog/client';
	import { coverSrc } from '$lib/catalog/covers';
	import { CoverFileError, prepareCoverFile } from '$lib/catalog/image';
	import type { CoverAlternative } from '$lib/catalog/schemas';

	interface Props {
		bookId: string;
		cover: { coverUrl: string | null; coverStoragePath: string | null };
		onchanged?: () => void;
		/** Facoltativo: apertura controllata dall'esterno (per default il componente ha il proprio pulsante). */
		open?: boolean;
		/** Facoltativo: nasconde il pulsante "Cambia copertina" se l'apertura è gestita dal chiamante. */
		showTrigger?: boolean;
	}

	let { bookId, cover, onchanged, open = $bindable(false), showTrigger = true }: Props = $props();

	let current = $derived({ coverUrl: cover.coverUrl, coverStoragePath: cover.coverStoragePath });

	let alternatives = $state<CoverAlternative[]>([]);
	let loadingAlternatives = $state(false);
	let alternativesError = $state('');
	let degraded = $state(false);
	let busy = $state<'upload' | 'provider' | 'remove' | null>(null);
	let message = $state('');
	let messageKind = $state<'error' | 'ok'>('error');
	let confirmRemove = $state(false);

	const uid = $props.id();
	let controller: AbortController | undefined;

	const preview = $derived(coverSrc(current));
	const source = $derived(
		current.coverStoragePath ? 'personalizzata' : current.coverUrl ? 'dal catalogo' : 'nessuna'
	);

	async function loadAlternatives() {
		controller?.abort();
		controller = new AbortController();
		loadingAlternatives = true;
		alternativesError = '';
		try {
			const result = await fetchCoverAlternatives(bookId, controller.signal);
			alternatives = result.alternatives;
			degraded = result.degraded;
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return;
			alternatives = [];
			alternativesError =
				error instanceof CatalogClientError
					? error.message
					: 'Non riesco a cercare altre copertine.';
		} finally {
			loadingAlternatives = false;
		}
	}

	$effect(() => {
		if (open) {
			message = '';
			loadAlternatives();
		} else {
			controller?.abort();
		}
	});

	async function changed(
		state: { coverUrl: string | null; coverStoragePath: string | null },
		text: string
	) {
		current = state;
		messageKind = 'ok';
		message = text;
		onchanged?.();
		try {
			await invalidateAll();
		} catch {
			// la pagina si aggiorna alla prossima navigazione
		}
	}

	function fail(error: unknown) {
		messageKind = 'error';
		message =
			error instanceof CatalogClientError || error instanceof CoverFileError
				? error.message
				: 'Qualcosa è andato storto, riprova.';
	}

	async function onFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = ''; // permette di scegliere di nuovo lo stesso file
		if (!file || busy) return;

		busy = 'upload';
		message = '';
		try {
			const ready = await prepareCoverFile(file);
			await changed(await uploadCover(bookId, ready), 'Copertina aggiornata.');
		} catch (error) {
			fail(error);
		} finally {
			busy = null;
		}
	}

	async function useAlternative(item: CoverAlternative) {
		if (busy) return;
		busy = 'provider';
		message = '';
		try {
			const state = await selectCover({ action: 'provider', bookId, coverUrl: item.url });
			await changed(state, 'Copertina aggiornata.');
		} catch (error) {
			fail(error);
		} finally {
			busy = null;
		}
	}

	async function removeCustom() {
		busy = 'remove';
		message = '';
		try {
			const state = await selectCover({ action: 'remove-custom', bookId });
			confirmRemove = false;
			await changed(state, 'Copertina personalizzata rimossa.');
		} catch (error) {
			confirmRemove = false;
			fail(error);
		} finally {
			busy = null;
		}
	}

	function dropAlternative(url: string) {
		alternatives = alternatives.filter((item) => item.url !== url);
	}
</script>

{#if showTrigger}
	<Button variant="secondary" size="sm" onclick={() => (open = true)}>
		{#snippet icon()}<Icon name="image" size={18} />{/snippet}
		Cambia copertina
	</Button>
{/if}

<BottomSheet
	{open}
	title="Cambia copertina"
	subtitle="Scegli l’immagine che preferisci"
	onclose={() => (open = false)}
>
	<div class="current">
		<CoverImage src={preview} width={96} height={144} alt="Copertina attuale" eager />
		<p class="current-label">Copertina attuale: <strong>{source}</strong></p>
	</div>

	{#if message}
		<p class="message {messageKind}" role={messageKind === 'error' ? 'alert' : 'status'}>
			{message}
		</p>
	{/if}

	<div class="actions">
		<label class="row" class:busy={busy === 'upload'}>
			<span class="tile"><Icon name="image" size={22} /></span>
			<span class="row-label">Scegli dalla galleria</span>
			<input
				class="file"
				type="file"
				accept="image/png,image/jpeg,image/webp"
				disabled={busy !== null}
				onchange={onFile}
				aria-label="Scegli un’immagine dalla galleria"
			/>
		</label>
		<label class="row" class:busy={busy === 'upload'}>
			<span class="tile"><Icon name="camera" size={22} /></span>
			<span class="row-label">Scatta una foto</span>
			<input
				class="file"
				type="file"
				accept="image/png,image/jpeg,image/webp"
				capture="environment"
				disabled={busy !== null}
				onchange={onFile}
				aria-label="Scatta una foto della copertina"
			/>
		</label>
	</div>
	<p class="limits">PNG, JPEG o WebP, fino a 5 MB.</p>

	<h3 class="section" id="{uid}-alt">Altre copertine trovate</h3>
	<div aria-labelledby="{uid}-alt" aria-busy={loadingAlternatives}>
		{#if loadingAlternatives}
			<div class="grid" aria-hidden="true">
				{#each [0, 1, 2, 3] as n (n)}<span class="thumb skeleton"></span>{/each}
			</div>
			<p class="sr-only" role="status">Cerco altre copertine…</p>
		{:else if alternativesError}
			<div class="note" role="alert">
				<p>{alternativesError}</p>
				<Button size="sm" variant="secondary" onclick={loadAlternatives}>Riprova</Button>
			</div>
		{:else if alternatives.length === 0}
			<p class="note-text">
				Non ho trovato altre copertine per questo libro. Puoi caricarne una tua.
			</p>
		{:else}
			<ul class="grid">
				{#each alternatives as item (item.url)}
					<li>
						<button
							class="thumb"
							type="button"
							disabled={busy !== null}
							aria-label={`Usa questa copertina (${item.label})`}
							onclick={() => useAlternative(item)}
							class:selected={current.coverUrl === item.url && !current.coverStoragePath}
						>
							<CoverImage
								src={item.url}
								width={72}
								height={108}
								onfail={() => dropAlternative(item.url)}
							/>
							<span class="thumb-label">{item.label}</span>
						</button>
					</li>
				{/each}
			</ul>
			{#if degraded}
				<p class="note-text">
					Uno dei servizi non ha risposto: potrebbero esserci altre copertine.
				</p>
			{/if}
		{/if}
	</div>

	{#if current.coverStoragePath}
		<button
			class="remove"
			type="button"
			disabled={busy !== null}
			onclick={() => (confirmRemove = true)}
		>
			Rimuovi cover personalizzata
		</button>
	{/if}

	{#snippet footer()}
		<Button variant="secondary" fullWidth onclick={() => (open = false)}>Chiudi</Button>
	{/snippet}
</BottomSheet>

<ConfirmDialog
	open={confirmRemove}
	title="Rimuovere la cover personalizzata?"
	description="Tornerai alla copertina del catalogo, se c’è. L’immagine caricata verrà eliminata."
	confirmLabel="Rimuovi"
	busy={busy === 'remove'}
	onconfirm={removeCustom}
	oncancel={() => (confirmRemove = false)}
/>

<style>
	.current {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		margin: 8px 0 14px;
	}

	.current-label {
		margin: 0;
		font-size: 13px;
		color: var(--color-text-secondary);
	}

	.current-label strong {
		color: var(--color-text-primary);
	}

	.message {
		margin: 0 0 12px;
		padding: 10px 14px;
		border-radius: 14px;
		font-size: 13.5px;
		font-weight: 600;
	}

	.message.error {
		background: color-mix(in srgb, var(--color-danger) 12%, transparent);
		color: var(--color-danger);
	}

	.message.ok {
		background: color-mix(in srgb, var(--color-success) 14%, transparent);
		color: var(--color-text-primary);
	}

	.actions {
		display: flex;
		flex-direction: column;
	}

	.row {
		position: relative;
		display: flex;
		align-items: center;
		gap: 14px;
		min-height: 60px;
		border-bottom: 1px solid var(--color-surface);
		cursor: pointer;
	}

	.row:last-child {
		border-bottom: 0;
	}

	.row:has(.file:focus-visible) {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
		border-radius: 14px;
	}

	.row.busy {
		opacity: 0.6;
		cursor: progress;
	}

	.file {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		cursor: pointer;
	}

	.tile {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 42px;
		height: 42px;
		border-radius: 14px;
		background: var(--color-surface);
		color: var(--color-primary);
	}

	.row-label {
		font-size: 16px;
		font-weight: 600;
	}

	.limits {
		margin: 4px 0 0;
		font-size: 12.5px;
		color: var(--color-text-secondary);
	}

	.section {
		margin: 20px 0 10px;
		font-size: 18px;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
		gap: 14px 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.thumb {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 6px 4px;
		border: 2px solid transparent;
		border-radius: 14px;
		background: transparent;
		color: var(--color-text-secondary);
	}

	.thumb.selected {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-accent) 30%, transparent);
	}

	.thumb-label {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		font-size: 11.5px;
		line-height: 1.25;
		text-align: center;
	}

	.skeleton {
		height: 130px;
		background: var(--color-surface);
		border-radius: 14px;
		animation: pulse 1.4s ease-in-out infinite;
	}

	@keyframes pulse {
		50% {
			opacity: 0.55;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.skeleton {
			animation: none;
		}
	}

	.note,
	.note-text {
		margin: 8px 0 0;
		font-size: 13.5px;
		color: var(--color-text-secondary);
	}

	.note p {
		margin: 0 0 8px;
	}

	.remove {
		display: block;
		width: 100%;
		min-height: var(--tap-size);
		margin-top: 16px;
		border: 0;
		background: transparent;
		font-size: 15px;
		font-weight: 700;
		color: var(--color-danger);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
