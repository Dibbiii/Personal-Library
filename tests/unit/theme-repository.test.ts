import { describe, expect, it } from 'vitest';
import type { RpcTransport } from '../../src/lib/data/rpc-client';
import { RpcThemeRepository } from '../../src/lib/data/theme-repository';
import { builtinThemes } from '../../src/lib/themes/registry';

describe('migrazione compatibile dei temi custom', () => {
	it('fornisce la palette Saggi ai temi salvati prima dell’aggiunta del genere', async () => {
		const builtin = builtinThemes.segnalibro!;
		const oldGenres = Object.fromEntries(
			Object.entries(builtin.genres).filter(([slug]) => slug !== 'essays')
		);
		const transport: RpcTransport = {
			async rpc() {
				return {
					data: {
						contractVersion: 1,
						themes: [
							{
								id: '33333333-3333-4333-8333-333333333333',
								name: 'Tema precedente',
								schemaVersion: 1,
								tokens: { colors: builtin.colors, genres: oldGenres }
							}
						]
					},
					error: null
				};
			}
		};

		const [theme] = await new RpcThemeRepository(transport).listCustom();

		expect(theme?.genres).toHaveProperty(
			'essays',
			(builtin.genres as Record<string, unknown>).essays
		);
	});
});
