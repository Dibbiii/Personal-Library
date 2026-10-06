<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { BookSummary, Review } from '$lib/contracts';
	import BookCover from '$lib/components/book/BookCover.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import RatingStars from '$lib/components/ui/RatingStars.svelte';
	import { resolveCoverUrl } from '$lib/book/cover-url';
	import { seriesVolumeLabel, type StatusChoice } from '$lib/client/reading-logic';
	import { formatNumber } from './format';
	import StatusButton from './StatusButton.svelte';

	interface Props {
		book: BookSummary;
		review: Review | null;
		status: StatusChoice;
		queuePosition: number | null;
		onstatus: () => void;
		statusOpen?: boolean;
		/** Azioni secondarie (prossimi, sposta, altro) accanto al pulsante di stato. */
		actions?: Snippet;
	}

	let {
		book,
		review,
		status,
		queuePosition,
		onstatus,
		statusOpen = false,
		actions
	}: Props = $props();

	const FORMAT_LABELS = { physical: 'Cartaceo', digital: 'Digitale' } as const;

	const art = $derived(resolveCoverUrl(book.cover));
	const volume = $derived(
		book.series ? seriesVolumeLabel(book.series.number, book.series.total) : null
	);
	const rating = $derived(review?.rating ?? book.reviewRating);
	const tags = $derived(review?.tags.slice(0, 4) ?? []);
	const readings = $derived(book.completedReadingsCount);
</script>

<section class="banner" aria-label="Il libro">
	{#if art}
		<div class="art" style:background-image="url('{art}')" aria-hidden="true"></div>
	{/if}

	<div class="cover">
		<BookCover {book} size="fluid" priority />
	</div>

	<div class="info">
		<h1>{book.title}</h1>
		<p class="author">{book.author}</p>

		{#if rating}
			<div class="rating">
				<RatingStars value={rating} size={20} label="Il mio voto" />
				<span>Il mio voto · {rating}/5</span>
			</div>
		{/if}

		<ul class="chips">
			<li class="genre"><span class="dot" aria-hidden="true"></span>{book.genre.name}</li>
			{#each tags as tag (tag.id)}
				<li>{tag.label}</li>
			{/each}
			{#if queuePosition !== null}
				<li class="queued" data-testid="queue-position">
					<Icon name="bookmark" size={14} strokeWidth={2.2} />
					Prossimo · {queuePosition}º in coda
				</li>
			{/if}
		</ul>

		<dl class="facts">
			{#if book.pageCount}
				<div>
					<Icon name="book-open" size={20} />
					<dt>Pagine</dt>
					<dd>{formatNumber(book.pageCount)}</dd>
				</div>
			{/if}
			{#if book.series}
				<div>
					<Icon name="library" size={20} />
					<dt>{book.series.name}</dt>
					<dd>{volume ?? 'Serie'}</dd>
				</div>
			{/if}
			<div>
				<Icon name={book.format === 'digital' ? 'smartphone' : 'file-text'} size={20} />
				<dt>Formato</dt>
				<dd>{FORMAT_LABELS[book.format]}</dd>
			</div>
			<div>
				<Icon name="check" size={20} />
				<dt>Letture</dt>
				<dd>
					{readings === 0 ? 'Nessuna' : readings === 1 ? '1 completata' : `${readings} completate`}
				</dd>
			</div>
		</dl>

		<div class="cta">
			<StatusButton choice={status} size="lg" onclick={onstatus} expanded={statusOpen} />
			{@render actions?.()}
		</div>
	</div>
</section>

<style>
	.banner {
		position: relative;
		isolation: isolate;
		display: grid;
		grid-template-columns: 1fr;
		justify-items: center;
		gap: 20px;
		box-sizing: border-box;
		padding: 22px 18px 24px;
		overflow: hidden;
		border-radius: var(--radius-sheet);
		background:
			radial-gradient(
				ellipse 70% 120% at 100% 0%,
				color-mix(in srgb, var(--genre-current) 30%, transparent),
				transparent 70%
			),
			linear-gradient(
				120deg,
				color-mix(in srgb, var(--genre-current-light) 55%, var(--color-surface-elevated)),
				color-mix(in srgb, var(--genre-current-light) 80%, var(--color-surface))
			);
		box-shadow:
			0 0 0 1px color-mix(in srgb, var(--color-border) 18%, transparent),
			0 18px 40px -26px color-mix(in srgb, var(--color-shadow) 40%, transparent);
		color: var(--color-text-primary);
	}

	/* La copertina come illustrazione del banner: grande, sfocata e sfumata verso il testo. */
	.art {
		position: absolute;
		z-index: -1;
		inset: 0 0 0 45%;
		background-position: center 35%;
		background-size: cover;
		filter: blur(8px) saturate(1.15);
		opacity: 0.4;
		-webkit-mask-image: linear-gradient(90deg, transparent, var(--color-shadow) 75%);
		mask-image: linear-gradient(90deg, transparent, var(--color-shadow) 75%);
	}

	.cover {
		width: min(52vw, 190px);
		border-radius: 3px 10px 10px 3px;
		box-shadow:
			0 22px 34px -14px color-mix(in srgb, var(--color-shadow) 55%, transparent),
			0 4px 10px color-mix(in srgb, var(--color-shadow) 18%, transparent);
	}

	.info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		min-width: 0;
		text-align: center;
	}

	h1 {
		margin: 0;
		color: var(--color-primary);
		font-family: var(--font-display);
		font-size: 32px;
		font-weight: 400;
		line-height: 1.05;
		overflow-wrap: anywhere;
	}

	.author {
		margin: -6px 0 0;
		color: var(--color-text-secondary);
		font-size: 18px;
	}

	.rating {
		--genre-current: var(--color-flame);
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--color-text-secondary);
		font-size: 14px;
		font-weight: 600;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.chips li {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 32px;
		padding: 0 14px;
		border-radius: var(--radius-pill);
		background: color-mix(in srgb, var(--color-surface-elevated) 80%, transparent);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-border) 25%, transparent);
		font-size: 13px;
		font-weight: 600;
	}

	.chips .dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--genre-current);
	}

	.chips .queued {
		background: var(--color-primary);
		box-shadow: none;
		color: var(--color-on-primary);
	}

	.facts {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 12px 26px;
		margin: 4px 0 0;
	}

	.facts > div {
		display: grid;
		grid-template-columns: auto auto;
		grid-template-areas: 'icon value' 'icon label';
		align-items: center;
		column-gap: 10px;
		text-align: left;
	}

	.facts :global(svg) {
		grid-area: icon;
		color: var(--color-text-secondary);
	}

	.facts dd {
		grid-area: value;
		margin: 0;
		font-size: 15px;
		font-weight: 700;
	}

	.facts dt {
		grid-area: label;
		max-width: 160px;
		overflow: hidden;
		color: var(--color-text-secondary);
		font-size: 12px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.cta {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 10px;
		margin-top: 6px;
	}

	@media (min-width: 720px) {
		.banner {
			grid-template-columns: 200px minmax(0, 1fr);
			justify-items: stretch;
			align-items: center;
			gap: 32px;
			padding: 28px 32px;
		}

		.cover {
			width: 200px;
		}

		.info {
			align-items: flex-start;
			text-align: left;
		}

		h1 {
			font-size: 46px;
		}

		.chips,
		.facts,
		.cta {
			justify-content: flex-start;
		}
	}
</style>
