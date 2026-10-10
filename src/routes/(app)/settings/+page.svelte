<script lang="ts">
	import AccountSection from '$lib/components/settings/AccountSection.svelte';
	import AppearancePicker from '$lib/components/settings/AppearancePicker.svelte';
	import ChoiceGroup from '$lib/components/settings/ChoiceGroup.svelte';
	import DeleteAccountSheet from '$lib/components/settings/DeleteAccountSheet.svelte';
	import InstallPanel from '$lib/components/settings/InstallPanel.svelte';
	import GenreShelvesEditor from '$lib/components/settings/GenreShelvesEditor.svelte';
	import SettingsCard from '$lib/components/settings/SettingsCard.svelte';
	import SyncPanel from '$lib/components/settings/SyncPanel.svelte';
	import ThemeEditor from '$lib/components/settings/ThemeEditor.svelte';
	import ThemePicker from '$lib/components/settings/ThemePicker.svelte';
	import {
		applyMotionPreference,
		applySelection,
		rememberCustomTheme,
		sendJson,
		setCookie
	} from '$lib/components/settings/preferences';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import {
		SHELF_COOKIE,
		type MotionPreference,
		type ShelfMode,
		type UserGenreShelf,
		type UserSettings
	} from '$lib/contracts/settings';
	import type { ThemeDefinition, ThemeSelection } from '$lib/contracts/themes';
	import { getThemeController } from '$lib/themes/controller.svelte';
	import { forgetOutboxUser } from '$lib/offline/outbox';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const theme = getThemeController();

	// Stato locale inizializzato dai dati del server: da qui in poi è la pagina a comandare.
	/* svelte-ignore state_referenced_locally */
	let custom = $state<ThemeDefinition[]>([...data.custom]);
	/* svelte-ignore state_referenced_locally */
	let settings = $state<UserSettings>(data.settings);

	let message = $state<{ kind: 'ok' | 'error'; text: string } | null>(null);
	let themeBusy = $state(false);
	/* svelte-ignore state_referenced_locally */
	let genreShelves = $state<UserGenreShelf[]>(data.genreShelves.map((genre) => ({ ...genre })));
	let genreShelvesBusy = $state(false);

	function say(kind: 'ok' | 'error', text: string) {
		message = { kind, text };
	}

	// ---- Tema ------------------------------------------------------------

	const allThemes = $derived([...data.builtins, ...custom]);
	const activeTheme = $derived(allThemes.find((t) => t.id === theme.key) ?? data.builtins[0]!);

	async function chooseTheme(target: ThemeDefinition, kind: 'builtin' | 'custom') {
		if (target.id === theme.key || themeBusy) return;
		const previous: ThemeSelection = settings.selection;
		const selection: ThemeSelection =
			kind === 'builtin' ? { kind: 'builtin', key: target.id } : { kind: 'custom', id: target.id };

		// Cambio immediato, senza reload; poi si salva sul profilo.
		applySelection(theme, selection, custom);
		themeBusy = true;
		try {
			const saved = await sendJson<{ selection: ThemeSelection }>(
				'/api/settings/theme',
				'PUT',
				selection
			);
			settings = { ...settings, selection: saved.selection };
			say('ok', `Tema «${target.name}» attivo.`);
		} catch (cause) {
			applySelection(theme, previous, custom);
			say('error', cause instanceof Error ? cause.message : 'Non sono riuscito a salvare il tema.');
		} finally {
			themeBusy = false;
		}
	}

	// Editor dei temi custom
	let editorOpen = $state(false);
	/* svelte-ignore state_referenced_locally */
	let editorBase = $state<ThemeDefinition>(data.builtins[0]!);
	let editingId = $state<string | undefined>(undefined);
	let editorBusy = $state(false);
	let editorError = $state<string | null>(null);

	function openCreate() {
		editorBase = activeTheme;
		editingId = undefined;
		editorError = null;
		editorOpen = true;
	}

	function openEdit(target: ThemeDefinition) {
		editorBase = target;
		editingId = target.id;
		editorError = null;
		editorOpen = true;
	}

	async function saveCustom(definition: ThemeDefinition) {
		editorBusy = true;
		editorError = null;
		try {
			const body = editingId ? { theme: definition, id: editingId } : { theme: definition };
			const { theme: saved } = await sendJson<{ theme: ThemeDefinition }>(
				'/api/settings/themes',
				'POST',
				body
			);
			custom = editingId ? custom.map((t) => (t.id === saved.id ? saved : t)) : [...custom, saved];
			editorOpen = false;

			// Nuovo tema, oppure modifica del tema in uso: si applica subito.
			if (!editingId || theme.key === saved.id) {
				await chooseTheme(saved, 'custom');
				if (theme.key === saved.id) {
					theme.applyCustom(saved);
					rememberCustomTheme(saved);
				}
			}
			say('ok', `Tema «${saved.name}» salvato.`);
		} catch (cause) {
			editorError = cause instanceof Error ? cause.message : 'Non sono riuscito a salvare il tema.';
		} finally {
			editorBusy = false;
		}
	}

	let toDelete = $state<ThemeDefinition | null>(null);
	let deleteBusy = $state(false);

	async function deleteCustom() {
		const target = toDelete;
		if (!target) return;
		deleteBusy = true;
		try {
			// Il tema selezionato non si può eliminare: prima si torna al tema predefinito.
			if (theme.key === target.id) {
				const fallback = data.builtins[0]!;
				applySelection(theme, { kind: 'builtin', key: fallback.id }, custom);
				settings = await sendJson<{ selection: ThemeSelection }>('/api/settings/theme', 'PUT', {
					kind: 'builtin',
					key: fallback.id
				}).then((r) => ({ ...settings, selection: r.selection }));
			}
			await sendJson<{ ok: true }>(`/api/settings/themes/${target.id}`, 'DELETE');
			custom = custom.filter((t) => t.id !== target.id);
			toDelete = null;
			say('ok', `Tema «${target.name}» eliminato.`);
		} catch (cause) {
			say(
				'error',
				cause instanceof Error ? cause.message : 'Non sono riuscito a eliminare il tema.'
			);
		} finally {
			deleteBusy = false;
		}
	}

	// ---- Scaffali e movimento ---------------------------------------------

	const SHELF_OPTIONS = [
		{
			value: 'hybrid',
			label: 'Misto',
			description: 'Dorsi per la libreria, copertine dove servono'
		},
		{ value: 'spines', label: 'Solo dorsi', description: 'Scaffali come una libreria vera' },
		{
			value: 'covers',
			label: 'Solo copertine',
			description: 'Più immagine, meno libri per scaffale'
		}
	] as const;

	const MOTION_OPTIONS = [
		{
			value: 'system',
			label: 'Segui il dispositivo',
			description: 'Usa l’impostazione di sistema'
		},
		{ value: 'reduce', label: 'Ridotto', description: 'Niente animazioni non essenziali' },
		{ value: 'full', label: 'Pieno', description: 'Animazioni sempre attive' }
	] as const;
	let preferencesBusy = $state(false);

	async function patchSettings(
		patch: { shelfMode: ShelfMode } | { motionPreference: MotionPreference },
		confirmation: string
	) {
		if (preferencesBusy) return;
		preferencesBusy = true;
		const previous = settings;
		settings = { ...settings, ...patch };
		if ('motionPreference' in patch) applyMotionPreference(patch.motionPreference);
		if ('shelfMode' in patch) setCookie(SHELF_COOKIE, patch.shelfMode);
		try {
			const result = await sendJson<{ settings: UserSettings }>('/api/settings', 'PATCH', patch);
			settings = result.settings;
			say('ok', confirmation);
		} catch (cause) {
			settings = previous;
			applyMotionPreference(previous.motionPreference);
			setCookie(SHELF_COOKIE, previous.shelfMode);
			say('error', cause instanceof Error ? cause.message : 'Non sono riuscito a salvare.');
		} finally {
			preferencesBusy = false;
		}
	}

	// ---- Scaffali personali -------------------------------------------------

	async function saveGenreShelves(genres: UserGenreShelf[]) {
		genreShelvesBusy = true;
		try {
			const result = await sendJson<{ genres: UserGenreShelf[] }>('/api/settings/genres', 'PUT', {
				genres: genres.map(({ slug, name, sortOrder }) => ({ slug, name, sortOrder }))
			});
			genreShelves = result.genres;
			say('ok', 'Scaffali aggiornati.');
		} catch (cause) {
			say(
				'error',
				cause instanceof Error ? cause.message : 'Non sono riuscito a salvare gli scaffali.'
			);
		} finally {
			genreShelvesBusy = false;
		}
	}

	// ---- Account ------------------------------------------------------------

	let deleteSheetOpen = $state(false);
	let accountBusy = $state(false);
	let accountError = $state<string | null>(null);

	async function deleteAccount(input: { email: string; password: string }) {
		accountBusy = true;
		accountError = null;
		try {
			await sendJson<{ ok: true }>('/api/account', 'DELETE', input);
			// L'account non esiste più: via cache, coda e preferenze locali, poi al login.
			await Promise.allSettled([caches.delete('sb-pages'), forgetOutboxUser()]);
			rememberCustomTheme(null);
			window.location.assign('/auth/login');
		} catch (cause) {
			accountError =
				cause instanceof Error ? cause.message : 'Non sono riuscito a eliminare l’account.';
			accountBusy = false;
		}
	}
