<script lang="ts">
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import { themeDefinitionSchema, type ThemeDefinition } from '$lib/contracts/themes';
	import {
		EDITABLE_TOKENS,
		contrastChecks,
		deriveTheme,
		mainColorsOf,
		themeStyleAttribute,
		type EditableTokenKey,
		type MainColors
	} from './theme-utils';

	interface Props {
		open: boolean;
		/** Tema da duplicare (nuovo) o da modificare (se `editing`). */
		base: ThemeDefinition;
		/** Id del tema custom in modifica; assente = nuovo tema. */
		editingId?: string | undefined;
		busy?: boolean;
		error?: string | null;
		onclose: () => void;
		onsave: (theme: ThemeDefinition) => void;
	}

	let { open, base, editingId, busy = false, error = null, onclose, onsave }: Props = $props();

	let name = $state('');
	// svelte-ignore state_referenced_locally
	let main = $state<MainColors>(mainColorsOf(base));

	// Ogni apertura riparte dal tema base (o da quello in modifica).
	$effect(() => {
		if (!open) return;
		name = editingId ? base.name : `${base.name} personalizzato`;
		main = mainColorsOf(base);
	});

	const draft = $derived(
		deriveTheme(base, main, { id: editingId ?? 'nuovo-tema', name: name.trim() || 'Tema' })
	);
	const checks = $derived(contrastChecks(draft));
	const previewStyle = $derived(themeStyleAttribute(draft));
	const nameError = $derived(name.trim() ? null : 'Dai un nome al tema');

	function setColor(key: EditableTokenKey, value: string) {
		main = { ...main, [key]: value.toUpperCase() };
	}

	function save() {
		if (nameError) return;
		// Stessa validazione del server: solo token #RRGGBB, schemaVersion 1, mai CSS libero.
		const parsed = themeDefinitionSchema.safeParse(draft);
		if (parsed.success) onsave(parsed.data);
	}
</script>

<BottomSheet
	{open}
	title={editingId ? 'Modifica tema' : 'Nuovo tema'}
	subtitle={editingId ? 'Cambia i colori principali' : `Parte da «${base.name}»`}
	{onclose}
>
	<div class="editor">
		<TextField
			label="Nome del tema"
			name="theme-name"
			bind:value={name}
			error={nameError}
			maxlength={80}
		/>

		<div class="preview" style={previewStyle} data-testid="theme-preview">
			<p class="preview-title">Il nome del vento</p>
			<p class="preview-text">Patrick Rothfuss · 62% letto</p>
			<div class="preview-row">
				<span class="preview-pill">Continua a leggere</span>
				<span class="preview-chip">Fantasy</span>
			</div>
		</div>

		<div class="colors">
			{#each EDITABLE_TOKENS as token (token.key)}
				<label class="color">
					<span class="color-label">{token.label}</span>
					<span class="color-input">
						<input
							type="color"
							value={main[token.key].toLowerCase()}
							data-token={token.key}
							oninput={(event) => setColor(token.key, event.currentTarget.value)}
						/>
						<code>{main[token.key]}</code>
					</span>
				</label>
			{/each}
		</div>

		<ul class="checks" aria-label="Leggibilità">
			{#each checks as check (check.label)}
				<li class:bad={!check.ok}>
					<span>{check.label}</span>
					<span>{check.ratio.toFixed(1)}:1 · {check.ok ? 'leggibile' : 'poco leggibile'}</span>
				</li>
			{/each}
		</ul>

		{#if error}<p class="error" role="alert">{error}</p>{/if}
	</div>

	{#snippet footer()}
		<Button variant="secondary" fullWidth disabled={busy} onclick={onclose}>Annulla</Button>
		<Button fullWidth loading={busy} disabled={nameError !== null} onclick={save}>Salva</Button>
	{/snippet}
</BottomSheet>

<style>
	.editor {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-height: 58dvh;
		overflow-y: auto;
		padding: 4px 2px 2px;
	}

	.preview {
		padding: 16px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: var(--color-background);
		color: var(--color-text-primary);
	}

	.preview-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: 20px;
		color: var(--color-primary);
	}

	.preview-text {
		margin: 2px 0 12px;
		font-size: 13px;
		color: var(--color-text-secondary);
	}

	.preview-row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.preview-pill {
		padding: 9px 16px;
		border-radius: var(--radius-pill);
		background: var(--color-primary);
		color: var(--color-on-primary);
		font-size: 14px;
		font-weight: 700;
	}

	.preview-chip {
		padding: 7px 14px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-text-primary);
		font-size: 13px;
		font-weight: 700;
	}

	.colors {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}

	.color {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.color-label {
		font-size: 13px;
		font-weight: 700;
	}

	.color-input {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: var(--tap-size);
		padding: 4px 10px 4px 4px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface-elevated);
	}

	input[type='color'] {
		width: 36px;
		height: 36px;
		padding: 0;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		cursor: pointer;
	}

	code {
		font-size: 13px;
		color: var(--color-text-secondary);
	}

	.checks {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 13px;
	}

	.checks li {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		color: var(--color-text-secondary);
	}

	.checks li.bad {
		color: var(--color-danger);
		font-weight: 700;
	}

	.error {
		margin: 0;
		font-size: 14px;
		color: var(--color-danger);
	}
</style>
