<script lang="ts">
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { toLocalDate, validateDateRange } from '$lib/client/reading-logic';
	import DateRangeFields from './DateRangeFields.svelte';

	interface Props {
		open: boolean;
		title: string;
		busy?: boolean;
		error?: string | null;
		onclose: () => void;
		onsave: (dates: { start: string; end: string }) => void;
	}

	let { open, title, busy = false, error = null, onclose, onsave }: Props = $props();

	const today = toLocalDate(new Date());
	let start = $state(today);
	let end = $state(today);
	let localError = $state<string | null>(null);

	$effect(() => {
		if (open) {
			start = today;
			end = today;
			localError = null;
		}
	});

	function save() {
		const problem = validateDateRange(start, end, today);
		if (problem === 'order') return void (localError = 'La data di inizio è dopo quella di fine.');
		if (problem === 'future') return void (localError = 'Le date non possono essere nel futuro.');
		if (problem) return void (localError = 'Inserisci date valide.');
		localError = null;
		onsave({ start, end });
	}
</script>

<BottomSheet {open} title="Segna come letto" subtitle={title} {onclose}>
	<p class="hint">
		Di default è oggi: cambia le date se lo hai letto prima. Le date storiche non creano giorni di
		lettura nel calendario.
	</p>
	<DateRangeFields bind:start bind:end max={today} error={localError} />
	{#if error}<p class="error" role="alert">{error}</p>{/if}

	{#snippet footer()}
		<Button variant="secondary" size="lg" disabled={busy} onclick={onclose}>Annulla</Button>
		<Button size="lg" loading={busy} onclick={save} data-testid="mark-read-save">Salva</Button>
	{/snippet}
</BottomSheet>

<style>
	.hint {
		margin: 0 0 12px;
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
