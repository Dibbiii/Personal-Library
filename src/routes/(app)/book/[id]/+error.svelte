<script lang="ts">
	import { page } from '$app/state';
	import Button from '$lib/components/ui/Button.svelte';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head><title>{notFound ? 'Libro non trovato' : 'Errore'} · Segnalibro</title></svelte:head>

<section class="error" data-testid="book-error">
	<h1>{notFound ? 'Libro non trovato' : 'Non riesco a caricare il libro'}</h1>
	<p>
		{notFound
			? 'Questo libro non è nella tua libreria: forse è stato rimosso o il link non è corretto.'
			: 'Controlla la connessione e riprova tra un momento.'}
	</p>
	<div class="actions">
		{#if !notFound}<Button variant="secondary" onclick={() => location.reload()}>Riprova</Button
			>{/if}
		<Button href="/library">Torna alla libreria</Button>
	</div>
</section>

<style>
	.error {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		max-width: 420px;
		min-height: 70dvh;
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

	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 10px;
	}
</style>
