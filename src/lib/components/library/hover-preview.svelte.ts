import type { BookSummary } from '$lib/contracts';

const SHOW_DELAY = 280;
const SWITCH_DELAY = 80;
const HIDE_DELAY = 180;

/** Anteprima al passaggio del mouse sui libri degli scaffali (solo puntatori con hover reale). */
export class HoverPreview {
	book = $state<BookSummary | null>(null);
	anchor = $state<DOMRect | null>(null);
	#show: ReturnType<typeof setTimeout> | undefined;
	#hide: ReturnType<typeof setTimeout> | undefined;

	enter(book: BookSummary, node: HTMLElement) {
		clearTimeout(this.#hide);
		clearTimeout(this.#show);
		this.#show = setTimeout(
			() => {
				this.book = book;
				this.anchor = node.getBoundingClientRect();
			},
			this.book ? SWITCH_DELAY : SHOW_DELAY
		);
	}

	leave() {
		clearTimeout(this.#show);
		clearTimeout(this.#hide);
		this.#hide = setTimeout(() => this.close(), HIDE_DELAY);
	}

	/** Il puntatore e' passato sulla scheda: resta aperta. */
	keep() {
		clearTimeout(this.#hide);
	}

	close() {
		clearTimeout(this.#show);
		clearTimeout(this.#hide);
		this.book = null;
		this.anchor = null;
	}
}

interface PreviewParams {
	preview: HoverPreview;
	book: BookSummary;
}

/** `use:hoverPreview={{ preview, book }}` sul contenitore del libro. */
export function hoverPreview(node: HTMLElement, params: PreviewParams) {
	let current = params;
	const enter = (event: PointerEvent) => {
		if (event.pointerType === 'mouse') current.preview.enter(current.book, node);
	};
	const leave = (event: PointerEvent) => {
		if (event.pointerType === 'mouse') current.preview.leave();
	};
	// Click o inizio di un drag: l'anteprima non deve restare sopra al libro.
	const press = () => current.preview.close();
	node.addEventListener('pointerenter', enter);
	node.addEventListener('pointerleave', leave);
	node.addEventListener('pointerdown', press);
	return {
		update(next: PreviewParams) {
			current = next;
		},
		destroy() {
			node.removeEventListener('pointerenter', enter);
			node.removeEventListener('pointerleave', leave);
			node.removeEventListener('pointerdown', press);
		}
	};
}
