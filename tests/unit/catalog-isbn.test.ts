import { describe, expect, it } from 'vitest';
import {
	firstValidIsbn,
	hasBooklandPrefix,
	isValidEan13,
	isValidIsbn10,
	isValidIsbn13,
	isbn10To13,
	isbn13To10,
	normalizeIsbn,
	parseIsbn,
	parseScannedCode
} from '../../src/lib/catalog/isbn';

describe('normalizeIsbn', () => {
	it('toglie trattini, spazi e prefisso', () => {
		expect(normalizeIsbn(' 978-88-04-66803-9 ')).toBe('9788804668039');
		expect(normalizeIsbn('ISBN 88-04-66803-X')).toBe('880466803X');
		expect(normalizeIsbn('ISBN-13: 978 0 441 01359 3')).toBe('9780441013593');
		expect(normalizeIsbn('ISBN: 0-8044-2957-x')).toBe('080442957X');
	});

	it('accetta trattini tipografici', () => {
		expect(normalizeIsbn('978‐0441–0135—93')).toBe('9780441013593');
	});
});

describe('checksum', () => {
	it('ISBN-10 valido e non valido', () => {
		expect(isValidIsbn10('0441013597')).toBe(true);
		expect(isValidIsbn10('080442957X')).toBe(true); // X finale
		expect(isValidIsbn10('0441013598')).toBe(false);
		expect(isValidIsbn10('044101359')).toBe(false);
		expect(isValidIsbn10('04410135X7')).toBe(false); // X solo in ultima posizione
	});

	it('ISBN-13 / EAN-13', () => {
		expect(isValidIsbn13('9780441013593')).toBe(true);
		expect(isValidIsbn13('9788804668039')).toBe(true);
		expect(isValidIsbn13('9780441013594')).toBe(false);
		expect(isValidEan13('4006381333931')).toBe(true); // EAN valido ma non libro
		expect(isValidIsbn13('4006381333931')).toBe(false);
	});

	it('rileva il prefisso Bookland 978/979', () => {
		expect(hasBooklandPrefix('9780441013593')).toBe(true);
		expect(hasBooklandPrefix('9791090636071')).toBe(true);
		expect(hasBooklandPrefix('8000000000000')).toBe(false);
		expect(isValidIsbn13('9791090636071')).toBe(true);
	});
});

describe('conversioni', () => {
	it('ISBN-10 -> ISBN-13 e ritorno', () => {
		expect(isbn10To13('0441013597')).toBe('9780441013593');
		expect(isbn13To10('9780441013593')).toBe('0441013597');
		expect(isbn10To13('080442957X')).toBe('9780804429573');
		expect(isbn13To10('9780804429573')).toBe('080442957X');
	});

	it('i 979 non hanno un ISBN-10; input non validi danno null', () => {
		expect(isbn13To10('9791090636071')).toBeNull();
		expect(isbn10To13('0441013598')).toBeNull();
		expect(isbn13To10('9780441013594')).toBeNull();
	});
});

describe('parseIsbn', () => {
	it('restituisce la forma canonica a partire da 10 o 13 cifre', () => {
		expect(parseIsbn('0-441-01359-7')).toEqual({ isbn13: '9780441013593', isbn10: '0441013597' });
		expect(parseIsbn('978-0-441-01359-3')).toEqual({
			isbn13: '9780441013593',
			isbn10: '0441013597'
		});
		expect(parseIsbn('979-10-90636-07-1')).toEqual({ isbn13: '9791090636071', isbn10: null });
	});

	it('rifiuta checksum errato, lunghezze sbagliate e testo', () => {
		expect(parseIsbn('9780441013594')).toBeNull();
		expect(parseIsbn('12345')).toBeNull();
		expect(parseIsbn('abcdefghij')).toBeNull();
		expect(parseIsbn('')).toBeNull();
	});
});

describe('parseScannedCode', () => {
	it('accetta solo EAN-13 978/979 con checksum valido', () => {
		expect(parseScannedCode('9788804668039')?.isbn13).toBe('9788804668039');
		expect(parseScannedCode(' 9788804668039\n')?.isbn13).toBe('9788804668039');
		expect(parseScannedCode('4006381333931')).toBeNull(); // EAN di un altro prodotto
		expect(parseScannedCode('9788804668038')).toBeNull(); // checksum errato
		expect(parseScannedCode('0441013597')).toBeNull(); // un barcode EAN-13 non è mai un ISBN-10
	});
});

describe('firstValidIsbn', () => {
	it('salta i valori non validi', () => {
		expect(firstValidIsbn(['abc', '1234', '8834739671', '9788834739679'])?.isbn13).toBe(
			'9788834739679'
		);
		expect(firstValidIsbn(undefined)).toBeNull();
		expect(firstValidIsbn([])).toBeNull();
	});
});
