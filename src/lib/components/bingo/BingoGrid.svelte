<script lang="ts">
	import type { BingoCell as BingoCellData } from '$lib/contracts';
	import BingoCell from './BingoCell.svelte';

	interface Props {
		year: number;
		cells: BingoCellData[];
		onselect: (cell: BingoCellData) => void;
	}

	let { year, cells, onselect }: Props = $props();
</script>

<section class="board" aria-labelledby="board-heading">
	<h2 id="board-heading">La card del {year}</h2>
	<div class="grid">
		{#each cells as cell (cell.id)}
			<BingoCell {cell} {onselect} />
		{/each}
	</div>
</section>

<style>
	.board {
		box-sizing: border-box;
		padding: 22px 14px 20px;
		border-radius: 28px;
		background: var(--color-bingo-card);
	}

	h2 {
		margin-bottom: 18px;
		font-size: 22px;
		line-height: 1.15;
		color: var(--color-primary);
		text-align: center;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 18px 10px;
	}

	@media (min-width: 720px) {
		.board {
			padding: 28px 28px 26px;
		}

		.grid {
			gap: 26px 20px;
		}
	}
</style>
