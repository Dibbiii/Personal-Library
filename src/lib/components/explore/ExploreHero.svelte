<script lang="ts">
	import Decoration from '$lib/components/library/Decoration.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	interface Props {
		/** Testo nel campo di ricerca. */
		value: string;
		/** Ricerca confermata (invio o pausa nella digitazione). */
		onsearch: (text: string) => void;
	}

	let { value = $bindable(), onsearch }: Props = $props();

	const uid = $props.id();
	let timer: ReturnType<typeof setTimeout> | undefined;

	function oninput() {
		clearTimeout(timer);
		timer = setTimeout(() => onsearch(value.trim()), 450);
	}

	function onsubmit(event: SubmitEvent) {
		event.preventDefault();
		clearTimeout(timer);
		onsearch(value.trim());
	}

	function clear() {
		value = '';
		clearTimeout(timer);
		onsearch('');
	}
</script>

<section class="hero" aria-labelledby="{uid}-title">
	<div class="art" aria-hidden="true">
		<!-- Finestra ad arco sul tramonto: solo forme piatte con i colori del tema. -->
		<svg class="window" viewBox="0 0 420 300" preserveAspectRatio="xMidYMax slice">
			<defs>
				<linearGradient id="{uid}-sky" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" class="sky-top" />
					<stop offset="0.6" class="sky-mid" />
					<stop offset="1" class="sky-low" />
				</linearGradient>
				<clipPath id="{uid}-arch">
					<path d="M90 300V128a120 120 0 0 1 240 0v172z" />
				</clipPath>
			</defs>
			<path class="wall" d="M0 0h420v300H0z" />
			<g clip-path="url(#{uid}-arch)">
				<rect x="80" y="0" width="260" height="300" fill="url(#{uid}-sky)" />
				<circle class="sun" cx="250" cy="196" r="34" />
				<path class="hill-far" d="M80 214c40-18 70-22 110-12s70 6 100-6 40-8 50-2v106H80z" />
				<g class="city">
					<rect x="150" y="180" width="14" height="40" />
					<rect x="168" y="190" width="18" height="30" />
					<path d="M196 220v-30a26 26 0 0 1 52 0v30z" />
					<rect x="219" y="150" width="6" height="16" />
					<path d="M222 140l4 10h-8z" />
					<rect x="254" y="186" width="16" height="34" />
					<rect x="274" y="196" width="22" height="24" />
				</g>
				<path class="hill-near" d="M80 236c50-14 90-10 130 0s90 10 130-4v68H80z" />
				<path class="mullion" d="M207 0h6v300h-6zM80 176h260v5H80z" />
			</g>
			<path
				class="frame"
				d="M90 300V128a120 120 0 0 1 240 0v172h-10V128a110 110 0 0 0-220 0v172z"
			/>
			<rect class="sill" x="60" y="262" width="300" height="14" rx="3" />
			<rect class="sill-shadow" x="66" y="276" width="288" height="6" rx="2" />
		</svg>
		<span class="deco plant"><Decoration kind="trailing" /></span>
		<span class="deco stack"><Decoration kind="stack" /></span>
		<span class="deco mug"><Decoration kind="mug" /></span>
		<span class="deco candle"><Decoration kind="candle" /></span>
	</div>

	<div class="content">
		<h1 id="{uid}-title">Scopri il tuo prossimo libro</h1>
		<p>Esplora, lasciati ispirare e trova nuove storie da aggiungere alla tua libreria.</p>
		<form class="search" role="search" {onsubmit}>
			<label class="sr-only" for="{uid}-q">Cerca libri, autori, generi</label>
			<Icon name="search" size={22} />
			<input
				id="{uid}-q"
				type="search"
				autocomplete="off"
				enterkeyhint="search"
				placeholder="Cerca libri, autori, generi…"
				bind:value
				{oninput}
			/>
			{#if value}
				<button type="button" class="clear" aria-label="Cancella la ricerca" onclick={clear}>
					<Icon name="close" size={18} strokeWidth={2.2} />
				</button>
			{/if}
		</form>
	</div>
</section>

<style>
	.hero {
		position: relative;
		isolation: isolate;
		overflow: hidden;
		min-height: 220px;
		border-radius: var(--radius-xl);
		background:
			radial-gradient(
				ellipse 60% 90% at 78% 70%,
				color-mix(in srgb, var(--color-flame) 30%, transparent),
				transparent 70%
			),
			linear-gradient(
				110deg,
				var(--color-primary-deep) 0%,
				color-mix(in srgb, var(--color-primary-deep) 70%, var(--color-wood-detail-bottom)) 45%,
				var(--color-wood-detail-bottom)
			);
		box-shadow: 0 18px 40px -26px color-mix(in srgb, var(--color-shadow) 60%, transparent);
		color: var(--color-on-primary);
	}

	.art {
		position: absolute;
		z-index: -1;
		inset: 0 0 0 auto;
		width: min(62%, 520px);
		-webkit-mask-image: linear-gradient(90deg, transparent, var(--color-shadow) 30%);
		mask-image: linear-gradient(90deg, transparent, var(--color-shadow) 30%);
	}

	.window {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.wall {
		fill: color-mix(in srgb, var(--color-wood-detail-bottom) 55%, transparent);
	}

	.sky-top {
		stop-color: color-mix(in srgb, var(--color-primary) 55%, var(--color-flame));
	}

	.sky-mid {
		stop-color: var(--color-flame);
	}

	.sky-low {
		stop-color: color-mix(in srgb, var(--color-flame-core) 80%, var(--color-surface));
	}

	.sun {
		fill: color-mix(in srgb, var(--color-flame-core) 85%, var(--color-surface));
		opacity: 0.9;
	}

	.hill-far {
		fill: color-mix(in srgb, var(--color-primary) 45%, var(--color-flame));
		opacity: 0.75;
	}

	.city {
		fill: color-mix(in srgb, var(--color-primary-deep) 65%, var(--color-flame));
		opacity: 0.8;
	}

	.hill-near {
		fill: color-mix(in srgb, var(--color-primary-deep) 80%, var(--color-wood-detail-bottom));
	}

	.mullion,
	.frame {
		fill: var(--color-wood-detail-mid);
	}

	.sill {
		fill: var(--color-wood-top);
	}

	.sill-shadow {
		fill: color-mix(in srgb, var(--color-shadow) 35%, transparent);
	}

	.deco {
		position: absolute;
		bottom: calc(12% + 6px);
		display: block;
		line-height: 0;
	}

	.plant {
		right: 74%;
		bottom: calc(12% + 4px);
	}

	.stack {
		right: 54%;
	}

	.mug {
		right: 28%;
	}

	.candle {
		right: 14%;
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: 12px;
		max-width: 560px;
		padding: 28px 22px 26px;
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(30px, 4.4vw, 44px);
		font-weight: 400;
		line-height: 1.05;
		text-wrap: balance;
	}

	p {
		max-width: 400px;
		margin: 0;
		font-size: 16px;
		line-height: 1.45;
		opacity: 0.92;
	}

	.search {
		position: relative;
		display: flex;
		align-items: center;
		gap: 10px;
		max-width: 520px;
		min-height: 50px;
		margin-top: 8px;
		padding: 0 6px 0 18px;
		border-radius: var(--radius-md);
		background: var(--color-surface-elevated);
		box-shadow: 0 10px 24px -14px color-mix(in srgb, var(--color-shadow) 70%, transparent);
		color: var(--color-text-primary);
	}

	.search:focus-within {
		outline: 2px solid var(--color-flame-core);
		outline-offset: 2px;
	}

	input {
		flex: 1;
		min-width: 0;
		height: 48px;
		border: 0;
		background: transparent;
		font: inherit;
		font-size: 16px;
		color: inherit;
		appearance: none;
	}

	input:focus {
		outline: none;
	}

	input::placeholder {
		color: var(--color-text-muted);
	}

	input::-webkit-search-cancel-button {
		display: none;
	}

	.clear {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: var(--color-text-secondary);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	@media (max-width: 719px) {
		.art {
			width: 70%;
			opacity: 0.45;
		}

		.deco {
			display: none;
		}
	}

	@media (min-width: 720px) {
		.hero {
			min-height: 250px;
		}

		.content {
			padding: 36px 40px 34px;
		}
	}
</style>
