<script lang="ts">
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { classifyPageUpdate, progressPercent } from '$lib/client/reading-logic';
	import ProgressBar from './ProgressBar.svelte';

	interface Props {
		open: boolean;
		title: string;
		currentPage: number;
		pageCount: number | null;
		busy?: boolean;
		error?: string | null;
		offline?: boolean;
		onclose: () => void;
		onsubmit: (page: number, operation: 'progress' | 'correction') => void;
		onfinish: () => void;
		ondnf: (page: number) => void;
	}

	let {
		open,
		title,
		currentPage,
		pageCount,
		busy = false,
		error = null,
		offline = false,
		onclose,
		onsubmit,
		onfinish,
		ondnf
	}: Props = $props();

	const uid = $props.id();
	let value = $state<number | null>(0);

	$effect(() => {
		if (open) value = currentPage;
	});

	const next = $derived(value === null ? Number.NaN : value);
	const update = $derived(classifyPageUpdate(currentPage, next, pageCount));
	const percent = $derived(progressPercent(Number.isFinite(next) ? next : currentPage, pageCount));
	const invalidText = $derived(
		update.kind === 'invalid'
			? update.reason === 'beyond-total'
				? `Il libro ha ${pageCount} pagine.`
				: 'Inserisci un numero di pagina intero.'
			: null
	);

	function step(delta: number) {
		const base = Number.isFinite(next) ? next : currentPage;
		const max = pageCount ?? Number.MAX_SAFE_INTEGER;
		value = Math.max(0, Math.min(max, base + delta));
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (update.kind === 'progress' || update.kind === 'correction') {
			onsubmit(next, update.kind);
		}
	}
</script>

<BottomSheet {open} {title} subtitle="Aggiorna la pagina" {onclose}>
	<form id="{uid}-form" onsubmit={submit}>
		<p class="delta" aria-live="polite">
			<span>p. {currentPage}</span>
			<span aria-hidden="true">→</span>
			<strong>p. {Number.isFinite(next) ? next : '–'}</strong>
			{#if pageCount}<span class="of">di {pageCount}</span>{/if}
		</p>

		<div class="stepper">
			<button type="button" class="step" aria-label="Una pagina in meno" onclick={() => step(-1)}>
				<span aria-hidden="true">−</span>
			</button>
			<label class="field" for="{uid}-page">
				<span class="sr-only">Pagina raggiunta</span>
				<input
					id="{uid}-page"
					type="number"
					inputmode="numeric"
					min="0"
					max={pageCount ?? undefined}
					step="1"
					bind:value
					aria-invalid={invalidText ? 'true' : undefined}
					aria-describedby="{uid}-note"
				/>
			</label>
			<button type="button" class="step" aria-label="Una pagina in più" onclick={() => step(1)}>
				<span aria-hidden="true">+</span>
			</button>
		</div>

		<div class="quick" role="group" aria-label="Avanza di più pagine">
			{#each [10, 25, 50] as amount (amount)}
				<button type="button" onclick={() => step(amount)}>+{amount}</button>
			{/each}
		</div>

		<ProgressBar {percent} track="surface" label="Avanzamento dopo l'aggiornamento" />
		<p class="percent">{percent !== null ? `${percent}%` : 'Totale pagine non noto'}</p>

		<p id="{uid}-note" class="note" class:warn={update.kind === 'correction'}>
			{#if invalidText}
				{invalidText}
			{:else if update.kind === 'correction'}
				Stai correggendo il totale: la pagina scende da {currentPage} a {next}. Non conta come
				lettura negativa, sistema solo quanto avevi segnato.
			{:else if update.kind === 'progress'}
				{update.delta === 1 ? '1 pagina' : `${update.delta} pagine`} in più rispetto all'ultimo aggiornamento.
			{:else}
				Sposta il numero per registrare dove sei arrivato.
			{/if}
		</p>

		{#if offline}
			<p class="offline" role="status">
				Sei offline: l'aggiornamento resta in coda e si sincronizza quando torni online.
			</p>
		{/if}
		{#if error}<p class="error" role="alert">{error}</p>{/if}

		<div class="main-actions">
			<Button variant="secondary" size="lg" disabled={busy} onclick={onclose}>Annulla</Button>
			<Button
				type="submit"
				size="lg"
				loading={busy}
				disabled={update.kind !== 'progress' && update.kind !== 'correction'}
			>
				{update.kind === 'correction' ? 'Correggi pagina' : 'Salva pagina'}
			</Button>
		</div>
	</form>

	<div class="close-actions">
		<Button variant="ghost" size="sm" disabled={busy} onclick={onfinish}>
			<Icon name="check" size={18} strokeWidth={2.4} />
			Ho finito
		</Button>
		<Button
			variant="ghost"
			size="sm"
			disabled={busy || update.kind === 'invalid' || !Number.isFinite(next)}
			onclick={() => ondnf(next)}
		>
			Non finito a p. {Number.isFinite(next) ? next : '–'}
		</Button>
	</div>
</BottomSheet>

<style>
	.delta {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin: 6px 0 14px;
		font-family: var(--font-display);
		font-size: 24px;
		color: var(--color-text-secondary);
	}

	.delta strong {
		font-weight: 400;
		color: var(--color-primary);
	}

	.of {
		font-family: var(--font-ui);
		font-size: 13px;
	}

	.stepper {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
	}

	.step {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 52px;
		height: 52px;
		border: 0;
		border-radius: 50%;
		background: var(--color-surface);
		color: var(--color-primary);
		font-family: var(--font-ui);
		font-size: 26px;
		font-weight: 600;
		cursor: pointer;
	}

	.field input {
		box-sizing: border-box;
		width: 120px;
		min-height: 52px;
		border: 1.5px solid var(--color-border);
		border-radius: 16px;
		background: var(--color-surface-elevated);
		color: var(--color-text-primary);
		font-family: var(--font-ui);
		font-size: 22px;
		font-weight: 700;
		text-align: center;
	}

	.field input[aria-invalid='true'] {
		border-color: var(--color-danger);
	}

	.quick {
		display: flex;
		justify-content: center;
		gap: 8px;
		margin: 12px 0 16px;
	}

	.quick button {
		min-width: 64px;
		min-height: var(--tap-size);
		border: 1.5px solid var(--color-primary-outline);
		border-radius: 22px;
		background: transparent;
		color: var(--color-primary);
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
	}

	.percent {
		margin: 6px 0 0;
		font-size: 12.5px;
		font-weight: 700;
		color: var(--color-text-secondary);
		text-align: right;
	}

	.note {
		margin: 8px 0 0;
		font-size: 13px;
		line-height: 18px;
		color: var(--color-text-secondary);
	}

	.note.warn {
		color: var(--color-primary);
		font-weight: 600;
	}

	.offline {
		margin: 10px 0 0;
		padding: 10px 12px;
		border-radius: 12px;
		background: var(--color-surface);
		font-size: 13px;
		line-height: 18px;
	}

	.error {
		margin: 10px 0 0;
		font-size: 13px;
		color: var(--color-danger);
	}

	.main-actions {
		display: flex;
		gap: 10px;
		margin-top: 16px;
	}

	.main-actions > :global(*) {
		flex: 1;
	}

	.close-actions {
		display: flex;
		justify-content: center;
		gap: 4px;
		margin-top: 8px;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
