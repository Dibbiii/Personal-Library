<script lang="ts">
	import { onMount } from 'svelte';
	import {
		adoptDocumentTheme,
		CUSTOM_THEME_STORAGE_KEY,
		syncPreferencesFromProfile
	} from '$lib/components/settings/preferences';
	import { installState } from '$lib/offline/install.svelte';
	import { forgetOutboxUser, startOutbox } from '$lib/offline/outbox';
	import { getThemeController } from '$lib/themes/controller.svelte';
	import { exposeTestHook } from '$lib/offline/test-hook';
	import OfflineBanner from './OfflineBanner.svelte';

	interface Props {
		/** Utente della sessione: la outbox invia solo gli eventi di questo account. */
		userId: string | null | undefined;
	}

	let { userId }: Props = $props();
	const theme = getThemeController();

	async function cleanUpDeviceOnLogout(): Promise<void> {
		try {
			// L'HTML delle pagine visitate contiene dati personali: va via col logout.
			await Promise.all([caches.delete('sb-pages'), forgetOutboxUser()]);
			localStorage.removeItem(CUSTOM_THEME_STORAGE_KEY);
		} catch {
			// Cache API / storage non disponibili
		}
	}

	// Il prompt di installazione arriva una volta sola, spesso prima di aprire le Impostazioni.
	onMount(() => {
		adoptDocumentTheme(theme);
		return installState.start();
	});

	onMount(() => {
		if (!userId) return;

		exposeTestHook();
		const stopOutbox = startOutbox(userId);
		void syncPreferencesFromProfile(theme);

		// Logout: pulizia locale prima di inviare il form (con un tetto di attesa).
		const onSubmit = (event: SubmitEvent) => {
			const form = event.target;
			if (!(form instanceof HTMLFormElement) || form.getAttribute('action') !== '/auth/logout') {
				return;
			}
			event.preventDefault();
			void Promise.race([
				cleanUpDeviceOnLogout(),
				new Promise((resolve) => setTimeout(resolve, 1500))
			]).then(() => form.submit());
		};
		document.addEventListener('submit', onSubmit, true);

		return () => {
			stopOutbox();
			document.removeEventListener('submit', onSubmit, true);
		};
	});
</script>

<OfflineBanner />
