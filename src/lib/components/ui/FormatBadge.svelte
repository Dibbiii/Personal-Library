<script lang="ts">
	import type { BookFormat } from '$lib/contracts';
	import Icon from './Icon.svelte';
	import { FORMAT_ICONS, FORMAT_LABELS } from '$lib/book/format';

	interface Props {
		format: BookFormat;
		/** chip = icona + testo (dettaglio), icon = pallino sulla cover/dorso. */
		variant?: 'chip' | 'icon';
	}

	let { format, variant = 'chip' }: Props = $props();

	const label = $derived(FORMAT_LABELS[format]);
	const icon = $derived(FORMAT_ICONS[format]);
</script>

{#if variant === 'icon'}
	<span class="format-icon" role="img" aria-label={label}>
		<Icon name={icon} size={12} strokeWidth={2} />
	</span>
{:else}
	<span class="format-chip">
		<Icon name={icon} size={15} strokeWidth={2} />
		{label}
	</span>
{/if}

<style>
	.format-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		box-sizing: border-box;
		height: 32px;
		padding: 0 12px;
		border-radius: 16px;
		background: var(--color-surface);
		color: var(--color-text-primary);
		font-size: 13px;
		font-weight: 600;
		white-space: nowrap;
	}

	.format-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--color-background) 92%, transparent);
		color: var(--color-primary);
	}
</style>
