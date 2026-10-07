import type { BookFormat } from '$lib/contracts';
import type { IconName } from '$lib/components/ui/icons';

/** Unica fonte per etichette e simboli del formato (cartaceo, digitale, entrambi). */
export const FORMAT_LABELS: Record<BookFormat, string> = {
	physical: 'Cartaceo',
	digital: 'Digitale',
	both: 'Entrambi'
};

export const FORMAT_ICONS: Record<BookFormat, IconName> = {
	physical: 'format-paper',
	digital: 'format-digital',
	both: 'format-both'
};
