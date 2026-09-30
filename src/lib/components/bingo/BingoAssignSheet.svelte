<script lang="ts">
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { BingoBoard, BingoCell, BookSummary } from '$lib/contracts';
	import { bingoBoardSchema, completedBooksResponseSchema } from '$lib/contracts';
	import { GENRE_SHORT_LABELS } from '$lib/genres';
	import { bingoIcon } from './icons';

	interface Props {
		open: boolean;
		cell: BingoCell | null;
		board: BingoBoard;
		onclose: () => void;
		/** Chiamata con la card aggiornata dopo un'assegnazione o una rimozione. */
		onchange: (board: BingoBoard) => void;
	}

	let { open, cell, board, onclose, onchange }: Props = $props();

	let query = $state('');
	let books = $state<BookSummary[]>([]);
	let loading = $state(false);
	let saving = $state(false);
	let error = $state<string | null>(null);

	// Libri già usati in altre caselle della stessa card (è permesso, ma lo segnaliamo).
	const usedIn = $derived.by(() => {
		const map: Record<string, string> = {};
		for (const other of board.cells) {
			if (other.book && other.id !== cell?.id) map[other.book.id] = other.challenge;
		}
		return map;
	});

	let searchToken = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function load(term: string) {
		const run = ++searchToken;
		loading = true;
		error = null;
		try {
			const search = term.trim() ? `&q=${encodeURIComponent(term.trim())}` : '';
			const response = await fetch(`/api/stats/completed-books?limit=50${search}`);
			if (!response.ok) throw new Error(String(response.status));
			const parsed = completedBooksResponseSchema.parse(await response.json());
			if (run === searchToken) books = parsed.books;
		} catch {
			if (run === searchToken) error = 'Non riesco a caricare i libri letti. Riprova.';
		} finally {
			if (run === searchToken) loading = false;
		}
	}

	// Ogni apertura riparte da zero e carica i libri letti.
	$effect(() => {
		if (!open) return;
		query = '';
		books = [];
		void load('');
	});

	function onInput() {
		clearTimeout(timer);
		timer = setTimeout(() => void load(query), 250);
	}

	async function assign(bookId: string | null) {
		if (!cell || saving) return;
		saving = true;
		error = null;
		try {
			const response = await fetch('/api/bingo/assign', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ cellId: cell.id, bookId })
			});
			if (!response.ok) {
				const body = (await response.json().catch(() => null)) as { message?: string } | null;
				throw new Error(body?.message ?? 'Operazione non riuscita.');
			}
			onchange(bingoBoardSchema.parse(await response.json()));
			onclose();
		} catch (failure) {
			error = failure instanceof Error ? failure.message : 'Operazione non riuscita.';
		} finally {
			saving = false;
		}
	}
</script>

<BottomSheet
	{open}
	title={cell?.challenge ?? 'Casella'}
	subtitle="Collega un libro letto a questa casella."
	{onclose}
>
	{#if cell}
		<div class="sheet" data-testid="bingo-assign-sheet">
			{#if cell.book}
				<div class="current">
					<span class="ico"
						><Icon name={bingoIcon(cell.position)} size={24} strokeWidth={1.7} /></span
					>
					<span class="txt">
						<span class="label">Collegato a</span>
						<span class="name">{cell.book.title}</span>
					</span>
					<Button
						variant="secondary"
						size="sm"
						disabled={saving}
						onclick={() => assign(null)}
						data-testid="bingo-remove"
					>
						Rimuovi
					</Button>
				</div>
			{/if}

			<label class="search">
				<Icon name="search" size={18} strokeWidth={2} />
				<input
					type="search"
					placeholder="Cerca tra i libri letti"
					aria-label="Cerca tra i libri letti"
					autocomplete="off"
					bind:value={query}
					oninput={onInput}
				/>
			</label>

			{#if error}<p class="error" role="alert">{error}</p>{/if}

			<ul class="books" aria-busy={loading}>
				{#each books as book (book.id)}
					{@const other = usedIn[book.id]}
					<li>
						<button
							type="button"
							class="book"
							class:selected={cell.book?.id === book.id}
							aria-pressed={cell.book?.id === book.id}
							disabled={saving}
							onclick={() => assign(book.id)}
							style="--g: var(--genre-{book.genre.slug})"
							data-testid="bingo-book"
						>
							<span class="dot" aria-hidden="true"></span>
							<span class="info">
								<span class="t">{book.title}</span>
								<span class="a">
									{book.author} · {GENRE_SHORT_LABELS[book.genre.slug]}{#if other}
										· già in «{other}»{/if}
								</span>
							</span>
							{#if cell.book?.id === book.id}<Icon name="check" size={20} strokeWidth={2.4} />{/if}
						</button>
					</li>
				{:else}
					{#if !loading && !error}
						<li class="none">
							{query.trim()
								? 'Nessun libro letto corrisponde alla ricerca.'
								: 'Non hai ancora libri letti: segna come letto un libro per poterlo collegare.'}
						</li>
					{/if}
				{/each}
			</ul>
		</div>
	{/if}
</BottomSheet>

<style>
	.sheet {
		display: flex;
		flex-direction: column;
		gap: 12px;
		max-height: min(62dvh, 520px);
	}

	.current {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: 18px;
		background: var(--color-bingo-card);
	}

	.ico {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 42px;
		height: 42px;
		flex-shrink: 0;
		border: 2px solid var(--color-primary);
		border-radius: 50%;
		background: var(--color-accent);
		color: var(--color-primary);
	}

	.txt {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
	}

	.label {
		font-size: 12px;
		color: var(--color-text-secondary);
	}

	.name {
		overflow: hidden;
		font-style: italic;
		font-synthesis: style;
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.search {
		display: flex;
		align-items: center;
		gap: 8px;
		box-sizing: border-box;
		min-height: 46px;
		padding: 0 14px;
		border-radius: 16px;
		background: var(--color-surface);
		color: var(--color-text-secondary);
	}

	.search input {
		flex: 1;
		min-width: 0;
		border: 0;
		background: none;
		font-size: 15px;
		color: var(--color-text-primary);
	}

	.search input:focus-visible {
		outline: none;
	}

	.search:focus-within {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.books {
		display: flex;
		flex-direction: column;
		gap: 6px;
		flex: 1;
		min-height: 0;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		list-style: none;
	}

	.book {
		display: flex;
		align-items: center;
		gap: 12px;
		box-sizing: border-box;
		width: 100%;
		min-height: 56px;
		padding: 8px 12px;
		border: 1.5px solid transparent;
		border-radius: 16px;
		background: var(--color-card);
		text-align: left;
	}

	.book.selected {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-accent) 40%, transparent);
	}

	.dot {
		width: 12px;
		height: 12px;
		flex-shrink: 0;
		border-radius: 50%;
		background: var(--g);
	}

	.info {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
	}

	.t {
		font-family: var(--font-display);
		font-size: 16px;
		line-height: 1.2;
		overflow-wrap: anywhere;
	}

	.a {
		font-size: 12.5px;
		color: var(--color-text-secondary);
	}

	.none {
		padding: 12px 4px;
		font-size: 14px;
		color: var(--color-text-secondary);
	}

	.error {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--color-danger);
	}
</style>
