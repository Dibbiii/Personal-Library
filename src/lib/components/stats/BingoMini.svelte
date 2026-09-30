<script lang="ts">
	interface Props {
		/** 16 valori, in ordine di posizione (riga per riga). */
		states: boolean[];
		size?: 'md' | 'sm';
	}

	let { states, size = 'md' }: Props = $props();
</script>

<span class="mini {size}" aria-hidden="true">
	{#each Array.from({ length: 16 }, (_, i) => i) as index (index)}
		<span class="dot" class:done={states[index] === true}></span>
	{/each}
</span>

<style>
	.mini {
		display: inline-grid;
		grid-template-columns: repeat(4, var(--dot));
		gap: var(--gap);
		flex-shrink: 0;
	}

	.md {
		--dot: 22px;
		--gap: 6px;
		--border: 1.5px;
		--border-done: 2px;
	}

	.sm {
		--dot: 9px;
		--gap: 4px;
		--border: 1.5px;
		--border-done: 1.5px;
	}

	.dot {
		box-sizing: border-box;
		width: var(--dot);
		height: var(--dot);
		border-radius: 50%;
		border: var(--border) solid color-mix(in srgb, var(--color-primary) 45%, transparent);
	}

	.sm .dot:not(.done) {
		border-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
	}

	.dot.done {
		border: var(--border-done) solid var(--color-primary);
		background: var(--color-accent);
	}
</style>
