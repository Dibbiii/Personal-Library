import { describe, expect, it } from 'vitest';
import {
	cleanDescription,
	parseYear,
	pickSubjects,
	pickWork
} from '../../src/lib/server/catalog/book-info';

describe('book-info', () => {
	it('pulisce le descrizioni di Open Library e Google', () => {
		expect(
			cleanDescription(
				'A <b>great</b> novel about gods ([source][1]).\r\n\n----------\nSee also: [Odyssey][2]'
			)
		).toBe('A great novel about gods .');
		expect(cleanDescription('<p>Prima riga</p><p>seconda riga del testo</p>')).toBe(
			'Prima riga\n\nseconda riga del testo'
		);
		expect(cleanDescription('troppo corta')).toBeNull();
		expect(cleanDescription(null)).toBeNull();
	});

	it('tiene solo temi leggibili e senza doppioni', () => {
		expect(
			pickSubjects([
				'Science fiction',
				'Science-fiction',
				'nyt:combined-print=2018',
				'Witches--fiction',
				'Dune (imaginary place), fiction',
				'Fiction',
				'mythology',
				'Greek Mythology'
			])
		).toEqual(['Science fiction', 'Mythology', 'Greek Mythology']);
	});

	it('sceglie l’opera solo se l’autore corrisponde', () => {
		const docs = [
			{
				key: '/works/A',
				title: 'The Song of Achilles',
				author_name: ['Madeline Miller'],
				edition_count: 43
			},
			{
				key: '/works/B',
				title: 'La canzone di Achille',
				author_name: ['Altro Autore'],
				edition_count: 2
			}
		];
		expect(pickWork(docs, { title: 'La canzone di Achille', author: 'Madeline Miller' })?.key).toBe(
			'/works/A'
		);
		expect(pickWork(docs, { title: 'Circe', author: 'Omero' })).toBeNull();
	});

	it('estrae l’anno dalle date dei cataloghi', () => {
		expect(parseYear('May 2, 2019')).toBe(2019);
		expect(parseYear('1965')).toBe(1965);
		expect(parseYear('s.d.')).toBeNull();
	});
});
