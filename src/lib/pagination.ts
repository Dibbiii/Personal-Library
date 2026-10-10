/** Positive bounded page number; invalid input selects the first page. */
export function parsePage(value: string | null): number {
	if (!value || !/^[1-9]\d{0,6}$/.test(value)) return 1;
	return Math.min(Number(value), 1_000_000);
}

export function pageHref(url: URL, key: string, page: number): string {
	const params = new URLSearchParams(url.searchParams);
	if (page <= 1) params.delete(key);
	else params.set(key, String(page));
	const query = params.toString();
	return `${url.pathname}${query ? `?${query}` : ''}`;
}
