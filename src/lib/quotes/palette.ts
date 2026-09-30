import type { GenreSlug } from '$lib/contracts';

/** Stili della card. I colori non sono mai letterali: si leggono dai token del tema attivo. */
export type QuoteCardStyle = 'genre' | 'light' | 'theme' | 'paper';

export const QUOTE_CARD_STYLES: { id: QuoteCardStyle; label: string }[] = [
	{ id: 'genre', label: 'Genere' },
	{ id: 'light', label: 'Chiaro' },
	{ id: 'theme', label: 'Tema' },
	{ id: 'paper', label: 'Carta' }
];

export interface CardPalette {
	background: string;
	ink: string;
	/** Colore di rifinitura: filetto, virgolette, cornice. */
	accent: string;
}

/** Espressioni CSS (token) di ogni stile: sono risolte dal browser sul tema in uso. */
export function paletteTokens(style: QuoteCardStyle, genre: GenreSlug): CardPalette {
	switch (style) {
		case 'genre':
			return {
				background: `var(--genre-${genre})`,
				ink: `var(--genre-${genre}-on-base)`,
				accent: `var(--genre-${genre}-on-base)`
			};
		case 'light':
			return {
				background: `var(--genre-${genre}-light)`,
				ink: `var(--genre-${genre}-dark)`,
				accent: `var(--genre-${genre})`
			};
		case 'theme':
			return {
				background: 'var(--color-primary)',
				ink: 'var(--color-on-primary)',
				accent: 'var(--color-accent)'
			};
		case 'paper':
			return {
				background: 'var(--color-background)',
				ink: 'var(--color-text-primary)',
				accent: `var(--genre-${genre})`
			};
	}
}

/**
 * Risolve un'espressione CSS (`var(--x)`, `color-mix(...)`) nel colore calcolato dal browser,
 * pronto per `ctx.fillStyle`. Legge i token dall'elemento dato (default: la radice del documento).
 */
export function resolveCssColor(
	expression: string,
	scope: Element = document.documentElement
): string {
	const probe = document.createElement('span');
	probe.style.color = expression;
	probe.style.display = 'none';
	scope.appendChild(probe);
	try {
		return getComputedStyle(probe).color;
	} finally {
		probe.remove();
	}
}

export function resolvePalette(
	style: QuoteCardStyle,
	genre: GenreSlug,
	scope?: Element
): CardPalette {
	const tokens = paletteTokens(style, genre);
	return {
		background: resolveCssColor(tokens.background, scope),
		ink: resolveCssColor(tokens.ink, scope),
		accent: resolveCssColor(tokens.accent, scope)
	};
}

/** Famiglie dei font del design system, lette dai token (con un fallback sensato). */
export function resolveFonts(scope: Element = document.documentElement): {
	display: string;
	ui: string;
} {
	const styles = getComputedStyle(scope);
	return {
		display: styles.getPropertyValue('--font-display').trim() || 'Georgia, serif',
		ui: styles.getPropertyValue('--font-ui').trim() || 'system-ui, sans-serif'
	};
}
