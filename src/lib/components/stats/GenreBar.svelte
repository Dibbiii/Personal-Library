<script lang="ts">
	import type { GenreSlug } from '$lib/contracts';
	import { GENRE_SHORT_LABELS } from '$lib/genres';

	interface Props {
		segments: { slug: GenreSlug; count: number }[];
	}

	let { segments }: Props = $props();

	const visible = $derived(segments.filter((segment) => segment.count > 0));
	const summary = $derived(
		visible.map((segment) => `${GENRE_SHORT_LABELS[segment.slug]} ${segment.count}`).join(', ')
	);
</script>

{#if visible.length > 0}
	<div class="bar" role="img" aria-label="Libri per genere: {summary}">
		{#each visible as segment (segment.slug)}
			<span
				class="segment"
				style="flex: {segment.count}; background: var(--genre-{segment.slug})"
				title="{GENRE_SHORT_LABELS[segment.slug]}: {segment.count}"
			></span>
		{/each}
	</div>
{/if}

<style>
	.bar {
		display: flex;
		gap: 3px;
		height: 12px;
		margin-top: 14px;
	}

	.segment {
		min-width: 6px;
		border-radius: 6px;
	}
</style>
