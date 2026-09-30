<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import AddReadingSheet, {
		type AddReadingChoice
	} from '$lib/components/detail/AddReadingSheet.svelte';
	import BookHero from '$lib/components/detail/BookHero.svelte';
	import MarkReadSheet from '$lib/components/detail/MarkReadSheet.svelte';
	import MoveSheet from '$lib/components/detail/MoveSheet.svelte';
	import ProgressPanel from '$lib/components/detail/ProgressPanel.svelte';
	import ProgressSheet from '$lib/components/detail/ProgressSheet.svelte';
	import ReadingHistory from '$lib/components/detail/ReadingHistory.svelte';
	import ReadingStatusSheet from '$lib/components/detail/ReadingStatusSheet.svelte';
	import SeriesCard from '$lib/components/detail/SeriesCard.svelte';
	import ActionsMenu from '$lib/components/detail/ActionsMenu.svelte';
	import CoverPicker from '$lib/components/catalog/CoverPicker.svelte';
	import ReviewPanel from '$lib/components/review/ReviewPanel.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import { addToQueue, removeFromQueue } from '$lib/client/queue.svelte';
	import {
		addCompletedReading,
		changeBookGenre,
		describeReadingError,
		pauseReading,
		resumeReading,
		startReading
	} from '$lib/client/reading';
	import {
		runPlanSteps,
		submitDnf,
		submitFinish,
		submitPageUpdate,
		type StatusActionInputs
	} from '$lib/client/reading-actions';
	import {
		currentStatusChoice,
		finalPageFor,
		isReviewUnlocked,
		localDateToIso,
		planStatusChange,
		type PlanContext,
		type StatusChoice
	} from '$lib/client/reading-logic';
	import type { GenreSlug } from '$lib/contracts';
	import { genreScopeStyle } from '$lib/genres';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const detail = $derived(data.detail);
	const book = $derived(detail.book);
	const reading = $derived(detail.currentReading);
	const slug = $derived(book.genre.slug);

	const status = $derived(currentStatusChoice(book));
	const unlocked = $derived(isReviewUnlocked(book));
	const planContext = $derived<PlanContext>({
		lifecycleState: book.lifecycleState,
		completedReadingsCount: book.completedReadingsCount,
		hasOpenReading: reading !== null
	});

	// ---- sheet e stato dell'interfaccia ----
	type SheetName = 'move' | 'status' | 'progress' | 'markRead' | 'addReading' | null;
	let sheet = $state<SheetName>(null);
	let busy = $state(false);
	let sheetError = $state<string | null>(null);
	let notice = $state<string | null>(null);
	let scoresReset = $state(false);
	let pendingPage = $state<number | null>(null);
	let offline = $state(false);
	let coverOpen = $state(false);
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;

	function say(message: string) {
		notice = message;
		clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => (notice = null), 5000);
	}

	function openSheet(name: Exclude<SheetName, null>) {
		sheetError = null;
		sheet = name;
	}

	function closeSheet() {
		if (busy) return;
		sheet = null;
	}

	type Outcome = { message: string; refresh: boolean };

	/** Esegue una mutazione: stato busy, errori mappati per codice, dati ricaricati dal server. */
	async function perform(run: () => Promise<Outcome | string | void>): Promise<boolean> {
		busy = true;
		sheetError = null;
		try {
			const result = await run();
			const { message, refresh } =
				typeof result === 'object' ? result : { message: result, refresh: true };
			// Con eventi solo in coda (offline) il server non ha nulla di nuovo: ricaricare fallirebbe.
			if (refresh) await invalidateAll();
			sheet = null;
			if (message) say(message);
			return true;
		} catch (error) {
			sheetError = describeReadingError(error);
			return false;
		} finally {
			busy = false;
		}
	}

	// ---- Sposta ----
	const canMarkRead = $derived(reading !== null || book.completedReadingsCount === 0);
	const canQueue = $derived(book.lifecycleState !== 'reading' && book.lifecycleState !== 'paused');

	function markRead() {
		if (reading) {
			void perform(async () => {
				const outcome = await runPlanSteps(['finish'], book, reading);
				return outcome.queued
					? {
							message: 'Lettura chiusa: in coda, sincronizza quando torni online.',
							refresh: false
						}
					: 'Segnato come letto.';
			});
		} else {
			openSheet('markRead');
		}
	}

	async function saveMarkRead(dates: { start: string; end: string }) {
		await perform(async () => {
			await runPlanSteps(['addCompleted'], book, null, {
				startDate: dates.start,
				endDate: dates.end
			});
			return 'Segnato come letto.';
		});
	}

	async function changeGenre(next: GenreSlug) {
		const hadReview = detail.review !== null;
		await perform(async () => {
			const result = await changeBookGenre(book.id, next);
			scoresReset = result.reviewScoresReset && hadReview;
			return result.reviewScoresReset && hadReview
				? 'Genere cambiato: le valutazioni specifiche sono state azzerate.'
				: 'Genere cambiato.';
		});
	}

	async function toggleQueue() {
		const queued = detail.queuePosition !== null;
		sheet = null;
		try {
			if (queued) {
				await removeFromQueue(book.id);
				say('Tolto dai prossimi.');
			} else {
				const result = await addToQueue(book.id, { genre: slug });
				if (result.status === 'added') say('Aggiunto ai prossimi.');
			}
		} catch {
			say('Non sono riuscito ad aggiornare i prossimi. Riprova.');
		}
	}

	// ---- Stato di lettura ----
	async function saveStatus(choice: StatusChoice, inputs: StatusActionInputs) {
		const plan = planStatusChange(planContext, choice);
		if (plan.kind !== 'run') return;
		await perform(async () => {
			const outcome = await runPlanSteps(plan.steps, book, reading, inputs);
			return outcome.queued
				? { message: 'In coda: sincronizza quando torni online.', refresh: false }
				: 'Stato aggiornato.';
		});
	}

	// ---- Avanzamento ----
	async function savePage(page: number, operation: 'progress' | 'correction') {
		if (!reading) return;
		await perform(async () => {
			const outcome = await submitPageUpdate(reading.id, page, operation);
			if (outcome.status === 'queued') {
				pendingPage = page;
				return { message: 'In coda: sincronizza quando torni online.', refresh: false };
			}
			pendingPage = null;
			return operation === 'correction' ? 'Pagina corretta.' : `Pagina aggiornata a ${page}.`;
		});
	}

	async function finishReading() {
		if (!reading) return;
		await perform(async () => {
			const outcome = await submitFinish(
				reading.id,
				finalPageFor(reading.currentPage, book.pageCount)
			);
			return outcome.status === 'queued'
				? { message: 'Lettura chiusa: in coda, sincronizza quando torni online.', refresh: false }
				: 'Libro finito. Ora puoi recensirlo.';
		});
	}

	async function dnf(page: number) {
		if (!reading) return;
		await perform(async () => {
			const outcome = await submitDnf(reading.id, page);
			return outcome.status === 'queued'
				? { message: 'In coda: sincronizza quando torni online.', refresh: false }
				: `Segnato come non finito a p. ${page}.`;
		});
	}

	async function pause() {
		if (!reading) return;
		await perform(async () => {
			await pauseReading(reading.id);
			return 'Lettura in pausa.';
		});
	}

	async function resume() {
		if (!reading) return;
		await perform(async () => {
			await resumeReading(reading.id);
			return 'Bentornato alla lettura.';
		});
	}

	// ---- Rilettura ----
	async function saveReread(choice: AddReadingChoice, dates: { start: string; end: string }) {
		await perform(async () => {
			if (choice === 'now') {
				await startReading({ bookId: book.id });
				return 'Rilettura iniziata.';
			}
			await addCompletedReading({
				bookId: book.id,
				startedAt: localDateToIso(dates.start),
				finishedAt: localDateToIso(dates.end),
				finalPage: book.pageCount ?? 0
			});
			return 'Rilettura aggiunta.';
		});
	}

	// Una volta sincronizzata, la pagina in coda coincide con quella del server.
	$effect(() => {
		if (pendingPage !== null && reading && reading.currentPage >= pendingPage) pendingPage = null;
	});

	onMount(() => {
		offline = navigator.onLine === false;
		// Il link "aggiorna pagina" della Home (#progress) apre direttamente lo sheet.
		if (location.hash === '#progress' && reading?.status === 'active') {
			document.getElementById('progress')?.scrollIntoView({ block: 'center' });
			openSheet('progress');
		}
		return () => clearTimeout(noticeTimer);
	});

	/** Indietro: torna alla pagina da cui si arriva (Home, genere...), altrimenti allo scaffale del genere. */
	function back() {
		if (history.length > 1 && document.referrer.startsWith(location.origin)) history.back();
		else void goto(`/genre/${slug}`);
	}
