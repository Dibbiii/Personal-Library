/**
 * Drag & drop con Pointer Events (spec 33): niente HTML5 DnD.
 *
 *  - touch/penna: pressione lunga (default 400ms) senza muoversi oltre `slop`; se il dito si muove prima
 *    si tratta di uno scroll normale e il drag non parte. Dopo il "lift" lo scroll e' bloccato.
 *  - mouse: il drag parte appena il puntatore supera `slop`.
 *  - ghost: il chiamante disegna il contenuto (`ghost`), l'action lo posiziona, lo inclina e lo solleva;
 *    per touch compare anche il cerchio sotto il dito.
 *  - bersagli: `dropzone` registra un elemento; `onhover` segnala ingresso/uscita (highlight).
 *  - auto-scroll: pagina in verticale ai bordi del viewport, scaffale (`[data-shelf-scroller]`) in orizzontale.
 *  - Esc o pointercancel annullano; dopo un drag il click successivo viene soppresso.
 *  - `prefers-reduced-motion` / `data-motion="reduce"`: nessuna transizione del ghost.
 */

import './drag.css';

// ---------------------------------------------------------------------------------------------
// Logica pura (testata in tests/unit/drag.test.ts)
// ---------------------------------------------------------------------------------------------

export const DEFAULT_LONG_PRESS_MS = 400;
export const DEFAULT_SLOP = 8;

/** True se il puntatore si e' spostato oltre la soglia dal punto di partenza. */
export function exceedsSlop(dx: number, dy: number, slop = DEFAULT_SLOP): boolean {
	return dx * dx + dy * dy > slop * slop;
}

/**
 * Spostamento per frame quando il puntatore e' vicino ai bordi di un intervallo [start, end].
 * Negativo vicino a `start`, positivo vicino a `end`, 0 al centro. Cresce linearmente con la vicinanza.
 */
export function edgeScrollDelta(
	position: number,
	start: number,
	end: number,
	edge = 90,
	maxSpeed = 18
): number {
	if (end - start < edge * 2) return 0;
	if (position < start + edge)
		return -Math.round(maxSpeed * Math.min(1, (start + edge - position) / edge));
	if (position > end - edge)
		return Math.round(maxSpeed * Math.min(1, (position - (end - edge)) / edge));
	return 0;
}

/** Angolo in alto a sinistra del ghost: sopra il dito per touch/penna, centrato per il mouse. */
export function ghostOrigin(
	pointer: { x: number; y: number },
	size: { width: number; height: number },
	pointerType: string
): { x: number; y: number } {
	const x = pointer.x - size.width / 2;
	const y = pointerType === 'mouse' ? pointer.y - size.height / 2 : pointer.y - size.height - 26;
	return { x, y };
}

// ---------------------------------------------------------------------------------------------
// Bersagli
// ---------------------------------------------------------------------------------------------

export interface DropZoneOptions<T = unknown> {
	/** Dato libero del bersaglio, restituito in `ondrop`. */
	data?: unknown;
	/** Se assente accetta tutto. Un bersaglio che rifiuta viene ignorato (si prova il successivo sotto il puntatore). */
	accepts?: (payload: T) => boolean;
	/** Ingresso/uscita del puntatore con un drag attivo compatibile. */
	onhover?: (active: boolean, payload: T) => void;
}

const zones = new Map<Element, DropZoneOptions<never>>();

export function dropzone<T>(node: HTMLElement, options: DropZoneOptions<T>) {
	zones.set(node, options as DropZoneOptions<never>);
	node.dataset.dropZone = '';
	return {
		update(next: DropZoneOptions<T>) {
			zones.set(node, next as DropZoneOptions<never>);
		},
		destroy() {
			zones.delete(node);
			delete node.dataset.dropZone;
		}
	};
}

interface HitZone {
	node: HTMLElement;
	options: DropZoneOptions<unknown>;
}

