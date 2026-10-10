<script lang="ts">
	import { page } from '$app/state';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { isNavActive, NAV_ITEMS } from '$lib/navigation';
</script>

<nav class="bottom-nav" aria-label="Navigazione principale">
	{#each NAV_ITEMS as item, index (item.href)}
		{#if index === 2}
			<!-- Mantiene l'azione centrale fra le due coppie di destinazioni. -->
			<a class="add-book" href="/add" aria-label="Aggiungi libro">
				<Icon name="plus" size={28} strokeWidth={2.2} />
			</a>
		{/if}

		{@const active = isNavActive(item, page.url.pathname)}
		<a class="item" class:active href={item.href} aria-current={active ? 'page' : undefined}>
			<span class="pill"><Icon name={item.icon} size={22} /></span>
			<span class="label">{item.label}</span>
		</a>
	{/each}
</nav>

<style>
	.bottom-nav {
		position: fixed;
		inset: auto 0 0 0;
		z-index: var(--z-nav);
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 4px;
		box-sizing: border-box;
		height: calc(var(--nav-height) + env(safe-area-inset-bottom, 0px));
		padding: 8px 12px calc(14px + env(safe-area-inset-bottom, 0px));
		background: var(--nav-bg, var(--color-background));
		border-top: 1px solid var(--nav-border, var(--color-surface));
	}

	.item {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		min-inline-size: 0;
		color: var(--nav-ink, var(--color-nav-inactive));
		text-decoration: none;
		border-radius: var(--radius-md);
	}

	.pill {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 52px;
		max-width: 100%;
		height: 32px;
		border-radius: 16px;
		transition:
			background-color var(--duration-base) var(--ease-out),
			color var(--duration-base) var(--ease-out);
	}

	.label {
		max-width: 100%;
		overflow: hidden;
		font-size: 12px;
		line-height: 14px;
		font-weight: 600;
		white-space: nowrap;
		text-overflow: ellipsis;
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

	.add-book {
		display: flex;
		grid-column: 3;
		grid-row: 1;
		place-self: start center;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--nav-active-bg, var(--color-primary));
		color: var(--nav-active-fg, var(--color-on-primary));
		text-decoration: none;
		box-shadow: var(--shadow-button);
	}

	@media (min-width: 1024px) {
		.bottom-nav {
			display: none;
		}
	}
</style>
