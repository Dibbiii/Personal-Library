<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		as?: 'div' | 'section' | 'article';
		tone?: 'surface' | 'elevated';
		padding?: 'none' | 'md' | 'lg';
		children: Snippet;
		class?: string;
	}

	let {
		as = 'div',
		tone = 'surface',
		padding = 'lg',
		children,
		class: className
	}: Props = $props();
</script>

<svelte:element this={as} class="card {tone} {padding} {className ?? ''}">
	{@render children()}
</svelte:element>

<style>
	.card {
		box-sizing: border-box;
		border-radius: var(--radius-xl);
		min-width: 0;
	}

	.surface {
		background: var(--color-surface);
	}

	.elevated {
		background: var(--color-card);
		box-shadow: var(--shadow-card);
	}

	.md {
		padding: 16px;
	}

	.lg {
		padding: 20px;
	}
</style>
