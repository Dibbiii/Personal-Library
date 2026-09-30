<script lang="ts">
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import type {
		BingoBoardListItem,
		DnfBook,
		GenreSlug,
		QuotePreview,
		YearStats
	} from '$lib/contracts';
	import BingoSection from './BingoSection.svelte';
	import DnfCemetery from './DnfCemetery.svelte';
	import GenreBar from './GenreBar.svelte';
	import QuotesSection from './QuotesSection.svelte';
	import StatCard from './StatCard.svelte';
	import TopTags from './TopTags.svelte';
	import YearPicker from './YearPicker.svelte';
	import { countLabel, formatNumber, monthName, plural } from './format';

	interface Props {
		year: number;
		years: number[];
		stats: YearStats;
		genreBreakdown: { slug: GenreSlug; count: number }[];
		bingo: BingoBoardListItem | null;
		quotes: QuotePreview[];
		dnf: DnfBook[];
		/** Indirizzo della pagina per un anno (/stats per quello corrente). */
		yearHref: (year: number) => string;
	}

	let { year, years, stats, genreBreakdown, bingo, quotes, dnf, yearHref }: Props = $props();

	const hasData = $derived(stats.booksFinished > 0 || stats.pagesRead > 0);

	// Quote Card: il codice Canvas entra nel bundle solo al primo uso (import dinamico).
	type CreatorComponent = typeof import('$lib/components/quotes/QuoteCardCreator.svelte').default;
	let Creator = $state<CreatorComponent | null>(null);
	let creatorOpen = $state(false);
	let loadingCreator = false;

	async function openCreator() {
		if (loadingCreator) return;
		loadingCreator = true;
		try {
			Creator ??= (await import('$lib/components/quotes/QuoteCardCreator.svelte')).default;
			creatorOpen = true;
		} finally {
			loadingCreator = false;
		}
	}
</script>

<PageHeader title="Statistiche">
	{#snippet actions()}
		<YearPicker {year} {years} href={yearHref} />
	{/snippet}
</PageHeader>

<div class="stats" data-testid="stats-page">
	{#if !hasData}
		<p class="empty" data-testid="stats-empty">
			Ancora nessuna lettura completata nel {year}. Quando segnerai un libro come letto, qui
			compariranno genere, autore, pagine e serie di lettura.
		</p>
	{/if}

	<div class="cards">
		<StatCard icon="book-open" label="Genere più letto" class="genre">
			{#if stats.topGenre}
				<p class="value v22">{stats.topGenre.genre.name}</p>
				<p class="sub">
					<span class="dot" style="background: var(--genre-{stats.topGenre.genre.slug})"></span>
					{countLabel(stats.topGenre.booksFinished, 'libro', 'libri')} nel {year}
				</p>
				<GenreBar segments={genreBreakdown} />
			{:else}
				<p class="value v22 none">—</p>
				<p class="sub">Nessun libro letto nel {year}</p>
			{/if}
		</StatCard>

		<StatCard icon="user" label="Autore dell'anno" class="author">
			{#if stats.topAuthor}
				<p class="value v22">{stats.topAuthor.name}</p>
				<p class="sub">{countLabel(stats.topAuthor.booksFinished, 'libro letto', 'libri letti')}</p>
			{:else}
				<p class="value v22 none">—</p>
				<p class="sub">Nessun autore ancora</p>
			{/if}
		</StatCard>

		<StatCard icon="sun" label="Mese d'oro" class="month">
			{#if stats.goldenMonth}
				<p class="value v30">{monthName(stats.goldenMonth.month)}</p>
				<p class="sub">
					{countLabel(stats.goldenMonth.booksFinished, 'libro letto', 'libri letti')}
				</p>
			{:else}
				<p class="value v30 none">—</p>
				<p class="sub">Nessun mese ancora</p>
			{/if}
		</StatCard>

		<StatCard icon="file-text" label="Pagine totali" class="pages">
			<p class="value v30">{formatNumber(stats.pagesRead)}</p>
			<p class="sub">{plural(stats.pagesRead, 'pagina', 'pagine')} nel {year}</p>
		</StatCard>

		<StatCard icon="flame" label="Streak di lettura" class="streak">
			<p class="value v24">{countLabel(stats.currentStreak, 'giorno', 'giorni')}</p>
			<p class="sub">Record: {countLabel(stats.recordStreak, 'giorno', 'giorni')}</p>
		</StatCard>

		<StatCard icon="tag" label="Tag più usati" class="tags">
			{#if stats.topTags.length > 0}
				<TopTags tags={stats.topTags.slice(0, 4)} />
			{:else}
				<p class="sub tagless">Ancora nessun tag: aggiungili alle recensioni dei libri letti.</p>
			{/if}
		</StatCard>
	</div>

	<div class="sections">
		<BingoSection {year} board={bingo} />
		<QuotesSection {quotes} oncreate={openCreator} />
		<div class="cemetery"><DnfCemetery books={dnf} /></div>
	</div>
</div>

{#if Creator}
	<Creator open={creatorOpen} {quotes} onclose={() => (creatorOpen = false)} />
{/if}

<style>
	.stats {
		display: flex;
		flex-direction: column;
		gap: 32px;
		padding: 4px var(--page-gutter) 24px;
	}

	.empty {
		margin: 0;
		padding: 16px;
		border-radius: 22px;
		background: var(--color-surface);
		font-size: 14px;
		line-height: 20px;
		color: var(--color-text-secondary);
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}

	.cards :global(.genre),
	.cards :global(.tags) {
		grid-column: 1 / -1;
	}

	.value {
		margin: 12px 0 0;
		font-family: var(--font-display);
		line-height: 1.12;
		color: var(--color-text-primary);
		overflow-wrap: anywhere;
	}

	.v22 {
		font-size: 22px;
	}

	.v24 {
		font-size: 24px;
	}

	.v30 {
		font-size: 30px;
	}

	.none {
		color: var(--color-text-muted);
	}

	.sub {
		display: flex;
		align-items: center;
		margin: 4px 0 0;
		font-size: 13px;
		line-height: 17px;
		color: var(--color-text-secondary);
	}

	.dot {
		width: 9px;
		height: 9px;
		margin-right: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.tagless {
		margin-top: 12px;
	}

	.sections {
		display: flex;
		flex-direction: column;
		gap: 32px;
	}

	@media (min-width: 720px) {
		.cards {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}

		.cards :global(.genre),
		.cards :global(.tags) {
			grid-column: span 2;
		}
	}

	@media (min-width: 1024px) {
		.stats {
			gap: 40px;
			padding-top: 12px;
		}

		.sections {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 32px 40px;
			align-items: start;
		}

		.sections .cemetery {
			grid-column: 1 / -1;
		}
	}
</style>
