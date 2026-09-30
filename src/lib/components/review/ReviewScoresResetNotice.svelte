<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';

	interface Props {
		/** Nome del nuovo genere, se noto (es. "Thriller"). */
		genreLabel?: string;
		ondismiss?: () => void;
	}

	let { genreLabel, ondismiss }: Props = $props();
</script>

<div class="notice" role="status" data-testid="review-scores-reset">
	<span class="icon"><Icon name="tag" size={20} /></span>
	<p>
		<strong>Valutazioni specifiche azzerate.</strong>
		{#if genreLabel}Con il genere {genreLabel} le categorie sono diverse.{:else}Le categorie
			cambiano con il genere.{/if}
		Voto, aggettivi, tag e citazioni sono rimasti.
	</p>
	{#if ondismiss}
		<button type="button" class="close" aria-label="Chiudi avviso" onclick={ondismiss}>
			<Icon name="close" size={18} strokeWidth={2.2} />
		</button>
	{/if}
</div>

<style>
	.notice {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		box-sizing: border-box;
		padding: 12px 8px 12px 14px;
		border: 1.5px solid color-mix(in srgb, var(--color-warning) 55%, transparent);
		border-radius: 16px;
		background: color-mix(in srgb, var(--color-warning) 14%, var(--color-background));
		color: var(--color-text-primary);
	}

	.icon {
		display: inline-flex;
		margin-top: 1px;
		color: var(--color-text-primary);
	}

	p {
		flex: 1;
		margin: 0;
		font-size: 13.5px;
		line-height: 19px;
	}

	.close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: var(--tap-size);
		height: var(--tap-size);
		margin: -10px 0;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}
</style>