/** Primo bersaglio compatibile sotto il punto (dall'elemento piu' in alto). */
export function findZone(
	elements: readonly Element[],
	payload: unknown,
	registry: ReadonlyMap<Element, DropZoneOptions<never>> = zones
): HitZone | null {
	for (const element of elements) {
		const options = registry.get(element) as DropZoneOptions<unknown> | undefined;
		if (!options) continue;
		if (options.accepts && !options.accepts(payload)) continue;
		return { node: element as HTMLElement, options };
	}
	return null;
}

// ---------------------------------------------------------------------------------------------
// Sorgente trascinabile
// ---------------------------------------------------------------------------------------------

export interface DropTarget {
	node: HTMLElement;
	data: unknown;
}

export interface DraggableOptions<T> {
	/** Payload passato ai bersagli e ai callback. */
	data: T;
	disabled?: boolean;
	longPressMs?: number;
	slop?: number;
	/** Disegna il contenuto del ghost nel contenitore; puo' restituire il cleanup (es. unmount). */
	ghost?: (container: HTMLElement) => void | (() => void);
	onstart?: (payload: T) => void;
	/** Rilascio su un bersaglio compatibile. */
	ondrop?: (target: DropTarget, payload: T) => void;
	/** Sempre alla fine (rilascio, annullamento, fuori bersaglio). */
	onend?: (info: { dropped: boolean }) => void;
}

