<script lang="ts">
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Chip from '$lib/components/ui/Chip.svelte';

	interface Props {
		open: boolean;
		/** Anni in cui non esiste ancora una card. */
		availableYears: number[];
		busy?: boolean;
		error?: string | null;
		onclose: () => void;
		oncreate: (year: number) => void;
	}

	let { open, availableYears, busy = false, error = null, onclose, oncreate }: Props = $props();

	let chosen = $state<number | null>(null);
	const selected = $derived(
		chosen !== null && availableYears.includes(chosen) ? chosen : (availableYears[0] ?? null)
	);
</script>

<BottomSheet
	{open}
	title="Nuova card"
	subtitle="Una card per anno, con le 16 sfide del Bookish Bingo."
	{onclose}
>
	{#if availableYears.length > 0}
		<fieldset>
			<legend>Anno</legend>
			<div class="years">
				{#each availableYears as year (year)}
					<Chip
						variant="outline"
						size="lg"
						selected={selected === year}
						onclick={() => (chosen = year)}
					>
						{year}
					</Chip>
				{/each}
			</div>
		</fieldset>
	{:else}
		<p class="none">Hai già una card per ogni anno disponibile.</p>
	{/if}

	{#if error}<p class="error" role="alert">{error}</p>{/if}

	{#snippet footer()}
		<Button variant="secondary" onclick={onclose}>Annulla</Button>
		<Button
			loading={busy}
			disabled={selected === null}
			onclick={() => selected !== null && oncreate(selected)}
			data-testid="bingo-create-confirm"
		>
			Crea la card
		</Button>
	{/snippet}
</BottomSheet>

<style>
	fieldset {
		margin: 12px 0 0;
		padding: 0;
		border: 0;
	}

	legend {
		margin-bottom: 8px;
		padding: 0;
		font-size: 12.5px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-text-secondary);
	}

	.years {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.none {
		margin: 12px 0 0;
		color: var(--color-text-secondary);
	}

	.error {
		margin: 12px 0 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--color-danger);
	}
</style>
