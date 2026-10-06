<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { isGenreSlug } from '$lib/genres';
	import BottomNavigation from './BottomNavigation.svelte';
	import DesktopSidebar from './DesktopSidebar.svelte';

	interface Props {
		children: Snippet;
		userLabel?: string | null;
	}

	let { children, userLabel = null }: Props = $props();

	// Nella vista genere pagina e navigazione prendono i colori del genere (mockup 02).
	const genre = $derived.by(() => {
		const slug = page.params.slug;
		return page.route.id === '/(app)/genre/[slug]' && slug && isGenreSlug(slug) ? slug : null;
	});

	// La Home ha il fondo più caldo dei mockup (--color-background-shelf).
	const isHome = $derived(page.route.id === '/(app)/library');
</script>

<a class="skip-link" href="#main">Vai al contenuto</a>

<div class="shell" class:genre={genre !== null} class:home={isHome} data-genre={genre}>
	<DesktopSidebar {userLabel} />
	<main id="main" class="content">
		{@render children()}
	</main>
	<BottomNavigation />
</div>

<style>
	.shell {
		min-height: 100dvh;
	}

	.shell.home {
		background: var(--color-background-shelf);
	}

	.shell.genre {
		position: relative;
		background: var(--color-background-shelf);
		--nav-bg: var(--genre-current-nav-bg);
		--nav-border: var(--genre-current-nav-border);
		--nav-ink: var(--genre-current-dark);
		--nav-active-bg: var(--genre-current-dark);
		--nav-active-fg: var(--genre-current-light);
	}

	.shell.genre .content {
		position: relative;
	}

	.content {
		box-sizing: border-box;
		width: 100%;
		max-width: var(--content-max);
		margin: 0 auto;
		padding-bottom: calc(var(--nav-height) + env(safe-area-inset-bottom, 0px));
	}

	.skip-link {
		position: fixed;
		top: 8px;
		left: 8px;
		z-index: var(--z-sheet);
		padding: 10px 16px;
		border-radius: var(--radius-pill);
		background: var(--color-primary);
		color: var(--color-on-primary);
		font-weight: 700;
		text-decoration: none;
		transform: translateY(-200%);
	}

	.skip-link:focus {
		transform: none;
	}

	@media (min-width: 1024px) {
		.shell {
			padding-left: var(--sidebar-width);
		}

		.content {
			padding-bottom: 48px;
		}
	}
</style>
