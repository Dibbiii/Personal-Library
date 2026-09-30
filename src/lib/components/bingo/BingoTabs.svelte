<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';

	interface Props {
		years: number[];
		current: number;
		onnew: () => void;
	}

	let { years, current, onnew }: Props = $props();
</script>

<nav class="tabs" aria-label="Anni delle card">
	{#each years as year (year)}
		<a
			href="/bingo/{year}"
			class="tab"
			class:active={year === current}
			aria-current={year === current ? 'page' : undefined}
		>
			{year}
		</a>
	{/each}
	<button type="button" class="tab new" onclick={onnew} data-testid="bingo-new">
		<Icon name="plus" size={16} strokeWidth={2.4} />
		Nuova card
	</button>
</nav>

<style>
	.tabs {
		display: flex;
		gap: 8px;
		padding: 14px var(--page-gutter) 0;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.tabs::-webkit-scrollbar {
		display: none;
	}

	.tab {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		gap: 6px;
		box-sizing: border-box;
		height: 40px;
		padding: 0 18px;
		border: 1.5px solid color-mix(in srgb, var(--color-shelf-axis) 30%, transparent);
		border-radius: 20px;
		background: none;
		color: var(--color-text-primary);
		font-size: 14px;
		font-weight: 700;
		text-decoration: none;
		white-space: nowrap;
	}

	.tab.active {
		border-color: var(--color-primary);
		background: var(--color-primary);
		color: var(--color-on-primary);
	}

	.tab.new {
		padding: 0 14px;
		border: 1.5px dashed color-mix(in srgb, var(--color-primary) 50%, transparent);
		color: var(--color-primary);
	}
</style>
