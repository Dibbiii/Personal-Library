import type { Tag } from '../contracts/reviews';

/**
 * I 27 tag tematici predefiniti (MASTER_SPEC sez. 12), nell'ordine del DB (`tags.sort_order`).
 * Gli id numerici li decide il DB: la UI lavora sugli slug, il server li risolve in id.
 */
export interface ThemeTagDef {
	slug: string;
	label: string;
}

export const THEME_TAGS: readonly ThemeTagDef[] = [
	{ slug: 'friendship', label: 'Amicizia' },
	{ slug: 'love', label: 'Amore' },
	{ slug: 'adventure', label: 'Avventura' },
	{ slug: 'growth', label: 'Crescita' },
	{ slug: 'family', label: 'Famiglia' },
	{ slug: 'coming-of-age', label: 'Formazione' },
	{ slug: 'war', label: 'Guerra' },
	{ slug: 'identity', label: 'Identità' },
	{ slug: 'magic', label: 'Magia' },
	{ slug: 'mystery', label: 'Mistero' },
	{ slug: 'music', label: 'Musica' },
	{ slug: 'nature', label: 'Natura' },
	{ slug: 'loss', label: 'Perdita' },
	{ slug: 'politics', label: 'Politica' },
	{ slug: 'power', label: 'Potere' },
	{ slug: 'religion', label: 'Religione' },
	{ slug: 'revenge', label: 'Vendetta' },
	{ slug: 'loneliness', label: 'Solitudine' },
	{ slug: 'survival', label: 'Sopravvivenza' },
	{ slug: 'betrayal', label: 'Tradimento' },
	{ slug: 'trauma', label: 'Trauma' },
	{ slug: 'travel', label: 'Viaggio' },
	{ slug: 'death', label: 'Morte' },
	{ slug: 'memory', label: 'Memoria' },
	{ slug: 'freedom', label: 'Libertà' },
	{ slug: 'society', label: 'Società' },
	{ slug: 'technology', label: 'Tecnologia' }
];

export function toggleTag(selected: readonly string[], slug: string): string[] {
	return selected.includes(slug) ? selected.filter((s) => s !== slug) : [...selected, slug];
}

/** Slug -> id del DB. Gli slug sconosciuti vengono segnalati, non ignorati in silenzio. */
export function resolveTagIds(
	slugs: readonly string[],
	reference: readonly Pick<Tag, 'id' | 'slug'>[]
): { ids: number[]; unknown: string[] } {
	const byslug = new Map(reference.map((t) => [t.slug, t.id]));
	const ids: number[] = [];
	const unknown: string[] = [];
	for (const slug of new Set(slugs)) {
		const id = byslug.get(slug);
		if (id === undefined) unknown.push(slug);
		else ids.push(id);
	}
	return { ids, unknown };
}

/** Numero di tag mostrati prima di "Mostra tutti" (come nel mockup 05). */
export const TAG_COLLAPSED_COUNT = 9;

/** Tag proposti per primi quando non selezionati (ordine del mockup 05). */
const SUGGESTED_SLUGS = ['travel', 'revenge', 'loss', 'mystery', 'family'];

/**
 * Ordine di visualizzazione fissato all'apertura: prima i tag già selezionati (ordine della spec),
 * poi i suggeriti, poi gli altri. Non cambia mentre l'utente seleziona, così i chip non saltano.
 */
export function orderTagsForDisplay(initiallySelected: readonly string[]): ThemeTagDef[] {
	const selected = new Set(initiallySelected);
	const rank = (slug: string) => {
		if (selected.has(slug)) return 0;
		const suggested = SUGGESTED_SLUGS.indexOf(slug);
		return suggested >= 0 ? 1 + suggested : 100;
	};
	const indexOf = (slug: string) => THEME_TAGS.findIndex((t) => t.slug === slug);
	return [...THEME_TAGS].sort(
		(a, b) => rank(a.slug) - rank(b.slug) || indexOf(a.slug) - indexOf(b.slug)
	);
}

/** Tag visibili da chiusi: i primi N più tutti quelli selezionati. */
export function visibleTags(
	ordered: readonly ThemeTagDef[],
	selected: readonly string[],
	expanded: boolean,
	collapsedCount = TAG_COLLAPSED_COUNT
): ThemeTagDef[] {
	if (expanded) return [...ordered];
	return ordered.filter((t, i) => i < collapsedCount || selected.includes(t.slug));
}
