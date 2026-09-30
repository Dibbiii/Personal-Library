/** Sposta il nodo in document.body (evita che antenati con transform rompano position: fixed). */
export function portal(node: HTMLElement, target: HTMLElement = document.body) {
	target.appendChild(node);

	return {
		destroy() {
			node.remove();
		}
	};
}