</script>

<svelte:head><title>{book.title} · Segnalibro</title></svelte:head>
<svelte:window ononline={() => (offline = false)} onoffline={() => (offline = true)} />

<div class="page" style={genreScopeStyle(slug)}>
	<header class="top">
		<IconButton icon="chevron-left" label="Indietro" onclick={back} />
		<h2>Dettaglio</h2>
		<ActionsMenu
			{book}
			queued={detail.queuePosition !== null}
			{canQueue}
			onmove={() => openSheet('move')}
			onqueue={toggleQueue}
			oncover={() => (coverOpen = true)}
		/>
	</header>

	{#if notice}
		<p class="notice" role="status" data-testid="notice">
			<Icon name="check" size={16} strokeWidth={2.6} />
			{notice}
		</p>
	{/if}

	<div class="layout" class:compact={unlocked}>
		<div class="hero-area">
			<BookHero
				{book}
				compact={unlocked}
				{status}
				queuePosition={detail.queuePosition}
				onstatus={() => openSheet('status')}
				statusOpen={sheet === 'status'}
			/>
		</div>

		{#if reading}
			<div class="progress-area">
				<ProgressPanel
					currentPage={reading.currentPage}
					pageCount={book.pageCount}
					paused={reading.status === 'paused'}
					{pendingPage}
					{busy}
					onupdate={() => openSheet('progress')}
					onfinish={finishReading}
					onpause={pause}
					onresume={resume}
				/>
			</div>
		{/if}

		<div class="review-area">
			<ReviewPanel {detail} {scoresReset} onsaved={() => void invalidateAll()}>
				{#snippet lockedFooter()}
					<button
						class="move"
						type="button"
						aria-haspopup="dialog"
						aria-expanded={sheet === 'move'}
						onclick={() => openSheet('move')}
						data-testid="move-button"
					>
						<span class="tile"><Icon name="library" size={24} strokeWidth={1.8} /></span>
						Sposta
						<Icon
							name={sheet === 'move' ? 'chevron-up' : 'chevron-down'}
							size={18}
							strokeWidth={2.4}
						/>
					</button>
				{/snippet}
				{#snippet afterScores()}
					<ReadingHistory
						readings={detail.readings}
						pageCount={book.pageCount}
						canAdd={book.completedReadingsCount >= 1}
						onadd={() => openSheet('addReading')}
					/>
				{/snippet}
			</ReviewPanel>

			{#if !unlocked && detail.readings.length > 0}
				<div class="history-locked">
					<ReadingHistory
						readings={detail.readings}
						pageCount={book.pageCount}
						canAdd={false}
						onadd={() => openSheet('addReading')}
					/>
				</div>
			{/if}
		</div>

		{#if book.series}
			<div class="series-area">
				<SeriesCard series={book.series} />
			</div>
		{/if}
	</div>
</div>

<CoverPicker
	bookId={book.id}
	cover={book.cover}
	bind:open={coverOpen}
	showTrigger={false}
	onchanged={() => say('Copertina aggiornata.')}
/>

<MoveSheet
	open={sheet === 'move'}
	title={book.title}
	currentGenre={slug}
	{canMarkRead}
	{canQueue}
	queued={detail.queuePosition !== null}
	queueCount={data.queueCount}
	{busy}
	onclose={closeSheet}
	onmarkread={markRead}
	onchangegenre={changeGenre}
	onqueue={toggleQueue}
/>

<MarkReadSheet
	open={sheet === 'markRead'}
	title={book.title}
	{busy}
	error={sheetError}
	onclose={closeSheet}
	onsave={saveMarkRead}
/>

<ReadingStatusSheet
	open={sheet === 'status'}
	context={planContext}
	currentPage={reading?.currentPage ?? 0}
	pageCount={book.pageCount}
	{busy}
	error={sheetError}
	onclose={closeSheet}
	onsave={saveStatus}
/>

{#if reading}
	<ProgressSheet
		open={sheet === 'progress'}
		title={book.title}
		currentPage={reading.currentPage}
		pageCount={book.pageCount}
		{busy}
		{offline}
		error={sheetError}
		onclose={closeSheet}
		onsubmit={savePage}
		onfinish={finishReading}
		ondnf={dnf}
	/>
{/if}

<AddReadingSheet
	open={sheet === 'addReading'}
	title={book.title}
	hasOpenReading={reading !== null}
	{busy}
	error={sheetError}
	onclose={closeSheet}
	onsave={saveReread}
/>

<style>
	.page {
		padding-bottom: 32px;
	}

	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		box-sizing: border-box;
		height: 72px;
		padding: 14px 16px 0;
	}

	.top h2 {
		margin: 0;
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 700;
	}

	.notice {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 8px var(--page-gutter) 0;
		padding: 10px 14px;
		border-radius: 14px;
		background: var(--color-surface);
		color: var(--color-text-primary);
		font-size: 13.5px;
		font-weight: 600;
	}

	.layout {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 0 var(--page-gutter);
	}

	/* Il layout compatto (mockup 05) ha il proprio respiro laterale già nella hero */
	.layout.compact .hero-area {
		margin: 0 calc(-1 * var(--page-gutter));
	}

	.layout :global(.hero) {
		padding-bottom: 4px;
	}

	.hero-area {
		order: 1;
	}

	.progress-area {
		order: 2;
	}

	.review-area {
		order: 3;
		display: flex;
		flex-direction: column;
		gap: 14px;
		min-width: 0;
	}

	.series-area {
		order: 4;
	}

	/* nel layout compatto la serie è già sotto il titolo (mockup 05) */
	.layout.compact .series-area {
		display: none;
	}

	.move {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		box-sizing: border-box;
		width: 100%;
		height: 58px;
		border: 0;
		border-radius: 18px;
		background: var(--color-primary);
		color: var(--color-on-primary);
		font-family: var(--font-ui);
		font-size: 17px;
		font-weight: 700;
		box-shadow: var(--shadow-button);
		cursor: pointer;
	}

	.tile {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 38px;
		height: 38px;
		border-radius: 12px;
		background: color-mix(in srgb, var(--color-on-primary) 16%, transparent);
	}

	@media (min-width: 1024px) {
		.top {
			height: 88px;
			padding: 28px var(--page-gutter) 0;
		}

		.layout {
			display: grid;
			grid-template-columns: minmax(340px, 400px) minmax(0, 1fr);
			grid-template-areas:
				'hero review'
				'progress review'
				'series review'
				'. review';
			grid-template-rows: auto auto auto 1fr;
			column-gap: 40px;
			align-items: start;
		}

		.layout.compact .hero-area {
			margin: 0;
		}

		.hero-area {
			grid-area: hero;
		}

		.progress-area {
			grid-area: progress;
		}

		.review-area {
			grid-area: review;
		}

		.series-area,
		.layout.compact .series-area {
			display: block;
			grid-area: series;
		}
	}
</style>
