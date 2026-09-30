<script lang="ts">
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	interface Props {
		open: boolean;
		title: string;
		/** Posizione 1-based del libro e lunghezza della coda. */
		position: number;
		total: number;
		onclose: () => void;
		onmove: (newPosition: number) => void;
		onremove: () => void;
	}

	let { open, title, position, total, onclose, onmove, onremove }: Props = $props();

	function run(action: () => void) {
		action();
		onclose();
	}
</script>

<!-- Alternativa accessibile al drag: Su / Giu / Rimuovi per ogni libro dei prossimi. -->
<BottomSheet {open} title="Nei prossimi" subtitle={title} {onclose}>
	<ul>
		<li>
			<button
				type="button"
				disabled={position <= 1}
				onclick={() => run(() => onmove(position - 1))}
			>
				<span class="tile"><Icon name="chevron-up" size={22} strokeWidth={2.2} /></span>
				<span class="label">Sposta su</span>
			</button>
		</li>
		<li>
			<button
				type="button"
				disabled={position >= total}
				onclick={() => run(() => onmove(position + 1))}
			>
				<span class="tile"><Icon name="chevron-down" size={22} strokeWidth={2.2} /></span>
				<span class="label">Sposta giù</span>
			</button>
		</li>
		<li>
			<button type="button" onclick={() => run(onremove)}>
				<span class="tile"><Icon name="close" size={22} /></span>
				<span class="label">Rimuovi dai prossimi</span>
			</button>
		</li>
	</ul>
</BottomSheet>

<style>
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li + li {
		border-top: 1px solid var(--color-surface);
	}

	button {
		display: flex;
		align-items: center;
		gap: 14px;
		box-sizing: border-box;
		width: 100%;
		min-height: 60px;
		padding: 0;
		border: 0;
		background: transparent;
		text-align: left;
	}

	button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.tile {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 42px;
		height: 42px;
		border-radius: 14px;
		background: var(--color-surface);
		color: var(--color-primary);
	}

	.label {
		flex: 1;
		font-size: 16px;
		font-weight: 600;
	}
</style>
