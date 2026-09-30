<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { BingoBoardListItem } from '$lib/contracts';
	import BingoMini from './BingoMini.svelte';
	import { bingoRemaining } from './format';

	interface Props {
		year: number;
		/** Riepilogo della card dell'anno, `null` se non esiste. */
		board: BingoBoardListItem | null;
	}

	let { year, board }: Props = $props();

	const completed = $derived(board?.completedCount ?? 0);
	const states = $derived(
		Array.from({ length: 16 }, (_, i) => board?.completedPositions.includes(i + 1) ?? false)
	);
</script>

<section class="bingo" aria-labelledby="bingo-heading">
	<div class="head">
		<h2 id="bingo-heading">Bookish Bingo</h2>
		{#if board}<span class="badge">{completed} su 16</span>{/if}
	</div>

	<a class="card" href="/bingo/{year}">
		<BingoMini {states} />
		<span class="text">
			<span class="title">La card del {year}</span>
			{#if board}
				<span class="sub">{bingoRemaining(completed)}</span>
				<span
					class="track"
					role="progressbar"
					aria-label="Caselle completate"
					aria-valuemin="0"
					aria-valuemax="16"
					aria-valuenow={completed}
				>
					<span class="fill" style="width: {(completed / 16) * 100}%"></span>
				</span>
				<span class="open"
					>Apri la card <Icon name="chevron-right" size={16} strokeWidth={2.4} /></span
				>
			{:else}
				<span class="sub">Nessuna card per il {year}: creala e spunta le caselle mentre leggi.</span
				>
				<span class="open"
					>Crea la card <Icon name="chevron-right" size={16} strokeWidth={2.4} /></span
				>
			{/if}
		</span>
	</a>
</section>

<style>
	.bingo {
		min-width: 0;
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	h2 {
		font-size: 24px;
		line-height: 1.1;
		color: var(--color-text-primary);
	}

	.badge {
		display: inline-flex;
		align-items: center;
		height: 30px;
		padding: 0 12px;
		border-radius: 15px;
		background: var(--color-shelf-axis);
		color: var(--color-background);
		font-size: 12.5px;
		font-weight: 600;
	}

	.card {
		display: flex;
		align-items: center;
		gap: 18px;
		box-sizing: border-box;
		margin-top: 12px;
		padding: 16px;
		border-radius: 22px;
		background: var(--color-surface);
		color: inherit;
		text-decoration: none;
	}

	.card:hover {
		background: var(--color-surface-pressed);
	}

	.text {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
	}

	.title {
		font-family: var(--font-display);
		font-size: 19px;
		line-height: 1.15;
		color: var(--color-text-primary);
	}

	.sub {
		margin-top: 4px;
		font-size: 13px;
		line-height: 18px;
		color: var(--color-text-secondary);
	}

	.track {
		display: block;
		height: 8px;
		margin-top: 10px;
		border-radius: 4px;
		background: var(--color-background);
		overflow: hidden;
	}

	.fill {
		display: block;
		height: 100%;
		border-radius: 4px;
		background: var(--color-primary);
	}

	.open {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		margin-top: 10px;
		font-size: 14px;
		font-weight: 700;
		color: var(--color-primary);
	}
</style>
