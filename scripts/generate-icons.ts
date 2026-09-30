/**
 * Genera le icone PWA (SVG + PNG) dai colori del tema Segnalibro.
 * Uso: npm run icons
 */
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { segnalibroTheme } from '../src/lib/themes/segnalibro.ts';

const { primary, background, accent } = segnalibroTheme.colors;
const OUT = new URL('../static/icons/', import.meta.url);

function svg({ rounded }: { rounded: boolean }) {
	const radius = rounded ? 112 : 0;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="${radius}" fill="${primary}"/>
  <path d="M176 120h160v276l-80-58-80 58z" fill="${background}" stroke="${background}" stroke-width="20" stroke-linejoin="round"/>
  <rect x="208" y="168" width="96" height="14" rx="7" fill="${primary}"/>
  <rect x="220" y="198" width="72" height="14" rx="7" fill="${accent}"/>
</svg>
`;
}

async function png(source: string, size: number, name: string) {
	await sharp(Buffer.from(source)).resize(size, size).png().toFile(new URL(name, OUT).pathname);
}

await mkdir(OUT, { recursive: true });

const rounded = svg({ rounded: true });
const square = svg({ rounded: false });

await writeFile(new URL('icon.svg', OUT), rounded);
await png(rounded, 192, 'icon-192.png');
await png(rounded, 512, 'icon-512.png');
await png(square, 512, 'icon-maskable-512.png');
await png(square, 180, 'apple-touch-icon.png');

console.log('Icone generate in static/icons/');
