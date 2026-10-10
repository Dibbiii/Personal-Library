<script lang="ts" generics="T extends string">
	interface Option {
		value: T;
		label: string;
		description?: string;
	}

	interface Props {
		legend: string;
		name: string;
		options: readonly Option[];
		value: T;
		onchange: (value: T) => void;
		disabled?: boolean;
	}

	let { legend, name, options, value, onchange, disabled = false }: Props = $props();
</script>

<fieldset {disabled}>
	<legend class="sr-only">{legend}</legend>
	{#each options as option (option.value)}
		<label class="choice" class:selected={option.value === value}>
			<input
				type="radio"
				{name}
				value={option.value}
				checked={option.value === value}
				onchange={() => onchange(option.value)}
			/>
			<span class="dot" aria-hidden="true"></span>
			<span class="text">
				<span class="label">{option.label}</span>
				{#if option.description}<span class="description">{option.description}</span>{/if}
			</span>
		</label>
	{/each}
</fieldset>

<style>
	fieldset {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}
	fieldset:disabled {
		opacity: 0.6;
	}
	fieldset:disabled .choice {
		cursor: wait;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.choice {
		position: relative;
		display: flex;
		align-items: center;
		gap: 14px;
		box-sizing: border-box;
		min-height: 56px;
		padding: 10px 14px;
		border-radius: var(--radius-lg);
		background: transparent;
		cursor: pointer;
		transition: background-color var(--duration-fast) var(--ease-out);
	}

	.choice:hover {
		background: color-mix(in srgb, var(--color-surface-elevated) 60%, transparent);
	}

	.choice.selected {
		background: var(--color-surface-elevated);
		box-shadow: var(--shadow-card);
	}

	/* radio visivamente nascosto ma raggiungibile: il focus si vede sulla riga */
	input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}

	.choice:has(input:focus-visible) {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.dot {
		flex: none;
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		box-sizing: border-box;
		border: 2px solid var(--color-border);
		border-radius: 50%;
		background: var(--color-surface-elevated);
	}

	.selected .dot {
		border-color: var(--color-primary);
	}

	.selected .dot::after {
		content: '';
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--color-primary);
	}

	.text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.label {
		font-size: 16px;
		font-weight: 600;
		color: var(--color-text-primary);
	}

	.selected .label {
		font-weight: 700;
	}

	.description {
		font-size: 13px;
		color: var(--color-text-secondary);
	}
</style>
