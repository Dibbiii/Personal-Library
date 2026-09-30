import type { FailedRecord, OutboxRecord } from './types';

/**
 * Stato reattivo della outbox (Svelte 5 runes) letto da OfflineBanner e dalle Impostazioni.
 * Lo aggiorna solo outbox.ts.
 */
class OutboxStatus {
	/** Elementi in coda (non ancora confermati dal server). */
	pending = $state(0);
	/** Elementi rifiutati in modo permanente dal server. */
	failed = $state(0);
	syncing = $state(false);
	online = $state(true);
	/** La sessione è scaduta: gli elementi restano in coda fino al nuovo login. */
	authRequired = $state(false);
	lastSyncedAt = $state<number | null>(null);
	/** Vero per qualche secondo dopo una sync riuscita ("Sincronizzato"). */
	justSynced = $state(false);
	/** Prossimo tentativo programmato (backoff), epoch ms. */
	nextRetryAt = $state<number | null>(null);

	pendingItems = $state.raw<OutboxRecord[]>([]);
	failedItems = $state.raw<FailedRecord[]>([]);
}

export const outboxStatus = new OutboxStatus();
