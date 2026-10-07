<script lang="ts">
	import RatingStars from '$lib/components/ui/RatingStars.svelte';
	import ReviewCard from './ReviewCard.svelte';

	interface Props {
		rating: number | null;
		onchange: (rating: number) => void;
	}

	let { rating, onchange }: Props = $props();

	const formattedRating = $derived(
		rating === null
			? '–'
			: new Intl.NumberFormat('it-IT', { minimumFractionDigits: rating % 1 ? 1 : 0 }).format(rating)
	);
</script>

<ReviewCard title="Voto">
	<div class="row">
		<RatingStars
			value={rating}
			size={36}
			readonly={false}
			label="Voto generale"
			onchange={(value) => value !== null && onchange(value)}
		/>
		<p class="value" aria-hidden="true">
			<span class="number">{formattedRating}</span><span class="max">/5</span>
		</p>
	</div>
</ReviewCard>

<style>
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		/* le stelle hanno un'area di tocco di 44px: compensa il margine sul primo e ultimo */
		margin-left: -4px;
	}

	.value {
		display: flex;
		align-items: baseline;
		margin: 0;
		color: var(--color-text-primary);
	}

	.number {
		font-family: var(--font-display);
		font-size: 26px;
		line-height: 1;
	}

	.max {
		font-size: 16px;
		color: var(--color-text-secondary);
	}
</style>
