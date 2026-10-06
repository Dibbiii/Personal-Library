<script lang="ts">
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
	let viewport = $state({ w: 0, h: 0 });

	const book = $derived(preview.book);
	const reading = $derived(
		book ? (home.reading.find((entry) => entry.book.id === book.id)?.reading ?? null) : null
	);

	// Di fianco al libro (a destra se c'e' posto, altrimenti a sinistra), un po' sopra come nel mockup.
	const position = $derived.by(() => {
		const anchor = preview.anchor;
		if (!anchor || !width || !height) return null;
		let left = anchor.right + GAP;
		if (left + width > viewport.w - MARGIN) left = anchor.left - width - GAP;
		left = Math.max(MARGIN, Math.min(left, viewport.w - width - MARGIN));
		const top = Math.max(MARGIN, Math.min(anchor.top - 36, viewport.h - height - MARGIN));
		return { left, top };
	});

	function measure() {
		viewport = { w: window.innerWidth, h: window.innerHeight };
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
				onqueue={() => {
					void dnd.addToQueue(book);
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
