<script lang="ts">
	import type { BookSummary } from '$lib/contracts';
	import { GENRE_SHORT_LABELS } from '$lib/genres';
	import BookCover from '$lib/components/book/BookCover.svelte';
	import FormatBadge from '$lib/components/ui/FormatBadge.svelte';
	import GenreChip from '$lib/components/ui/GenreChip.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { seriesVolumeLabel, type StatusChoice } from '$lib/client/reading-logic';
	import { formatPages } from './format';
	import StatusButton from './StatusButton.svelte';

	interface Props {
		book: BookSummary;
		/** Layout compatto con cover a sinistra (mockup 05): libri già letti. Su desktop torna centrato. */
		compact: boolean;
		status: StatusChoice;
		queuePosition: number | null;
		onstatus: () => void;
		statusOpen?: boolean;
	}

	let { book, compact, status, queuePosition, onstatus, statusOpen = false }: Props = $props();

	const volume = $derived(
		book.series ? seriesVolumeLabel(book.series.number, book.series.total) : null
	);
</script>

<section class="hero" class:compact aria-label="Il libro">
	<div class="stage">
		<div class="glow" aria-hidden="true"></div>
		<div class="cover">
			<BookCover {book} size="fluid" showFormat={compact} priority />
		</div>
		<div class="shelf" aria-hidden="true"></div>
		<div class="led" aria-hidden="true"></div>
	</div>

	<div class="info">
		<h1>{book.title}</h1>
		<p class="author">{book.author}</p>

		<div class="chips">
			<span class="full-genre"><GenreChip slug={book.genre.slug} size="md" /></span>
			<span class="short-genre">
				<GenreChip slug={book.genre.slug} label={GENRE_SHORT_LABELS[book.genre.slug]} size="sm" />
			</span>
			<span class="status-md">
				<StatusButton choice={status} size="md" onclick={onstatus} expanded={statusOpen} />
			</span>
			<FormatBadge format={book.format} />
			{#if book.pageCount}
				<span class="meta-chip">
					<Icon name="file-text" size={15} strokeWidth={2} />
					{formatPages(book.pageCount)}
				</span>
			{/if}
			{#if queuePosition !== null}
				<span class="meta-chip queued" data-testid="queue-position">
					<Icon name="bookmark" size={15} strokeWidth={2} />
					Prossimo · {queuePosition}º in coda
				</span>
			{/if}
		</div>

		{#if volume}<p class="series-line">Serie: {volume}</p>{/if}

		<div class="status-lg">
			<StatusButton choice={status} size="lg" onclick={onstatus} expanded={statusOpen} />
		</div>
	</div>
</section>

<style>
	.hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 6px 24px 0;
	}

	/* ---- stage: cover su mensola con glow (mockup 03) ---- */
	.stage {
		position: relative;
		width: 260px;
		height: 236px;
		margin: 0 auto;
		flex: none;
	}

	.glow {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 16px;
		height: 150px;
		background: radial-gradient(
			ellipse at 50% 100%,
			color-mix(in srgb, var(--genre-current) 55%, transparent),
			transparent 70%
		);
	}

	.cover {
		position: absolute;
		top: 0;
		left: 50%;
		width: 126px;
		transform: translateX(-50%);
	}

	.cover :global(.cover) {
		aspect-ratio: 2 / 3;
	}

	.shelf {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 16px;
		height: 12px;
		border-radius: 4px;
		background: var(--gradient-wood-detail);
		box-shadow:
			0 0 18px 4px color-mix(in srgb, var(--genre-current) 55%, transparent),
			0 6px 10px -3px color-mix(in srgb, var(--color-text-primary) 30%, transparent);
	}

	.led {
		position: absolute;
		left: 20px;
		right: 20px;
		bottom: 27px;
		height: 3px;
		border-radius: 2px;
		background: var(--genre-current);
		box-shadow: 0 0 12px 3px color-mix(in srgb, var(--genre-current) 80%, transparent);
	}

	.info {
		min-width: 0;
		padding-top: 10px;
	}

	h1 {
		margin: 0;
		font-size: 27px;
		line-height: 1.15;
		color: var(--color-text-primary);
		overflow-wrap: anywhere;
	}

	.author {
		margin: 6px 0 0;
		font-size: 15px;
		font-weight: 600;
		color: var(--color-info);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px;
		margin-top: 14px;
	}

	.meta-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		box-sizing: border-box;
		height: 32px;
		padding: 0 12px;
		border-radius: 16px;
		background: var(--color-surface);
		color: var(--color-text-primary);
		font-size: 13px;
		font-weight: 600;
		white-space: nowrap;
	}

	.meta-chip.queued {
		background: var(--color-primary);
		color: var(--color-on-primary);
	}

	.series-line,
	.status-lg,
	.short-genre {
		display: none;
	}

	/* ---- layout compatto (mockup 05), solo mobile ---- */
	@media (max-width: 1023.98px) {
		.hero.compact {
			flex-direction: row;
			align-items: flex-start;
			gap: 16px;
			padding: 12px 20px 0;
			text-align: left;
		}

		.compact .stage {
			width: 98px;
			height: 147px;
			margin: 0;
		}

		.compact .cover {
			width: 98px;
		}

		.compact .glow {
			left: -12px;
			right: -12px;
			bottom: -10px;
			height: 26px;
		}

		.compact .shelf,
		.compact .led {
			display: none;
		}

		.compact .info {
			flex: 1;
			padding-top: 0;
		}

		.compact h1 {
			font-size: 24px;
		}

		.compact .author {
			margin-top: 4px;
			font-size: 14px;
		}

		.compact .chips {
			justify-content: flex-start;
			gap: 6px;
			margin-top: 10px;
		}

		.compact .full-genre,
		.compact .status-md {
			display: none;
		}

		.compact .short-genre,
		.compact .series-line,
		.compact .status-lg {
			display: block;
		}

		.compact .short-genre {
			display: inline-flex;
		}

		.compact .series-line {
			margin: 8px 0 0;
			font-size: 12.5px;
			font-weight: 600;
			color: var(--color-text-secondary);
		}

		.compact .status-lg {
			margin-top: 10px;
		}

		.compact :global(.format-chip),
		.compact .meta-chip {
			height: 28px;
			border-radius: 14px;
			font-size: 12px;
		}
	}

	@media (min-width: 1024px) {
		.hero {
			padding-top: 12px;
		}

		.stage {
			width: 300px;
			height: 262px;
		}

		.cover {
			width: 150px;
		}

		h1 {
			font-size: 32px;
		}
	}
</style>
