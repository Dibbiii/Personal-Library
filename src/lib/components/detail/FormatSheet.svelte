<script lang="ts">
	import { untrack } from 'svelte';
	import type { BookFormat } from '$lib/contracts';
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	interface Props {
		open: boolean;
		title: string;
		format: BookFormat;
		busy?: boolean;
		error?: string | null;
		onclose: () => void;
		onsave: (format: BookFormat) => void;
	}

	let { open, title, format, busy = false, error = null, onclose, onsave }: Props = $props();
	const uid = $props.id();
	let selected = $state<BookFormat>(untrack(() => format));

	$effect(() => {
		if (open) selected = format;
	});

	function submit() {
		if (!busy) onsave(selected);
	}
</script>

<BottomSheet {open} title="Modifica formato" subtitle={title} {onclose}>
	<form
		class="form"
		method="dialog"
		onsubmit={(event) => {
			event.preventDefault();
			submit();
		}}
	>
		<fieldset disabled={busy} aria-describedby={error ? `${uid}-error` : undefined}>
			<legend>Formato posseduto</legend>
			<p class="hint">Se possiedi entrambe le versioni, seleziona “Entrambi”.</p>
			<label>
				<input type="radio" name="format" value="physical" bind:group={selected} />
				<span>Cartaceo</span>
			</label>
			<label>
				<input type="radio" name="format" value="digital" bind:group={selected} />
				<span>Digitale</span>
			</label>
			<label>
				<input type="radio" name="format" value="both" bind:group={selected} />
				<span>Entrambi</span>
			</label>
		</fieldset>

		{#if error}<p id="{uid}-error" class="error" role="alert">{error}</p>{/if}

		<div class="actions">
			<Button variant="secondary" type="button" fullWidth disabled={busy} onclick={onclose}
				>Annulla</Button
			>
			<Button type="submit" fullWidth loading={busy}>Salva formato</Button>
		</div>
	</form>
</BottomSheet>

<style>
	.form {
		display: grid;
		gap: 20px;
	}

	fieldset {
		display: grid;
		gap: 10px;
		margin: 0;
		padding: 0;
		border: 0;
	}

	legend {
		font-size: 16px;
		font-weight: 700;
	}

	.hint {
		margin: -4px 0 2px;
		color: var(--color-text-secondary);
		font-size: 14px;
		line-height: 1.4;
	}

	label {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 48px;
		padding: 0 14px;
		border: 1px solid var(--color-border);
		border-radius: 14px;
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
	}

	input {
		accent-color: var(--color-primary);
	}

	label:has(input:focus-visible) {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	label:has(input:checked) {
		border-color: var(--color-primary);
		background: var(--color-surface);
	}

	.error {
		margin: -8px 0 0;
		color: var(--color-error, var(--color-danger));
		font-size: 14px;
	}

	.actions {
		display: flex;
		gap: 12px;
	}

	.actions :global(*) {
		flex: 1;
	}
</style>
