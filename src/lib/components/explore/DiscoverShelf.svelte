<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { findOwned, type DiscoverBook, type DiscoverRequest } from '$lib/catalog/discover';
	import DiscoverCard from './DiscoverCard.svelte';
	import { discoverSection } from './discover-load.svelte';

	interface Props {
		title: string;
		subtitle: string;
		query: DiscoverRequest;
		owned: ReadonlyMap<string, string>;
		/** Nasconde i libri già in libreria (per i consigli). */
		hideOwned?: boolean;
		onopen: (book: DiscoverBook) => void;
		onseeall: () => void;
	}

	let { title, subtitle, query, owned, hideOwned = false, onopen, onseeall }: Props = $props();

	const uid = $props.id();
	const section = discoverSection(() => query);
	let track = $state<HTMLUListElement>();
	let atStart = $state(true);
	let atEnd = $state(false);

	const books = $derived(
		hideOwned ? section.books.filter((book) => !findOwned(book, owned)) : section.books
	);

	function updateEdges() {
		if (!track) return;
		atStart = track.scrollLeft < 8;
		atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
	}

	function scrollBy(direction: 1 | -1) {
		if (!track) return;
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		track.scrollBy({
			left: direction * track.clientWidth * 0.85,
			behavior: reduce ? 'auto' : 'smooth'
		});
	}

	$effect(() => {
		void books;
		queueMicrotask(updateEdges);
	});
</script>

<section class="shelf" aria-labelledby="{uid}-title">
	<header>
		<div>
			<h2 id="{uid}-title">{title}</h2>
			<p>{subtitle}</p>
		</div>
		<button type="button" class="see-all" onclick={onseeall}>
			Vedi tutti <Icon name="chevron-right" size={16} strokeWidth={2.2} />
		</button>
	</header>

	<div class="viewport">
		{#if section.loading && books.length === 0}
			<ul class="track" aria-busy="true" aria-label="Caricamento">
				{#each Array.from({ length: 7 }, (_, i) => i) as n (n)}
					<li class="skeleton"><span></span><i></i><i></i></li>
				{/each}
			</ul>
		{:else if section.error}
			<p class="note" role="alert">{section.error}</p>
		{:else if books.length === 0}
			<p class="note">Nessun libro da mostrare qui, per ora.</p>
		{:else}
			<ul class="track" bind:this={track} onscroll={updateEdges}>
				{#each books as book (book.workId)}
					<li><DiscoverCard {book} owned={findOwned(book, owned) !== null} {onopen} /></li>
				{/each}
			</ul>
			{#if !atStart}
				<button
					type="button"
					class="arrow prev"
					aria-label="Libri precedenti: {title}"
					onclick={() => scrollBy(-1)}
				>
					<Icon name="chevron-left" size={20} strokeWidth={2.2} />
				</button>
			{/if}
			{#if !atEnd}
				<button
					type="button"
					class="arrow next"
					aria-label="Altri libri: {title}"
					onclick={() => scrollBy(1)}
				>
					<Icon name="chevron-right" size={20} strokeWidth={2.2} />
				</button>
			{/if}
		{/if}
	</div>
</section>

<style>
	.shelf {
		padding: 18px 0 14px;
		border-radius: var(--radius-xl);
		background: color-mix(in srgb, var(--color-card) 70%, transparent);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-border) 16%, transparent);
	}

	header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		padding: 0 18px;
	}

	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 24px;
		font-weight: 400;
		line-height: 1.15;
		color: var(--color-primary);
	}

	header p {
		margin: 4px 0 0;
		font-size: 13.5px;
		color: var(--color-text-secondary);
	}

	.see-all {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		gap: 4px;
		min-height: 36px;
		padding: 0 4px 0 10px;
		border: 0;
		border-radius: var(--radius-pill);
		background: transparent;
		font-size: 13.5px;
		font-weight: 700;
		color: var(--color-primary);
	}

	.see-all:hover {
		background: var(--color-surface);
	}

	.viewport {
		position: relative;
		margin-top: 14px;
	}

	.track {
		display: flex;
		gap: 16px;
		margin: 0;
		padding: 4px 18px 8px;
		overflow-x: auto;
		list-style: none;
		scroll-snap-type: x proximity;
		scroll-padding-inline: 18px;
		scrollbar-width: none;
	}

	.track::-webkit-scrollbar {
		display: none;
	}

	.track > li {
		flex-shrink: 0;
		scroll-snap-align: start;
	}

	.arrow {
		position: absolute;
		top: 74px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border: 0;
		border-radius: 50%;
		background: var(--color-surface-elevated);
		box-shadow: var(--shadow-card);
		color: var(--color-text-primary);
	}

	.arrow.prev {
		left: 8px;
	}

	.arrow.next {
		right: 8px;
	}

	.arrow:focus-visible,
	.see-all:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.note {
		margin: 0;
		padding: 20px 18px;
		font-size: 14px;
		color: var(--color-text-secondary);
	}

	.skeleton {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 118px;
		animation: pulse 1.4s ease-in-out infinite;
	}

	.skeleton span {
		height: 176px;
		border-radius: 3px 8px 8px 3px;
		background: var(--color-surface);
	}

	.skeleton i {
		height: 11px;
		border-radius: 6px;
		background: var(--color-surface);
	}

	.skeleton i:last-child {
		width: 60%;
	}

	@keyframes pulse {
		50% {
			opacity: 0.55;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.skeleton {
			animation: none;
		}
	}

	@media (hover: none) {
		.arrow {
			display: none;
		}
	}
</style>
