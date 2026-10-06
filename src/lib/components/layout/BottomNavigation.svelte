<script lang="ts">
	import { page } from '$app/state';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { isNavActive, NAV_ITEMS } from '$lib/navigation';
	import ProfileMenu from './ProfileMenu.svelte';
</script>

<nav class="bottom-nav" aria-label="Navigazione principale">
	{#each NAV_ITEMS as item (item.href)}
		{@const active = isNavActive(item, page.url.pathname)}
		<a class="item" class:active href={item.href} aria-current={active ? 'page' : undefined}>
			<span class="pill"><Icon name={item.icon} size={22} /></span>
			<span class="label">{item.label}</span>
		</a>
	{/each}
	<ProfileMenu label={page.data.user?.displayName ?? page.data.user?.email ?? 'Profilo'} mobile />
</nav>

<style>
	.bottom-nav {
		position: fixed;
		inset: auto 0 0 0;
		z-index: var(--z-nav);
		display: flex;
		box-sizing: border-box;
		height: calc(var(--nav-height) + env(safe-area-inset-bottom, 0px));
		padding: 8px 12px calc(14px + env(safe-area-inset-bottom, 0px));
		background: var(--nav-bg, var(--color-background));
		border-top: 1px solid var(--nav-border, var(--color-surface));
	}

	.item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		min-width: var(--tap-size);
		color: var(--nav-ink, var(--color-nav-inactive));
		text-decoration: none;
		border-radius: var(--radius-md);
	}

	.pill {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 60px;
		height: 32px;
		border-radius: 16px;
		transition:
			background-color var(--duration-base) var(--ease-out),
			color var(--duration-base) var(--ease-out);
	}

	.label {
		font-size: 12px;
		line-height: 14px;
		font-weight: 600;
	}

	.item.active {
		color: var(--nav-active-bg, var(--color-primary));
	}

	.item.active .pill {
		background: var(--nav-active-bg, var(--color-primary));
		color: var(--nav-active-fg, var(--color-on-primary));
	}

	.item.active .label {
		font-weight: 700;
	}

	@media (min-width: 1024px) {
		.bottom-nav {
			display: none;
		}
	}
</style>
