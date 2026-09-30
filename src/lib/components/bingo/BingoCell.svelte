<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { BingoCell } from '$lib/contracts';
	import { bingoIcon } from './icons';

	interface Props {
		cell: BingoCell;
		onselect: (cell: BingoCell) => void;
	}

	let { cell, onselect }: Props = $props();

	const done = $derived(cell.completedAt !== null);
	const label = $derived(
		done
			? `${cell.challenge}: completato${cell.book ? `, ${cell.book.title}` : ''}`
			: `${cell.challenge}: da fare`
	);
</script>

<button
	type="button"
	class="cell"
	class:done
	aria-pressed={done}
	aria-label={label}
	onclick={() => onselect(cell)}
	data-testid="bingo-cell"
	data-position={cell.position}
>
	<span class="circle">
		<Icon name={bingoIcon(cell.position)} size={38} strokeWidth={done ? 1.7 : 1.4} />
		{#if done}
			<span class="badge"><Icon name="check" size={14} strokeWidth={3.2} /></span>
		{/if}
	</span>
	<span class="name">{cell.challenge}</span>
	{#if done && cell.book}<span class="book">{cell.book.title}</span>{/if}
</button>

<style>
	.cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 7px;
		min-width: 0;
		padding: 0;
		border: 0;
		background: none;
		text-align: center;
	}

	.circle {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		width: 100%;
		aspect-ratio: 1 / 1;
		border: 1.5px solid color-mix(in srgb, var(--color-primary) 55%, transparent);
		border-radius: 50%;
		color: color-mix(in srgb, var(--color-primary) 75%, transparent);
		transition: background var(--duration-fast) var(--ease-out);
	}

	.cell:hover .circle {
		background: color-mix(in srgb, var(--color-accent) 25%, transparent);
	}

	.done .circle {
		border: 2px solid var(--color-primary);
		background: var(--color-accent);
		color: var(--color-primary);
	}

	.badge {
		position: absolute;
		top: -3px;
		right: -3px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		width: 26px;
		height: 26px;
		border: 2px solid var(--color-background);
		border-radius: 50%;
		background: var(--color-primary);
		color: var(--color-background);
	}

	.name {
		font-size: 12px;
		font-weight: 600;
		line-height: 14px;
		color: var(--color-text-primary);
	}

	.book {
		max-width: 100%;
		overflow: hidden;
		font-size: 10.5px;
		font-style: italic;
		font-synthesis: style;
		line-height: 13px;
		color: var(--color-primary-deep);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (min-width: 720px) {
		.name {
			font-size: 14px;
			line-height: 17px;
		}

		.book {
			font-size: 12.5px;
			line-height: 16px;
		}
	}
</style>
