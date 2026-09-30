<script lang="ts">
	import type { Snippet } from 'svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { IconName } from '$lib/components/ui/icons';

	interface Props {
		icon: IconName;
		title: string;
		/** Occupa tutta la riga nella griglia desktop. */
		wide?: boolean;
		id?: string;
		children: Snippet;
	}

	let { icon, title, wide = false, id, children }: Props = $props();
</script>

<section class="settings-card" class:wide {id} aria-labelledby={id ? `${id}-title` : undefined}>
	<Card as="div" padding="lg">
		<header>
			<span class="badge"><Icon name={icon} size={20} /></span>
			<h2 id={id ? `${id}-title` : undefined}>{title}</h2>
		</header>
		{@render children()}
	</Card>
</section>

<style>
	.settings-card {
		min-width: 0;
		scroll-margin-top: 16px;
	}

	@media (min-width: 1024px) {
		.wide {
			grid-column: 1 / -1;
		}
	}

	header {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 16px;
	}

	.badge {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-text-primary) 8%, transparent);
		color: var(--color-icon);
	}

	h2 {
		font-family: var(--font-ui);
		font-size: 16px;
		font-weight: 700;
		color: var(--color-text-primary);
	}
</style>
