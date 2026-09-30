<script lang="ts" module>
	export type SaveState =
		| { kind: 'idle' }
		| { kind: 'pending'; restored?: boolean }
		| { kind: 'saving' }
		| { kind: 'saved' }
		| { kind: 'local'; message: string; restored?: boolean }
		| { kind: 'offline'; message: string }
		| { kind: 'error'; message: string };
</script>

<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';

	interface Props {
		status: SaveState;
		onretry?: () => void;
	}

	let { status, onretry }: Props = $props();

	const text = $derived.by(() => {
		switch (status.kind) {
			case 'pending':
				return status.restored ? 'Bozza ripristinata, salvo…' : 'Salvo…';
			case 'saving':
				return 'Salvo…';
			case 'saved':
				return 'Salvato';
			case 'local':
				return status.restored ? `Bozza ripristinata. ${status.message}` : status.message;
			case 'offline':
			case 'error':
				return status.message;
			default:
				return '';
		}
	});

	const tone = $derived(
		status.kind === 'error' ? 'danger' : status.kind === 'saved' ? 'ok' : 'neutral'
	);
</script>

<!-- Area sempre presente per gli screen reader; il pannello visivo compare solo quando serve. -->
<div
	class="region"
	role="status"
	aria-live="polite"
	data-testid="review-save-status"
	data-state={status.kind}
>
	{#if text}
		<div class="pill {tone}">
			{#if status.kind === 'saved'}<Icon name="check" size={16} strokeWidth={2.6} />{/if}
			<span>{text}</span>
			{#if status.kind === 'error' || status.kind === 'offline'}
				<button type="button" class="retry" onclick={onretry}>Riprova</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.region {
		position: fixed;
		z-index: 4;
		left: 0;
		right: 0;
		bottom: calc(var(--nav-height) + 12px + env(safe-area-inset-bottom, 0px));
		display: flex;
		justify-content: center;
		padding: 0 16px;
		pointer-events: none;
	}

	@media (min-width: 1024px) {
		.region {
			bottom: 24px;
			left: var(--sidebar-width);
		}
	}

	.pill {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		max-width: 420px;
		box-sizing: border-box;
		min-height: 40px;
		padding: 8px 16px;
		border-radius: var(--radius-pill);
		background: var(--color-text-primary);
		color: var(--color-background);
		box-shadow: var(--shadow-card);
		font-size: 13.5px;
		font-weight: 600;
		line-height: 18px;
		pointer-events: auto;
	}

	.pill.danger {
		background: var(--color-danger);
		color: var(--color-on-danger);
	}

	.retry {
		min-height: var(--tap-size);
		margin: -8px -8px -8px 0;
		padding: 0 12px;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		font-weight: 700;
		text-decoration: underline;
		cursor: pointer;
	}
</style>
