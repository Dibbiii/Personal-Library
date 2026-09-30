<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import type { IconName } from '$lib/components/ui/icons';

	const options: { href: string; icon: IconName; title: string; text: string }[] = [
		{
			href: '/add/scan',
			icon: 'camera',
			title: 'Scansiona l’ISBN',
			text: 'Inquadra il codice a barre sul retro: trovo io titolo, autore e copertina.'
		},
		{
			href: '/add/search',
			icon: 'search',
			title: 'Cerca per titolo o autore',
			text: 'Scegli l’edizione giusta tra i migliori risultati di Open Library e Google Books.'
		},
		{
			href: '/add/manual',
			icon: 'file-text',
			title: 'Inserisci a mano',
			text: 'Titolo, autore e poco altro. Funziona anche senza connessione ai cataloghi.'
		}
	];
</script>

<svelte:head><title>Aggiungi un libro · Segnalibro</title></svelte:head>

<div class="column">
	<PageHeader title="Aggiungi un libro" subtitle="Scegli come vuoi inserirlo" backHref="/library" />

	<nav class="options" aria-label="Modi per aggiungere un libro">
		{#each options as option (option.href)}
			<a class="option" href={option.href}>
				<span class="tile"><Icon name={option.icon} size={24} /></span>
				<span class="text">
					<span class="title">{option.title}</span>
					<span class="desc">{option.text}</span>
				</span>
				<span class="chevron" aria-hidden="true"
					><Icon name="chevron-right" size={20} strokeWidth={2.2} /></span
				>
			</a>
		{/each}
	</nav>

	<p class="note">
		Prima di aggiungerlo ti chiederò sempre genere, formato ed eventuale serie, così finisce subito
		sullo scaffale giusto.
	</p>
</div>

<style>
	.column {
		max-width: 680px;
		margin-inline: auto;
		padding-bottom: 32px;
	}

	.options {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 8px var(--page-gutter) 0;
	}

	.option {
		display: flex;
		align-items: center;
		gap: 16px;
		min-height: 88px;
		padding: 16px 16px 16px 14px;
		border-radius: var(--radius-xl);
		background: var(--color-card);
		box-shadow: var(--shadow-card);
		text-decoration: none;
		color: var(--color-text-primary);
		transition: background-color var(--duration-fast) var(--ease-out);
	}

	.option:hover {
		background: var(--color-surface);
	}

	.tile {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 52px;
		height: 52px;
		border-radius: 16px;
		background: var(--color-surface);
		color: var(--color-primary);
	}

	.option:hover .tile {
		background: var(--color-card);
	}

	.text {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}

	.title {
		font-family: var(--font-display);
		font-size: 19px;
		line-height: 1.2;
	}

	.desc {
		font-size: 13.5px;
		line-height: 1.4;
		color: var(--color-text-secondary);
	}

	.chevron {
		display: inline-flex;
		color: var(--color-nav-inactive);
	}

	.note {
		margin: 20px var(--page-gutter) 0;
		font-size: 13.5px;
		line-height: 1.45;
		color: var(--color-text-secondary);
	}
</style>
