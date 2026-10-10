import { describe, expect, it } from 'vitest';
import {
	parseSeriesNumber,
	seriesRefFromFields,
	validateSeriesFields
} from '../../src/lib/catalog/series-form';

describe('dati dei volumi della serie', () => {
	it('interpreta valori decimali italiani e campi vuoti', () => {
		expect(parseSeriesNumber('1,5')).toBe(1.5);
		expect(parseSeriesNumber('1,234')).toBe(1.234);
		expect(parseSeriesNumber('')).toBeNull();
		expect(parseSeriesNumber('abc')).toBeUndefined();
	});

	it('consente di scollegare una serie lasciando vuoti tutti i campi', () => {
		expect(validateSeriesFields('', null, null)).toBeNull();
		expect(seriesRefFromFields('', null, null)).toBeNull();
	});

	it('costruisce i metadati normalizzati quando i campi sono validi', () => {
		expect(validateSeriesFields('  Saga  ', 1.5, 3)).toBeNull();
		expect(seriesRefFromFields('  Saga  ', 1.5, 3)).toEqual({
			name: 'Saga',
			number: 1.5,
			total: 3
		});
	});

	it('rifiuta numeri e totali non validi prima di inviare la modifica', () => {
		expect(validateSeriesFields('Saga', undefined, 3)).toBe(
			'Il numero del volume deve essere maggiore di zero.'
		);
		expect(validateSeriesFields('Saga', 2, 1)).toBe(
			'Il numero del volume non può superare il totale.'
		);
		expect(validateSeriesFields('Saga', 2, 1.5)).toBe(
			'Il totale dei volumi deve essere un intero tra 1 e 999.'
		);
		expect(validateSeriesFields('Saga', 1.234, 3)).toBe(
			'Il numero del volume può avere al massimo due decimali.'
		);
		expect(validateSeriesFields('', 2, null)).toBe('Scrivi anche il nome della serie.');
	});
});
