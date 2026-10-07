<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { DnfBook } from '$lib/contracts';
	import Tombstone from './Tombstone.svelte';

	interface Props {
		books: DnfBook[];
	}

	let { books }: Props = $props();

	// Posizioni decorative (% della larghezza utile) di petali e fiori: niente animazioni.
	const petals = [
		{ left: 37, top: 25, rotate: 30 },
		{ left: 52, top: 38, rotate: 120 },
		{ left: 8, top: 42, rotate: 60 },
		{ left: 88, top: 14, rotate: 160 },
		{ left: 70, top: 30, rotate: 80 }
	];
	const flowers = [
		{ left: 2, bottom: 8 },
		{ left: 37, bottom: 14 },
		{ left: 67, bottom: 6 },
		{ left: 92, bottom: 12 }
	];
</script>

<section class="cemetery" aria-labelledby="dnf-heading" data-testid="dnf-cemetery">
	{#each petals as petal, i (i)}
		<span
			class="petal"
			aria-hidden="true"
			style="left: {petal.left}%; top: {petal.top}%; transform: rotate({petal.rotate}deg)"
		></span>
	{/each}

	<header>
		<span class="tile"><Icon name="flower" size={22} strokeWidth={1.8} /></span>
		<h2 id="dnf-heading">Cimitero DNF</h2>
	</header>
	<p class="intro">Libri lasciati a metà, senza rancore. Un fiore per ognuno.</p>

	{#if books.length > 0}
		<ul class="tombs">
			{#each books as item (item.book.id)}
				<li>
					<Tombstone book={item.book} page={item.stoppedAtPage} />
				</li>
			{/each}
		</ul>
	{:else}
		<p class="empty" data-testid="dnf-empty">
			Nessun libro riposa qui, per ora. Se ne lascerai uno a metà, troverà il suo fiore.
		</p>
	{/if}

	<div class="ground" aria-hidden="true">
		<svg viewBox="0 0 350 34" preserveAspectRatio="none" width="100%" height="34">
			<path
				d="M0 34V18c20-8 30 4 55-2s30-10 60-2 40 6 70-2 50-8 80 0 40 6 85-2V34z"
				fill="var(--color-divider)"
				opacity=".55"
			/>
		</svg>
		<div class="flowers">
			{#each flowers as flower, i (i)}
				<span class="flower" style="left: {flower.left}%; bottom: {flower.bottom}px">
					<svg
						width="22"
						height="22"
						viewBox="0 0 24 24"
						fill="none"
						stroke="var(--color-primary-deep)"
						stroke-width="1.6"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="12" cy="12" r="2.2" />
						<path
							d="M12 9.8C12 7 13 5 12 3.5 11 5 12 7 12 9.8zM14.2 12c2.8 0 4.8 1 6.3 0-1.5-1-3.5 0-6.3 0zM12 14.2c0 2.8-1 4.8 0 6.3 1-1.5 0-3.5 0-6.3zM9.8 12C7 12 5 11 3.5 12c1.5 1 3.5 0 6.3 0z"
						/>
					</svg>
				</span>
			{/each}
		</div>
	</div>
</section>

<style>
	.cemetery {
		position: relative;
		box-sizing: border-box;
		min-width: 0;
		padding: 20px 14px 0;
		border: 1.5px solid color-mix(in srgb, var(--color-divider) 35%, transparent);
		border-radius: 28px;
		background: var(--color-graveyard-bg);
		overflow: hidden;
	}

	.petal {
		position: absolute;
		width: 9px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-accent);
		opacity: 0.85;
		pointer-events: none;
	}

	header {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.tile {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 12px;
		background: color-mix(in srgb, var(--color-divider) 28%, transparent);
		color: var(--color-shelf-axis);
	}

	h2 {
		font-size: 24px;
		line-height: 1.1;
		color: var(--color-shelf-axis);
	}

	.intro {
		margin: 8px 0 18px;
		font-size: 14px;
		line-height: 20px;
		color: var(--color-shelf-axis);
	}

	.tombs {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 14px 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.tombs li {
		display: flex;
		flex-direction: column;
	}

	.tombs li :global(.tomb) {
		flex: 1;
	}

	.tombs li:nth-child(3n + 1) {
		transform: rotate(-2deg);
	}

	.tombs li:nth-child(3n + 2) {
		transform: rotate(1.5deg);
	}

	.tombs li:nth-child(3n) {
		transform: rotate(-1deg);
	}

	.empty {
		margin: 0 0 18px;
		padding: 18px 16px;
		border-radius: 20px;
		background: color-mix(in srgb, var(--color-tomb-top) 70%, transparent);
		font-size: 14px;
		line-height: 20px;
		color: var(--color-shelf-axis);
		text-align: center;
	}

	.ground {
		position: relative;
		height: 46px;
		margin: -6px -14px 0;
	}

	.ground svg {
		position: relative;
		display: block;
		margin-top: -14px;
	}

	.ground::before {
		content: '';
		position: absolute;
		inset: 20px 0 0;
		background: color-mix(in srgb, var(--color-divider) 55%, transparent);
	}

	.flowers {
		position: absolute;
		inset: 0 14px;
	}

	.flower {
		position: absolute;
		line-height: 0;
		margin-left: -2px;
	}

	@media (min-width: 640px) {
		.tombs {
			grid-template-columns: repeat(auto-fit, minmax(150px, 200px));
			justify-content: center;
			gap: 18px 16px;
		}
	}
</style>
