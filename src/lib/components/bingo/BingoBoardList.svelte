<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import BingoMini from '$lib/components/stats/BingoMini.svelte';
	import { bingoBoardStatus } from '$lib/components/stats/format';
	import type { BingoBoardListItem } from '$lib/contracts';

	interface Props {
		boards: BingoBoardListItem[];
	}

	let { boards }: Props = $props();
</script>

<section aria-labelledby="boards-heading">
	<h2 id="boards-heading">Le tue card</h2>
	<ul>
		{#each boards as board (board.boardId)}
			<li>
				<a href="/bingo/{board.year}" data-testid="bingo-board-link">
					<BingoMini
						size="sm"
						states={Array.from({ length: 16 }, (_, i) => board.completedPositions.includes(i + 1))}
					/>
					<span class="text">
						<span class="year">{board.year}</span>
						<span class="sub">{bingoBoardStatus(board.completedCount)}</span>
					</span>
					<Icon name="chevron-right" size={20} strokeWidth={2} />
				</a>
			</li>
		{/each}
	</ul>
</section>

<style>
	h2 {
		margin-bottom: 12px;
		font-size: 24px;
		line-height: 1.1;
		color: var(--color-text-primary);
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	a {
		display: flex;
		align-items: center;
		gap: 16px;
		box-sizing: border-box;
		padding: 14px 16px;
		border-radius: 20px;
		background: var(--color-surface);
		color: var(--color-primary);
		text-decoration: none;
	}

	a:hover {
		background: var(--color-surface-pressed);
	}

	.text {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
	}

	.year {
		font-family: var(--font-display);
		font-size: 20px;
		line-height: 1.2;
		color: var(--color-text-primary);
	}

	.sub {
		font-size: 13px;
		color: var(--color-text-secondary);
	}
</style>
