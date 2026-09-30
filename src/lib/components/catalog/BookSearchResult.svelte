<script lang="ts">
	import CoverImage from './CoverImage.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { EditionCandidate } from '$lib/contracts/books';
	import { candidateMeta } from '$lib/catalog/draft';

	interface Props {
		candidate: EditionCandidate;
		onselect: (candidate: EditionCandidate) => void;
		/** Mostra lo stato di attesa mentre si completano i dati dell'edizione. */
		busy?: boolean;
		disabled?: boolean;
	}

	let { candidate, onselect, busy = false, disabled = false }: Props = $props();

	const meta = $derived(candidateMeta(candidate));
	const isbn = $derived(candidate.isbn13 ?? candidate.isbn10);
	const exactIsbn = $derived(candidate.matchReasons.includes('isbn-exact'));
</script>

<button
	class="result"
	type="button"
	disabled={disabled || busy}
	aria-busy={busy}
	onclick={() => onselect(candidate)}
>
	<CoverImage src={candidate.coverUrl} width={56} height={84} />
	<span class="text">
		<span class="title">{candidate.editionTitle}</span>
		<span class="author">{candidate.authors.join(', ')}</span>
		{#if meta}<span class="meta">{meta}</span>{/if}
		{#if isbn}<span class="isbn">ISBN {isbn}</span>{/if}
		{#if exactIsbn}
			<span class="flag"><Icon name="check" size={13} strokeWidth={2.6} />Stesso ISBN</span>
		{/if}
	</span>
	<span class="chevron" aria-hidden="true">
		{#if busy}<span class="spinner"></span>{:else}<Icon
				name="chevron-right"
				size={20}
				strokeWidth={2.2}
			/>{/if}
	</span>
</button>

<style>
	.result {
		display: flex;
		align-items: center;
		gap: 14px;
		box-sizing: border-box;
		width: 100%;
		min-height: var(--tap-size);
		padding: 12px 14px 12px 12px;
		border: 0;
		border-radius: 20px;
		background: var(--color-card);
		box-shadow: var(--shadow-card);
		text-align: left;
		color: var(--color-text-primary);
	}

	.result:hover:not(:disabled) {
		background: var(--color-surface);
	}

	.result:disabled {
		cursor: progress;
	}

	.text {
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		min-width: 0;
	}

	.title {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		font-family: var(--font-display);
		font-size: 17px;
		line-height: 1.2;
	}

	.author {
		font-size: 13.5px;
		font-weight: 600;
		color: var(--color-text-link);
	}

	.meta,
	.isbn {
		font-size: 12px;
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
		margin-top: 4px;
		padding: 0 10px 0 8px;
		border-radius: 11px;
		background: var(--color-info-tint);
		font-size: 11.5px;
		font-weight: 700;
		color: var(--color-info);
	}

	.chevron {
		display: inline-flex;
		color: var(--color-nav-inactive);
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
