<script lang="ts">
	import { page } from '$app/state';
	import DnfCemetery from '$lib/components/stats/DnfCemetery.svelte';
	import StatsView from '$lib/components/stats/StatsView.svelte';
	import YearPicker from '$lib/components/stats/YearPicker.svelte';
	import type {
		BingoBoardListItem,
		DnfBook,
		GenreSlug,
		LibraryHomeResponse,
		QuotePreview,
		ReadingCalendarDay,
		YearStats
	} from '$lib/contracts';
	import { genreShares, libraryCounts, recentActivity } from '$lib/profile/overview';
	import ActivityList from './ActivityList.svelte';
	import ProfileCard from './ProfileCard.svelte';
	import ProfileHero from './ProfileHero.svelte';
	import ProfileOverview from './ProfileOverview.svelte';

	interface Props {
		year: number;
		currentYear: number;
		years: number[];
		stats: YearStats;
		genreBreakdown: { slug: GenreSlug; count: number }[];
		bingo: BingoBoardListItem | null;
		quotes: QuotePreview[];
		quoteCount: number;
		dnf: DnfBook[];
		calendar: ReadingCalendarDay[];
		home: LibraryHomeResponse;
	}

	let props: Props = $props();

	const TABS = [
		{ key: 'overview', label: 'Panoramica' },
		{ key: 'stats', label: 'Statistiche' },
		{ key: 'activity', label: 'Attività' },
		{ key: 'dnf', label: 'Abbandonati' }
	] as const;
	type TabKey = (typeof TABS)[number]['key'];

	const tab = $derived.by<TabKey>(() => {
		const requested = page.url.searchParams.get('tab');
		return TABS.find((t) => t.key === requested)?.key ?? 'overview';
	});

	const user = $derived(page.data.user);
	const name = $derived(user?.displayName ?? user?.email ?? 'Lettore');
	const counts = $derived(libraryCounts(props.home));

	function yearPath(year: number): string {
		return year === props.currentYear ? '/profile' : `/profile/${year}`;
	}

	function tabHref(key: string, year = props.year): string {
		return key === 'overview' ? yearPath(year) : `${yearPath(year)}?tab=${key}`;
	}
</script>

<div class="profile" data-testid="profile-page">
	<ProfileHero
		{name}
		email={user?.email ?? null}
		year={props.year}
		{counts}
		genres={genreShares(props.genreBreakdown)}
		readingDays={props.stats.readingDays}
	/>

	<div class="tabbar">
		<nav aria-label="Sezioni del profilo">
			<ul>
				{#each TABS as t (t.key)}
					<li>
						<a
							href={tabHref(t.key)}
							class:active={tab === t.key}
							aria-current={tab === t.key ? 'page' : undefined}
							data-sveltekit-noscroll
							data-sveltekit-replacestate
						>
							{t.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
		<YearPicker year={props.year} years={props.years} href={(y) => tabHref(tab, y)} />
	</div>

	{#if tab === 'overview'}
		<ProfileOverview
			year={props.year}
			isCurrentYear={props.year === props.currentYear}
			stats={props.stats}
			bingo={props.bingo}
			calendar={props.calendar}
			home={props.home}
			{counts}
			dnf={props.dnf}
			quotes={props.quotes}
			quoteCount={props.quoteCount}
			tabHref={(key) => tabHref(key)}
		/>
	{:else if tab === 'stats'}
		<StatsView
			year={props.year}
			stats={props.stats}
			genreBreakdown={props.genreBreakdown}
			bingo={props.bingo}
			quotes={props.quotes}
			dnf={props.dnf}
			showDnf={false}
		/>
	{:else if tab === 'activity'}
		<ProfileCard icon="calendar" title="Attività recente" class="activity-full">
			<ActivityList items={recentActivity(props.home, props.dnf, 30)} />
		</ProfileCard>
	{:else}
		<DnfCemetery books={props.dnf} />
	{/if}
</div>

<style>
	.profile {
		display: flex;
		flex-direction: column;
		gap: 20px;
		box-sizing: border-box;
		width: 100%;
		max-width: var(--content-max);
		margin: 0 auto;
		padding: 16px var(--page-gutter) 32px;
	}

	.tabbar {
		display: flex;
		align-items: center;
		gap: 12px;
		border-bottom: 1px solid var(--color-divider);
	}

	nav {
		flex: 1;
		min-width: 0;
		overflow-x: auto;
		scrollbar-width: none;
	}

	ul {
		display: flex;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	nav a {
		position: relative;
		display: flex;
		align-items: center;
		min-height: 48px;
		padding: 0 14px;
		color: var(--color-text-secondary);
		font-size: 14px;
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
	}

	nav a:hover {
		color: var(--color-text-primary);
	}

	nav a.active {
		color: var(--color-primary);
		font-weight: 700;
	}

	nav a.active::after {
		content: '';
		position: absolute;
		inset: auto 8px -1px;
		height: 3px;
		border-radius: 3px 3px 0 0;
		background: var(--color-primary);
	}

	.profile :global(.activity-full) {
		max-width: 720px;
	}

	@media (min-width: 1024px) {
		.profile {
			gap: 24px;
			padding-top: 24px;
		}
	}
</style>
