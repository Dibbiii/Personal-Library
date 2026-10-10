import { invalidate } from '$app/navigation';

export const READING_DEPENDENCIES = [
	'app:reading',
	'app:library',
	'app:profile',
	'app:queue',
	'app:quotes'
] as const;
const requested = new Set<string>();
let pending: Promise<void> | undefined;

/** One invalidation per batch, including concurrent sync and mutation notifications. */
export function refreshData(dependencies: readonly string[]): Promise<void> {
	for (const key of dependencies) requested.add(key);
	pending ??= Promise.resolve()
		.then(async () => {
			while (requested.size > 0) {
				const keys = new Set(requested);
				requested.clear();
				await invalidate((url) => keys.has(url.href));
			}
		})
		.finally(() => {
			pending = undefined;
			// A notification can arrive after the loop exits but before this finalizer runs.
			if (requested.size > 0) return refreshData([]);
		});
	return pending;
}
