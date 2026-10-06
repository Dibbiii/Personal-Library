<script lang="ts" module>
	import type { IconName } from '$lib/components/ui/icons';

	export interface ShareRow {
		key: string;
		label: string;
		percent: number;
		/** Colore della barra (variabile CSS); il testo resta sempre nei colori del testo. */
		color: string;
		icon?: IconName;
		title?: string;
	}
</script>

<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';

	interface Props {
		rows: ShareRow[];
	}

	let { rows }: Props = $props();
</script>

<ul class="shares">
	{#each rows as row (row.key)}
		<li title={row.title}>
			{#if row.icon}
				<Icon name={row.icon} size={18} class="share-icon" />
			{:else}
				<span class="dot" style:background={row.color}></span>
			{/if}
			<span class="label">{row.label}</span>
			<span
				class="track"
				role="meter"
				aria-label={row.label}
				aria-valuemin="0"
				aria-valuemax="100"
				aria-valuenow={row.percent}
			>
				<span class="fill" style:width="{row.percent}%" style:background={row.color}></span>
			</span>
			<span class="value">{row.percent}%</span>
		</li>
	{/each}
</ul>

<style>
	.shares {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		grid-template-columns: 18px minmax(70px, 0.9fr) minmax(60px, 1.4fr) 36px;
		align-items: center;
		gap: 10px;
		color: var(--color-text-primary);
		font-size: 13px;
	}

	li :global(.share-icon) {
		color: var(--color-primary);
	}

	.dot {
		justify-self: center;
		width: 9px;
		height: 9px;
		border-radius: 50%;
	}

	.label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.track {
		height: 8px;
		overflow: hidden;
		border-radius: var(--radius-pill);
		background: color-mix(in srgb, var(--color-divider) 45%, transparent);
	}

	.fill {
		display: block;
		height: 100%;
		min-width: 4px;
		border-radius: inherit;
	}

	.value {
		color: var(--color-text-secondary);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
</style>
