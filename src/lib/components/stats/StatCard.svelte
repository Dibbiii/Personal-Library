<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { IconName } from '$lib/components/ui/icons';

	interface Props {
		icon: IconName;
		label: string;
		class?: string;
		children: Snippet;
	}

	let { icon, label, class: className, children }: Props = $props();
</script>

<section class="stat-card {className ?? ''}">
	<header>
		<span class="tile"><Icon name={icon} size={18} strokeWidth={2} /></span>
		<h2>{label}</h2>
	</header>
	{@render children()}
</section>

<style>
	.stat-card {
		box-sizing: border-box;
		min-width: 0;
		padding: 16px;
		border-radius: 22px;
		background: var(--color-surface);
	}

	header {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.tile {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		flex-shrink: 0;
		border-radius: 10px;
		background: color-mix(in srgb, var(--color-divider) 22%, transparent);
		color: var(--color-shelf-axis);
	}

	h2 {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		line-height: 15px;
		color: var(--color-primary-deep);
	}
</style>
