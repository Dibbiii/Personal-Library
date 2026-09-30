const PAGES = new Intl.NumberFormat('it-IT', { useGrouping: 'always' });

/** "1.008 pag." (il separatore delle migliaia c'è anche a 4 cifre, come nel mockup). */
export function formatPages(count: number): string {
	return `${PAGES.format(count)} pag.`;
}

export function formatNumber(value: number): string {
	return PAGES.format(value);
}
