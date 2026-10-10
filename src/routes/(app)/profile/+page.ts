import { loadProfileComponents } from '$lib/profile/load-components';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ data }) => loadProfileComponents(data);
