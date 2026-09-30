<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	let { children }: { children: Snippet } = $props();
</script>

<main class="auth">
	<header class="brand">
		<span class="mark"><Icon name="bookmark" size={30} strokeWidth={2} /></span>
		<h1>Segnalibro</h1>
		<p>La tua libreria e il tuo diario di lettura.</p>
	</header>

	{@render children()}
</main>

<style>
	.auth {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 28px;
		box-sizing: border-box;
		min-height: 100dvh;
		padding: 32px var(--page-gutter);
		background: var(--color-background-shelf);
	}

	.brand {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		text-align: center;
		color: var(--color-primary);
	}

	.mark {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: var(--color-surface);
	}

	h1 {
		font-size: 38px;
		line-height: 1.1;
	}

	.brand p {
		margin: 0;
		font-size: 14px;
		color: var(--color-text-secondary);
	}
</style>
