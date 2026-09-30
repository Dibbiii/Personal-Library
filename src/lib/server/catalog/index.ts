import { GoogleBooksProvider } from './google-books';
import { OpenLibraryProvider } from './open-library';
import { CatalogService } from './service';
import { serverEnv } from '../db/env';

export { CatalogService } from './service';
export { OpenLibraryProvider } from './open-library';
export { GoogleBooksProvider } from './google-books';
export { RateLimiter } from './rate-limit';

const globalKey = Symbol.for('segnalibro.catalogService');
const globals = globalThis as unknown as Record<symbol, CatalogService | undefined>;

/**
 * Servizio di catalogo condiviso dal processo (la cache vive qui, anche oltre l'HMR in sviluppo).
 * `GOOGLE_BOOKS_API_KEY` si legge solo sul server e non viene mai inviata al browser.
 */
export function getCatalogService(): CatalogService {
	return (globals[globalKey] ??= new CatalogService({
		providers: [
			new OpenLibraryProvider(),
			new GoogleBooksProvider({ apiKey: serverEnv('GOOGLE_BOOKS_API_KEY') })
		]
	}));
}
