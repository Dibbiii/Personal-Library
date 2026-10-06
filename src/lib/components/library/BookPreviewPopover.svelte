<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { startReading } from '$lib/client/reading';
	import { QUEUE_DEPENDENCY } from '$lib/client/queue-keys';
	import BookHeroCard from './BookHeroCard.svelte';
	import type { HoverPreview } from './hover-preview.svelte';
	import type { HomeDnd } from './home-dnd.svelte';
	import type { HomeState } from './home-state.svelte';

	interface Props {
		preview: HoverPreview;
		home: HomeState;
		dnd: HomeDnd;
	}

	let { preview, home, dnd }: Props = $props();

	const GAP = 14;
	const MARGIN = 16;
	let width = $state(0);
	let height = $state(0);
	let viewport = $state({ w: 0, h: 0, left: 0 });

	const book = $derived(preview.book);
	const reading = $derived(
		book ? (home.reading.find((entry) => entry.book.id === book.id)?.reading ?? null) : null
	);

	/**
	 * Di fianco al libro come nel mockup: a destra se c'e' posto, poi a sinistra; per righe larghe
	 * (vista elenco) sotto o sopra. Mai sopra la sidebar: il limite sinistro e' l'inizio del contenuto.
	 */
	const position = $derived.by(() => {
		const anchor = preview.anchor;
		if (!anchor || !width || !height) return null;
		const minLeft = viewport.left + MARGIN;
		const maxLeft = viewport.w - width - MARGIN;
		const clampTop = (top: number) => Math.max(MARGIN, Math.min(top, viewport.h - height - MARGIN));
		const clampLeft = (left: number) => Math.max(minLeft, Math.min(left, maxLeft));
		if (anchor.right + GAP + width <= viewport.w - MARGIN) {
			return { left: anchor.right + GAP, top: clampTop(anchor.top - 36) };
		}
		if (anchor.left - GAP - width >= minLeft) {
			return { left: anchor.left - GAP - width, top: clampTop(anchor.top - 36) };
		}
		const below = anchor.bottom + GAP;
		const top = below + height <= viewport.h - MARGIN ? below : anchor.top - GAP - height;
		return { left: clampLeft(anchor.left), top: clampTop(top) };
	});

	function measure() {
		const main = document.getElementById('main')?.getBoundingClientRect();
		viewport = { w: window.innerWidth, h: window.innerHeight, left: main?.left ?? 0 };
	}

	async function start() {
		if (!book) return;
		const target = book;
		preview.close();
		try {
			await startReading({ bookId: target.id });
			home.notify(`Buona lettura: ${target.title}.`);
			await invalidate(QUEUE_DEPENDENCY);
		} catch (error) {
			home.notify(error instanceof Error ? error.message : 'Impossibile iniziare la lettura.');
		}
	}

	$effect(() => {
		if (!book) return;
		measure();
		// La posizione e' fissa: con lo scroll l'anteprima si chiude.
		const close = () => preview.close();
		window.addEventListener('scroll', close, { capture: true, passive: true });
		window.addEventListener('resize', close);
		const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
		window.addEventListener('keydown', onKey);
		return () => {
			window.removeEventListener('scroll', close, { capture: true });
			window.removeEventListener('resize', close);
			window.removeEventListener('keydown', onKey);
		};
	});

	$effect(() => {
		if (dnd.draggingId) preview.close();
	});
</script>

{#if book}
	<div
		class="popover"
		class:ready={position !== null}
		style:left="{position?.left ?? 0}px"
		style:top="{position?.top ?? 0}px"
		bind:clientWidth={width}
		bind:clientHeight={height}
		role="region"
		aria-label="Anteprima di {book.title}"
		onpointerenter={() => preview.keep()}
		onpointerleave={() => preview.leave()}
	>
		{#key book.id}
			<BookHeroCard
				{book}
				{reading}
				queued={home.queuedIds.has(book.id)}
				onstart={start}
				onqueue={() => {
					void dnd.addToQueue(book);
					preview.close();
				}}
				onunqueue={() => {
					void dnd.remove(book);
					preview.close();
				}}
				onmove={(slug) => {
					void dnd.changeGenre(book, slug);
					preview.close();
				}}
			/>
		{/key}
	</div>
{/if}

<style>
	.popover {
		position: fixed;
		z-index: var(--z-overlay);
		width: min(540px, calc(100vw - 32px));
		opacity: 0;
		pointer-events: none;
		transform: translateY(6px) scale(0.98);
		transform-origin: left center;
		transition:
			opacity var(--duration-fast) var(--ease-out),
			transform var(--duration-base) var(--ease-out);
	}

	.popover.ready {
		opacity: 1;
		pointer-events: auto;
		transform: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.popover {
			transition: none;
		}
	}
</style>
