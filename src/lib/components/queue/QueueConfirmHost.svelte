<script lang="ts">
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import BookCover from '$lib/components/book/BookCover.svelte';
	import { queueConfirm } from '$lib/client/queue.svelte';

	const covers = $derived(queueConfirm.queue.slice(0, 3));
	const count = $derived(queueConfirm.count);
	const title = $derived(
		`Hai già ${count} ${count === 1 ? 'libro' : 'libri'} nelle prossime letture. Vuoi aggiungerlo comunque?`
	);
	const accent = $derived(
		queueConfirm.genre ? `var(--genre-${queueConfirm.genre})` : 'var(--color-divider)'
	);
	const accentDark = $derived(
		queueConfirm.genre ? `var(--genre-${queueConfirm.genre}-dark)` : 'var(--color-shelf-axis)'
	);
</script>

<!-- Dialog globale del soft limit (mockup 04): montato una volta nel layout (app). -->
<ConfirmDialog
	open={queueConfirm.open}
	{title}
	confirmLabel="Aggiungi comunque"
	busy={queueConfirm.busy}
	onconfirm={() => queueConfirm.confirm()}
	oncancel={() => queueConfirm.cancel()}
>
	{#snippet illustration()}
		<div class="row" aria-hidden="true" style:--accent={accent} style:--accent-dark={accentDark}>
			{#each covers as entry (entry.book.id)}
				<BookCover book={entry.book} size="xs" noImage={false} />
			{/each}
			<span class="plus"><Icon name="plus" size={16} strokeWidth={2.4} /></span>
			<span class="slot"><Icon name="plus" size={18} strokeWidth={2} /></span>
		</div>
	{/snippet}
</ConfirmDialog>

<style>
	.row {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		gap: 8px;
	}

	.plus {
		display: flex;
		padding-bottom: 26px;
		color: var(--color-shelf-axis);
	}

	.slot {
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		width: 46px;
		height: 68px;
		border: 2px dashed color-mix(in srgb, var(--accent) 80%, transparent);
		border-radius: 6px;
		background: color-mix(in srgb, var(--accent) 15%, transparent);
		color: var(--accent-dark);
	}
</style>
