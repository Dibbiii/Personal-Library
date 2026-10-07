<script lang="ts">
	import { onDestroy } from 'svelte';
	import { prepareCoverFile } from '$lib/catalog/image';
	import Button from '$lib/components/ui/Button.svelte';
	let {
		onchange,
		onbusychange = () => {}
	}: { onchange: (file: File | null) => void; onbusychange?: (busy: boolean) => void } = $props();
	let preview = $state<string | null>(null);
	let error = $state('');
	let busy = $state(false);
	let generation = 0;
	function clear() {
		generation++;
		if (preview) URL.revokeObjectURL(preview);
		preview = null;
		error = '';
		busy = false;
		onbusychange(false);
		onchange(null);
	}
	async function choose(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		const current = ++generation;
		busy = true;
		onbusychange(true);
		error = '';
		try {
			const ready = await prepareCoverFile(file);
			if (current !== generation) return;
			if (preview) URL.revokeObjectURL(preview);
			preview = URL.createObjectURL(ready);
			onchange(ready);
		} catch (caught) {
			if (current === generation)
				error = caught instanceof Error ? caught.message : 'Immagine non valida.';
		} finally {
			if (current === generation) {
				busy = false;
				onbusychange(false);
			}
		}
	}
	onDestroy(() => {
		generation++;
		if (preview) URL.revokeObjectURL(preview);
	});
</script>

<div class="attachment">
	<span>Copertina personale (facoltativa)</span>
	<div class="choices">
		<label
			>Carica una copertina<input
				type="file"
				accept="image/png,image/jpeg,image/webp"
				disabled={busy}
				onchange={choose}
			/></label
		>
		<label
			>Fotografa la copertina<input
				type="file"
				accept="image/png,image/jpeg,image/webp"
				capture="environment"
				disabled={busy}
				onchange={choose}
			/></label
		>
	</div>
	{#if busy}<p role="status">Preparo l’immagine…</p>{/if}
	{#if preview}<img
			src={preview}
			alt="Anteprima della copertina personale"
			width="80"
			height="120"
		/><Button variant="ghost" onclick={clear}>Rimuovi la foto scelta</Button>{/if}
	{#if error}<p role="alert">{error}</p>{/if}
</div>

<style>
	.attachment {
		display: grid;
		gap: 10px;
		margin-block: 12px;
	}
	.choices {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}
	.choices label {
		display: grid;
		gap: 6px;
		font-size: 0.85rem;
	}
	.choices input {
		max-width: 100%;
	}
	img {
		object-fit: contain;
		border-radius: var(--radius-sm);
	}
</style>
