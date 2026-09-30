<script module lang="ts">
	import type { LifecycleState } from '$lib/contracts';

	export type StatusKind = LifecycleState | 'queued';
</script>

<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		status: StatusKind;
		/** Con 2 o più letture completate lo stato "finished" diventa "Letto più di una volta". */
		completedReadingsCount?: number;
		size?: 'sm' | 'md';
	}

	let { status, completedReadingsCount = 0, size = 'md' }: Props = $props();

	const LABELS: Record<StatusKind, string> = {
		unread: 'TBR',
		reading: 'In lettura',
		paused: 'In pausa',
		finished: 'Letto',
		dnf: 'Non finito',
		queued: 'Prossimo'
	};

	const label = $derived(
		status === 'finished' && completedReadingsCount >= 2 ? 'Letto più di una volta' : LABELS[status]
	);
</script>

<span class="status {status} {size}">
	{#if status === 'finished'}<Icon name="check" size={14} strokeWidth={2.6} />{:else}<span
			class="dot"
			aria-hidden="true"
		></span>{/if}
	{label}
</span>

<style>
	.status {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		box-sizing: border-box;
		border: 1.5px solid transparent;
		font-weight: 600;
		white-space: nowrap;
	}

	.md {
		height: 32px;
		padding: 0 12px;
		border-radius: 16px;
		font-size: 13px;
	}

	.sm {
		height: 22px;
		padding: 0 9px;
		border-radius: 11px;
		font-size: 11.5px;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: currentColor;
	}

	.unread {
		border-color: var(--color-divider);
		color: var(--color-nav-inactive);
	}

	.reading,
	.queued {
		background: var(--color-primary);
		color: var(--color-on-primary);
	}

	.paused {
		border-color: var(--color-warning);
		color: var(--color-warning);
	}

	.finished {
		background: var(--color-surface);
		color: var(--color-text-primary);
	}

	.dnf {
		border-color: var(--color-danger);
		color: var(--color-danger);
	}
</style>
