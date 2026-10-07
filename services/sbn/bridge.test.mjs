import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuery, mapMarc, parseMarc } from './bridge.mjs';

function marc(fields) {
	const content = fields.map(([tag, value]) => [tag, Buffer.from(`${value}\x1e`)]);
	let offset = 0;
	const directory = content
		.map(([tag, buffer]) => {
			const entry = `${tag}${String(buffer.length).padStart(4, '0')}${String(offset).padStart(5, '0')}`;
			offset += buffer.length;
			return entry;
		})
		.join('');
	const base = 25 + directory.length;
	const length = base + offset + 1;
	const leader = `${String(length).padStart(5, '0')}nam a22${String(base).padStart(5, '0')}   4500`;
	return Buffer.concat([
		Buffer.from(leader + directory + '\x1e'),
		...content.map(([, b]) => b),
		Buffer.from('\x1d')
	]);
}
test('MARC21 UTF-8 byte offsets and bibliographic edition fields', () => {
	const data = marc([
		['001', 'IT\\ICCU\\PAR\\1242486'],
		['245', '14\x1faCittà e memoria /'],
		['100', '1 \x1faAutore, Ada,'],
		['020', '  \x1fa9788804678106'],
		['260', '  \x1fbEditore,\x1fc2025'],
		['300', '  \x1fa183 p.'],
		['041', '  \x1faita']
	]);
	assert.equal(mapMarc(parseMarc(data)[0]).title, 'Città e memoria');
	assert.deepEqual(mapMarc(parseMarc(data)[0]), {
		id: 'PAR1242486',
		title: 'Città e memoria',
		authors: ['Autore, Ada'],
		isbns: ['9788804678106'],
		language: 'ita',
		publisher: 'Editore',
		publishedDate: '2025',
		pageCount: 183
	});
	assert.throws(() => parseMarc(data.subarray(0, 20)));
});
test('PQF input cannot inject commands, normalizes diacritics and validates ISBN', () => {
	assert.equal(buildQuery(new URLSearchParams({ title: 'Città "\n! ls' })), '@attr 1=4 "Citta ls"');
	assert.equal(
		buildQuery(new URLSearchParams({ title: 'Dune', author: 'Herbert' })),
		'@and @attr 1=4 "Dune" @attr 1=1003 "Herbert"'
	);
	assert.throws(() => buildQuery(new URLSearchParams({ isbn: 'isbn\nquit' })));
});
