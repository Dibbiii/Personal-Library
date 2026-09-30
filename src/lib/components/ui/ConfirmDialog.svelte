<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';
	import Modal from './Modal.svelte';

	interface Props {
		open: boolean;
		title: string;
		description?: string;
		confirmLabel: string;
		cancelLabel?: string;
		onconfirm: () => void;
		oncancel: () => void;
		/** Disabilita i pulsanti mentre l'azione è in corso. */
		busy?: boolean;
		/** Illustrazione sopra al titolo (es. i libri della coda). */
		illustration?: Snippet;
	}

	let {
		open,
		title,
		description,
		confirmLabel,
		cancelLabel = 'Annulla',
		onconfirm,
		oncancel,
		busy = false,
		illustration
	}: Props = $props();

	const uid = $props.id();
</script>

<Modal
	{open}
	placement="center"
	role="alertdialog"
	labelledby="{uid}-title"
	describedby={description ? `${uid}-desc` : undefined}
	onclose={oncancel}
>
	{#if illustration}<div class="illustration">{@render illustration()}</div>{/if}
	<h2 id="{uid}-title" class="title">{title}</h2>
	{#if description}<p id="{uid}-desc" class="description">{description}</p>{/if}
	<div class="actions">
		<Button fullWidth loading={busy} onclick={onconfirm}>{confirmLabel}</Button>
		<Button variant="secondary" fullWidth disabled={busy} onclick={oncancel} data-autofocus>
			{cancelLabel}
		</Button>
	</div>
</Modal>

<style>
	.illustration {
		display: flex;
		justify-content: center;
		margin-bottom: 18px;
	}

	.title {
		margin-bottom: 20px;
		font-size: 19px;
		line-height: 1.3;
		text-align: center;
	}

	.description {
		margin: -8px 0 20px;
		font-size: 14px;
		line-height: 20px;
		text-align: center;
		color: var(--color-text-secondary);
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
</style>
