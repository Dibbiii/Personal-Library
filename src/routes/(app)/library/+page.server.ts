import { QUEUE_DEPENDENCY } from '$lib/client/queue-keys';
import { requireRepository } from '$lib/server/repositories';
import type { PageServerLoad } from './$types';

// Una sola RPC (`get_library_home`): in lettura, prossimi e i 7 scaffali con la prima pagina.
export const load: PageServerLoad = async ({ locals, depends }) => {
	depends(QUEUE_DEPENDENCY, 'app:library', 'app:reading');
	const library = requireRepository(locals.repos, 'library');
	return { home: await library.getHome() };
};
