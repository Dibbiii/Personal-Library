<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { IconName } from '$lib/components/ui/icons';

	let { active = true }: { active?: boolean } = $props();
	let mode = $state('system');
	const options: { value: string; label: string; icon: IconName }[] = [
		{ value: 'light', label: 'Chiaro', icon: 'sun' },
		{ value: 'dark', label: 'Scuro', icon: 'moon' },
		{ value: 'system', label: 'Sistema', icon: 'smartphone' }
	];

	onMount(() => {
		try {
			const stored = localStorage.getItem('sb-appearance');
			setMode(stored === 'dark' || stored === 'light' ? stored : 'system');
		} catch {
			mode = document.documentElement.dataset.appearance ?? 'system';
		}
	});

	$effect(() => {
		if (active) mode = document.documentElement.dataset.appearance ?? 'system';
	});

	function setMode(value: string) {
		mode = value;
		document.documentElement.dataset.appearance = value;
		try {
			localStorage.setItem('sb-appearance', value);
		} catch {
			// Il cambio resta valido anche senza storage disponibile.
		}
	}
</script>

<div class="modes" role="group" aria-label="Modalità di visualizzazione">
	{#each options as option (option.value)}
		<button
			type="button"
			class:selected={mode === option.value}
			aria-pressed={mode === option.value}
			onclick={() => setMode(option.value)}
		>
			<Icon name={option.icon} size={16} />
			<span>{option.label}</span>
		</button>
	{/each}
</div>

<style>
	.modes {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 3px;
		padding: 3px;
		border-radius: 12px;
		background: var(--color-surface);
	}
	button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		min-height: 44px;
		padding: 6px 4px;
		border: 0;
		border-radius: 9px;
		background: transparent;
		color: var(--color-text-secondary);
		font-size: 12px;
		font-weight: 500;
	}
	button.selected {
		background: var(--color-surface-elevated);
		color: var(--color-primary);
		box-shadow: 0 1px 4px color-mix(in srgb, var(--color-shadow) 12%, transparent);
		font-weight: 700;
	}
</style>
