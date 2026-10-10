import type { ThemeDefinition, ThemeSelection } from '../contracts/themes';
import { themeDefinitionSchema } from '../contracts/themes';
import { themeMutationResponseSchema, type SetThemeInput } from '../contracts/rpc';
import {
	customThemeListResponseSchema,
	customThemeResponseSchema,
	okResponseSchema,
	type customThemeRowSchema
} from '../contracts/settings';
import type { z } from 'zod';
import { builtinThemes } from '../themes/registry';
import { DataAccessError } from './errors';
import type { ThemeRepository } from './repositories';
import { callRpc, type RpcTransport } from './rpc-client';
import { RPC } from './rpc-names';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CustomThemeRow = z.infer<typeof customThemeRowSchema>;

/** Ricompone la definizione (id e nome vengono dalla riga, colori e generi dai token). */
function rowToDefinition(row: CustomThemeRow): ThemeDefinition {
	const tokens = (
		typeof row.tokens === 'object' && row.tokens !== null ? row.tokens : {}
	) as Record<string, unknown>;
	const savedGenres =
		typeof tokens.genres === 'object' && tokens.genres !== null && !Array.isArray(tokens.genres)
			? (tokens.genres as Record<string, unknown>)
			: {};
	const fallbackGenres = builtinThemes.segnalibro!.genres;
	return themeDefinitionSchema.parse({
		schemaVersion: row.schemaVersion,
		id: row.id,
		name: row.name,
		colors: tokens.colors,
		genres: { ...fallbackGenres, ...savedGenres }
	});
}

export class RpcThemeRepository implements ThemeRepository {
	constructor(private readonly transport: RpcTransport) {}

	async getSelection(): Promise<ThemeSelection> {
		const response = await callRpc(
			this.transport,
			RPC.getThemeSelection,
			{},
			themeMutationResponseSchema
		);
		return response.selection;
	}

	async setSelection(input: SetThemeInput): Promise<ThemeSelection> {
		const { selection } = input;
		const response = await callRpc(
			this.transport,
			RPC.setThemeSelection,
			selection.kind === 'builtin'
				? { p_kind: 'builtin', p_key: selection.key, p_custom_theme_id: null }
				: { p_kind: 'custom', p_key: null, p_custom_theme_id: selection.id },
			themeMutationResponseSchema
		);
		return response.selection;
	}

	async listBuiltins(): Promise<ThemeDefinition[]> {
		return Object.values(builtinThemes);
	}

	async listCustom(): Promise<ThemeDefinition[]> {
		const response = await callRpc(
			this.transport,
			RPC.listCustomThemes,
			{},
			customThemeListResponseSchema
		);

		const themes: ThemeDefinition[] = [];
		for (const row of response.themes) {
			try {
				themes.push(rowToDefinition(row));
			} catch {
				// Un tema salvato con uno schema non più valido viene ignorato, non rompe la pagina.
			}
		}
		return themes;
	}

	async saveCustom(theme: ThemeDefinition): Promise<ThemeDefinition> {
		const valid = themeDefinitionSchema.parse(theme);
		const tokens = { colors: valid.colors, genres: valid.genres };

		const save = async (id: string | null) =>
			callRpc(
				this.transport,
				RPC.saveCustomTheme,
				{
					p_name: valid.name,
					// jsonb: postgres.js serializza l'oggetto (una stringa verrebbe salvata come stringa JSON)
					p_tokens: tokens,
					p_schema_version: valid.schemaVersion,
					p_id: id
				},
				customThemeResponseSchema
			);

		let response;
		if (UUID_RE.test(valid.id)) {
			try {
				response = await save(valid.id);
			} catch (error) {
				if (!(error instanceof DataAccessError) || error.code !== 'NOT_FOUND') throw error;
				response = await save(null);
			}
		} else {
			response = await save(null);
		}
		return rowToDefinition(response.theme);
	}

	async deleteCustom(themeId: string): Promise<void> {
		await callRpc(this.transport, RPC.deleteCustomTheme, { p_id: themeId }, okResponseSchema);
	}
}
