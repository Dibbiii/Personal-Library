<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { IconName } from '$lib/components/ui/icons';

	interface Props {
		icon: IconName;
		title: string;
		/** Link "Vedi tutti" in alto a destra. */
		href?: string;
		linkLabel?: string;
		class?: string;
		testid?: string;
		children: Snippet;
	}

	let {
		icon,
		title,
		href,
		linkLabel = 'Vedi tutti',
		class: className,
		testid,
		children
	}: Props = $props();
	const headingId = $props.id();
</script>

<section class="card {className ?? ''}" aria-labelledby={headingId} data-testid={testid}>
	<header>
		<Icon name={icon} size={20} strokeWidth={2} class="card-icon" />
		<h2 id={headingId}>{title}</h2>
		{#if href}
			<a class="more" {href}>
				{linkLabel}<Icon name="chevron-right" size={14} strokeWidth={2.4} />
			</a>
		{/if}
	</header>
	{@render children()}
</section>

<style>
	.card {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 14px;
		min-width: 0;
		padding: 18px 20px 20px;
		border: 1px solid color-mix(in srgb, var(--color-border) 55%, transparent);
		border-radius: var(--radius-lg);
		background: var(--color-surface-elevated);
		box-shadow: var(--shadow-card);
	}

	header {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 28px;
		color: var(--color-primary);
	}

	h2 {
		flex: 1;
		min-width: 0;
		margin: 0;
		color: var(--color-primary-deep);
		font-family: var(--font-ui);
		font-size: 16px;
		font-weight: 700;
		line-height: 1.2;
	}

	.more {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		min-height: var(--tap-size);
		margin: -8px 0;
		color: var(--color-primary);
		font-size: 12px;
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
	}

	.more:hover {
		text-decoration: underline;
	}
</style>
