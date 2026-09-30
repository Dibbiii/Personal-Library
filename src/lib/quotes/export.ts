import { CARD_HEIGHT, CARD_WIDTH, createCardCanvas, renderQuoteCard } from './render';
import type { CardFonts, CardCanvas, QuoteCardContent } from './render';
import type { CardPalette } from './palette';

async function canvasToBlob(canvas: CardCanvas): Promise<Blob> {
	if ('convertToBlob' in canvas) return canvas.convertToBlob({ type: 'image/png' });
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('Esportazione PNG non riuscita'))),
			'image/png'
		);
	});
}

/** Disegna la card fuori schermo (OffscreenCanvas se disponibile) e la esporta in PNG 1080x1350. */
export async function exportQuoteCardPng(
	content: QuoteCardContent,
	palette: CardPalette,
	fonts: CardFonts
): Promise<Blob> {
	const canvas = createCardCanvas(CARD_WIDTH, CARD_HEIGHT);
	renderQuoteCard(canvas, content, palette, fonts);
	return canvasToBlob(canvas);
}

export function quoteCardFileName(title: string): string {
	const slug = title
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48);
	return `segnalibro-${slug || 'citazione'}.png`;
}

export function downloadBlob(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function canShareFile(file: File): boolean {
	return (
		typeof navigator !== 'undefined' &&
		!!navigator.canShare &&
		navigator.canShare({ files: [file] })
	);
}

/** Condivide il PNG con il foglio di sistema. Restituisce false se l'utente annulla. */
export async function shareFile(file: File, title: string): Promise<boolean> {
	try {
		await navigator.share({ files: [file], title });
		return true;
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') return false;
		throw error;
	}
}
