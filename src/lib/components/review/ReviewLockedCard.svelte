<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		footer?: Snippet | undefined;
	}

	let { footer }: Props = $props();
</script>

<section class="locked" aria-labelledby="review-locked-title" data-testid="review-locked">
	<header>
		<h2 id="review-locked-title">Recensione</h2>
		<span class="pill">Non ancora letto</span>
	</header>
	<p>Voto, tag e citazioni si sbloccano quando segni il libro come letto.</p>
	{#if footer}{@render footer()}{/if}
</section>

<style>
	.locked {
		box-sizing: border-box;
		padding: 20px;
		border-radius: var(--radius-xl);
		background: var(--color-surface);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	h2 {
		margin: 0;
		font-size: 20px;
		line-height: 1.2;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		height: 28px;
		padding: 0 12px;
		border-radius: 14px;
		background: var(--color-background);
		color: var(--color-text-secondary);
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
	}

	p {
		margin: 8px 0 16px;
		font-size: 14px;
		line-height: 20px;
		color: var(--color-text-secondary);
	}
</style>
