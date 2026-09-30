#!/usr/bin/env node
/**
 * Fallisce se trova colori letterali (#hex, rgb/hsl/oklch..., nomi CSS, classi Tailwind colorate)
 * fuori dai file di definizione del tema. Regola della specifica, sezione 21.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

const SCAN = ['src', 'static', 'vite.config.ts', 'svelte.config.js'];
const EXTENSIONS = new Set([
	'.svelte',
	'.ts',
	'.js',
	'.css',
	'.html',
	'.svg',
	'.json',
	'.webmanifest'
]);

/** Percorsi (prefissi) dove i colori letterali sono ammessi. */
const ALLOWED = [
	'src/lib/themes/', // definizioni tema
	'static/icons/' // asset generati da scripts/generate-icons.ts a partire dal tema
];

const NAMED = [
	'white',
	'black',
	'red',
	'green',
	'blue',
	'yellow',
	'orange',
	'purple',
	'pink',
	'gray',
	'grey',
	'brown',
	'cyan',
	'magenta',
	'maroon',
	'navy',
	'teal',
	'olive',
	'lime',
	'aqua',
	'silver',
	'gold',
	'crimson',
	'coral',
	'salmon',
	'beige',
	'ivory',
	'tan',
	'violet',
	'indigo',
	'turquoise'
].join('|');

const TAILWIND_PALETTE =
	'white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';

const RULES = [
	{ name: '#hex', re: /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])/g },
	{ name: 'funzione colore', re: /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/g },
	{
		name: 'color() / light-dark()',
		re: /\b(?:color|light-dark)\(\s*(?:srgb|display-p3|rec2020|#|[a-z]+,)/g
	},
	{
		name: 'nome colore CSS',
		re: new RegExp(
			`(?:\\b(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|outline(?:-color)?|fill|stroke|caret-color|accent-color)\\s*:|\\b(?:fill|stroke|stop-color|flood-color)=["'])\\s*(?:${NAMED})\\b`,
			'gi'
		)
	},
	{
		name: 'classe Tailwind colorata',
		re: new RegExp(
			`(?<![\\w-])(?:[a-z0-9-]+:)*(?:bg|text|border|fill|stroke|ring|from|to|via|shadow|outline|divide|accent|caret|decoration|placeholder)-(?:${TAILWIND_PALETTE})(?:-\\d{2,3})?(?![\\w-])`,
			'g'
		)
	}
];

function* walk(path) {
	const stat = statSync(path, { throwIfNoEntry: false });
	if (!stat) return;
	if (stat.isFile()) {
		yield path;
		return;
	}
	for (const entry of readdirSync(path)) {
		if (entry === 'node_modules' || entry.startsWith('.')) continue;
		yield* walk(join(path, entry));
	}
}

const violations = [];

for (const target of SCAN) {
	for (const file of walk(join(ROOT, target))) {
		const rel = relative(ROOT, file).split('\\').join('/');
		if (!EXTENSIONS.has(extname(file))) continue;
		if (ALLOWED.some((prefix) => rel.startsWith(prefix))) continue;

		const lines = readFileSync(file, 'utf8').split('\n');
		lines.forEach((line, index) => {
			for (const rule of RULES) {
				for (const match of line.matchAll(rule.re)) {
					violations.push(`${rel}:${index + 1}  ${rule.name}  ${match[0].trim()}`);
				}
			}
		});
	}
}

if (violations.length > 0) {
	console.error('Colori letterali trovati fuori dai file tema:\n');
	for (const v of violations) console.error(`  ${v}`);
	console.error(
		`\n${violations.length} violazione/i. Usa i token (var(--color-*), var(--genre-*)).`
	);
	process.exit(1);
}

console.log('Nessun colore letterale fuori da src/lib/themes/.');
