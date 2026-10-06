import { CatalogClientError, discoverBooks } from '$lib/catalog/client';
import type { DiscoverBook, DiscoverRequest } from '$lib/catalog/discover';

/** Stato di una sezione di Esplora caricata da /api/discover (si ricarica quando cambia la query). */
export function discoverSection(query: () => DiscoverRequest) {
	const state = $state({
		books: [] as DiscoverBook[],
		loading: true,
		error: ''
	});

	$effect(() => {
		const current = query();
		const controller = new AbortController();
		state.loading = true;
		state.error = '';
		discoverBooks(current, controller.signal)
			.then((response) => {
				state.books = response.books;
			})
			.catch((error: unknown) => {
				if (error instanceof DOMException && error.name === 'AbortError') return;
				state.books = [];
				state.error =
					error instanceof CatalogClientError ? error.message : 'Non riesco a caricare i libri.';
			})
			.finally(() => {
				if (!controller.signal.aborted) state.loading = false;
			});
		return () => controller.abort();
	});

	return state;
}
