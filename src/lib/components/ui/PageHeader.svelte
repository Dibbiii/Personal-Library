<script lang="ts">
	import type { Snippet } from 'svelte';
	import IconButton from './IconButton.svelte';

	interface Props {
		title: string;
		subtitle?: string;
		/** Se presente mostra il pulsante indietro (cerchio chiaro 44px come nei mockup). */
		backHref?: string;
		actions?: Snippet;
	}

	let { title, subtitle, backHref, actions }: Props = $props();
</script>

<header class="page-header">
	{#if backHref}
		<IconButton icon="chevron-left" label="Indietro" href={backHref} />
	{/if}
	<div class="text">
		<h1>{title}</h1>
		{#if subtitle}<p>{subtitle}</p>{/if}
	</div>
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
</header>

<style>
	.page-header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 20px var(--page-gutter) 12px;
	}

	.text {
		flex: 1;
		min-width: 0;
	}

	h1 {
		font-size: 32px;
		line-height: 1.1;
		color: var(--color-primary);
	}

	p {
		margin: 2px 0 0;
		font-size: 13px;
		color: var(--color-text-secondary);
	}

	.actions {
		display: flex;
		gap: 8px;
		flex-shrink: 0;
	}

	@media (min-width: 1024px) {
		.page-header {
			padding-top: 36px;
		}

		h1 {
			font-size: 36px;
		}
	}
</style>
