<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { bingoRemaining } from '$lib/components/stats/format';

	interface Props {
		completed: number;
	}

	let { completed }: Props = $props();
</script>

<section class="summary" aria-label="Riepilogo della card">
	<div class="row">
		<div>
			<p class="count" data-testid="bingo-count">{completed} su 16</p>
			<p class="sub">{bingoRemaining(completed)}</p>
		</div>
		<span class="trophy" aria-hidden="true"><Icon name="trophy" size={26} strokeWidth={1.9} /></span
		>
	</div>
	<div
		class="track"
		role="progressbar"
		aria-label="Caselle completate"
		aria-valuemin="0"
		aria-valuemax="16"
		aria-valuenow={completed}
	>
		<span class="fill" style="width: {(completed / 16) * 100}%"></span>
	</div>
</section>

<style>
	.summary {
		box-sizing: border-box;
		padding: 16px;
		border-radius: 22px;
		background: var(--color-surface);
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.count {
		margin: 0;
		font-family: var(--font-display);
		font-size: 30px;
		line-height: 1.1;
		color: var(--color-text-primary);
	}

	.sub {
		margin: 2px 0 0;
		font-size: 13px;
		line-height: 18px;
		color: var(--color-text-secondary);
	}

	.trophy {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		flex-shrink: 0;
		border-radius: 50%;
		background: color-mix(in srgb, var(--color-divider) 22%, transparent);
		color: var(--color-shelf-axis);
	}

	.track {
		height: 8px;
		margin-top: 12px;
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
</style>
