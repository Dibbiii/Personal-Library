<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLButtonAttributes, 'children' | 'class'> {
		variant?: 'primary' | 'secondary' | 'ghost';
		size?: 'sm' | 'md' | 'lg';
		fullWidth?: boolean;
		/** Se presente il pulsante è un link. */
		href?: string;
		loading?: boolean;
		icon?: Snippet;
		children: Snippet;
		class?: string;
	}

	let {
		variant = 'primary',
		size = 'md',
		fullWidth = false,
		href,
		loading = false,
		disabled = false,
		type = 'button',
		icon,
		children,
		class: className,
		...rest
	}: Props = $props();

	const classes = $derived(
		['btn', variant, size, fullWidth && 'full', loading && 'loading', className]
			.filter(Boolean)
			.join(' ')
	);
</script>

{#if href && !disabled}
	<a class={classes} {href}>
		{#if icon}<span class="icon">{@render icon()}</span>{/if}
		{@render children()}
	</a>
{:else}
	<button class={classes} {type} disabled={disabled || loading} aria-busy={loading} {...rest}>
		{#if icon}<span class="icon">{@render icon()}</span>{/if}
		{@render children()}
	</button>
{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		box-sizing: border-box;
		border: 1.5px solid transparent;
		font-family: var(--font-ui);
		font-weight: 700;
		text-decoration: none;
		white-space: nowrap;
		transition:
			background-color var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}

	.btn:active:not(:disabled) {
		transform: scale(0.98);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.sm {
		min-height: var(--tap-size);
		padding: 0 18px;
		border-radius: var(--radius-md);
		font-size: 14px;
	}

	.md {
		min-height: 50px;
		padding: 0 22px;
		border-radius: 16px;
		font-size: 16px;
	}

	.lg {
		min-height: 58px;
		padding: 0 22px;
		border-radius: var(--radius-lg);
		font-size: 17px;
	}

	.full {
		width: 100%;
	}

	.primary {
		background: var(--color-primary);
		color: var(--color-on-primary);
	}

	.primary:hover:not(:disabled) {
		background: var(--color-primary-hover);
	}

	.lg.primary {
		box-shadow: var(--shadow-button);
	}

	.secondary {
		background: transparent;
		border-color: var(--color-primary-outline);
		color: var(--color-primary);
	}

	.secondary:hover:not(:disabled) {
		background: var(--color-primary-tint);
	}

	.ghost {
		background: transparent;
		color: var(--color-primary);
	}

	.ghost:hover:not(:disabled) {
		background: var(--color-surface);
	}

	.icon {
		display: inline-flex;
	}

	.loading {
		cursor: progress;
	}
</style>
