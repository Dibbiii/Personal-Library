<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { seriesVolumeLabel, seriesVolumes } from '$lib/client/reading-logic';
	import type { SeriesRef } from '$lib/contracts';

	interface Props {
		series: SeriesRef;
	}

	let { series }: Props = $props();

	const volumes = $derived(seriesVolumes(series.number, series.total));
	const label = $derived(seriesVolumeLabel(series.number, series.total));
</script>

<section class="series" aria-label="Serie">
	{#if volumes.length > 0}
		<div class="spines" aria-hidden="true">
			{#each volumes as volume (volume.number)}
				<span class="spine {volume.state}">
					{#if volume.state === 'read'}
						<Icon name="check" size={12} strokeWidth={2.6} />
					{:else if volume.state === 'current'}
						{volume.number}
					{/if}
				</span>
			{/each}
		</div>
	{/if}
	<div class="text">
		<p class="vol">Serie: {label ?? series.name}</p>
		{#if label}<p class="name">{series.name}</p>{/if}
	</div>
</section>

<style>
	.series {
		display: flex;
		align-items: center;
		gap: 14px;
		box-sizing: border-box;
		padding: 12px 16px;
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}

	.spines {
		display: flex;
		align-items: flex-end;
		gap: 4px;
		height: 54px;
		flex: none;
	}

	.spine {
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		width: 18px;
		height: 48px;
		border-radius: 3px 5px 5px 3px;
		color: var(--color-on-genre-white);
		font-size: 11px;
		font-weight: 700;
	}

	.spine.read {
		background: var(--color-divider);
	}

	.spine.current {
		height: 54px;
		background: var(--genre-current);
		color: var(--genre-current-on);
		box-shadow: 0 0 10px 1px color-mix(in srgb, var(--genre-current) 70%, transparent);
	}

	.spine.missing {
		border: 1.5px dashed color-mix(in srgb, var(--color-shelf-axis) 45%, transparent);
	}

	.text {
		min-width: 0;
	}

	p {
		margin: 0;
	}

	.vol {
		font-size: 15px;
		font-weight: 700;
	}

	.name {
		margin-top: 2px;
		font-size: 12.5px;
		line-height: 17px;
		color: var(--color-text-secondary);
	}
</style>
