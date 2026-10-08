/**
 * Genera le icone PWA (SVG + PNG) dai colori del tema Segnalibro.
 * Uso: npm run icons
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const OUT = new URL('../static/icons/', import.meta.url);
const logo = new URL('../static/segnalibro-logo.jpeg', import.meta.url);

async function png(source: Buffer, size: number, name: string, fit: 'cover' | 'contain' = 'cover') {
	await sharp(source)
		.resize(size, size, { fit, background: '#ffe8ec' })
		.png()
		.toFile(fileURLToPath(new URL(name, OUT)));
}

await mkdir(OUT, { recursive: true });

// Il cuore nella foto originale ha margini asimmetrici: centriamo il
// disegno in un quadrato prima di generare tutte le varianti dell'icona.
const source = await sharp(await readFile(logo))
	.extract({ left: 407, top: 151, width: 1385, height: 1250 })
	.extend({ top: 143, bottom: 143, left: 75, right: 76, background: '#ffe8ec' })
	.png()
	.toBuffer();
const icon = await sharp(source).resize(512, 512, { fit: 'cover' }).png().toBuffer();
const maskable = await sharp(source)
	// Mantiene tutto il cuore nel cerchio sicuro (raggio: 40% dell'icona).
	.resize(384, 384, { fit: 'contain', background: '#ffe8ec' })
	.extend({ top: 64, bottom: 64, left: 64, right: 64, background: '#ffe8ec' })
	.png()
	.toBuffer();

await writeFile(
	new URL('icon.svg', OUT),
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><image href="/icons/icon-512.png" width="512" height="512"/></svg>\n`
);
await png(icon, 192, 'icon-192.png');
await png(icon, 512, 'icon-512.png');
await png(maskable, 512, 'icon-maskable-512.png');
await png(icon, 180, 'apple-touch-icon.png');

console.log('Icone generate in static/icons/');
