<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { StatusChoice } from '$lib/client/reading-logic';

	interface Props {
		choice: StatusChoice;
		/** `lg` = bottone del layout compatto (mockup 05), `md` = chip del layout hero (mockup 03). */
		size?: 'md' | 'lg';
		onclick: () => void;
		expanded?: boolean;
	}

	let { choice, size = 'lg', onclick, expanded = false }: Props = $props();

	const LABELS: Record<StatusChoice, string> = {
		unread: 'TBR',
		reading: 'In lettura',
		paused: 'In pausa',
		finished: 'Letto',
		rereads: 'Letto più di una volta',
		dnf: 'Non finito'
	};

	const label = $derived(LABELS[choice]);
	const done = $derived(choice === 'finished' || choice === 'rereads');
</script>

<button
	class="status {size}"
	class:done
	type="button"
	aria-haspopup="dialog"
	aria-expanded={expanded}
	aria-label="Stato di lettura: {label}. Cambia"
	{onclick}
>
	{#if done}
		<Icon name="check" size={size === 'lg' ? 16 : 14} strokeWidth={2.6} />
	{:else}
		<span class="dot" aria-hidden="true"></span>
	{/if}
	{label}
	<Icon name="chevron-down" size={size === 'lg' ? 16 : 14} strokeWidth={2.4} />
</button>

<style>
	.status {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		box-sizing: border-box;
		border: 1.5px solid var(--color-divider);
		background: transparent;
		color: var(--color-shelf-axis);
		font-family: var(--font-ui);
		font-weight: 700;
		white-space: nowrap;
		cursor: pointer;
	}

	.status.done {
		background: color-mix(in srgb, var(--color-divider) 16%, transparent);
	}

	.lg {
		height: 40px;
		padding: 0 14px;
		border-radius: 20px;
		font-size: 14px;
	}

	.md {
		height: 32px;
		padding: 0 12px;
		border-radius: 16px;
		font-size: 13px;
		font-weight: 600;
		gap: 6px;
	}

	/* area di tocco di 44px anche per il chip basso */
	.status::after {
		content: '';
		position: absolute;
		inset: -6px -2px;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-divider);
	}
</style>
