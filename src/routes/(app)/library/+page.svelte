<script lang="ts">
	import GenreShelf from '$lib/components/library/GenreShelf.svelte';
	import HomeHeader from '$lib/components/library/HomeHeader.svelte';
	import ReadingNow from '$lib/components/library/ReadingNow.svelte';
	import UpNextQueue from '$lib/components/library/UpNextQueue.svelte';
	import { HomeDnd } from '$lib/components/library/home-dnd.svelte';
	import { HomeState } from '$lib/components/library/home-state.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally
	const home = new HomeState(data.home);
	const dnd = new HomeDnd(home);

	// Dopo un invalidate() la risposta cambia: riallinea lo stato locale.
	// svelte-ignore state_referenced_locally
	let loaded = data.home;
	$effect(() => {
		if (data.home === loaded) return;
		loaded = data.home;
		home.apply(data.home);
	});

	// Messaggi di esito (spostamenti, errori): spariscono da soli.
	$effect(() => {
		if (!home.message) return;
		const timer = setTimeout(() => (home.message = ''), 4500);
		return () => clearTimeout(timer);
	});
</script>

<svelte:head><title>Libreria · Segnalibro</title></svelte:head>

<div class="home">
	<HomeHeader name={data.user?.displayName ?? null} />

	<div class="top">
		<ReadingNow items={home.reading} />
		<div class="queue"><UpNextQueue {home} {dnd} /></div>
	</div>

	<div class="shelves">
		{#each home.shelves as shelf (shelf.genre.slug)}
			<GenreShelf {shelf} {home} {dnd} />
		{/each}
	</div>

	<p class="toast" role="status" aria-live="polite" class:visible={home.message !== ''}>
		{home.message}
	</p>
</div>

<style>
	.home {
		position: relative;
		isolation: isolate;
		padding-top: 0;
	}

	/* "Nuvole" blush del fondo Home (mockup 3.1): qualche ellisse sfumata, nessuna posizione e' critica */
	.home::before {
		content: '';
		position: absolute;
		z-index: -1;
		inset: 0;
		pointer-events: none;
		background:
			radial-gradient(
				ellipse 130px 55px at 62% 1%,
				color-mix(in srgb, var(--color-accent) 30%, transparent),
				transparent 72%
			),
			radial-gradient(
				ellipse 120px 50px at 28% 6%,
				color-mix(in srgb, var(--color-accent) 30%, transparent),
				transparent 72%
			),
			radial-gradient(
				ellipse 115px 63px at 71% 44%,
				color-mix(in srgb, var(--color-accent) 30%, transparent),
				transparent 72%
			),
			radial-gradient(
				ellipse 130px 45px at 4% 64%,
				color-mix(in srgb, var(--color-surface) 90%, transparent),
				transparent 72%
			),
			radial-gradient(
				ellipse 95px 64px at 28% 54%,
				color-mix(in srgb, var(--color-on-genre-white) 35%, transparent),
				transparent 72%
			),
			radial-gradient(
				ellipse 146px 52px at 100% 80%,
				color-mix(in srgb, var(--color-accent) 30%, transparent),
				transparent 72%
			),
			radial-gradient(
				ellipse 110px 40px at 10% 90%,
				color-mix(in srgb, var(--color-surface) 90%, transparent),
				transparent 72%
			);
	}

	.top {
		display: flex;
		flex-direction: column;
		gap: 28px;
		padding-top: 18px;
	}

	.queue {
		min-width: 0;
	}

	.shelves {
		display: flex;
		flex-direction: column;
		gap: 26px;
		margin-top: 28px;
	}

	.toast {
		position: fixed;
		z-index: var(--z-overlay);
		left: 50%;
		bottom: calc(var(--nav-height) + 12px + env(safe-area-inset-bottom, 0px));
		max-width: min(92vw, 420px);
		margin: 0;
		padding: 10px 16px;
		border-radius: var(--radius-pill);
		background: var(--color-text-primary);
		box-shadow: var(--shadow-button);
		color: var(--color-background);
		font-size: 13px;
		font-weight: 600;
		opacity: 0;
		pointer-events: none;
		transform: translate(-50%, 8px);
		transition:
			opacity var(--duration-base) var(--ease-out),
			transform var(--duration-base) var(--ease-out);
	}

	.toast.visible {
		opacity: 1;
		transform: translate(-50%, 0);
	}

	@media (min-width: 1024px) {
		.home {
			padding-inline: 24px;
		}

		.top {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			align-items: start;
			gap: 32px;
		}

		.shelves {
			margin-top: 36px;
		}

		.toast {
			bottom: 28px;
		}
	}
</style>
