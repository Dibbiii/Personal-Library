<script module lang="ts">
	let locks = 0;

	function lockScroll() {
		if (locks++ === 0) document.documentElement.style.overflow = 'hidden';
	}

	function unlockScroll() {
		if (--locks === 0) document.documentElement.style.overflow = '';
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { portal } from '$lib/actions/portal';
	import { trapFocus } from '$lib/actions/focus-trap';

	interface Props {
		open: boolean;
		placement: 'bottom' | 'center';
		role?: 'dialog' | 'alertdialog';
		labelledby: string;
		describedby?: string | undefined;
		/** Pannello largo (dettagli di un libro) invece del dialogo compatto. */
		wide?: boolean;
		onclose: () => void;
		children: Snippet;
	}

	let {
		open,
		placement,
		role = 'dialog',
		labelledby,
		describedby,
		wide = false,
		onclose,
		children
	}: Props = $props();

	const reduceMotion = () =>
		typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	const duration = (ms: number) => (reduceMotion() ? 0 : ms);

	$effect(() => {
		if (!open) return;
		lockScroll();
		return unlockScroll;
	});

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.stopPropagation();
			onclose();
		}
	}
</script>

{#if open}
	<div class="layer {placement}" class:wide use:portal>
		<button
			class="scrim"
			type="button"
			tabindex="-1"
			aria-hidden="true"
			onclick={onclose}
			transition:fade={{ duration: duration(180) }}
		></button>
		<div
			class="panel"
			{role}
			aria-modal="true"
			aria-labelledby={labelledby}
			aria-describedby={describedby}
			tabindex="-1"
			use:trapFocus
			onkeydown={onKeydown}
			transition:fly={placement === 'bottom'
				? { y: 320, duration: duration(260), opacity: 1 }
				: { y: 16, duration: duration(200) }}
		>
			{@render children()}
		</div>
	</div>
{/if}

<style>
	.layer {
		position: fixed;
		inset: 0;
		z-index: var(--z-sheet);
		display: flex;
		justify-content: center;
	}

	.layer.bottom {
		align-items: flex-end;
	}

	.layer.center {
		align-items: center;
		padding: 24px;
	}

	.scrim {
		position: absolute;
		inset: 0;
		border: 0;
		padding: 0;
		background: var(--color-scrim);
		cursor: default;
	}

	.panel {
		position: relative;
		box-sizing: border-box;
		width: 100%;
		max-height: 92dvh;
		overflow-y: auto;
		overscroll-behavior: contain;
		background: var(--color-background);
		color: var(--color-text-primary);
	}

	.panel:focus {
		outline: none;
	}

	.bottom .panel {
		max-width: 560px;
		padding: 10px 20px calc(24px + env(safe-area-inset-bottom, 0px));
		border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
		box-shadow: var(--shadow-sheet);
	}

	.wide.bottom .panel {
		max-width: 720px;
	}

	.wide.center .panel {
		max-width: 760px;
		padding: 28px;
	}

	.center .panel {
		max-width: 320px;
		padding: 24px 22px 22px;
		border-radius: var(--radius-sheet);
		box-shadow: var(--shadow-dialog);
	}
</style>
