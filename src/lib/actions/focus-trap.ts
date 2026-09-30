const FOCUSABLE = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled]):not([type="hidden"])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])'
].join(',');

function focusableIn(node: HTMLElement): HTMLElement[] {
	return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
		(el) => !el.hasAttribute('hidden') && el.getClientRects().length > 0
	);
}

/**
 * Intrappola il focus nel nodo, porta il focus dentro all'apertura
 * (prima [data-autofocus], poi il primo elemento focalizzabile) e lo restituisce alla chiusura.
 */
export function trapFocus(node: HTMLElement) {
	const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;

	// Dopo il mount: il portal può ancora spostare il nodo e spostare un nodo fa perdere il focus.
	queueMicrotask(() => {
		const initial =
			node.querySelector<HTMLElement>('[data-autofocus]') ?? focusableIn(node)[0] ?? node;
		initial.focus({ preventScroll: true });
	});

	function onKeydown(event: KeyboardEvent) {
		if (event.key !== 'Tab') return;

		const items = focusableIn(node);
		if (items.length === 0) {
			event.preventDefault();
			node.focus();
			return;
		}

		const first = items[0] as HTMLElement;
		const last = items[items.length - 1] as HTMLElement;
		const active = document.activeElement;

		if (event.shiftKey && (active === first || active === node)) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && active === last) {
			event.preventDefault();
			first.focus();
		}
	}

	node.addEventListener('keydown', onKeydown);

	return {
		destroy() {
			node.removeEventListener('keydown', onKeydown);
			if (previous?.isConnected) previous.focus({ preventScroll: true });
		}
	};
}
