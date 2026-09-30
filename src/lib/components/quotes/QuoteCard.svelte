<script lang="ts">
	import type { GenreSlug } from '$lib/contracts';
	import { resolveFonts, resolvePalette, type QuoteCardStyle } from '$lib/quotes/palette';
	import {
		CARD_HEIGHT,
		CARD_WIDTH,
		ensureCardFonts,
		renderQuoteCard,
		type QuoteCardContent
	} from '$lib/quotes/render';

	interface Props {
		content: QuoteCardContent;
		style: QuoteCardStyle;
		genre: GenreSlug;
		/** Segnala quando il disegno è aggiornato (font caricati e card renderizzata). */
		onrendered?: () => void;
	}

	let { content, style, genre, onrendered }: Props = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	let token = 0;

	// Ridisegna a ogni cambio di contenuto/stile; i font si attendono prima del disegno.
	$effect(() => {
		const target = canvas;
		if (!target) return;
		const snapshot = { ...content };
		const currentStyle = style;
		const currentGenre = genre;
		const run = ++token;

		const fonts = resolveFonts();
		void ensureCardFonts(fonts).then(() => {
			if (run !== token) return;
			renderQuoteCard(target, snapshot, resolvePalette(currentStyle, currentGenre), fonts);
			onrendered?.();
		});
	});
</script>

<div
	class="wrap"
	role="img"
	aria-label="Anteprima della Quote Card: «{content.body}», {content.title}, {content.author}"
>
	<canvas
		bind:this={canvas}
		class="card"
		width={CARD_WIDTH}
		height={CARD_HEIGHT}
		aria-hidden="true"
		data-testid="quote-card-canvas"
	></canvas>
</div>

<style>
	.card {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 1080 / 1350;
		border-radius: 18px;
		box-shadow: var(--shadow-card);
	}
</style>
