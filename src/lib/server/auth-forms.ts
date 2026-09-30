/** Accetta solo percorsi interni: niente redirect verso domini esterni. */
export function safeRedirectPath(next: string | null | undefined, fallback = '/library'): string {
	if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
		return fallback;
	}
	return next;
}
