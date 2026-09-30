<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import BingoBoardList from '$lib/components/bingo/BingoBoardList.svelte';
	import BingoAssignSheet from '$lib/components/bingo/BingoAssignSheet.svelte';
	import BingoGrid from '$lib/components/bingo/BingoGrid.svelte';
	import BingoSummary from '$lib/components/bingo/BingoSummary.svelte';
	import BingoTabs from '$lib/components/bingo/BingoTabs.svelte';
	import NewBoardSheet from '$lib/components/bingo/NewBoardSheet.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import type { BingoBoard, BingoCell } from '$lib/contracts';
	import { bingoBoardSchema } from '$lib/contracts';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// La card viene dal server; le assegnazioni la sostituiscono finché non cambia la pagina.
	let board = $derived<BingoBoard | null>(data.board);

	const years = $derived(data.boards.map((item) => item.year));
	const otherBoards = $derived(data.boards.filter((item) => item.year !== data.year));
	const completed = $derived(board?.completedCount ?? 0);

	// Anni proponibili per una nuova card: dall'anno prossimo a cinque anni fa, senza quelli esistenti.
	const availableYears = $derived(
		Array.from({ length: 7 }, (_, i) => data.currentYear + 1 - i).filter(
			(year) => !years.includes(year)
		)
	);

	let selected = $state<BingoCell | null>(null);
	let assignOpen = $state(false);

	function openCell(cell: BingoCell) {
		selected = cell;
		assignOpen = true;
	}

	// La casella selezionata si riallinea alla card aggiornata.
	const selectedCell = $derived(
		selected && board ? (board.cells.find((cell) => cell.id === selected?.id) ?? selected) : null
	);

	async function onChange(next: BingoBoard) {
		board = next;
		// Aggiorna i riepiloghi (elenco card) senza ricaricare la pagina.
		await invalidateAll();
		board = next;
	}

	let newOpen = $state(false);
	let creating = $state(false);
	let createError = $state<string | null>(null);

	async function createBoard(year: number) {
		creating = true;
		createError = null;
		try {
			const response = await fetch('/api/bingo/board', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ year })
			});
			if (!response.ok) {
				createError =
					response.status === 409
						? 'Esiste già una card per quest’anno.'
						: 'Non sono riuscito a creare la card. Riprova.';
				return;
			}
			bingoBoardSchema.parse(await response.json());
			newOpen = false;
			await goto(`/bingo/${year}`, { invalidateAll: true });
		} catch {
			createError = 'Non sono riuscito a creare la card. Riprova.';
		} finally {
			creating = false;
		}
	}
</script>

<svelte:head><title>Bookish Bingo · Segnalibro</title></svelte:head>

<PageHeader title="Bookish Bingo" backHref="/stats" />

<BingoTabs
	years={years.includes(data.year) ? years : [data.year, ...years].sort((a, b) => b - a)}
	current={data.year}
	onnew={() => {
		createError = null;
		newOpen = true;
	}}
/>

{#if board}
	<div class="layout" data-testid="bingo-page">
		<div class="main">
			<BingoSummary {completed} />
			<div class="grid-wrap">
				<BingoGrid year={data.year} cells={board.cells} onselect={openCell} />
			</div>
			<div class="legend">
				<span class="key"><span class="swatch todo"></span>Da fare</span>
				<span class="key"><span class="swatch done"></span>Completata</span>
				<p>Tocca una casella per spuntarla e collegarla a un libro letto.</p>
			</div>
		</div>

		{#if otherBoards.length > 0}
			<aside class="side"><BingoBoardList boards={otherBoards} /></aside>
		{/if}
	</div>
{:else}
	<div class="layout" data-testid="bingo-empty">
		<div class="main">
			<section class="empty">
				<h2>Nessuna card per il {data.year}</h2>
				<p>
					Ogni anno ha la sua card con 16 sfide di lettura. Creala e collega un libro letto a ogni
					casella.
				</p>
				<Button
					onclick={() => createBoard(data.year)}
					loading={creating}
					data-testid="bingo-create-year"
				>
					Crea la card del {data.year}
				</Button>
				{#if createError}<p class="error" role="alert">{createError}</p>{/if}
			</section>
		</div>
		{#if otherBoards.length > 0}
			<aside class="side"><BingoBoardList boards={otherBoards} /></aside>
		{/if}
	</div>
{/if}

{#if board}
	<BingoAssignSheet
		open={assignOpen}
		cell={selectedCell}
		{board}
		onclose={() => (assignOpen = false)}
		onchange={onChange}
	/>
{/if}

<NewBoardSheet
	open={newOpen}
	{availableYears}
	busy={creating}
	error={createError}
	onclose={() => (newOpen = false)}
	oncreate={createBoard}
/>

<style>
	.layout {
		display: flex;
		flex-direction: column;
		gap: 30px;
		padding: 16px var(--page-gutter) 24px;
	}

	.main {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.grid-wrap {
		margin-top: 16px;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 18px;
		padding-top: 14px;
		font-size: 12.5px;
	}

	.key {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.swatch {
		box-sizing: border-box;
		width: 16px;
		height: 16px;
		border-radius: 50%;
	}

	.swatch.todo {
		border: 1.5px solid color-mix(in srgb, var(--color-primary) 55%, transparent);
	}

	.swatch.done {
		border: 2px solid var(--color-primary);
		background: var(--color-accent);
	}

	.legend p {
		width: 100%;
		margin: 0;
		line-height: 18px;
		color: var(--color-text-secondary);
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
		padding: 22px 18px;
		border-radius: 28px;
		background: var(--color-bingo-card);
	}

	.empty h2 {
		font-size: 22px;
		color: var(--color-primary);
	}

	.empty p {
		margin: 0;
		font-size: 14px;
		line-height: 20px;
		color: var(--color-text-secondary);
	}

	.empty .error {
		font-weight: 600;
		color: var(--color-danger);
	}

	@media (min-width: 1024px) {
		.layout {
			display: grid;
			grid-template-columns: minmax(0, 640px) minmax(0, 360px);
			gap: 40px;
			align-items: start;
		}
	}
</style>
