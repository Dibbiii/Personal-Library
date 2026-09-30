<script lang="ts">
	import { page } from '$app/state';
	import Button from '$lib/components/ui/Button.svelte';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head><title>{notFound ? 'Pagina non trovata' : 'Errore'} · Segnalibro</title></svelte:head>

<section class="error">
	<h1>{notFound ? 'Pagina non trovata' : 'Qualcosa è andato storto'}</h1>
	<p>
		{notFound
			? 'Questo segnalibro non porta a nessuna pagina.'
			: 'Riprova tra un momento. Se il problema continua, torna alla libreria.'}
	</p>
	<Button href="/library">Torna alla libreria</Button>
</section>

<style>
	.error {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		max-width: 420px;
		min-height: 100dvh;
		margin: 0 auto;
		padding: 0 var(--page-gutter);
		justify-content: center;
		text-align: center;
	}

	h1 {
		font-size: 28px;
		color: var(--color-primary);
	}

	p {
		margin: 0 0 8px;
		color: var(--color-text-secondary);
	}
</style>
