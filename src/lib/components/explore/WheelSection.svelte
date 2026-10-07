<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { BookSummary } from '$lib/contracts/books';
	import type { GenreSlug } from '$lib/contracts/enums';
	import BookCover from '$lib/components/book/BookCover.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { GENRE_LABELS } from '$lib/genres';
	import { requestQueueAdd } from '$lib/explore/queue-client';
	import {
		MAX_WHEEL_SLICES,
		hashString,
		planSpin,
		sampleSlices,
		seededRandomInt
	} from '$lib/explore/wheel';
	import {
		WHEEL_FORMAT_OPTIONS,
		matchesWheelFormat,
		wheelFormatCounts,
		type WheelFormatFilter
	} from '$lib/explore/wheel-filter';
	import FortuneWheel from './FortuneWheel.svelte';
	import GenreFilterChips from './GenreFilterChips.svelte';

	interface Props {
		/** Tutti i libri non letti dell'utente. */
		pool: readonly BookSummary[];
	}

	let { pool }: Props = $props();

	const SPIN_MS = 4600;

	let selected = $state<GenreSlug[]>([]);
	let formatFilter = $state<WheelFormatFilter>('all');
	let rotation = $state(0);
	let duration = $state(0);
	let spinning = $state(false);
	let result = $state.raw<BookSummary | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;

	const byFormat = $derived(pool.filter((book) => matchesWheelFormat(book, formatFilter)));
	const formatCounts = $derived(wheelFormatCounts(pool));

	const filtered = $derived(
		selected.length === 0
			? byFormat
			: byFormat.filter((book) => selected.includes(book.genre.slug))
	);

	const counts = $derived.by(() => {
		const map: Partial<Record<GenreSlug, number>> = {};
		for (const book of byFormat) map[book.genre.slug] = (map[book.genre.slug] ?? 0) + 1;
		return map;
	});

	// Anteprima deterministica (uguale su server e client); i giri usano crypto.getRandomValues.
	// svelte-ignore state_referenced_locally
	let slices = $state.raw<BookSummary[]>(previewSlices(filtered, selected));

	function previewSlices(books: readonly BookSummary[], filter: readonly GenreSlug[]) {
		const seed = hashString(`${filter.join(',')}|${books.length}|${books[0]?.id ?? ''}`);
		return sampleSlices(books, seededRandomInt(seed), MAX_WHEEL_SLICES);
	}

	function resetWheel() {
		clearTimeout(timer);
		spinning = false;
		duration = 0;
		result = null;
		queue = { status: 'idle' };
		slices = previewSlices(filtered, selected);
	}

	function toggleGenre(slug: GenreSlug) {
		selected = selected.includes(slug) ? selected.filter((s) => s !== slug) : [...selected, slug];
		resetWheel();
	}

	function clearGenres() {
		selected = [];
		resetWheel();
	}

	function chooseFormat(value: WheelFormatFilter) {
		if (value === formatFilter) return;
		formatFilter = value;
		resetWheel();
	}

	function prefersReducedMotion() {
		return (
			window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
			document.documentElement.dataset.motion === 'reduce'
		);
	}

	function spin() {
		if (spinning || filtered.length === 0) return;
		clearTimeout(timer);
		const reduced = prefersReducedMotion();
		// Il vincitore è estratto subito (crypto) e l'angolo finale ne deriva.
		const plan = planSpin({
			pool: filtered,
			slices,
			currentRotation: rotation,
			turns: reduced ? 0 : 5
		});
		queue = { status: 'idle' };
		slices = plan.slices;

		if (reduced) {
			duration = 0;
			rotation = plan.rotation;
			result = plan.winner;
			return;
		}

		spinning = true;
		duration = SPIN_MS;
		rotation = plan.rotation;
		timer = setTimeout(() => {
			spinning = false;
			result = plan.winner;
		}, SPIN_MS + 60);
	}

	onDestroy(() => clearTimeout(timer));

	// --- Metti nei prossimi -------------------------------------------------

	type QueueState =
		| { status: 'idle' }
		| { status: 'busy' }
		| { status: 'added'; position: number | null }
		| { status: 'already' }
		| { status: 'error'; message: string };

	let queue = $state<QueueState>({ status: 'idle' });
	let confirm = $state<{ book: BookSummary; currentCount: number } | null>(null);

	async function addToQueue(book: BookSummary, force = false) {
		queue = { status: 'busy' };
		try {
			const response = await requestQueueAdd(book.id, force);
			if (response.status === 'requiresConfirmation') {
				confirm = { book, currentCount: response.currentCount };
				queue = { status: 'idle' };
			} else if (response.status === 'alreadyQueued') {
				queue = { status: 'already' };
			} else {
				queue = { status: 'added', position: response.position };
			}
		} catch (error) {
			queue = {
				status: 'error',
				message: error instanceof Error ? error.message : 'Impossibile aggiungere il libro.'
			};
		}
	}

	async function confirmAdd() {
		const pending = confirm;
		confirm = null;
		if (pending) await addToQueue(pending.book, true);
	}

	const wheelDescription = $derived(
		slices.length < filtered.length
			? `${slices.length} libri da leggere, scelti tra ${filtered.length}`
			: `${slices.length} ${slices.length === 1 ? 'libro da leggere' : 'libri da leggere'}`
	);

	const statusText = $derived.by(() => {
		switch (queue.status) {
			case 'added':
				return `Aggiunto ai prossimi${queue.position ? ` (posizione ${queue.position})` : ''}.`;
			case 'already':
				return 'Questo libro è già nei prossimi.';
			case 'error':
				return queue.message;
			default:
				return '';
		}
	});

	const selectedLabel = $derived(selected.map((slug) => GENRE_LABELS[slug]).join(', '));
