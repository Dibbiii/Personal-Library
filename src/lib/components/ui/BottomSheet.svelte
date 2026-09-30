<script lang="ts">
	import type { Snippet } from 'svelte';
	import Modal from './Modal.svelte';

	interface Props {
		open: boolean;
		title: string;
		/** Riga secondaria sotto il titolo (es. titolo del libro). */
		subtitle?: string;
		onclose: () => void;
		children: Snippet;
		/** Barra azioni fissa in fondo (es. Annulla / Salva). */
		footer?: Snippet;
	}

	let { open, title, subtitle, onclose, children, footer }: Props = $props();

	const uid = $props.id();
</script>

<Modal {open} placement="bottom" labelledby="{uid}-title" {onclose}>
	<div class="handle" aria-hidden="true"></div>
	<h2 id="{uid}-title" class="title">{title}</h2>
	{#if subtitle}<p class="subtitle">{subtitle}</p>{/if}
	<div class="body">{@render children()}</div>
	{#if footer}<div class="footer">{@render footer()}</div>{/if}
</Modal>

<style>
	.handle {
		width: 40px;
		height: 4px;
		margin: 0 auto 12px;
		border-radius: 2px;
		background: var(--color-sheet-handle);
	}

	.title {
		font-size: 20px;
		line-height: 1.2;
		color: var(--color-text-primary);
	}

	.subtitle {
		margin: 2px 0 6px;
		font-size: 13px;
		color: var(--color-text-secondary);
	}

	.body {
		margin-top: 6px;
	}

	.footer {
		display: flex;
		gap: 12px;
		margin-top: 18px;
	}

	.footer > :global(*) {
		flex: 1;
	}
</style>
