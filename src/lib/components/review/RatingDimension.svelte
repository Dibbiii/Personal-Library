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

	function select(star: number, event: MouseEvent) {
		const rect =
			event.currentTarget instanceof HTMLElement
				? event.currentTarget.getBoundingClientRect()
				: null;
		const next = rect && event.clientX < rect.left + rect.width / 2 ? star - 0.5 : star;
		onchange(next === current ? null : next);
	}

	function onkeydown(event: KeyboardEvent) {
		let next: number | null = null;
		if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(max, current + 0.5);
		else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown')
			next = Math.max(0.5, current - 0.5);
		else if (event.key === 'Home') next = 0.5;
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
			.querySelector<HTMLElement>(`[data-star="${Math.ceil(next)}"]`)
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
				aria-checked={Math.ceil(current) === n}
				aria-label={`${n - 0.5} o ${n} stelle`}
				tabindex={Math.ceil(current) === n || (current === 0 && n === 1) ? 0 : -1}
				onclick={(event) => select(n, event)}
			>
				<span class="star" aria-hidden="true">
					<svg class="empty" width="20" height="20" viewBox="0 0 24 24">
						<path d={STAR_PATH} stroke-width="1.2" stroke-linejoin="round" />
					</svg>
					<span class="fill" style:width={`${Math.max(0, Math.min(1, current - n + 1)) * 100}%`}>
						<svg width="20" height="20" viewBox="0 0 24 24">
							<path d={STAR_PATH} stroke-width="1.2" stroke-linejoin="round" />
						</svg>
					</span>
				</span>
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

	.star {
		position: relative;
		display: inline-flex;
		width: 20px;
		height: 20px;
	}

	svg {
		display: block;
		fill: color-mix(in srgb, var(--genre-current) 22%, transparent);
		stroke: color-mix(in srgb, var(--genre-current) 22%, transparent);
	}

	.fill {
		position: absolute;
		inset: 0 auto 0 0;
		overflow: hidden;
	}

	.fill svg {
		max-width: none;
		fill: var(--genre-current);
		stroke: var(--genre-current);
	}
</style>
