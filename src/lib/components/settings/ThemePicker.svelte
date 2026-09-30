<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { ThemeDefinition } from '$lib/contracts/themes';

	interface Props {
		builtins: readonly ThemeDefinition[];
		custom: readonly ThemeDefinition[];
		/** Chiave del tema attivo: built-in o id del tema custom. */
		activeKey: string;
		disabled?: boolean;
		onselect: (theme: ThemeDefinition, kind: 'builtin' | 'custom') => void;
		oncreate: () => void;
		onedit: (theme: ThemeDefinition) => void;
		ondelete: (theme: ThemeDefinition) => void;
	}

	let {
		builtins,
		custom,
		activeKey,
		disabled = false,
		onselect,
		oncreate,
		onedit,
		ondelete
	}: Props = $props();

	const SWATCHES = ['surface', 'primary', 'accent', 'textPrimary'] as const;
</script>

{#snippet card(theme: ThemeDefinition, kind: 'builtin' | 'custom')}
	{@const selected = theme.id === activeKey}
	<li class="item">
		<button
			type="button"
			class="theme"
			class:selected
			{disabled}
			aria-pressed={selected}
			data-theme-option={theme.id}
			onclick={() => onselect(theme, kind)}
		>
			<span class="preview" style:background={theme.colors.background} aria-hidden="true">
				{#each SWATCHES as token (token)}
					<span class="swatch" style:background={theme.colors[token]}></span>
				{/each}
			</span>
			<span class="name">{theme.name}</span>
			{#if selected}
				<span class="check" aria-hidden="true"
					><Icon name="check" size={16} strokeWidth={2.6} /></span
				>
				<span class="sr-only">(in uso)</span>
			{/if}
		</button>
		{#if kind === 'custom'}
			<div class="tools">
				<button type="button" class="tool" {disabled} onclick={() => onedit(theme)}>
					<Icon name="pencil" size={16} /> Modifica<span class="sr-only"> {theme.name}</span>
				</button>
				<button type="button" class="tool danger" {disabled} onclick={() => ondelete(theme)}>
					<Icon name="trash" size={16} /> Elimina<span class="sr-only"> {theme.name}</span>
				</button>
			</div>
		{/if}
	</li>
{/snippet}

<ul class="grid" aria-label="Temi">
	{#each builtins as theme (theme.id)}
		{@render card(theme, 'builtin')}
	{/each}
	{#each custom as theme (theme.id)}
		{@render card(theme, 'custom')}
	{/each}
</ul>

<button type="button" class="create" {disabled} onclick={oncreate}>
	<Icon name="plus" size={18} strokeWidth={2.2} />
	Crea tema personalizzato
</button>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	@media (min-width: 640px) {
		.grid {
			grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		}
	}

	.item {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}

	.theme {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 10px;
		box-sizing: border-box;
		width: 100%;
		min-height: 44px;
		padding: 10px;
		border: 2px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface-elevated);
		text-align: left;
	}

	.theme.selected {
		border-color: var(--color-primary);
		box-shadow: var(--shadow-card);
	}

	.preview {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 12px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-divider);
	}

	.swatch {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		border: 1px solid color-mix(in srgb, var(--color-text-primary) 25%, transparent);
	}

	.name {
		font-size: 15px;
		font-weight: 700;
		color: var(--color-text-primary);
	}

	.check {
		position: absolute;
		top: 8px;
		right: 8px;
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--color-primary);
		color: var(--color-on-primary);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.tools {
		display: flex;
		gap: 6px;
	}

	.tool {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		flex: 1;
		min-height: var(--tap-size);
		border: 0;
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--color-text-secondary);
		font-size: 13px;
		font-weight: 700;
	}

	.tool:hover {
		background: var(--color-surface-elevated);
	}

	.tool.danger {
		color: var(--color-danger);
	}

	.create {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		box-sizing: border-box;
		width: 100%;
		min-height: 50px;
		margin-top: 14px;
		border: 1.5px dashed var(--color-primary-outline);
		border-radius: var(--radius-lg);
		background: transparent;
		color: var(--color-primary);
		font-size: 15px;
		font-weight: 700;
	}

	.create:hover:not(:disabled) {
		background: var(--color-primary-tint);
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
