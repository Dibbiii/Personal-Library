/**
 * Parte pura della Quote Card: word-wrap e scaling del testo. Nessuna dipendenza dal DOM,
 * la misura del testo arriva da fuori (`ctx.measureText` nel browser, una funzione finta nei test).
 */

export type MeasureText = (text: string) => number;

/** Spezza il testo in righe che stanno in `maxWidth`. I `\n` sono a capo espliciti. */
export function wrapText(text: string, maxWidth: number, measure: MeasureText): string[] {
	const lines: string[] = [];

	for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
		const words = paragraph.split(/\s+/).filter(Boolean);
		if (words.length === 0) {
			lines.push('');
			continue;
		}

		let current = '';
		for (const word of words) {
			const candidate = current ? `${current} ${word}` : word;
			if (measure(candidate) <= maxWidth) {
				current = candidate;
				continue;
			}
			if (current) lines.push(current);
			// Parola più larga della riga: si spezza per caratteri.
			const pieces = breakLongWord(word, maxWidth, measure);
			current = pieces.pop() ?? '';
			lines.push(...pieces);
		}
		lines.push(current);
	}

	while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
	return lines;
}

function breakLongWord(word: string, maxWidth: number, measure: MeasureText): string[] {
	if (measure(word) <= maxWidth) return [word];

	const pieces: string[] = [];
	let current = '';
	for (const char of Array.from(word)) {
		if (current && measure(current + char) > maxWidth) {
			pieces.push(current);
			current = char;
		} else {
			current += char;
		}
	}
	pieces.push(current);
	return pieces;
}

/** Accorcia `text` aggiungendo "…" finché sta in `maxWidth`. */
export function ellipsize(text: string, maxWidth: number, measure: MeasureText): string {
	if (measure(text) <= maxWidth) return text;

	let chars = Array.from(text.trimEnd());
	while (chars.length > 0 && measure(`${chars.join('').trimEnd()}…`) > maxWidth) chars.pop();
	chars = Array.from(chars.join('').trimEnd());
	return `${chars.join('')}…`;
}

export interface FitOptions {
	text: string;
	maxWidth: number;
	maxHeight: number;
	maxFontSize: number;
	minFontSize: number;
	/** line-height / font-size. */
	lineHeight?: number;
	/** Decremento del corpo a ogni tentativo. */
	step?: number;
	/** Restituisce la funzione di misura per un dato corpo. */
	measureAt: (fontSize: number) => MeasureText;
}

export interface FitResult {
	fontSize: number;
	lineHeight: number;
	lines: string[];
	/** Il testo non stava nemmeno al corpo minimo ed è stato troncato con "…". */
	truncated: boolean;
	/** Altezza occupata dalle righe. */
	height: number;
}

/**
 * Sceglie il corpo più grande (tra max e min) per cui il testo sta nel riquadro.
 * Se neanche il minimo basta, tronca l'ultima riga visibile con un'ellissi.
 */
export function fitText(options: FitOptions): FitResult {
	const { text, maxWidth, maxHeight, maxFontSize, minFontSize } = options;
	const lineHeightRatio = options.lineHeight ?? 1.3;
	const step = Math.max(options.step ?? 2, 0.5);
	const normalized = text.trim();

	let fontSize = Math.max(maxFontSize, minFontSize);
	for (;;) {
		const lineHeight = fontSize * lineHeightRatio;
		const measure = options.measureAt(fontSize);
		const lines = wrapText(normalized, maxWidth, measure);
		const height = lines.length * lineHeight;

		if (height <= maxHeight) {
			return { fontSize, lineHeight, lines, truncated: false, height };
		}
		if (fontSize - step < minFontSize) {
			const fit = Math.max(1, Math.floor(maxHeight / lineHeight));
			const visible = lines.slice(0, fit);
			const last = visible.length - 1;
			// L'ellissi si applica alla riga più l'inizio di quella successiva, così non si perde spazio.
			const tail = lines.slice(last).join(' ');
			visible[last] = ellipsize(tail, maxWidth, measure);
			return {
				fontSize,
				lineHeight,
				lines: visible,
				truncated: true,
				height: visible.length * lineHeight
			};
		}
		fontSize = Math.max(fontSize - step, minFontSize);
	}
}
