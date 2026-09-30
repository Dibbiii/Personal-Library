/** Preparazione lato browser del file cover prima dell'upload (il server ricontrolla tutto). */
export const ACCEPTED_COVER_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_COVER_BYTES = 5 * 1024 * 1024;
/** Oltre questa soglia non proviamo nemmeno a ridimensionare. */
const MAX_RAW_BYTES = 40 * 1024 * 1024;

export class CoverFileError extends Error {}

export function checkCoverType(file: Pick<File, 'type'>): void {
	if (!(ACCEPTED_COVER_TYPES as readonly string[]).includes(file.type)) {
		throw new CoverFileError('Formato non supportato: usa un’immagine PNG, JPEG o WebP.');
	}
}

async function renderJpeg(bitmap: ImageBitmap, maxSide: number): Promise<Blob | null> {
	const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(bitmap.width * scale));
	canvas.height = Math.max(1, Math.round(bitmap.height * scale));
	const context = canvas.getContext('2d');
	if (!context) return null;
	context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
}

/**
 * Tipo corretto e dimensione entro 5 MB. Le foto della fotocamera pesano spesso di più:
 * in quel caso vengono ridimensionate (JPEG) invece di essere rifiutate.
 */
export async function prepareCoverFile(file: File): Promise<File> {
	checkCoverType(file);
	if (file.size === 0) throw new CoverFileError('Il file è vuoto.');
	if (file.size <= MAX_COVER_BYTES) return file;
	if (file.size > MAX_RAW_BYTES) throw new CoverFileError('L’immagine supera i 5 MB.');

	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file);
	} catch {
		throw new CoverFileError('Non riesco a leggere questa immagine.');
	}
	try {
		for (const side of [1800, 1200, 800]) {
			const blob = await renderJpeg(bitmap, side);
			if (blob && blob.size <= MAX_COVER_BYTES) {
				const name = file.name.replace(/\.[^.]+$/, '') || 'cover';
				return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
			}
		}
	} finally {
		bitmap.close();
	}
	throw new CoverFileError('L’immagine supera i 5 MB anche dopo il ridimensionamento.');
}
