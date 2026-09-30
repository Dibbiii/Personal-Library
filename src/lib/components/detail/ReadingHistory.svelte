<script lang="ts">
	import type { ReadingHistoryItem } from '$lib/contracts/readings';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { formatReadingRange, readingSequenceLabel } from '$lib/client/reading-logic';
	import { formatNumber } from './format';

	interface Props {
		readings: readonly ReadingHistoryItem[];
		pageCount: number | null;
		/** Mostra "Aggiungi rilettura" (serve almeno una lettura completata). */
		canAdd: boolean;
		onadd: () => void;
	}

	let { readings, pageCount, canAdd, onadd }: Props = $props();

	// Il database le restituisce dalla più recente: nel mockup sono in ordine cronologico.
	const ordered = $derived([...readings].sort((a, b) => a.sequence - b.sequence));

	function detail(reading: ReadingHistoryItem): string | null {
		const total = pageCount ? ` di ${formatNumber(pageCount)}` : '';
		switch (reading.status) {
			case 'active':
				return `In corso · p. ${formatNumber(reading.currentPage)}${total}`;
			case 'paused':
				return `In pausa · p. ${formatNumber(reading.currentPage)}${total}`;
			case 'dnf':
				return `Non finito · riposa a p. ${formatNumber(reading.currentPage)}`;
			default:
				return null;
		}
	}
</script>

<section class="card" aria-labelledby="history-title" data-testid="reading-history">
	<h2 id="history-title">Date di lettura</h2>

	<ul role="list">
		{#each ordered as reading (reading.id)}
			{@const note = detail(reading)}
			<li class="row" data-status={reading.status}>
				<Icon name="calendar" size={20} strokeWidth={1.8} />
				<span class="dates">
					<span class="range">{formatReadingRange(reading)}</span>
					{#if note}<span class="note">{note}</span>{/if}
				</span>
				<span class="chip">{readingSequenceLabel(reading.sequence)}</span>
			</li>
		{/each}
	</ul>

	{#if canAdd}
		<button class="add" type="button" onclick={onadd}>
			<Icon name="plus" size={18} strokeWidth={2} />
			Aggiungi rilettura
		</button>
	{/if}
</section>

<style>
	.card {
		box-sizing: border-box;
		padding: 18px;
		border-radius: var(--radius-xl);
		background: var(--color-surface);
	}

	h2 {
		margin: 0 0 12px;
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 700;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		box-sizing: border-box;
		min-height: 52px;
		margin-bottom: 8px;
		padding: 6px 14px;
		border-radius: 14px;
		background: var(--color-background);
		color: var(--color-shelf-axis);
	}

	.dates {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
		color: var(--color-text-primary);
	}

	.range {
		font-size: 14px;
		font-weight: 600;
	}

	.note {
		margin-top: 1px;
		font-size: 12px;
		color: var(--color-text-secondary);
	}

	.chip {
		flex: none;
		display: inline-flex;
		align-items: center;
		height: 26px;
		padding: 0 12px;
		border-radius: 13px;
		background: var(--color-info-tint);
		color: var(--color-info);
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
	}

	.add {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		min-height: 46px;
		border: 1.5px dashed color-mix(in srgb, var(--color-primary) 40%, transparent);
		border-radius: 14px;
		background: transparent;
		color: var(--color-primary);
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
	}
</style>
