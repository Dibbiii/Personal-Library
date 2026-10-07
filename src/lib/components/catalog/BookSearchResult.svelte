<script lang="ts">
	import CoverImage from './CoverImage.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { EditionCandidate } from '$lib/contracts/books';
	import { candidateMeta } from '$lib/catalog/draft';

	interface Props {
		candidate: EditionCandidate;
		onselect: (candidate: EditionCandidate) => void;
		/** Il candidato mostrato nel pannello di dettaglio. */
		selected?: boolean;
		/** Mostra lo stato di attesa mentre si completano i dati dell'edizione. */
		busy?: boolean;
		disabled?: boolean;
	}

	let { candidate, onselect, selected = false, busy = false, disabled = false }: Props = $props();

	const meta = $derived(candidateMeta(candidate));
	const isbn = $derived(candidate.isbn13 ?? candidate.isbn10);
	const exactIsbn = $derived(candidate.matchReasons.includes('isbn-exact'));
</script>

<button
	class="result"
	class:selected
	type="button"
	disabled={disabled || busy}
	aria-busy={busy}
	aria-pressed={selected}
	onclick={() => onselect(candidate)}
>
	<CoverImage src={candidate.coverUrl} width={64} height={96} />
	<span class="text">
		<span class="title">{candidate.editionTitle}</span>
		<span class="author">{candidate.authors.join(', ')}</span>
		{#if meta}<span class="meta">{meta}</span>{/if}
		{#if isbn}<span class="isbn">ISBN {isbn}</span>{/if}
		{#if exactIsbn}
			<span class="flag"><Icon name="check" size={13} strokeWidth={2.6} />Stesso ISBN</span>
		{/if}
	</span>
	<span class="pick" aria-hidden="true">
		{#if busy}
			<span class="spinner"></span>
		{:else}
			<span class="pick-label">{selected ? 'Selezionato' : 'Seleziona'}</span>
			<Icon name={selected ? 'check' : 'arrow-right'} size={16} strokeWidth={2.2} />
		{/if}
	</span>
</button>

<style>
	.result {
		display: flex;
		align-items: center;
		gap: 16px;
		box-sizing: border-box;
		width: 100%;
		min-height: var(--tap-size);
		padding: 10px 14px 10px 10px;
		border: 1.5px solid transparent;
		border-radius: var(--radius-lg);
		background: var(--color-card);
		text-align: left;
		color: var(--color-text-primary);
		transition:
			background-color var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}

	.result:hover:not(:disabled) {
		background: var(--color-surface);
	}

	.result.selected {
		border-color: var(--color-primary-outline);
		background: color-mix(in srgb, var(--color-primary) 7%, var(--color-card));
	}

	.result:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.result:disabled {
		cursor: progress;
	}

	.text {
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: flex-start;
		gap: 3px;
		min-width: 0;
	}

	.title {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		font-family: var(--font-display);
		font-size: 18px;
		line-height: 1.2;
	}

	.author {
		font-size: 14px;
		color: var(--color-text-secondary);
	}

	.meta,
	.isbn {
		font-size: 12.5px;
		line-height: 1.35;
		color: var(--color-text-secondary);
	}

	.isbn {
		font-variant-numeric: tabular-nums;
		color: var(--color-text-muted);
	}

	.flag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 22px;
		margin-top: 2px;
		padding: 0 10px 0 8px;
		border-radius: 11px;
		background: var(--color-info-tint);
		font-size: 11.5px;
		font-weight: 700;
		color: var(--color-info);
	}

	.pick {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-width: 40px;
		height: 40px;
		padding: 0 12px;
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		font-size: 14px;
		font-weight: 700;
		color: var(--color-primary);
	}

	.selected .pick {
		background: var(--color-primary);
		color: var(--color-on-primary);
	}

	.pick-label {
		display: none;
	}

	@media (min-width: 560px) {
		.pick {
			padding: 0 16px 0 18px;
		}

		.pick-label {
			display: inline;
		}
	}

	.spinner {
		width: 18px;
		height: 18px;
		border: 2.5px solid var(--color-divider);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation-duration: 2.4s;
		}
	}
</style>
