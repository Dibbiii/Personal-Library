<script lang="ts">
	import type { BookSummary, ReadingHistoryItem } from '$lib/contracts';
	import Icon from '$lib/components/ui/Icon.svelte';

	interface Props {
		book: BookSummary;
		readings: ReadingHistoryItem[];
		onstatus: () => void;
	}

	/** "Il mio progresso" quando non c'e' una lettura aperta: riepilogo delle letture concluse. */
	let { book, readings, onstatus }: Props = $props();

	const dateFormat = new Intl.DateTimeFormat('it-IT', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});
	const DAY = 86_400_000;

	const last = $derived(
		[...readings].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null
	);
	const days = $derived(
		last?.endedAt
			? Math.max(1, Math.round((Date.parse(last.endedAt) - Date.parse(last.startedAt)) / DAY) + 1)
			: null
	);
	const headline = $derived.by(() => {
		if (book.lifecycleState === 'dnf') return 'Lasciato a metà';
		if (book.completedReadingsCount > 1) return `Letto ${book.completedReadingsCount} volte`;
		if (book.completedReadingsCount === 1) return 'Letto';
		return 'Non ancora iniziato';
	});
</script>

<section class="card" aria-labelledby="summary-title">
	<header>
		<h2 id="summary-title">Il mio progresso</h2>
	</header>

	<p class="headline">
		<span class="badge" class:done={book.completedReadingsCount > 0}>
			<Icon
				name={book.completedReadingsCount > 0 ? 'check' : 'bookmark'}
				size={18}
				strokeWidth={2.2}
			/>
		</span>
		{headline}
	</p>

	{#if last}
		<dl class="dates">
			<div>
				<Icon name="calendar" size={18} />
				<dt>Inizio lettura</dt>
				<dd>{dateFormat.format(new Date(last.startedAt))}</dd>
			</div>
			<div>
				<Icon name="calendar" size={18} />
				<dt>Fine lettura</dt>
				<dd>{last.endedAt ? dateFormat.format(new Date(last.endedAt)) : '—'}</dd>
			</div>
		</dl>
		{#if days}
			<p class="note">
				Finito in {days}
				{days === 1 ? 'giorno' : 'giorni'}{book.pageCount
					? ` · ${Math.round(book.pageCount / days)} pagine al giorno`
					: ''}.
			</p>
		{/if}
	{:else}
		<p class="note">Quando inizi a leggerlo, qui trovi pagina, percentuale e date.</p>
	{/if}

	<button type="button" class="change" onclick={onstatus} aria-haspopup="dialog">
		{book.completedReadingsCount > 0 ? 'Cambia stato o rileggi' : 'Inizia a leggere'}
		<Icon name="chevron-right" size={18} strokeWidth={2.2} />
	</button>
</section>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 20px;
		border-radius: var(--radius-xl);
		background: var(--color-surface-elevated);
		box-shadow:
			0 0 0 1px color-mix(in srgb, var(--color-border) 18%, transparent),
			0 12px 30px -20px color-mix(in srgb, var(--color-shadow) 35%, transparent);
	}

	h2 {
		margin: 0;
		color: var(--color-primary);
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 400;
	}

	.headline {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 0;
		padding: 12px 14px;
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 16px;
		font-weight: 700;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 10px;
		background: var(--color-primary-tint);
		color: var(--color-primary);
	}

	.badge.done {
		background: var(--color-primary);
		color: var(--color-on-primary);
	}

	.dates {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin: 0;
	}

	.dates > div {
		display: grid;
		grid-template-columns: auto 1fr;
		grid-template-areas: 'icon label' 'icon value';
		column-gap: 10px;
		align-items: center;
	}

	.dates :global(svg) {
		grid-area: icon;
		color: var(--color-text-secondary);
	}

	.dates dt {
		grid-area: label;
		color: var(--color-text-secondary);
		font-size: 12px;
	}

	.dates dd {
		grid-area: value;
		margin: 0;
		font-size: 14px;
		font-weight: 700;
	}

	.note {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 13.5px;
		line-height: 1.45;
	}

	.change {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 48px;
		padding: 0 16px;
		border: 0;
		border-radius: var(--radius-md);
		background: var(--color-primary);
		color: var(--color-on-primary);
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 700;
		cursor: pointer;
	}

	.change:hover {
		background: var(--color-primary-hover);
	}

	.change:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
</style>
