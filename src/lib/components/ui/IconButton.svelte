<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';
	import type { IconName } from './icons';

	interface Props extends Omit<HTMLButtonAttributes, 'children' | 'class' | 'aria-label'> {
		icon: IconName;
		/** Testo per screen reader (obbligatorio: il pulsante non ha testo visibile). */
		label: string;
		variant?: 'soft' | 'ghost';
		/** 44 per le barre di navigazione, 48 per l'header della Home. */
		size?: 44 | 48;
		href?: string;
		iconSize?: number;
		class?: string;
	}

	let {
		icon,
		label,
		variant = 'soft',
		size = 44,
		href,
		iconSize = 22,
		type = 'button',
		class: className,
		...rest
	}: Props = $props();
</script>

{#if href}
	<a class="icon-btn {variant} {className ?? ''}" {href} aria-label={label} style:--size="{size}px">
		<Icon name={icon} size={iconSize} />
	</a>
{:else}
	<button
		class="icon-btn {variant} {className ?? ''}"
		{type}
		aria-label={label}
		style:--size="{size}px"
		{...rest}
	>
		<Icon name={icon} size={iconSize} />
	</button>
{/if}

<style>
	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		box-sizing: border-box;
		width: var(--size);
		height: var(--size);
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: var(--color-surface);
		color: var(--color-primary);
		text-decoration: none;
		transition: background-color var(--duration-fast) var(--ease-out);
	}

	.icon-btn:hover {
		background: var(--color-surface-pressed);
	}

	.ghost {
		background: transparent;
	}

	.ghost:hover {
		background: var(--color-surface);
	}
</style>
