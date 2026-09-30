<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLInputAttributes, 'class' | 'value'> {
		label: string;
		name: string;
		value?: string;
		error?: string | null;
		hint?: string;
	}

	let {
		label,
		name,
		value = $bindable(''),
		error = null,
		hint,
		type = 'text',
		...rest
	}: Props = $props();

	const uid = $props.id();
</script>

<div class="field">
	<label for="{uid}-input">{label}</label>
	<input
		id="{uid}-input"
		{name}
		{type}
		bind:value
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={error ? `${uid}-error` : hint ? `${uid}-hint` : undefined}
		{...rest}
	/>
	{#if error}
		<p id="{uid}-error" class="error" role="alert">{error}</p>
	{:else if hint}
		<p id="{uid}-hint" class="hint">{hint}</p>
	{/if}
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	label {
		font-size: 14px;
		font-weight: 700;
		color: var(--color-text-primary);
	}

	input {
		box-sizing: border-box;
		width: 100%;
		min-height: 50px;
		padding: 0 16px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-card);
		font-size: 16px;
		color: var(--color-text-primary);
	}

	input::placeholder {
		color: var(--color-text-muted);
	}

	input:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 1px;
		border-color: var(--color-primary);
	}

	input[aria-invalid='true'] {
		border-color: var(--color-danger);
	}

	.error,
	.hint {
		margin: 0;
		font-size: 13px;
	}

	.error {
		color: var(--color-danger);
	}

	.hint {
		color: var(--color-text-secondary);
	}
</style>
