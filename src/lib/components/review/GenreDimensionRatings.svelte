<script lang="ts">
	import type { GenreSlug } from '$lib/contracts/enums';
	import { GENRE_SHORT_LABELS } from '$lib/genres';
	import { dimensionsForGenre, type DimensionScores } from '$lib/review/dimensions';
	import RatingDimension from './RatingDimension.svelte';
	import ReviewCard from './ReviewCard.svelte';

	interface Props {
		genre: GenreSlug;
		scores: DimensionScores;
		onchange: (dimensionKey: string, score: number | null) => void;
	}

	let { genre, scores, onchange }: Props = $props();

	const dimensions = $derived(dimensionsForGenre(genre));
</script>

<ReviewCard title="Valutazioni specifiche">
	{#snippet aside()}
		<span class="pill">{GENRE_SHORT_LABELS[genre]}</span>
	{/snippet}

	<div class="list">
		{#each dimensions as dimension (dimension.key)}
			<RatingDimension
				label={dimension.shortLabel}
				value={scores[dimension.key] ?? null}
				onchange={(score) => onchange(dimension.key, score)}
			/>
		{/each}
	</div>
</ReviewCard>

<style>
	.pill {
		display: inline-flex;
		align-items: center;
		height: 26px;
		padding: 0 12px;
		border-radius: 13px;
		background: var(--genre-current-light);
		color: var(--genre-current-dark);
		font-size: 12px;
		font-weight: 600;
	}

	.list {
		display: flex;
		flex-direction: column;
		/* righe da 44px per il tocco; il mockup ne mostra 40, il ritmo verticale resta simile */
		margin-block: -2px;
	}
</style>
