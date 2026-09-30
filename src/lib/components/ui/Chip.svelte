<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	interface Props {
		variant?: 'soft' | 'outline' | 'solid' | 'dark';
		size?: 'sm' | 'md' | 'lg';
		/** Se definito il chip è un toggle (aria-pressed). */
		selected?: boolean;
		/** Se presente il chip è cliccabile. */
		onclick?: (event: MouseEvent) => void;
		href?: string;
		/** Mostra una X per rimuovere (es. i 3 aggettivi). */
		onremove?: () => void;
		removeLabel?: string;
		icon?: Snippet;
		children: Snippet;
		class?: string;
		style?: string;
	}

	let {
		variant = 'soft',
		size = 'md',
		selected,
		onclick,
		href,
		onremove,
		removeLabel = 'Rimuovi',
		icon,
		children,
		class: className,
		style
	}: Props = $props();

	const interactive = $derived(Boolean(onclick || href));
	const classes = $derived(
		['chip', variant, size, interactive && 'interactive', selected && 'selected', className]
			.filter(Boolean)
			.join(' ')
	);
</script>

{#snippet content()}
	{#if icon}<span class="lead">{@render icon()}</span>{/if}
	{@render children()}
{/snippet}

{#if href}
	<a class={classes} {href} {style}>{@render content()}</a>
{:else if onclick}
	<button
		class={classes}
		type="button"
		{onclick}
		aria-pressed={selected === undefined ? undefined : selected}
		{style}
	>
		{@render content()}
	</button>
{:else}
	<span class={classes} {style}>
		{@render content()}
		{#if onremove}
			<button class="remove" type="button" aria-label={removeLabel} onclick={onremove}>
				<Icon name="close" size={14} strokeWidth={2.4} />
			</button>
		{/if}
	</span>
{/if}

<style>
	.chip {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		box-sizing: border-box;
		border: 1.5px solid transparent;
		font-family: var(--font-ui);
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
	}

	.sm {
		height: 26px;
		padding: 0 12px;
		border-radius: 13px;
		font-size: 12px;
	}

	.md {
		height: 32px;
		padding: 0 12px;
		border-radius: 16px;
		font-size: 13px;
	}

	.lg {
		height: 38px;
		padding: 0 14px;
		border-radius: 19px;
		font-size: 14px;
	}

	.soft {
		background: var(--color-surface);
		color: var(--color-text-primary);
	}

	.outline {
		background: transparent;
		border-color: var(--color-divider);
		color: var(--color-nav-inactive);
	}

	.solid {
		background: var(--color-primary);
		color: var(--color-on-primary);
	}

	.dark {
		background: var(--color-nav-inactive);
		color: var(--color-on-primary);
	}

	.interactive {
		cursor: pointer;
	}

	/* Area di tocco di almeno 44px anche per i chip bassi */
	.interactive::after {
		content: '';
		position: absolute;
		inset: -6px -2px;
	}

	.interactive.outline.selected {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: var(--color-on-primary);
	}

	.lead {
		display: inline-flex;
	}

	.remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin: 0 -6px 0 0;
		padding: 4px;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: inherit;
	}
</style>
