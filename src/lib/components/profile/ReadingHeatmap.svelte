<script lang="ts">
	import { formatNumber, MONTH_NAMES } from '$lib/components/stats/format';

	interface Props {
		/** 7 righe (lunedì..domenica) x 12 mesi, pagine lette. */
		matrix: number[][];
	}

	let { matrix }: Props = $props();

	const WEEKDAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
	const max = $derived(Math.max(1, ...matrix.flat()));
	const totals = $derived(matrix.map((row) => row.reduce((sum, v) => sum + v, 0)));
	const best = $derived(totals.indexOf(Math.max(...totals)));

	/** 5 gradini di un'unica tinta: 0 = vuoto. */
	function level(value: number): number {
		return value === 0 ? 0 : Math.min(4, Math.ceil((value / max) * 4));
	}
</script>

<div class="heatmap">
	{#if totals.some((t) => t > 0)}
		<p class="hint">
			Il giorno in cui leggi di più è il <strong>{WEEKDAYS[best]?.toLowerCase()}</strong>.
		</p>
	{/if}
	<table aria-label="Pagine lette per giorno della settimana e mese">
		<thead>
			<tr>
				<th scope="col"><span class="sr-only">Giorno</span></th>
				{#each MONTH_NAMES as month (month)}
					<th scope="col" abbr={month}>{month.charAt(0)}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each matrix as row, d (d)}
				<tr>
					<th scope="row" abbr={WEEKDAYS[d]}>{WEEKDAYS[d]?.slice(0, 3)}</th>
					{#each row as value, m (m)}
						<td
							class="cell l{level(value)}"
							title="{WEEKDAYS[d]} di {MONTH_NAMES[m]?.toLowerCase()}: {formatNumber(value)} pagine"
						>
							<span class="sr-only">{formatNumber(value)} pagine</span>
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
	<div class="legend" aria-hidden="true">
		<span>Meno</span>
		{#each [0, 1, 2, 3, 4] as l (l)}<span class="cell l{l}"></span>{/each}
		<span>Più</span>
	</div>
</div>

<style>
	.heatmap {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.hint {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 13px;
	}

	.hint strong {
		color: var(--color-text-primary);
	}

	table {
		width: 100%;
		border-spacing: 3px;
		table-layout: fixed;
	}

	th {
		color: var(--color-text-muted);
		font-size: 10px;
		font-weight: 600;
		text-align: center;
	}

	th[scope='row'] {
		width: 30px;
		text-align: left;
	}

	.cell {
		height: 14px;
		border-radius: 3px;
	}

	.l0 {
		background: color-mix(in srgb, var(--color-divider) 45%, transparent);
	}
	.l1 {
		background: color-mix(in srgb, var(--color-primary) 22%, var(--color-surface));
	}
	.l2 {
		background: color-mix(in srgb, var(--color-primary) 45%, var(--color-surface));
	}
	.l3 {
		background: color-mix(in srgb, var(--color-primary) 72%, var(--color-surface));
	}
	.l4 {
		background: var(--color-primary);
	}

	.legend {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 3px;
		color: var(--color-text-muted);
		font-size: 10px;
	}

	.legend .cell {
		display: inline-block;
		width: 12px;
		height: 12px;
	}

	.legend span:first-child {
		margin-right: 3px;
	}

	.legend span:last-child {
		margin-left: 3px;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
