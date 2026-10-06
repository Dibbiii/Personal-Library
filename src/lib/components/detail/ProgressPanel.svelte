<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { progressPercent } from '$lib/client/reading-logic';
	import ProgressBar from './ProgressBar.svelte';
	import { formatNumber } from './format';

	interface Props {
		currentPage: number;
		pageCount: number | null;
		paused: boolean;
		/** Pagina già registrata offline ma non ancora sincronizzata. */
		pendingPage?: number | null;
		busy?: boolean;
		onupdate: () => void;
		onfinish: () => void;
		onpause: () => void;
		onresume: () => void;
	}

	let {
		currentPage,
		pageCount,
		paused,
		pendingPage = null,
		busy = false,
		onupdate,
		onfinish,
		onpause,
		onresume
	}: Props = $props();

	const shown = $derived(pendingPage ?? currentPage);
	const percent = $derived(progressPercent(shown, pageCount));
</script>

<section id="progress" class="panel" aria-labelledby="progress-title">
	<header>
		<h2 id="progress-title">Avanzamento</h2>
		<span class="pill" class:paused>{paused ? 'In pausa' : 'In lettura'}</span>
	</header>

	<p class="pages">
		<strong>p. {formatNumber(shown)}</strong>
		{#if pageCount}<span>di {formatNumber(pageCount)}</span>{/if}
		{#if percent !== null}<span class="percent">{percent}%</span>{/if}
	</p>
	<ProgressBar {percent} />

	{#if pendingPage !== null}
		<p class="pending" role="status" data-testid="sync-pending">
			In coda: sincronizza quando torni online.
		</p>
	{/if}

	<div class="actions">
		{#if paused}
			<Button size="lg" fullWidth disabled={busy} onclick={onresume}>Riprendi a leggere</Button>
		{:else}
			<Button size="lg" fullWidth disabled={busy} onclick={onupdate} data-testid="update-page">
				Aggiorna pagina
			</Button>
		{/if}
		<div class="secondary">
			<Button variant="secondary" size="sm" disabled={busy} onclick={onfinish}>
				{#snippet icon()}<Icon name="check" size={18} strokeWidth={2.4} />{/snippet}
				Ho finito
			</Button>
			{#if paused}
				<Button variant="secondary" size="sm" disabled={busy} onclick={onupdate}>
					Aggiorna pagina
				</Button>
			{:else}
				<Button variant="secondary" size="sm" disabled={busy} onclick={onpause}>In pausa</Button>
			{/if}
		</div>
	</div>
</section>

<style>
	.panel {
		box-sizing: border-box;
		padding: 20px;
		border-radius: var(--radius-xl);
		background: var(--color-surface-elevated);
		box-shadow:
			0 0 0 1px color-mix(in srgb, var(--color-border) 18%, transparent),
			0 12px 30px -20px color-mix(in srgb, var(--color-shadow) 35%, transparent);
		scroll-margin-top: 16px;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	h2 {
		margin: 0;
		color: var(--color-primary);
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 400;
		line-height: 1.2;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		height: 28px;
		padding: 0 12px;
		border-radius: 14px;
		background: var(--color-primary);
		color: var(--color-on-primary);
		font-size: 12px;
		font-weight: 600;
	}

	.pill.paused {
		background: var(--color-background);
		color: var(--color-text-secondary);
	}

	.pages {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin: 12px 0 8px;
		font-size: 14px;
		color: var(--color-text-secondary);
	}

	.pages strong {
		font-family: var(--font-display);
		font-size: 24px;
		font-weight: 400;
		color: var(--color-text-primary);
	}

	.percent {
		margin-left: auto;
		font-weight: 700;
	}

	.pending {
		margin: 10px 0 0;
		font-size: 13px;
		color: var(--color-text-secondary);
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 16px;
	}

	.secondary {
		display: flex;
		gap: 10px;
	}

	.secondary > :global(*) {
		flex: 1;
	}
</style>
