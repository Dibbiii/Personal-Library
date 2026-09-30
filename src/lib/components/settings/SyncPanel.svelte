<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import {
		discardFailed,
		outboxStatus,
		retryAllFailed,
		retryFailed,
		syncNow
	} from '$lib/offline/outbox';
	import type { ReadingOperation } from '$lib/offline/types';

	const OPERATION_LABELS: Record<ReadingOperation, string> = {
		progress: 'Avanzamento',
		correction: 'Correzione',
		finish: 'Fine lettura',
		dnf: 'Lettura abbandonata'
	};

	const dateFormat = new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' });

	let busy = $state(false);

	function when(iso: string): string {
		return dateFormat.format(new Date(iso));
	}

	function updates(count: number): string {
		return count === 1 ? '1 aggiornamento' : `${count} aggiornamenti`;
	}

	async function run(action: () => Promise<void>) {
		busy = true;
		try {
			await action();
		} finally {
			busy = false;
		}
	}

	const summary = $derived.by(() => {
		const { online, pending, failed, authRequired } = outboxStatus;
		if (!online) return pending > 0 ? `Sei offline: ${updates(pending)} in coda.` : 'Sei offline.';
		if (authRequired && pending > 0) return 'Sessione scaduta: accedi di nuovo per sincronizzare.';
		if (pending > 0) return `${updates(pending)} in coda.`;
		if (failed > 0) return 'Tutto il resto è sincronizzato.';
		return 'Tutto sincronizzato.';
	});
</script>

<div class="panel" data-testid="sync-panel">
	<p class="summary" role="status" aria-live="polite" data-testid="sync-summary">{summary}</p>

	<dl class="counts">
		<div>
			<dt>In coda</dt>
			<dd data-testid="pending-count">{outboxStatus.pending}</dd>
		</div>
		<div>
			<dt>Non sincronizzati</dt>
			<dd data-testid="failed-count">{outboxStatus.failed}</dd>
		</div>
	</dl>

	<div class="actions">
		<Button
			size="sm"
			variant="secondary"
			loading={busy || outboxStatus.syncing}
			disabled={!outboxStatus.online}
			onclick={() => run(syncNow)}
		>
			Riprova ora
		</Button>
	</div>

	{#if outboxStatus.failedItems.length > 0}
		<div class="failed">
			<h3>Da controllare</h3>
			<p class="hint">
				Il server ha rifiutato questi aggiornamenti e non verranno inviati di nuovo da soli.
			</p>
			<ul>
				{#each outboxStatus.failedItems as item (item.eventId)}
					<li>
						<div class="what">
							<strong>{OPERATION_LABELS[item.operation]} · pagina {item.page}</strong>
							<span>{when(item.occurredAt)}</span>
							<span class="reason">{item.reason}</span>
						</div>
						<div class="row-actions">
							<Button
								size="sm"
								variant="secondary"
								disabled={busy}
								onclick={() => run(() => retryFailed(item.eventId))}
							>
								Riprova
							</Button>
							<Button
								size="sm"
								variant="ghost"
								disabled={busy}
								onclick={() => run(() => discardFailed(item.eventId))}
							>
								Scarta
							</Button>
						</div>
					</li>
				{/each}
			</ul>
			{#if outboxStatus.failedItems.length > 1}
				<Button size="sm" variant="ghost" disabled={busy} onclick={() => run(retryAllFailed)}>
					Riprova tutti
				</Button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 14px;
	}

	.summary {
		margin: 0;
		font-size: 16px;
		font-weight: 700;
	}

	.counts {
		display: flex;
		gap: 10px;
		margin: 0;
	}

	.counts div {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 16px;
		border-radius: var(--radius-lg);
		background: var(--color-surface-elevated);
	}

	dt {
		font-size: 12px;
		color: var(--color-text-secondary);
	}

	dd {
		margin: 0;
		font-family: var(--font-display);
		font-size: 24px;
		line-height: 1.1;
	}

	.failed {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
		width: 100%;
	}

	h3 {
		font-size: 18px;
		color: var(--color-danger);
	}

	.hint {
		margin: 0;
		font-size: 13px;
		color: var(--color-text-secondary);
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 100%;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 12px 14px;
		border: 1.5px solid var(--color-danger);
		border-radius: var(--radius-lg);
		background: var(--color-surface-elevated);
	}

	.what {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		font-size: 13px;
		color: var(--color-text-secondary);
	}

	.what strong {
		font-size: 15px;
		color: var(--color-text-primary);
	}

	.reason {
		color: var(--color-danger);
		font-weight: 600;
	}

	.row-actions {
		display: flex;
		gap: 6px;
	}
</style>
