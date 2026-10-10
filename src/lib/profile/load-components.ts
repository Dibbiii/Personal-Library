import type { ProfileTab } from '$lib/contracts/performance';

/** Universal load: await the active component for SSR and load its chunk on navigation. */
export async function loadProfileComponents<T extends { tab: ProfileTab }>(data: T) {
	const [stats, wheel, calendar, dnf] = await Promise.all([
		data.tab === 'stats' ? import('$lib/components/stats/StatsView.svelte') : null,
		data.tab === 'wheel' ? import('$lib/components/explore/WheelSection.svelte') : null,
		data.tab === 'calendar' ? import('$lib/components/explore/ReadingCalendar.svelte') : null,
		data.tab === 'dnf' ? import('$lib/components/stats/DnfCemetery.svelte') : null
	]);
	return {
		...data,
		components: {
			stats: stats?.default ?? null,
			wheel: wheel?.default ?? null,
			calendar: calendar?.default ?? null,
			dnf: dnf?.default ?? null
		}
	};
}
