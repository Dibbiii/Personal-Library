<script lang="ts">
	import { STAR_PATH } from './icons';

	interface Props {
		/** Voto da 1 a 5, null/0 se non valutato. */
		value: number | null;
		max?: number;
		/** Dimensione della stella in px. */
		size?: number;
		readonly?: boolean;
		/** Con clearable, toccare di nuovo la stella selezionata azzera il voto. */
		clearable?: boolean;
		label?: string;
		onchange?: (value: number | null) => void;
	}

	let {
		value = $bindable(),
		max = 5,
		size = 18,
		readonly = true,
		clearable = false,
		label = 'Voto',
		onchange
	}: Props = $props();

	const current = $derived(value ?? 0);
	const stars = $derived(Array.from({ length: max }, (_, i) => i + 1));

	function plural(n: number) {
		return `${n} ${n === 1 ? 'stella' : 'stelle'}`;
	}

	function select(next: number) {
		const result = clearable && next === current ? null : next;
		value = result;
		onchange?.(result);
	}

	function onKeydown(event: KeyboardEvent) {
		let next: number | null = null;
		if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(max, current + 1);
		else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown')
			next = Math.max(1, current - 1);
		else if (event.key === 'Home') next = 1;
		else if (event.key === 'End') next = max;
		if (next === null) return;
		event.preventDefault();
		value = next;
		onchange?.(next);
		(event.currentTarget as HTMLElement)
			.querySelector<HTMLElement>(`[data-star="${next}"]`)
			?.focus();
	}
</script>

{#snippet star(n: number)}
	<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" class:on={n <= current}>
		<path d={STAR_PATH} stroke-width="1.2" stroke-linejoin="round" />
	</svg>
{/snippet}

{#if readonly}
	<span
		class="stars"
		role="img"
		aria-label={current > 0 ? `${plural(current)} su ${max}` : 'Non valutato'}
	>
		{#each stars as n (n)}{@render star(n)}{/each}
	</span>
{:else}
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<span class="stars interactive" role="radiogroup" aria-label={label} onkeydown={onKeydown}>
		{#each stars as n (n)}
			<button
				type="button"
				role="radio"
				class="star-btn"
				data-star={n}
				aria-checked={n === current}
				aria-label={plural(n)}
				tabindex={n === current || (current === 0 && n === 1) ? 0 : -1}
				onclick={() => select(n)}
			>
				{@render star(n)}
			</button>
		{/each}
	</span>
{/if}

<style>
	.stars {
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}

	.interactive {
		gap: 0;
	}

	svg {
		flex-shrink: 0;
		fill: color-mix(in srgb, var(--genre-current) 22%, transparent);
		stroke: color-mix(in srgb, var(--genre-current) 22%, transparent);
	}

	svg.on {
		fill: var(--genre-current);
		stroke: var(--genre-current);
	}

	.star-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: var(--tap-size);
		min-height: var(--tap-size);
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: transparent;
	}
</style>