</script>

<svelte:head><title>Impostazioni · Segnalibro</title></svelte:head>

<PageHeader title="Impostazioni" backHref="/library" />

<div class="page">
	<div class="status" role="status" aria-live="polite">
		{#if message}
			<p class="message" class:error={message.kind === 'error'}>{message.text}</p>
		{/if}
	</div>

	<div class="sections">
		<SettingsCard icon="user" title="Account">
			<AccountSection
				displayName={settings.displayName ?? ''}
				email={data.email}
				onsaved={(name) => {
					settings = { ...settings, displayName: name };
					say('ok', 'Nome aggiornato.');
				}}
			/>
		</SettingsCard>

		<SettingsCard icon="sun" title="Modalità di visualizzazione">
			<AppearancePicker />
		</SettingsCard>

		<SettingsCard icon="image" title="Palette" wide>
			<ThemePicker
				builtins={data.builtins}
				{custom}
				activeKey={theme.key}
				disabled={themeBusy}
				onselect={chooseTheme}
				oncreate={openCreate}
				onedit={openEdit}
				ondelete={(t) => (toDelete = t)}
			/>
		</SettingsCard>

		<SettingsCard icon="library" title="I tuoi scaffali" wide>
			<GenreShelvesEditor genres={genreShelves} busy={genreShelvesBusy} onsave={saveGenreShelves} />
		</SettingsCard>

		<SettingsCard icon="library" title="Visualizzazione scaffali">
			<ChoiceGroup
				legend="Modalità degli scaffali"
				name="shelf-mode"
				options={SHELF_OPTIONS}
				value={settings.shelfMode}
				disabled={preferencesBusy}
				onchange={(value) => patchSettings({ shelfMode: value }, 'Scaffali aggiornati.')}
			/>
		</SettingsCard>

		<SettingsCard icon="flame" title="Movimento">
			<ChoiceGroup
				legend="Animazioni"
				name="motion"
				options={MOTION_OPTIONS}
				value={settings.motionPreference}
				disabled={preferencesBusy}
				onchange={(value) => patchSettings({ motionPreference: value }, 'Movimento aggiornato.')}
			/>
		</SettingsCard>

		<SettingsCard icon="smartphone" title="App">
			<InstallPanel />
		</SettingsCard>

		<SettingsCard icon="check" title="Sincronizzazione" id="sincronizzazione">
			<SyncPanel />
		</SettingsCard>

		<SettingsCard icon="lock" title="Privacy e dati" wide>
			<p class="intro">
				La tua libreria è privata: nessuna pagina pubblica, solo tu puoi vedere i tuoi dati. Puoi
				scaricarli o cancellare l’account quando vuoi.
			</p>
			<div class="buttons">
				<a class="download" href="/api/export/json" download data-testid="export-json">
					Esporta tutto (JSON)
				</a>
				<a class="download" href="/api/export/csv" download data-testid="export-csv">
					Esporta i libri (CSV)
				</a>
			</div>
			<div class="danger-zone">
				<h3>Elimina account</h3>
				<p>Cancella per sempre il tuo account e tutti i dati collegati.</p>
				<button
					type="button"
					class="danger"
					onclick={() => ((accountError = null), (deleteSheetOpen = true))}
				>
					Elimina il mio account
				</button>
			</div>
		</SettingsCard>
	</div>
</div>

<ThemeEditor
	open={editorOpen}
	base={editorBase}
	{editingId}
	busy={editorBusy}
	error={editorError}
	onclose={() => (editorOpen = false)}
	onsave={saveCustom}
/>

<ConfirmDialog
	open={toDelete !== null}
	title={`Eliminare il tema «${toDelete?.name ?? ''}»?`}
	description={toDelete?.id === theme.key
		? 'Il tema è in uso: tornerai a quello predefinito.'
		: 'Questa azione non si può annullare.'}
	confirmLabel="Elimina"
	busy={deleteBusy}
	onconfirm={deleteCustom}
	oncancel={() => (toDelete = null)}
/>

<DeleteAccountSheet
	open={deleteSheetOpen}
	email={data.email}
	busy={accountBusy}
	error={accountError}
	onclose={() => (deleteSheetOpen = false)}
	onconfirm={deleteAccount}
/>

<style>
	.page {
		padding: 0 var(--page-gutter) 32px;
	}

	.status {
		min-height: 28px;
		margin-bottom: 8px;
	}

	.message {
		display: inline-block;
		margin: 0;
		padding: 6px 14px;
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-success);
		font-size: 14px;
		font-weight: 700;
	}

	.message.error {
		color: var(--color-danger);
	}

	.sections {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 16px;
		align-items: start;
	}

	@media (min-width: 1024px) {
		.sections {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 20px;
		}
	}

	.intro {
		margin: 0 0 14px;
		font-size: 15px;
		line-height: 1.45;
	}

	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.download {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		min-height: var(--tap-size);
		padding: 0 20px;
		border: 1.5px solid var(--color-primary-outline);
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--color-primary);
		font-size: 15px;
		font-weight: 700;
		text-decoration: none;
	}

	.download:hover {
		background: var(--color-primary-tint);
	}

	.danger-zone {
		margin-top: 22px;
		padding-top: 18px;
		border-top: 1px solid var(--color-divider);
	}

	h3 {
		font-size: 18px;
		color: var(--color-danger);
	}

	.danger-zone p {
		margin: 4px 0 12px;
		font-size: 14px;
		color: var(--color-text-secondary);
	}

	.danger {
		min-height: var(--tap-size);
		padding: 0 20px;
		border: 1.5px solid var(--color-danger);
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--color-danger);
		font-size: 15px;
		font-weight: 700;
	}

	.danger:hover {
		background: color-mix(in srgb, var(--color-danger) 10%, transparent);
	}
</style>
