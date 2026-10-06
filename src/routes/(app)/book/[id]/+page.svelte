<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import AddReadingSheet, {
		type AddReadingChoice
	} from '$lib/components/detail/AddReadingSheet.svelte';
	import BookBanner from '$lib/components/detail/BookBanner.svelte';
	import LibraryPlaceCard from '$lib/components/detail/LibraryPlaceCard.svelte';
	import ReadingSummaryCard from '$lib/components/detail/ReadingSummaryCard.svelte';
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
	import Modal from '$lib/components/ui/Modal.svelte';
	import { describeBookRemovalError, removeBook } from '$lib/client/library';
	import { withBookRemovalGuard } from '$lib/offline/book-removal';
	import { clearLocalDraft } from '$lib/review/local-draft';
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
	const removalUid = $props.id();
	let removalOpen = $state(false);
	let removalBusy = $state(false);
	let removalError = $state<string | null>(null);
	let removalCompleted = $state(false);
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

	// La navigazione invalida la destinazione, mai il dettaglio appena eliminato.
	function openRemoval() {
		if (busy || removalBusy) return;
		removalError = null;
		removalCompleted = false;
		removalOpen = true;
	}

	function closeRemoval() {
		if (removalBusy || removalCompleted) return;
		removalOpen = false;
	}

	async function confirmRemoval() {
		if (busy || removalBusy) return;
		removalBusy = true;
		removalError = null;
		const bookId = book.id;
		const destination = `/genre/${slug}`;
		try {
			if (!removalCompleted) {
				if (!data.user) {
					removalError = 'Sessione scaduta: accedi di nuovo e riprova.';
					return;
				}
				await withBookRemovalGuard(
					data.user.id,
					detail.readings.map((item) => item.id),
					() => removeBook(bookId)
				);
				removalCompleted = true;
				clearLocalDraft(bookId);
			}
			await goto(destination, { invalidateAll: true, replaceState: true });
			removalOpen = false;
		} catch (error) {
			removalError = removalCompleted
				? 'Il libro è stato eliminato, ma non riesco ad aprire il genere. Riprova con “Torna al genere”.'
				: describeBookRemovalError(error);
		} finally {
			removalBusy = false;
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
		<nav class="crumbs" aria-label="Percorso">
			<a href="/library">Libreria</a>
			<Icon name="chevron-right" size={14} strokeWidth={2.2} />
			<a href="/genre/{slug}">{book.genre.name}</a>
		</nav>
		<ActionsMenu
			{book}
			queued={detail.queuePosition !== null}
			{canQueue}
			onmove={() => openSheet('move')}
			onqueue={toggleQueue}
			oncover={() => (coverOpen = true)}
			onremove={openRemoval}
		/>
	</header>

	{#if notice}
		<p class="notice" role="status" data-testid="notice">
			<Icon name="check" size={16} strokeWidth={2.6} />
			{notice}
		</p>
	{/if}

	<div class="layout">
		<div class="banner-area">
			<BookBanner
				{book}
				review={detail.review}
				{status}
				queuePosition={detail.queuePosition}
				onstatus={() => openSheet('status')}
				statusOpen={sheet === 'status'}
			>
				{#snippet actions()}
					{#if canQueue}
						<button
							type="button"
							class="round"
							class:on={detail.queuePosition !== null}
							aria-pressed={detail.queuePosition !== null}
							aria-label={detail.queuePosition !== null
								? 'Togli dai prossimi'
								: 'Aggiungi ai prossimi'}
							title={detail.queuePosition !== null ? 'Togli dai prossimi' : 'Aggiungi ai prossimi'}
							onclick={toggleQueue}
						>
							<Icon name="bookmark" size={20} />
						</button>
					{/if}
					<button
						type="button"
						class="round"
						aria-label="Apri le opzioni di spostamento"
						title="Sposta: genere, prossimi, letto"
						aria-haspopup="dialog"
						onclick={() => openSheet('move')}
					>
						<Icon name="library" size={20} />
					</button>
				{/snippet}
			</BookBanner>
		</div>

		<div class="right">
			<aside class="progress-area" aria-label="Il mio progresso">
				{#if reading}
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
				{:else}
					<ReadingSummaryCard
						{book}
						readings={detail.readings}
						onstatus={() => openSheet('status')}
					/>
				{/if}
			</aside>
			<aside class="side-area" aria-label="Il libro nella libreria">
				<div id="place"><LibraryPlaceCard {book} queuePosition={detail.queuePosition} /></div>
				{#if book.series}
					<div id="series"><SeriesCard series={book.series} /></div>
				{/if}
			</aside>
		</div>

		<nav class="sections" aria-label="Sezioni">
			<a href="#review">Recensione</a>
			{#if detail.readings.length > 0}<a href="#history">Letture</a>{/if}
			<a href="#place">Nella mia libreria</a>
			{#if book.series}<a href="#series">Serie</a>{/if}
		</nav>

		<div class="review-area" id="review">
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
					<div id="history">
						<ReadingHistory
							readings={detail.readings}
							pageCount={book.pageCount}
							canAdd={book.completedReadingsCount >= 1}
							onadd={() => openSheet('addReading')}
						/>
					</div>
				{/snippet}
			</ReviewPanel>

			{#if !unlocked && detail.readings.length > 0}
				<div class="history-locked" id="history">
					<ReadingHistory
						readings={detail.readings}
						pageCount={book.pageCount}
						canAdd={false}
						onadd={() => openSheet('addReading')}
					/>
				</div>
			{/if}
		</div>
	</div>
</div>

<Modal
	open={removalOpen}
	placement="center"
	role="alertdialog"
	labelledby="{removalUid}-removal-title"
	describedby="{removalUid}-removal-description"
	onclose={closeRemoval}
>
	<div class="removal-dialog" aria-busy={removalBusy}>
		<h2 id="{removalUid}-removal-title">Eliminare «{book.title}»?</h2>
		<p id="{removalUid}-removal-description">
			Il libro sarà rimosso dalla libreria insieme a tutta la cronologia di lettura, alle
			recensioni, ai tag e alle citazioni. Le caselle Bingo collegate potrebbero essere svuotate e
			le statistiche cambieranno. L’operazione è irreversibile.
		</p>
		{#if removalError}
			<p class="removal-error" role="alert">{removalError}</p>
		{/if}
		<div class="removal-actions">
			<button
				class="removal-confirm"
				type="button"
				disabled={removalBusy}
				onclick={confirmRemoval}
				data-testid="confirm-remove"
			>
				<Icon name="trash" size={20} />
				{removalBusy ? 'Attendi…' : removalCompleted ? 'Torna al genere' : 'Elimina dalla libreria'}
			</button>
			<button
				class="removal-cancel"
				type="button"
				disabled={removalBusy || removalCompleted}
				onclick={closeRemoval}
				data-autofocus
			>
				Annulla
			</button>
		</div>
	</div>
</Modal>

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
	.removal-dialog h2 {
		margin: 0 0 20px;
		font-size: 19px;
		line-height: 1.3;
		text-align: center;
		overflow-wrap: anywhere;
	}

	.removal-dialog p {
		margin: 0 0 20px;
		color: var(--color-text-secondary);
		font-size: 14px;
		line-height: 20px;
		text-align: center;
	}

	.removal-dialog .removal-error {
		color: var(--color-error, var(--color-danger));
	}

	.removal-actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.removal-actions button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 50px;
		padding: 10px 12px;
		border: 1.5px solid transparent;
		border-radius: 16px;
		font-family: var(--font-ui);
		font-size: 16px;
		font-weight: 700;
		cursor: pointer;
	}

	.removal-confirm {
		background: var(--color-error, var(--color-danger));
		color: var(--color-on-error, var(--color-on-danger));
	}

	.removal-actions .removal-cancel {
		background: transparent;
		color: var(--color-primary);
		border-color: color-mix(in srgb, var(--color-primary) 45%, transparent);
	}

	.removal-actions button:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.page {
		box-sizing: border-box;
		max-width: 1360px;
		margin: 0 auto;
		padding: 0 0 40px;
	}

	.top {
		display: flex;
		align-items: center;
		gap: 12px;
		box-sizing: border-box;
		min-height: 72px;
		padding: 14px 16px 6px;
	}

	.crumbs {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 6px;
		min-width: 0;
		color: var(--color-text-secondary);
		font-size: 14px;
		font-weight: 600;
	}

	.crumbs a {
		overflow: hidden;
		color: inherit;
		text-decoration: none;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.crumbs a:last-child {
		color: var(--color-primary);
	}

	.crumbs a:hover {
		text-decoration: underline;
	}

	.notice {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 8px var(--page-gutter) 12px;
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
		gap: 16px;
		padding: 0 var(--page-gutter);
	}

	/* Mobile: progresso subito dopo il banner, "Nella mia libreria" in fondo. */
	.right {
		display: contents;
	}

	.banner-area {
		order: 1;
	}

	.progress-area {
		order: 2;
	}

	.sections {
		order: 3;
	}

	.review-area {
		order: 4;
	}

	.side-area {
		order: 5;
	}

	.review-area {
		display: flex;
		flex-direction: column;
		gap: 14px;
		min-width: 0;
		scroll-margin-top: 16px;
	}

	.side-area {
		display: flex;
		flex-direction: column;
		gap: 16px;
		min-width: 0;
	}

	#place,
	#series,
	#history {
		scroll-margin-top: 16px;
	}

	.sections {
		display: flex;
		gap: 4px;
		overflow-x: auto;
		border-bottom: 1px solid color-mix(in srgb, var(--color-border) 30%, transparent);
		scrollbar-width: none;
	}

	.sections a {
		flex: none;
		padding: 12px 14px;
		border-bottom: 2.5px solid transparent;
		color: var(--color-text-secondary);
		font-size: 14.5px;
		font-weight: 600;
		text-decoration: none;
	}

	.sections a:first-child {
		border-bottom-color: var(--color-primary);
		color: var(--color-primary);
	}

	.sections a:hover {
		color: var(--color-primary);
	}

	/* Azioni rotonde accanto al pulsante di stato nel banner */
	.round {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 50px;
		height: 50px;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--color-border) 35%, transparent);
		border-radius: 50%;
		background: var(--color-surface-elevated);
		color: var(--color-primary);
		cursor: pointer;
		transition: background-color var(--duration-fast) var(--ease-out);
	}

	.round:hover {
		background: var(--color-background);
	}

	.round.on {
		border-color: transparent;
		background: var(--color-primary);
		color: var(--color-on-primary);
	}

	.round:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
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
			min-height: 80px;
			padding: 22px var(--page-gutter) 10px;
		}
	}

	/* Desktop largo (mockup dettaglio): banner, sezioni e recensione a sinistra; progresso e libreria a destra. */
	@media (min-width: 1180px) {
		.layout {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 360px;
			grid-template-areas:
				'banner right'
				'sections right'
				'review right';
			grid-template-rows: auto auto 1fr;
			gap: 20px 24px;
			align-items: start;
		}

		.right {
			grid-area: right;
			display: flex;
			flex-direction: column;
			gap: 20px;
		}

		.banner-area {
			grid-area: banner;
		}

		.sections {
			grid-area: sections;
		}

		.review-area {
			grid-area: review;
		}
	}
</style>