export function draggable<T>(node: HTMLElement, initial: DraggableOptions<T>) {
	let options = initial;
	let phase: 'idle' | 'pending' | 'dragging' = 'idle';
	let pointerId = -1;
	let pointerType = 'mouse';
	let startX = 0;
	let startY = 0;
	let x = 0;
	let y = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let frame = 0;
	let ghostEl: HTMLElement | null = null;
	let circleEl: HTMLElement | null = null;
	let ghostCleanup: void | (() => void);
	let hover: HitZone | null = null;

	const blockScroll = (event: TouchEvent) => {
		if (event.cancelable) event.preventDefault();
	};
	const blockContextMenu = (event: Event) => event.preventDefault();
	const blockNativeDrag = (event: Event) => event.preventDefault();

	function attachGlobal() {
		window.addEventListener('pointermove', onMove, { passive: false });
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onCancel);
		window.addEventListener('keydown', onKey);
	}

	function detachGlobal() {
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', onUp);
		window.removeEventListener('pointercancel', onCancel);
		window.removeEventListener('keydown', onKey);
		document.removeEventListener('touchmove', blockScroll);
	}

	function onDown(event: PointerEvent) {
		if (options.disabled || phase !== 'idle') return;
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		pointerId = event.pointerId;
		pointerType = event.pointerType;
		startX = x = event.clientX;
		startY = y = event.clientY;
		phase = 'pending';
		attachGlobal();
		if (pointerType !== 'mouse') {
			timer = setTimeout(lift, options.longPressMs ?? DEFAULT_LONG_PRESS_MS);
		}
	}

	function onMove(event: PointerEvent) {
		if (event.pointerId !== pointerId) return;
		x = event.clientX;
		y = event.clientY;

		if (phase === 'pending') {
			if (exceedsSlop(x - startX, y - startY, options.slop ?? DEFAULT_SLOP)) {
				if (pointerType === 'mouse') lift();
				else abort(); // movimento prima del long press: e' uno scroll
			}
			return;
		}

		if (phase === 'dragging') {
			if (event.cancelable) event.preventDefault();
			render();
			updateHover();
		}
	}

	function lift() {
		clearTimeout(timer);
		if (phase !== 'pending') return;
		phase = 'dragging';

		document.addEventListener('touchmove', blockScroll, { passive: false });
		node.addEventListener('contextmenu', blockContextMenu);
		document.documentElement.classList.add('is-dragging');
		navigator.vibrate?.(12);

		ghostEl = document.createElement('div');
		ghostEl.className = 'drag-ghost';
		ghostEl.setAttribute('aria-hidden', 'true');
		document.body.appendChild(ghostEl);
		ghostCleanup = options.ghost?.(ghostEl);

		if (pointerType !== 'mouse') {
			circleEl = document.createElement('div');
			circleEl.className = 'drag-touch';
			circleEl.setAttribute('aria-hidden', 'true');
			document.body.appendChild(circleEl);
		}

		render();
		updateHover();
		options.onstart?.(options.data);
		tick();
	}

	function render() {
		if (ghostEl) {
			const rect = ghostEl.getBoundingClientRect();
			const origin = ghostOrigin(
				{ x, y },
				{ width: ghostEl.offsetWidth || rect.width, height: ghostEl.offsetHeight || rect.height },
				pointerType
			);
			ghostEl.style.transform = `translate3d(${origin.x}px, ${origin.y}px, 0) rotate(-5deg) scale(1.16)`;
		}
		if (circleEl) circleEl.style.transform = `translate3d(${x - 22}px, ${y - 22}px, 0)`;
	}

	function updateHover() {
		const found = findZone(document.elementsFromPoint(x, y), options.data);
		if (found?.node === hover?.node) return;
		if (hover) hover.options.onhover?.(false, options.data as never);
		hover = found;
		if (hover) hover.options.onhover?.(true, options.data as never);
	}

	/** Auto-scroll: pagina in verticale, scaffale sotto il puntatore in orizzontale. */
	function tick() {
		if (phase !== 'dragging') return;
		const dy = edgeScrollDelta(y, 0, window.innerHeight);
		if (dy !== 0) window.scrollBy(0, dy);

		const scroller = document
			.elementsFromPoint(x, y)
			.find(
				(el): el is HTMLElement =>
					el instanceof HTMLElement && el.hasAttribute('data-shelf-scroller')
			);
		let scrolled = dy !== 0;
		if (scroller) {
			const rect = scroller.getBoundingClientRect();
			const dx = edgeScrollDelta(x, rect.left, rect.right, 56, 14);
			if (dx !== 0) {
				scroller.scrollLeft += dx;
				scrolled = true;
			}
		}
		if (scrolled) updateHover();
		frame = requestAnimationFrame(tick);
	}

	function onUp(event: PointerEvent) {
		if (event.pointerId !== pointerId) return;
		if (phase === 'pending') return abort();

		const target = hover;
		const payload = options.data;
		finish();
		suppressNextClick();
		if (target) {
			options.ondrop?.({ node: target.node, data: target.options.data }, payload);
		}
		options.onend?.({ dropped: target !== null });
	}

	function onCancel(event: PointerEvent) {
		if (event.pointerId !== pointerId) return;
		if (phase === 'dragging') {
			finish();
			suppressNextClick();
			options.onend?.({ dropped: false });
		} else abort();
	}

	function onKey(event: KeyboardEvent) {
		if (event.key !== 'Escape' || phase !== 'dragging') return;
		finish();
		suppressNextClick();
		options.onend?.({ dropped: false });
	}

	function abort() {
		clearTimeout(timer);
		phase = 'idle';
		detachGlobal();
	}

	function finish() {
		cancelAnimationFrame(frame);
		clearTimeout(timer);
		if (hover) hover.options.onhover?.(false, options.data as never);
		hover = null;
		phase = 'idle';
		detachGlobal();
		node.removeEventListener('contextmenu', blockContextMenu);
		document.documentElement.classList.remove('is-dragging');
		ghostEl?.remove();
		circleEl?.remove();
		ghostEl = circleEl = null;
		if (typeof ghostCleanup === 'function') ghostCleanup();
		ghostCleanup = undefined;
	}

	function suppressNextClick() {
		const stop = (event: Event) => {
			event.preventDefault();
			event.stopPropagation();
		};
		window.addEventListener('click', stop, { capture: true, once: true });
		setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 350);
	}

	node.addEventListener('pointerdown', onDown);
	node.addEventListener('dragstart', blockNativeDrag);

	return {
		update(next: DraggableOptions<T>) {
			options = next;
		},
		destroy() {
			if (phase === 'dragging') finish();
			else abort();
			node.removeEventListener('pointerdown', onDown);
			node.removeEventListener('dragstart', blockNativeDrag);
		}
	};
}
