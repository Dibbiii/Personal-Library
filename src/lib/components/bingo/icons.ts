import type { IconName } from '$lib/components/ui/icons';

/** Icona di ciascuna casella della card, per posizione (DESIGN_REFERENCE 8, tabella caselle). */
export const BINGO_ICONS: Record<number, IconName> = {
	1: 'book-open',
	2: 'bingo-bestseller',
	3: 'bingo-film',
	4: 'smartphone',
	5: 'bingo-hearts',
	6: 'trophy',
	7: 'bingo-feather',
	8: 'bingo-scribble',
	9: 'bingo-laurel',
	10: 'bingo-temple',
	11: 'bingo-search',
	12: 'bingo-sparkle',
	13: 'bingo-academia',
	14: 'bingo-pulse',
	15: 'bingo-plane',
	16: 'bingo-music'
};

export function bingoIcon(position: number): IconName {
	return BINGO_ICONS[position] ?? 'bookmark';
}
