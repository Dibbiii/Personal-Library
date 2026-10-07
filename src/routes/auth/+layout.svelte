<script lang="ts">
	import { page } from '$app/state';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
	const registering = $derived(page.url.pathname === '/auth/register');
</script>

<svelte:head>
	<meta
		name="description"
		content="Organizza la tua libreria, segui le tue letture e conserva ogni storia in un unico posto."
	/>
</svelte:head>

<main class="auth">
	<section class="story" aria-labelledby="brand-title">
		<a class="brand" href="/" aria-label="Segnalibro, pagina iniziale">
			<span class="brand-mark"><Icon name="bookmark" size={22} strokeWidth={2.2} /></span>
			<span id="brand-title">Segnalibro</span>
		</a>

		<div class="story-content">
			<p class="eyebrow">La tua libreria personale</p>
			<h1>{registering ? 'Ogni grande storia inizia da una pagina.' : 'Ritrova tutte le tue storie.'}</h1>
			<p class="intro">
				{registering
					? 'Crea il tuo spazio di lettura, organizza i libri e trasforma ogni pagina in un ricordo.'
					: 'La tua libreria, i progressi e le prossime letture sono qui, esattamente dove li avevi lasciati.'}
			</p>

			<ul aria-label="Funzionalità principali">
				<li><Icon name="book-open" size={18} /><span>Organizza ogni libro in un solo posto</span></li>
				<li><Icon name="bar-chart" size={18} /><span>Segui progressi, obiettivi e abitudini</span></li>
				<li><Icon name="bingo-sparkle" size={18} /><span>Costruisci una libreria davvero tua</span></li>
			</ul>
		</div>

		<p class="story-footer">Il tuo prossimo capitolo è già qui.</p>
	</section>

	<section class="form-panel" aria-label={registering ? 'Registrazione' : 'Accesso'}>
		<div class="form-shell">{@render children()}</div>
	</section>
</main>

<style>
	.auth {
		display: grid;
		grid-template-columns: minmax(0, 0.96fr) minmax(500px, 1.04fr);
		min-height: 100dvh;
		background: var(--color-surface-elevated);
	}

	.story {
		position: relative;
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		min-height: 100dvh;
		padding: clamp(30px, 4vw, 56px);
		overflow: hidden;
		background:
			radial-gradient(circle at 88% 12%, color-mix(in srgb, var(--color-on-primary) 14%, transparent), transparent 28%),
			linear-gradient(145deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 72%, var(--color-text-primary)));
		color: var(--color-on-primary);
	}

	.story::after {
		position: absolute;
		right: -12%;
		bottom: -20%;
		width: min(42vw, 560px);
		aspect-ratio: 1;
		border: 1px solid color-mix(in srgb, var(--color-on-primary) 16%, transparent);
		border-radius: 50%;
		box-shadow:
			0 0 0 64px color-mix(in srgb, var(--color-on-primary) 4%, transparent),
			0 0 0 128px color-mix(in srgb, var(--color-on-primary) 3%, transparent);
		content: '';
		pointer-events: none;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		align-self: flex-start;
		gap: 12px;
		color: inherit;
		font-family: var(--font-display);
		font-size: 28px;
		line-height: 1;
		text-decoration: none;
	}

	.brand-mark {
		display: grid;
		place-items: center;
		width: 42px;
		height: 42px;
		border: 1px solid color-mix(in srgb, var(--color-on-primary) 24%, transparent);
		border-radius: 13px;
		background: color-mix(in srgb, var(--color-on-primary) 12%, transparent);
	}

	.story-content {
		position: relative;
		z-index: 1;
		width: min(100%, 560px);
		margin: auto 0;
	}

	.eyebrow {
		margin: 0 0 20px;
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		opacity: 0.78;
	}

	h1 {
		max-width: 12ch;
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(44px, 4.2vw, 64px);
		font-weight: 400;
		line-height: 1.02;
		letter-spacing: -0.035em;
	}

	.intro {
		max-width: 52ch;
		margin: 24px 0 0;
		font-size: clamp(15px, 1.25vw, 18px);
		line-height: 1.65;
		opacity: 0.82;
	}

	ul {
		display: grid;
		gap: 14px;
		margin: 30px 0 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 14px;
		font-weight: 650;
	}

	li :global(svg) {
		opacity: 0.78;
	}

	.story-footer {
		position: relative;
		z-index: 1;
		margin: 0;
		font-size: 13px;
		opacity: 0.64;
	}

	.form-panel {
		display: grid;
		place-items: center;
		box-sizing: border-box;
		min-width: 0;
		min-height: 100dvh;
		padding: clamp(32px, 6vw, 88px);
		background: var(--color-surface-elevated);
	}

	.form-shell {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 24px;
		width: min(100%, 440px);
	}

	@media (max-width: 900px) {
		.auth {
			display: block;
			background: var(--color-surface-elevated);
		}

		.story {
			min-height: auto;
			padding: 24px var(--page-gutter) 28px;
			border-radius: 0 0 28px 28px;
		}

		.story-content {
			margin: 44px 0 0;
		}

		.eyebrow,
		.intro,
		ul,
		.story-footer {
			display: none;
		}

		h1 {
			max-width: 14ch;
			font-size: clamp(34px, 9vw, 48px);
			line-height: 1.04;
		}

		.form-panel {
			min-height: auto;
			padding: 36px var(--page-gutter) 48px;
		}
	}
</style>
