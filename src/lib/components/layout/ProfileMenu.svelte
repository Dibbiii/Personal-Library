<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import AppearancePicker from '$lib/components/settings/AppearancePicker.svelte';
	import { applySelection, sendJson } from '$lib/components/settings/preferences';
	import { getThemeController } from '$lib/themes/controller.svelte';
	import { builtinThemes } from '$lib/themes/registry';

	interface Props {
		label: string;
		mobile?: boolean;
	}

	let { label, mobile = false }: Props = $props();
	const panelId = $props.id();
	const theme = getThemeController();
	const palette = $derived(builtinThemes[theme.key]);
	const email = $derived(page.data.user?.email);
	let trigger: HTMLButtonElement;
	let dialog = $state<HTMLDialogElement>();
	let dropdown = $state<HTMLDivElement>();
	let opened = $state(false);
	let supportsPopover = $state(false);
	let position = $state('');
	let busy = $state(false);
	let error = $state('');

	onMount(() => {
		supportsPopover = 'popover' in HTMLElement.prototype;
	});

	function positionDropdown() {
		const rect = trigger.getBoundingClientRect();
		position = `left:${rect.right + 8}px;bottom:${Math.max(12, window.innerHeight - rect.bottom)}px;`;
	}

	function openProfile() {
		if (mobile) opened = true;
		else {
			positionDropdown();
			if (!supportsPopover) {
				opened = true;
				dialog?.showModal();
			}
		}
	}

	function closeProfile() {
		if (!mobile) {
			if (supportsPopover) dropdown?.hidePopover();
			else dialog?.close();
		}
		opened = false;
	}

	function onResize() {
		if (matchMedia('(min-width: 1024px)').matches === mobile) closeProfile();
		else if (!mobile && opened) positionDropdown();
	}

	async function choosePalette(key: string) {
		if (busy || key === theme.key) return;
		busy = true;
		error = '';
		try {
			const selection = { kind: 'builtin' as const, key };
			await sendJson('/api/settings/theme', 'PUT', selection);
			applySelection(theme, selection, []);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Non è stato possibile salvare la palette.';
		} finally {
			busy = false;
		}
	}
</script>

<button
	bind:this={trigger}
	class="profile-trigger"
	class:mobile
	type="button"
	aria-haspopup="dialog"
	aria-expanded={opened}
	popovertarget={!mobile && supportsPopover ? panelId : undefined}
	onclick={openProfile}
