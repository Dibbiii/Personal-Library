import {
	shelfPageResponseSchema,
	type BookSummary,
	type CurrentlyReadingBook,
	type GenreRef,
	type GenreSlug,
	type LibraryHomeResponse,
	type QueueBook,
	type ShelfCursor
} from '$lib/contracts';

export interface ShelfState {
	genre: GenreRef;
	totalCount: number;
	hasMore: boolean;
	books: BookSummary[];
	/** Cursore keyset della prossima pagina: assente finche' non si e' caricata la prima pagina extra. */
	cursor: ShelfCursor | null;
	loading: boolean;
	failed: boolean;
}

const PAGE_SIZE = 24;

/** Stato locale della Home: parte dalla risposta di `getHome` e segue le azioni (drag, coda, paginazione). */
export class HomeState {
	reading = $state<CurrentlyReadingBook[]>([]);
	queue = $state<QueueBook[]>([]);
	shelves = $state<ShelfState[]>([]);
	/** Messaggio per l'utente (errori/conferme), letto da una live region. */
	message = $state('');

	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- derived: viene ricreato, non mutato
	queuedIds = $derived(new Set(this.queue.map((entry) => entry.book.id)));
	sortedQueue = $derived([...this.queue].sort((a, b) => a.position - b.position));

	constructor(data: LibraryHomeResponse) {
		this.apply(data);
	}

	apply(data: LibraryHomeResponse) {
		this.reading = data.currentlyReading.map((entry) => ({ ...entry }));
		this.queue = data.queue.map((entry) => ({ ...entry }));
		this.shelves = data.shelves.map((shelf) => ({
			genre: shelf.genre,
			totalCount: shelf.totalCount,
			hasMore: shelf.hasMore,
			books: [...shelf.books],
			cursor: null,
			loading: false,
			failed: false
		}));
	}

	shelf(slug: GenreSlug): ShelfState | undefined {
		return this.shelves.find((shelf) => shelf.genre.slug === slug);
	}

	findBook(bookId: string): BookSummary | undefined {
		for (const shelf of this.shelves) {
			const found = shelf.books.find((book) => book.id === bookId);
			if (found) return found;
		}
		return this.queue.find((entry) => entry.book.id === bookId)?.book;
	}

	notify(text: string) {
		this.message = text;
	}

	setQueue(queue: QueueBook[]) {
		this.queue = queue;
	}

	/** Sposta il libro nello scaffale del genere di destinazione (ottimistico). Restituisce l'undo. */
	moveToGenre(bookId: string, target: GenreSlug): (() => void) | null {
		const to = this.shelf(target);
		if (!to) return null;
		const snapshot = {
			reading: $state.snapshot(this.reading),
			queue: $state.snapshot(this.queue),
			shelves: $state.snapshot(this.shelves)
		};

		let moved: BookSummary | undefined;
		for (const shelf of this.shelves) {
			const index = shelf.books.findIndex((book) => book.id === bookId);
			if (index === -1 || shelf.genre.slug === target) continue;
			moved = shelf.books[index];
			shelf.books.splice(index, 1);
			shelf.totalCount = Math.max(0, shelf.totalCount - 1);
		}
		if (!moved) return null;

		const updated: BookSummary = { ...moved, genre: to.genre };
		to.books.unshift(updated);
		to.totalCount += 1;
		for (const entry of this.reading) {
			if (entry.book.id === bookId) entry.book = { ...entry.book, genre: to.genre };
		}
		for (const entry of this.queue) {
			if (entry.book.id === bookId) entry.book = { ...entry.book, genre: to.genre };
		}

		return () => {
			this.reading = snapshot.reading as CurrentlyReadingBook[];
			this.queue = snapshot.queue as QueueBook[];
			this.shelves = snapshot.shelves as ShelfState[];
		};
	}

	/**
	 * Carica la pagina successiva dello scaffale (keyset). `getHome` non espone il cursore: la prima volta
	 * si richiede l'inizio dello scaffale con un limite maggiore e si scartano i libri gia' presenti.
	 */
	async loadMore(slug: GenreSlug) {
		const shelf = this.shelf(slug);
		if (!shelf || shelf.loading || !shelf.hasMore) return;
		shelf.loading = true;
		shelf.failed = false;
		try {
			// eslint-disable-next-line svelte/prefer-svelte-reactivity -- locale alla richiesta
			const params = new URLSearchParams({ genre: slug });
			if (shelf.cursor) {
				params.set('limit', String(PAGE_SIZE));
				params.set('cursorCreatedAt', shelf.cursor.createdAt);
				params.set('cursorId', shelf.cursor.id);
			} else {
				params.set('limit', String(Math.min(100, shelf.books.length + PAGE_SIZE)));
			}
			const response = await fetch(`/api/library/shelf?${params}`);
			if (!response.ok) throw new Error(String(response.status));
			const page = shelfPageResponseSchema.parse(await response.json()).data;

			// eslint-disable-next-line svelte/prefer-svelte-reactivity -- locale
			const known = new Set(shelf.books.map((book) => book.id));
			for (const book of page.books) {
				// Un libro spostato altrove in locale non deve ricomparire qui.
				if (!known.has(book.id) && book.genre.slug === slug) shelf.books.push(book);
			}
			shelf.hasMore = page.hasMore;
			shelf.cursor = page.nextCursor;
		} catch {
			shelf.failed = true;
		} finally {
			shelf.loading = false;
		}
	}
}
