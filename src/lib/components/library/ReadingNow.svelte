<script lang="ts">
	import type { CurrentlyReadingBook } from '$lib/contracts';
	import BookCover from '$lib/components/book/BookCover.svelte';
	import Decoration from './Decoration.svelte';
	import BookHeroCard from './BookHeroCard.svelte';
	import ShelfFrame from './ShelfFrame.svelte';

	interface Props {
		items: CurrentlyReadingBook[];
	}

	let { items }: Props = $props();

	const count = $derived(items.length);
	const pill = $derived(`${count} ${count === 1 ? 'libro' : 'libri'}`);

	// La scheda mostra il libro scelto sullo scaffale (di default il primo).
	let selectedId = $state<string | null>(null);
	const selected = $derived(items.find((entry) => entry.book.id === selectedId) ?? items[0]);

	function percent(entry: CurrentlyReadingBook): number | null {
		const value = entry.reading.progressPercent;
		return value === null ? null : Math.max(0, Math.min(100, Math.round(value)));
	}
</script>

<div class="reading" class:has-hero={selected !== undefined}>
	<ShelfFrame
		title="In lettura"
		accent="var(--color-danger)"
		height={184}
		{pill}
		label="In lettura, {pill}"
		class="reading-frame"
	>
		<Decoration kind="fern" />
		{#each items as entry (entry.book.id)}
			{@const pct = percent(entry)}
			{@const active = entry === selected}
			<button
				type="button"
				class="pick"
				class:active
				aria-pressed={active}
				aria-label="Mostra {entry.book.title}, di {entry.book.author}"
				onclick={() => (selectedId = entry.book.id)}
				onpointerenter={(event) => {
					if (event.pointerType === 'mouse') selectedId = entry.book.id;
				}}
			>
				<BookCover book={entry.book} size="lg" showFormat priority />
				{#if pct !== null}
					<span class="mini-bar" aria-hidden="true"><span style:width="{pct}%"></span></span>
				{/if}
			</button>
		{/each}
		{#if count === 0}
			<p class="none">Nessun libro in lettura. Scegline uno dai prossimi o dagli scaffali.</p>
		{/if}
		<Decoration kind="candle" />
		<Decoration kind="succulent" />
	</ShelfFrame>

	{#if selected}
		<div class="hero-slot"><BookHeroCard book={selected.book} reading={selected.reading} /></div>
	{/if}
</div>

<style>
	.reading {
		position: relative;
	}

	.pick {
		position: relative;
		flex: none;
		margin: 0 6px;
		padding: 0;
		border: 0;
		border-radius: 3px 8px 8px 3px;
		background: none;
		cursor: pointer;
		transition: transform var(--duration-fast) var(--ease-out);
	}

	.pick:hover,
	.pick.active {
		transform: translateY(-6px);
	}

	.pick:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 3px;
	}

	.pick.active::after {
		content: '';
		position: absolute;
		left: 50%;
		bottom: -12px;
		width: 6px;
		height: 6px;
		margin-left: -3px;
		border-radius: 50%;
		background: var(--color-primary);
	}

	.mini-bar {
		position: absolute;
		z-index: 2;
		left: 12%;
		right: 12%;
		bottom: 10px;
		height: 4px;
		overflow: hidden;
		border-radius: 2px;
		background: color-mix(in srgb, var(--color-on-genre-white) 55%, transparent);
	}

	.mini-bar span {
		display: block;
		height: 100%;
		background: var(--color-danger);
	}

	.none {
		align-self: center;
		max-width: 260px;
		margin: 0 12px;
		color: var(--color-text-secondary);
		font-size: 13px;
	}

	.hero-slot {
		margin-top: 14px;
	}

	/* Desktop largo: la scheda si sovrappone alla parte destra dello scaffale, come nel mockup. */
	@media (min-width: 1200px) {
		.has-hero :global(.reading-frame .row) {
			padding-right: calc(min(640px, 58%) + 24px) !important;
		}

		.hero-slot {
			position: absolute;
			z-index: 3;
			top: -36px;
			right: 18px;
			width: min(640px, 58%);
			margin: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pick {
			transition: none;
		}
	}
</style>
