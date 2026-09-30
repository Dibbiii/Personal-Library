<script lang="ts">
	import { STAR_PATH } from '$lib/components/ui/icons';

	interface Props {
		label: string;
		/** 1-5, null se non valutata. */
		value: number | null;
		max?: number;
		/** Toccare di nuovo la stella selezionata azzera il punteggio (le dimensioni sono facoltative). */
		onchange: (value: number | null) => void;
	}

	let { label, value, max = 5, onchange }: Props = $props();

	const uid = $props.id();
	const current = $derived(value ?? 0);
	const stars = $derived(Array.from({ length: max }, (_, i) => i + 1));

	function select(next: number) {
		onchange(next === current ? null : next);
	}

	function onkeydown(event: KeyboardEvent) {
		let next: number | null = null;
		if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(max, current + 1);
		else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown')
			next = Math.max(1, current - 1);
		else if (event.key === 'Home') next = 1;
		else if (event.key === 'End') next = max;
		else if (event.key === 'Delete' || event.key === 'Backspace') {
			event.preventDefault();
			onchange(null);
			return;
		}
		if (next === null) return;
		event.preventDefault();
		onchange(next);
		(event.currentTarget as HTMLElement)
			.querySelector<HTMLElement>(`[data-star="${next}"]`)
			?.focus();
	}
</script>

<div class="row">
	<span id="{uid}-label" class="label">{label}</span>
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div class="stars" role="radiogroup" aria-labelledby="{uid}-label" {onkeydown}>
		{#each stars as n (n)}
			<button
				type="button"
				role="radio"
				data-star={n}
				aria-checked={n === current}
				aria-label={n === 1 ? '1 stella' : `${n} stelle`}
				tabindex={n === current || (current === 0 && n === 1) ? 0 : -1}
				onclick={() => select(n)}
			>
				<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" class:on={n <= current}>
					<path d={STAR_PATH} stroke-width="1.2" stroke-linejoin="round" />
				</svg>
			</button>
		{/each}
	</div>
</div>

<style>
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		min-height: 44px;
	}

	.label {
		min-width: 0;
		font-size: 14.5px;
		line-height: 1.25;
		color: var(--color-text-primary);
	}

	.stars {
		display: flex;
		flex-shrink: 0;
		margin-right: -4px;
	}

	/* 20px di stella, 30x44 di area di tocco: cinque stelle restano in 150px anche a 320px */
	button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 44px;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
	}

	svg {
		fill: color-mix(in srgb, var(--genre-current) 22%, transparent);
		stroke: color-mix(in srgb, var(--genre-current) 22%, transparent);
	}

	svg.on {
		fill: var(--genre-current);
		stroke: var(--genre-current);
	}
</style>
