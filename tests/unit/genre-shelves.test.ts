import { describe, expect, it } from 'vitest';
import {
	updateUserGenreShelvesInputSchema,
	userGenreShelvesResponseSchema
} from '../../src/lib/contracts/settings';

const genres = [
	'classics',
	'mythology-epic-retelling',
	'dystopia-scifi',
	'thriller-mystery',
	'fantasy-magical-gothic',
	'romance-ya-na',
	'contemporary-historical'
].map((slug, index) => ({ id: index + 1, slug, name: `Scaffale ${index + 1}`, sortOrder: index + 1 }));

describe('contratti scaffali personali', () => {
	it('accetta sette generi distinti, rinominati e ordinati', () => {
		expect(userGenreShelvesResponseSchema.parse({ contractVersion: 1, genres }).genres).toEqual(genres);
		expect(
		updateUserGenreShelvesInputSchema.safeParse({
			genres: genres.map(({ slug, name, sortOrder }) => ({ slug, name, sortOrder }))
		}).success
	).toBe(true);
	});

	it('rifiuta nomi vuoti e posizioni duplicate', () => {
		const invalid = genres.map(({ slug, name, sortOrder }) => ({ slug, name, sortOrder }));
		invalid[0]!.name = ' ';
		invalid[1]!.sortOrder = 1;
		expect(updateUserGenreShelvesInputSchema.safeParse({ genres: invalid }).success).toBe(false);
	});
});
