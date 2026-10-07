<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { startReading } from '$lib/client/reading';
	import { QUEUE_DEPENDENCY } from '$lib/client/queue-keys';
	import BookHoverCard from './BookHoverCard.svelte';
	import type { HoverPreview } from './hover-preview.svelte';
	import type { HomeDnd } from './home-dnd.svelte';
	import type { HomeState } from './home-state.svelte';

	interface Props {
		preview: HoverPreview;
		home: HomeState;
		dnd: HomeDnd;
	}

	let { preview, home, dnd }: Props = $props();

	const GAP = 12;
	const MARGIN = 16;
	/** Distanza minima della freccia dagli angoli arrotondati della card. */
	const ARROW_INSET = 22;
	let width = $state(0);
	let height = $state(0);
	let viewport = $state({ w: 0, h: 0, left: 0 });
	/** Dopo la prima apparizione, i cambi di libro fanno scivolare la card invece di farla saltare. */
	let glide = $state(false);

	const book = $derived(preview.book);
	const reading = $derived(
		book ? (home.reading.find((entry) => entry.book.id === book.id)?.reading ?? null) : null
	);

	type Side = 'right' | 'left' | 'top' | 'bottom';

	/**
	 * Accanto al libro con la freccia verso di lui: a destra, poi a sinistra; per righe larghe
	 * (vista elenco) sopra o sotto. Mai sopra la sidebar: il limite sinistro e' l'inizio del contenuto.
	 */
	const position = $derived.by(() => {
		const anchor = preview.anchor;
		if (!anchor || !width || !height) return null;
		const minLeft = viewport.left + MARGIN;
		const maxLeft = viewport.w - width - MARGIN;
		const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
		const centerX = anchor.left + anchor.width / 2;
		const centerY = anchor.top + anchor.height / 2;

		let side: Side;
		let left: number;
		let top: number;
		if (anchor.right + GAP + width <= viewport.w - MARGIN) {
			side = 'right';
			left = anchor.right + GAP;
		} else if (anchor.left - GAP - width >= minLeft) {
			side = 'left';
			left = anchor.left - GAP - width;
		} else {
			side = anchor.top - GAP - height >= MARGIN ? 'top' : 'bottom';
			left = clamp(centerX - width / 2, minLeft, maxLeft);
		}
		if (side === 'right' || side === 'left') {
			top = clamp(centerY - height / 2, MARGIN, viewport.h - height - MARGIN);
		} else {
			top = side === 'top' ? anchor.top - GAP - height : anchor.bottom + GAP;
		}
		const arrow =
			side === 'right' || side === 'left'
				? clamp(centerY - top, ARROW_INSET, height - ARROW_INSET)
				: clamp(centerX - left, ARROW_INSET, width - ARROW_INSET);
		return { side, left, top, arrow };
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
		if (!book) {
			glide = false;
			return;
		}
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
		if (!position || glide) return;
		const frame = requestAnimationFrame(() => (glide = true));
		return () => cancelAnimationFrame(frame);
	});

	$effect(() => {
		if (dnd.draggingId) preview.close();
	});
</script>

{#if book}
	<div
		class="popover"
		class:ready={position !== null}
		class:glide
		data-side={position?.side ?? 'right'}
		style:left="{position?.left ?? 0}px"
		style:top="{position?.top ?? 0}px"
		style:--arrow="{position?.arrow ?? 0}px"
		bind:clientWidth={width}
		bind:clientHeight={height}
		role="region"
		aria-label="Anteprima di {book.title}"
		onpointerenter={() => preview.keep()}
		onpointerleave={() => preview.leave()}
	>
		<span class="arrow" aria-hidden="true"></span>
		{#key book.id}
			<div class="content">
				<BookHoverCard
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
			</div>
		{/key}
	</div>
{/if}

<style>
	.popover {
		position: fixed;
		z-index: var(--z-overlay);
		width: min(340px, calc(100vw - 32px));
		opacity: 0;
		pointer-events: none;
		transition:
			opacity var(--duration-fast) var(--ease-out),
			transform var(--duration-base) var(--ease-out);
	}

	/* Entra scivolando dal lato del libro */
	.popover[data-side='right'] {
		transform: translateX(-8px);
	}

	.popover[data-side='left'] {
		transform: translateX(8px);
	}

	.popover[data-side='top'] {
		transform: translateY(8px);
	}

	.popover[data-side='bottom'] {
		transform: translateY(-8px);
	}

	.popover.ready {
		opacity: 1;
		pointer-events: auto;
		transform: none;
	}

	.popover.glide {
		transition:
			opacity var(--duration-fast) var(--ease-out),
			transform var(--duration-base) var(--ease-out),
			left 220ms var(--ease-out),
			top 220ms var(--ease-out);
	}

	.content {
		animation: swap 180ms var(--ease-out);
	}

	@keyframes swap {
		from {
			opacity: 0.35;
		}
	}

	/* Freccia: quadratino ruotato con lo stesso fondo e bordo della card, rivolto al libro */
	.arrow {
		position: absolute;
		z-index: 1;
		width: 14px;
		height: 14px;
		border: 1px solid color-mix(in srgb, var(--color-border) 30%, transparent);
		background: var(--color-surface-elevated);
		transform: rotate(45deg);
	}

	[data-side='right'] .arrow {
		top: calc(var(--arrow) - 7px);
		left: -7px;
		border-top-color: transparent;
		border-right-color: transparent;
	}

	[data-side='left'] .arrow {
		top: calc(var(--arrow) - 7px);
		right: -7px;
		border-bottom-color: transparent;
		border-left-color: transparent;
	}

	[data-side='top'] .arrow {
		bottom: -7px;
		left: calc(var(--arrow) - 7px);
		border-top-color: transparent;
		border-left-color: transparent;
	}

	[data-side='bottom'] .arrow {
		top: -7px;
		left: calc(var(--arrow) - 7px);
		border-right-color: transparent;
		border-bottom-color: transparent;
	}

	@media (prefers-reduced-motion: reduce) {
		.popover,
		.popover.glide {
			transition: opacity var(--duration-fast) linear;
			transform: none;
		}

		.content {
			animation: none;
		}
	}
</style>
