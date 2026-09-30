<script module lang="ts">
	export type AddReadingChoice = 'now' | 'past';
</script>

<script lang="ts">
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { toLocalDate, validateDateRange } from '$lib/client/reading-logic';
	import DateRangeFields from './DateRangeFields.svelte';

	interface Props {
		open: boolean;
		title: string;
		/** Esiste già una lettura aperta: non se ne può iniziare un'altra. */
		hasOpenReading: boolean;
		busy?: boolean;
		error?: string | null;
		onclose: () => void;
		onsave: (choice: AddReadingChoice, dates: { start: string; end: string }) => void;
	}

	let {
		open,
		title,
		hasOpenReading,
		busy = false,
		error = null,
		onclose,
		onsave
	}: Props = $props();

	const today = toLocalDate(new Date());
	const uid = $props.id();

	let choice = $state<AddReadingChoice>('past');
	let start = $state(today);
	let end = $state(today);
	let localError = $state<string | null>(null);

	$effect(() => {
		if (open) {
			choice = hasOpenReading ? 'past' : 'now';
			start = today;
			end = today;
			localError = null;
		}
	});

	function save() {
		localError = null;
		if (choice === 'past') {
			const problem = validateDateRange(start, end, today);
			if (problem === 'order')
				return void (localError = 'La data di inizio è dopo quella di fine.');
			if (problem === 'future') return void (localError = 'Le date non possono essere nel futuro.');
			if (problem) return void (localError = 'Inserisci date valide.');
		}
		onsave(choice, { start, end });
	}
</script>

<BottomSheet {open} title="Aggiungi rilettura" subtitle={title} {onclose}>
	<div class="group" role="radiogroup" aria-label="Tipo di lettura">
		<button
			class="option"
			class:selected={choice === 'now'}
			type="button"
			role="radio"
			aria-checked={choice === 'now'}
			aria-disabled={hasOpenReading}
			aria-describedby={hasOpenReading ? `${uid}-why` : undefined}
			onclick={() => {
				if (!hasOpenReading) choice = 'now';
			}}
		>
			<span class="radio" aria-hidden="true"></span>
			<span class="text">
				La sto rileggendo ora
				{#if hasOpenReading}
					<span id="{uid}-why" class="why">C'è già una lettura in corso.</span>
				{/if}
			</span>
		</button>
		<button
			class="option"
			class:selected={choice === 'past'}
			type="button"
			role="radio"
			aria-checked={choice === 'past'}
			onclick={() => (choice = 'past')}
		>
			<span class="radio" aria-hidden="true"></span>
			<span class="text">L'ho già riletta</span>
		</button>
	</div>

	{#if choice === 'past'}
		<div class="extra">
			<p class="hint">
				Le letture inserite a posteriori non creano giorni di lettura nel calendario.
			</p>
			<DateRangeFields bind:start bind:end max={today} error={localError} />
		</div>
	{/if}

	{#if error}<p class="error" role="alert">{error}</p>{/if}

	{#snippet footer()}
		<Button variant="secondary" size="lg" disabled={busy} onclick={onclose}>Annulla</Button>
		<Button size="lg" loading={busy} onclick={save}>Salva</Button>
	{/snippet}
</BottomSheet>

<style>
	.group {
		display: flex;
		flex-direction: column;
	}

	.option {
		display: flex;
		align-items: center;
		gap: 14px;
		width: 100%;
		min-height: 48px;
		padding: 6px 12px;
		border: 0;
		border-radius: 14px;
		background: transparent;
		color: var(--color-text-primary);
		font-family: var(--font-ui);
		font-size: 16px;
		text-align: left;
		cursor: pointer;
	}

	.option[aria-disabled='true'] {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.option.selected {
		background: color-mix(in srgb, var(--color-accent) 40%, transparent);
		font-weight: 700;
	}

	.radio {
		position: relative;
		flex: none;
		box-sizing: border-box;
		width: 24px;
		height: 24px;
		border: 2px solid color-mix(in srgb, var(--color-shelf-axis) 50%, transparent);
		border-radius: 50%;
	}

	.selected .radio {
		border-color: var(--color-primary);
	}

	.selected .radio::after {
		content: '';
		position: absolute;
		inset: 4px;
		border-radius: 50%;
		background: var(--color-primary);
	}

	.text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.why {
		font-size: 12px;
		font-weight: 500;
		color: var(--color-text-secondary);
	}

	.extra {
		margin-top: 12px;
		padding: 12px;
		border-radius: 16px;
		background: var(--color-surface);
	}

	.hint {
		margin: 0 0 10px;
		font-size: 13px;
		line-height: 18px;
		color: var(--color-text-secondary);
	}

	.error {
		margin: 12px 0 0;
		font-size: 13px;
		color: var(--color-danger);
	}
</style>
