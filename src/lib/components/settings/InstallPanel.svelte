<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { installState } from '$lib/offline/install.svelte';

	let message = $state<string | null>(null);

	async function install() {
		const outcome = await installState.install();
		message =
			outcome === 'accepted'
				? 'App installata.'
				: outcome === 'dismissed'
					? 'Installazione annullata: puoi riprovare quando vuoi.'
					: null;
	}
</script>

<div class="panel" data-testid="install-panel">
	{#if installState.installed}
		<p class="status">L’app è installata su questo dispositivo.</p>
	{:else if installState.canPrompt}
		<p class="status">Installa Segnalibro per aprirla come un’app, a schermo intero.</p>
		<Button onclick={install}>Installa app</Button>
	{:else if installState.isIos}
		<p class="status">Su iPhone e iPad: tocca Condividi e poi «Aggiungi alla schermata Home».</p>
	{:else}
		<p class="status">
			L’installazione non è disponibile in questo browser o è già stata proposta. Puoi usare il menu
			del browser («Installa app» o «Aggiungi a schermata Home»).
		</p>
	{/if}

	<p class="hint" data-testid="offline-ready">
		{installState.offlineReady
			? 'Funzionamento offline attivo: le pagine già visitate si aprono senza rete.'
			: 'Funzionamento offline in preparazione: ricarica la pagina con la rete attiva.'}
	</p>
	{#if message}<p class="hint" role="status">{message}</p>{/if}
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
	}

	.status,
	.hint {
		margin: 0;
		font-size: 15px;
		line-height: 1.4;
	}

	.hint {
		font-size: 13px;
		color: var(--color-text-secondary);
	}
</style>