>
	<Icon name="user" size={22} />
	<span>{mobile ? 'Profilo' : label}</span>
	{#if !mobile}
		<span class="trigger-chevron" aria-hidden="true"><Icon name="chevron-up" size={16} /></span>
	{/if}
</button>

{#snippet identity()}
	<div class="identity" class:sheet={mobile}>
		<span class="avatar" aria-hidden="true">{label.trim().charAt(0).toUpperCase()}</span>
		<div class="user-info">
			<strong>{label}</strong>
			<span>{email && email !== label ? email : 'Account Segnalibro'}</span>
		</div>
	</div>
{/snippet}

{#snippet actions()}
	<div class="actions">
		<a class="action" href="/settings" onclick={closeProfile}>
			<Icon name="settings" size={19} />
			<span>{mobile ? 'Impostazioni e modifiche' : 'Impostazioni'}</span>
			<Icon name="chevron-right" size={16} />
		</a>
		<form method="POST" action="/auth/logout">
			<button class="action logout" type="submit">
				<Icon name="logout" size={19} /><span>Esci dall’account</span>
			</button>
		</form>
	</div>
{/snippet}

{#snippet desktopContent()}
	{@render identity()}
	<div class="preferences">
		<span class="section-label">Personalizzazione</span>
		<AppearancePicker active={opened} />
		<div class="palette-row">
			<label for="{panelId}-palette">Palette</label>
			<select
				id="{panelId}-palette"
				value={theme.key}
				disabled={busy}
				onchange={(event) => choosePalette(event.currentTarget.value)}
			>
				{#if !palette}<option value={theme.key}>Personalizzata</option>{/if}
				{#each Object.values(builtinThemes) as option (option.id)}
					<option value={option.id}>{option.name}</option>
				{/each}
			</select>
		</div>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
	</div>
	{@render actions()}
{/snippet}

{#if mobile}
	<BottomSheet open={opened} title="Profilo" onclose={closeProfile}>
		<button class="sheet-close" type="button" aria-label="Chiudi profilo" onclick={closeProfile}>
			<Icon name="close" size={22} />
		</button>
		{@render identity()}
		<p class="profile-hint">Gestisci il tuo account e personalizza la tua libreria.</p>
		{@render actions()}
	</BottomSheet>
{:else if supportsPopover}
	<div
		bind:this={dropdown}
		id={panelId}
		class="profile-dropdown"
		popover="auto"
		role="dialog"
		aria-label="Profilo e impostazioni"
		style={position}
		ontoggle={(event) => (opened = event.newState === 'open')}
	>
		{@render desktopContent()}
	</div>
{:else}
	<dialog
		bind:this={dialog}
		class="profile-dropdown"
		aria-label="Profilo e impostazioni"
		style={position}
		onclose={() => (opened = false)}
	>
		<button class="fallback-close" type="button" onclick={closeProfile}>Chiudi</button>
		{@render desktopContent()}
	</dialog>
{/if}

<svelte:window onresize={onResize} />

<style>
	.profile-trigger {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 48px;
		padding: 0 14px;
		border: 0;
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--nav-ink, var(--color-nav-inactive));
		font-size: 14px;
		font-weight: 600;
		text-align: left;
	}
	.profile-trigger > span {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.profile-trigger {
		transition:
			background-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}
	.profile-trigger:hover,
	.profile-trigger[aria-expanded='true'] {
		background: var(--color-surface);
		color: var(--color-text-primary);
	}
	.profile-trigger:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
	.trigger-chevron {
		display: grid;
		place-items: center;
		transition: transform var(--duration-fast) var(--ease-out);
	}
	.profile-trigger[aria-expanded='true'] .trigger-chevron {
		transform: rotate(180deg);
	}
	.profile-trigger.mobile {
		flex: 1;
		flex-direction: column;
		justify-content: center;
		gap: 4px;
		padding: 0;
		min-width: var(--tap-size);
		font-size: 12px;
	}
	.profile-trigger.mobile > span {
		flex: 0;
	}
	.profile-dropdown {
		position: fixed;
		inset: auto;
		box-sizing: border-box;
		width: 320px;
		max-width: calc(100vw - var(--sidebar-width) - 32px);
		max-height: calc(100dvh - 24px);
		margin: 0;
		padding: 8px;
		border: 1px solid color-mix(in srgb, var(--color-border) 72%, transparent);
		border-radius: 20px;
		background: var(--color-surface-elevated);
		color: var(--color-text-primary);
		box-shadow:
			0 20px 48px color-mix(in srgb, var(--color-shadow) 18%, transparent),
			0 4px 12px color-mix(in srgb, var(--color-shadow) 10%, transparent);
		overflow: auto;
		transform-origin: left bottom;
	}
	.profile-dropdown:popover-open {
		animation: dropdown-in 160ms var(--ease-out);
	}
	@keyframes dropdown-in {
		from {
			opacity: 0;
			transform: translateX(-6px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateX(0) scale(1);
		}
	}
	.identity {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 12px 16px;
		border-radius: 14px;
		background: linear-gradient(135deg, var(--color-primary-subtle), transparent);
	}
	.avatar {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 42px;
		height: 42px;
		border: 1px solid color-mix(in srgb, var(--color-primary) 18%, transparent);
		border-radius: 50%;
		background: var(--color-surface-elevated);
		color: var(--color-primary);
		font-size: 17px;
		font-weight: 700;
	}
	.user-info {
		display: grid;
		gap: 3px;
		min-width: 0;
	}
	.user-info strong,
	.user-info span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.user-info strong {
		font-size: 15px;
		font-weight: 700;
	}
	.user-info span {
		font-size: 12px;
		color: var(--color-text-secondary);
	}
	.preferences {
		display: grid;
		gap: 10px;
		padding: 16px 10px 12px;
	}
	.section-label {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-text-secondary);
	}
	.palette-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		font-size: 13px;
	}
	select {
		max-width: 180px;
		min-height: 40px;
		padding: 6px 30px 6px 10px;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		background: var(--color-surface);
		color: var(--color-text-primary);
		font: inherit;
		font-size: 13px;
	}
	select:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
	.actions {
		padding: 8px 0 0;
		border-top: 1px solid var(--color-divider);
	}
	.action {
		display: flex;
		align-items: center;
		gap: 10px;
		box-sizing: border-box;
		width: 100%;
		min-height: 44px;
		padding: 8px 10px;
		border: 0;
		border-radius: 10px;
		background: transparent;
		color: var(--color-text-primary);
		font-size: 13px;
		font-weight: 600;
		text-align: left;
		text-decoration: none;
		transition:
			background-color var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}
	.action span {
		flex: 1;
	}
	.action:hover {
		background: var(--color-surface);
		transform: translateX(2px);
	}
	.action:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}
	.logout {
		color: var(--color-danger);
	}
	.error {
		margin: 0;
		font-size: 12px;
		color: var(--color-danger);
	}
	.sheet-close {
		position: absolute;
		top: 20px;
		right: 14px;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 0;
		border-radius: 50%;
		background: transparent;
	}
	.identity.sheet {
		padding: 20px 14px;
		gap: 14px;
	}
	.sheet .avatar {
		width: 48px;
		height: 48px;
		font-size: 20px;
	}
	.sheet .user-info strong {
		font-size: 17px;
	}
	.sheet .user-info span {
		font-size: 14px;
	}
	.profile-hint {
		margin: 0 0 20px;
		color: var(--color-text-secondary);
		font-size: 14px;
	}
	.fallback-close {
		display: block;
		margin-left: auto;
		border: 0;
		background: transparent;
		font-size: 12px;
	}

	@media (prefers-reduced-motion: reduce) {
		.profile-dropdown:popover-open {
			animation: none;
		}
		.trigger-chevron,
		.action {
			transition: none;
		}
	}
</style>
