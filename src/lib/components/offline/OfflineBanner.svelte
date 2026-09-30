<script lang="ts">
	import { fade } from 'svelte/transition';
	import { outboxStatus } from '$lib/offline/status.svelte';

	function updates(count: number): string {
		return count === 1 ? '1 aggiornamento' : `${count} aggiornamenti`;
	}

	type Tone = 'neutral' | 'warning' | 'danger' | 'success';

	const view = $derived.by((): { tone: Tone; text: string; href?: string; icon: string } | null => {
		const { online, pending, failed, syncing, authRequired, justSynced } = outboxStatus;

		if (!online) {
			return {
				tone: 'neutral',
				icon: 'offline',
				text: pending > 0 ? `Offline · ${updates(pending)} in coda` : 'Offline'
			};
		}
		if (authRequired && pending > 0) {
			return {
				tone: 'warning',
				icon: 'sync',
				text: `Accedi di nuovo per sincronizzare ${updates(pending)}`,
				href: '/auth/login?next=/settings'
			};
		}
		if (failed > 0) {
			return {
				tone: 'danger',
				icon: 'alert',
				text: `${failed === 1 ? '1 aggiornamento non sincronizzato' : `${failed} aggiornamenti non sincronizzati`}`,
				href: '/settings#sincronizzazione'
			};
		}
		if (syncing && pending > 0) {
			return { tone: 'neutral', icon: 'sync', text: `Sincronizzo ${updates(pending)}…` };
		}
		if (pending > 0) {
			return {
				tone: 'neutral',
				icon: 'sync',
				text: `${updates(pending)} in coda · riprovo a breve`
			};
		}
		if (justSynced) return { tone: 'success', icon: 'check', text: 'Sincronizzato' };
		return null;
	});
</script>

<div class="slot">
	{#if view}
		{@const v = view}
		<div class="pill {v.tone}" role="status" aria-live="polite" transition:fade={{ duration: 160 }}>
			<svg
				class="glyph"
				class:spin={v.icon === 'sync' && outboxStatus.syncing}
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				{#if v.icon === 'offline'}
					<path
						d="M3 3l18 18M8.5 8.6A10 10 0 0 0 2 12.5M5.7 13.6a6 6 0 0 1 3.1-1.6M16.5 12.2a6 6 0 0 1 1.8 1.4M13.6 6.2A10 10 0 0 1 22 12.5"
					/>
					<path d="M12 18.5h.01" />
				{:else if v.icon === 'sync'}
					<path d="M20 11a8 8 0 0 0-14.5-3.5M4 4v4h4M4 13a8 8 0 0 0 14.5 3.5M20 20v-4h-4" />
				{:else if v.icon === 'alert'}
					<path d="M12 4l9 16H3zM12 10v4M12 17.5h.01" />
				{:else}
					<path d="M5 12.5l4.5 4.5L19 7.5" />
				{/if}
			</svg>
			{#if v.href}
				<a href={v.href}>{v.text}</a>
			{:else}
				<span>{v.text}</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	.slot {
		position: fixed;
		/* su mobile sta sopra la barra di navigazione: non copre l'intestazione delle pagine */
		bottom: calc(var(--nav-height) + env(safe-area-inset-bottom, 0px) + 10px);
		left: 0;
		right: 0;
		z-index: var(--z-overlay);
		display: flex;
		justify-content: center;
		padding: 0 12px;
		pointer-events: none;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		box-sizing: border-box;
		max-width: 100%;
		min-height: 34px;
		padding: 6px 14px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		color: var(--color-text-primary);
		font-size: 13px;
		font-weight: 700;
		line-height: 1.2;
		box-shadow: var(--shadow-card);
		pointer-events: auto;
	}

	.pill.warning {
		border-color: var(--color-warning);
		color: var(--color-warning);
	}

	.pill.danger {
		border-color: var(--color-danger);
		color: var(--color-danger);
	}

	.pill.success {
		color: var(--color-success);
		border-color: color-mix(in srgb, var(--color-success) 40%, var(--color-border));
	}

	a {
		color: inherit;
		text-decoration: underline;
		text-underline-offset: 2px;
		/* area tocco più ampia del testo */
		padding-block: 10px;
		margin-block: -10px;
	}

	.glyph {
		flex-shrink: 0;
	}

	.spin {
		animation: rotate 1.1s linear infinite;
	}

	@keyframes rotate {
		to {
			transform: rotate(360deg);
		}
	}

	@media (min-width: 1024px) {
		.slot {
			top: 16px;
			bottom: auto;
			justify-content: flex-end;
			padding: 0 28px;
		}
	}
</style>