</script>

<section class="wheel-section" aria-labelledby="wheel-title">
	<h2 id="wheel-title">Ruota della Fortuna</h2>
	<p class="lead">
		Non sai cosa leggere? Lascia scegliere alla sorte tra i libri che non hai ancora letto.
	</p>

	{#if pool.length > 0}
		<div class="formats" role="group" aria-label="Formato dei libri">
			{#each WHEEL_FORMAT_OPTIONS as option (option.value)}
				<button
					type="button"
					class="format-chip"
					aria-pressed={formatFilter === option.value}
					onclick={() => chooseFormat(option.value)}
				>
					{option.label}
					<span class="format-count">{formatCounts[option.value]}</span>
				</button>
			{/each}
		</div>
		<GenreFilterChips {selected} {counts} ontoggle={toggleGenre} onclear={clearGenres} />
	{/if}

	<div class="card">
		{#if pool.length === 0}
			<div class="empty">
				<Icon name="book-open" size={32} strokeWidth={1.6} />
				<h3>Nessun libro da estrarre</h3>
				<p>Non hai libri non letti: aggiungine uno alla libreria e la ruota sarà pronta.</p>
				<Button href="/add" size="sm">Aggiungi un libro</Button>
			</div>
		{:else if filtered.length === 0}
			<div class="empty">
				<Icon name="tag" size={32} strokeWidth={1.6} />
				<h3>Nessun libro con questi filtri</h3>
				<p>
					Non ci sono libri non letti{selected.length > 0 ? ` in ${selectedLabel}` : ''}{formatFilter ===
					'physical'
						? ' in formato cartaceo'
						: formatFilter === 'digital'
							? ' in formato digitale'
							: ''}. Prova con un altro filtro.
				</p>
				<Button
					variant="secondary"
					size="sm"
					onclick={() => {
						formatFilter = 'all';
						clearGenres();
					}}>Mostra tutti i non letti</Button
				>
			</div>
		{:else}
			<FortuneWheel
				{slices}
				{rotation}
				{duration}
				{spinning}
				description={wheelDescription}
				onspin={spin}
			/>

			{#if slices.length < filtered.length}
				<p class="sample-note">
					Sulla ruota ci sono {slices.length} libri su {filtered.length}; l'estrazione avviene tra
					tutti i non letti.
				</p>
			{/if}

			{#if result}
				<a class="result" class:stale={spinning} href="/book/{result.id}" aria-busy={spinning}>
					<BookCover book={result} size="sm" showFormat />
					<div class="result-text">
						<span class="eyebrow">La sorte ha scelto</span>
						<span class="result-title">{result.title}</span>
						<span class="result-author">{result.author}</span>
						<span class="genre-chip" style:--g="var(--genre-{result.genre.slug})">
							{result.genre.name}
						</span>
					</div>
				</a>

				<div class="actions">
					<Button variant="secondary" class="again" disabled={spinning} onclick={spin}>
						{#snippet icon()}<Icon name="shuffle" size={20} />{/snippet}
						Gira ancora
					</Button>
					<Button
						class="queue"
						disabled={spinning ||
							queue.status === 'busy' ||
							queue.status === 'added' ||
							queue.status === 'already'}
						loading={queue.status === 'busy'}
						onclick={() => result && addToQueue(result)}
					>
						{#snippet icon()}<Icon name="bookmark" size={20} />{/snippet}
						{queue.status === 'added' || queue.status === 'already'
							? 'Nei prossimi'
							: 'Metti nei prossimi'}
					</Button>
				</div>
			{/if}

			<p class="sr-only" role="status">
				{#if result && !spinning}La sorte ha scelto: {result.title}, di {result.author}.{/if}
			</p>
			<p
				class="status"
				class:filled={statusText !== ''}
				class:error={queue.status === 'error'}
				role="status"
			>
				{statusText}
			</p>
		{/if}
	</div>
</section>

<ConfirmDialog
	open={confirm !== null}
	title="Hai già {confirm?.currentCount ??
		3} libri nelle prossime letture. Vuoi aggiungerlo comunque?"
	confirmLabel="Aggiungi comunque"
	onconfirm={confirmAdd}
	oncancel={() => (confirm = null)}
/>

<style>
	.wheel-section {
		padding: 10px var(--page-gutter) 0;
	}

	h2 {
		font-size: 24px;
		line-height: 1.2;
	}

	.lead {
		margin: 4px 0 0;
		font-size: 14px;
		line-height: 20px;
		color: var(--color-text-secondary);
	}

	.formats {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 14px;
	}

	.format-chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: var(--tap-size);
		padding: 0 16px;
		border: 0;
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-text-primary);
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
	}

	.format-chip[aria-pressed='true'] {
		background: var(--color-primary);
		color: var(--color-on-primary);
	}

	.format-chip:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.format-count {
		opacity: 0.75;
		font-size: 12.5px;
	}

	.card {
		margin-top: 16px;
		padding: 18px 16px 16px;
		border-radius: 28px;
		background: var(--color-surface);
	}

	.sample-note {
		margin: 10px 4px 0;
		font-size: 12.5px;
		line-height: 17px;
		text-align: center;
		color: var(--color-text-secondary);
	}

	.result {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-top: 18px;
		padding: 14px;
		border-radius: 20px;
		background: var(--color-background);
		color: inherit;
		text-decoration: none;
		transition: opacity var(--duration-base) var(--ease-out);
		animation: result-in var(--duration-base) var(--ease-out);
	}

	.result.stale {
		opacity: 0.45;
	}

	.result-text {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		min-width: 0;
	}

	.eyebrow {
		font-size: 11.5px;
		font-weight: 700;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--color-shelf-axis);
	}

	.result-title {
		margin-top: 2px;
		font-family: var(--font-display);
		font-size: 21px;
		line-height: 1.15;
		overflow-wrap: anywhere;
	}

	.result-author {
		font-size: 13.5px;
		font-weight: 600;
		color: var(--color-text-link);
	}

	.genre-chip {
		display: inline-flex;
		align-items: center;
		height: 26px;
		margin-top: 8px;
		padding: 0 12px;
		border-radius: 13px;
		background: var(--g);
		color: var(--color-on-genre-white);
		font-size: 12px;
		font-weight: 600;
	}

	.actions {
		display: flex;
		gap: 10px;
		margin-top: 12px;
	}

	.actions :global(.again) {
		flex: 1;
		min-height: 50px;
		padding: 0 12px;
		font-size: 15px;
	}

	.actions :global(.queue) {
		flex: 1.2;
		min-height: 50px;
		padding: 0 12px;
		font-size: 15px;
	}

	.status {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		text-align: center;
		color: var(--color-text-secondary);
	}

	.status.filled {
		margin-top: 10px;
	}

	.status.error {
		color: var(--color-danger);
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 24px 8px;
		text-align: center;
		color: var(--color-primary);
	}

	.empty h3 {
		font-size: 20px;
		color: var(--color-text-primary);
	}

	.empty p {
		max-width: 30ch;
		margin: 0 0 8px;
		font-size: 14px;
		line-height: 20px;
		color: var(--color-text-secondary);
	}

	@keyframes result-in {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}
</style>
