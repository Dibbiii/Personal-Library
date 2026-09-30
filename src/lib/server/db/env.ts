/**
 * Runtime configuration for server-only code (database, storage).
 *
 * SvelteKit exposes .env files in `vite dev` only through `$env/dynamic/private`
 * (they are NOT copied into process.env), while plain Node code (tests, scripts)
 * only has process.env. Both are consulted, an explicit process.env value first.
 *
 * The dynamic import is wrapped so the module also loads outside SvelteKit,
 * where `$env/*` does not exist.
 */
let dynamicEnv: Record<string, string | undefined> = {};

try {
	const mod = await import('$env/dynamic/private');
	dynamicEnv = mod.env as Record<string, string | undefined>;
} catch {
	// not running inside SvelteKit/Vite: fall back to process.env only
}

/**
 * Reads are lazy and never happen at import time: SvelteKit's build analysis
 * imports server modules with no environment available and throws when
 * `$env/dynamic/private` is read then.
 */
export function serverEnv(name: string): string | undefined {
	const fromProcess = process.env[name];
	if (fromProcess !== undefined && fromProcess !== '') return fromProcess;
	try {
		const fromKit = dynamicEnv[name];
		if (fromKit !== undefined && fromKit !== '') return fromKit;
	} catch {
		// SvelteKit refuses env reads during build/analysis: use process.env only
	}
	return undefined;
}

/** Local development defaults (docker-compose.yml). Never used when NODE_ENV=production. */
export const DEV_DATABASE_URL = 'postgres://segnalibro_app:segnalibro_app@127.0.0.1:5433/segnalibro';

export function isProduction(): boolean {
	return (serverEnv('NODE_ENV') ?? process.env.NODE_ENV) === 'production';
}
