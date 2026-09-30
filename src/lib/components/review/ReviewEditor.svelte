<script lang="ts">
	import { onDestroy, onMount, untrack, type Snippet } from 'svelte';
	import type { Quote } from '$lib/contracts/reviews';
	import type { BookDetailResponse } from '$lib/contracts/rpc';
	import { GENRE_SHORT_LABELS, genreScopeStyle } from '$lib/genres';
	import {
		canSave,
		draftFromReview,
		draftsEqual,
		missingFields,
		missingMessage,
		scoresForGenre,
		toSaveRequest,
		toggleTag,
		type ReviewDraft
	} from '$lib/review';
	import { clearLocalDraft, readLocalDraft, writeLocalDraft } from '$lib/review/local-draft';
	import AdjectiveInput from './AdjectiveInput.svelte';
	import GenreDimensionRatings from './GenreDimensionRatings.svelte';
	import OverallRating from './OverallRating.svelte';
	import QuotesEditor from './QuotesEditor.svelte';
	import ReviewScoresResetNotice from './ReviewScoresResetNotice.svelte';
	import SaveStatus, { type SaveState } from './SaveStatus.svelte';
	import ThemeTagPicker from './ThemeTagPicker.svelte';
	import { ReviewApiError, saveReviewRequest } from './api';

	interface Props {
		detail: BookDetailResponse;
		afterScores?: Snippet | undefined;
		onsaved?: (() => void) | undefined;
		scoresReset?: boolean;
	}

	let { detail, afterScores, onsaved, scoresReset = false }: Props = $props();

	const DEBOUNCE_MS = 700;

	const bookId = $derived(detail.book.id);
	const genre = $derived(detail.book.genre.slug);

	/* Stato editabile. `baseline` è l'ultima versione nota al server. */
	// svelte-ignore state_referenced_locally
	let baseline = $state<ReviewDraft>(draftFromReview(detail.review, detail.book.genre.slug));
	// svelte-ignore state_referenced_locally
	let draft = $state<ReviewDraft>(structuredClone($state.snapshot(baseline)));
	// svelte-ignore state_referenced_locally
	let quotes = $state<Quote[]>([...detail.quotes]);

	let status = $state<SaveState>({ kind: 'idle' });
	let resetNotice = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let hideTimer: ReturnType<typeof setTimeout> | undefined;
	let inFlight = false;
	let resaveAfter = false;
	let mounted = false;

	// svelte-ignore state_referenced_locally
	let trackedGenre = detail.book.genre.slug;
	// svelte-ignore state_referenced_locally
	let trackedStamp = detail.review?.updatedAt ?? null;

	const dirty = $derived(!draftsEqual(draft, baseline));
	const missing = $derived(missingFields(draft));

	function clone(value: ReviewDraft): ReviewDraft {
		return structuredClone($state.snapshot(value));
	}

	/* --- sincronizzazione con `detail` (ricaricato dal genitore) ----------------------- */
	$effect(() => {
		const nextGenre = detail.book.genre.slug;
		const stamp = detail.review?.updatedAt ?? null;
		const serverDraft = draftFromReview(detail.review, nextGenre);
		const serverQuotes = [...detail.quotes];

		untrack(() => {
			if (nextGenre !== trackedGenre) {
				const hadScores = Object.keys(draft.scores).length > 0;
				trackedGenre = nextGenre;
				trackedStamp = stamp;
				draft = { ...clone(draft), scores: scoresForGenre(draft.scores, nextGenre) };
				baseline = serverDraft;
				if (hadScores) resetNotice = true;
				quotes = serverQuotes;
				return;
			}
			if (stamp !== trackedStamp) {
				trackedStamp = stamp;
				if (!dirty && !inFlight) {
					baseline = serverDraft;
					draft = clone(serverDraft);
				}
			}
			quotes = serverQuotes;
		});
	});

	$effect(() => {
		if (scoresReset) resetNotice = true;
	});

	/* --- modifica e salvataggio -------------------------------------------------------- */
	function update(patch: Partial<ReviewDraft>) {
		draft = { ...clone(draft), ...patch };
		afterChange();
	}

	function afterChange() {
		clearTimeout(hideTimer);
		if (draftsEqual(draft, baseline)) {
			clearTimeout(timer);
			clearLocalDraft(bookId);
			status = { kind: 'idle' };
			return;
		}
		writeLocalDraft(bookId, genre, draft);
		if (canSave(draft)) {
			status = { kind: 'pending' };
			schedule();
		} else {
			clearTimeout(timer);
			status = { kind: 'local', message: missingMessage(missing) };
		}
	}

	function schedule() {
		clearTimeout(timer);
		timer = setTimeout(() => void save(), DEBOUNCE_MS);
	}

	async function save(options: { keepalive?: boolean } = {}) {
		clearTimeout(timer);
		if (inFlight) {
			resaveAfter = true;
			return;
		}
		const snapshot = clone(draft);
		const request = toSaveRequest(bookId, genre, snapshot);
		if (!request || draftsEqual(snapshot, baseline)) return;

		inFlight = true;
		status = { kind: 'saving' };
		try {
			const saved = await saveReviewRequest(request, options);
			const savedDraft = draftFromReview(saved, genre);
			baseline = savedDraft;
			trackedStamp = saved.updatedAt;
			if (draftsEqual(draft, snapshot)) {
				draft = clone(savedDraft);
				clearLocalDraft(bookId);
				status = { kind: 'saved' };
				hideTimer = setTimeout(() => {
					if (status.kind === 'saved') status = { kind: 'idle' };
				}, 2200);
			}
			onsaved?.();
		} catch (error) {
			const offline = error instanceof ReviewApiError && error.offline;
			const message = error instanceof ReviewApiError ? error.message : 'Salvataggio non riuscito.';
			status = offline
				? { kind: 'offline', message: 'Sei offline: la bozza è al sicuro su questo dispositivo.' }
				: { kind: 'error', message };
		} finally {
			inFlight = false;
			if (resaveAfter) {
				resaveAfter = false;
				if (dirty && canSave(draft)) schedule();
			}
		}
	}

	function retry() {
		void save();
	}

	/* --- bozza locale, ritorno online, chiusura pagina -------------------------------- */
	onMount(() => {
		mounted = true;
		const stored = readLocalDraft(bookId);
		if (stored && stored.genre === genre && !draftsEqual(stored.draft, baseline)) {
			draft = { ...clone(stored.draft), scores: scoresForGenre(stored.draft.scores, genre) };
			if (canSave(draft)) {
				status = { kind: 'pending', restored: true };
				schedule();
			} else {
				status = { kind: 'local', message: missingMessage(missing), restored: true };
			}
		} else if (stored) {
			clearLocalDraft(bookId);
		}

		const onOnline = () => {
			if (dirty && canSave(draft)) void save();
		};
		const onHide = () => {
			if (document.visibilityState === 'hidden' && dirty && canSave(draft)) {
				void save({ keepalive: true });
			}
		};
		window.addEventListener('online', onOnline);
		document.addEventListener('visibilitychange', onHide);
		return () => {
			window.removeEventListener('online', onOnline);
			document.removeEventListener('visibilitychange', onHide);
		};
	});

	onDestroy(() => {
		clearTimeout(timer);
		clearTimeout(hideTimer);
		// Modifica ancora in attesa del debounce: invia ora (la navigazione non deve perderla).
		if (mounted && dirty && canSave(draft)) void save({ keepalive: true });
	});

	function setScore(key: string, score: number | null) {
		const scores = { ...draft.scores };
		if (score === null) delete scores[key];
		else scores[key] = score;
		update({ scores });
	}
</script>

<div class="review" style={genreScopeStyle(genre)} data-testid="review-panel">
	{#if resetNotice}
		<ReviewScoresResetNotice
			genreLabel={GENRE_SHORT_LABELS[genre]}
			ondismiss={() => (resetNotice = false)}
		/>
	{/if}

	<AdjectiveInput adjectives={draft.adjectives} onchange={(adjectives) => update({ adjectives })} />
	<OverallRating rating={draft.rating} onchange={(rating) => update({ rating })} />
	<GenreDimensionRatings {genre} scores={draft.scores} onchange={setScore} />

	{#if afterScores}{@render afterScores()}{/if}

	<ThemeTagPicker
		selected={draft.tags}
		ontoggle={(slug) => update({ tags: toggleTag(draft.tags, slug) })}
	/>
	<QuotesEditor {bookId} {quotes} onchange={(next) => (quotes = next)} />

	<SaveStatus {status} onretry={retry} />
</div>

<style>
	.review {
		display: flex;
		flex-direction: column;
		gap: 14px;
		min-width: 0;
		/* su desktop resta una colonna leggibile; il genitore può allargarla con un wrapper */
		max-width: 720px;
	}
</style>
