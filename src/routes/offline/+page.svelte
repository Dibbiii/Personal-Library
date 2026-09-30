<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
</script>

<svelte:head><title>Sei offline · Segnalibro</title></svelte:head>

<main class="offline">
	<span class="mark"><Icon name="bookmark" size={32} strokeWidth={2} /></span>
	<h1>Sei offline</h1>
	<p>Questa pagina non è ancora salvata sul dispositivo. Appena torni online potrai aprirla.</p>
	<p class="note">
		Gli aggiornamenti di lettura che hai già inviato da una pagina aperta restano in coda e partono
		da soli alla riconnessione.
	</p>
	<div class="actions">
		<Button href="/library" size="md">Riprova</Button>
	</div>
</main>

<style>
	.offline {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 14px;
		box-sizing: border-box;
		min-height: 100dvh;
		padding: 32px var(--page-gutter);
		background: var(--color-background-shelf);
		text-align: center;
	}

	.mark {
		display: grid;
		place-items: center;
		width: 72px;
		height: 72px;
		border-radius: var(--radius-xl);
		background: var(--color-surface);
		color: var(--color-primary);
	}

	h1 {
		font-size: 32px;
		line-height: 1.1;
		color: var(--color-primary);
	}

	p {
		max-width: 34ch;
		margin: 0;
		font-size: 16px;
		line-height: 1.45;
		color: var(--color-text-primary);
	}

	.note {
		font-size: 14px;
		color: var(--color-text-secondary);
	}

	.actions {
		margin-top: 10px;
	}
</style>
