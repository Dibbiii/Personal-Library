<script lang="ts">
	import { page } from '$app/state';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { isNavActive, NAV_ITEMS } from '$lib/navigation';
	import ProfileMenu from './ProfileMenu.svelte';

	interface Props {
		/** Nome visualizzato o email dell'utente, mostrato in fondo alla sidebar. */
		userLabel?: string | null;
	}

	let { userLabel = null }: Props = $props();
</script>

<aside class="sidebar">
	<a class="brand" href="/library" aria-label="Segnalibro, vai alla libreria">
		<Icon name="bookmark" size={24} strokeWidth={2} />
		<span>Segnalibro</span>
	</a>

	<nav aria-label="Navigazione principale">
		<ul>
			{#each NAV_ITEMS as item (item.href)}
				{@const active = isNavActive(item, page.url.pathname)}
				<li>
					<a class="link" class:active href={item.href} aria-current={active ? 'page' : undefined}>
						<Icon name={item.icon} size={22} />
						<span>{item.label}</span>
					</a>
				</li>
			{/each}
			<li>
				<a
					class="link"
					class:active={page.url.pathname.startsWith('/friends')}
					href="/friends"
					aria-current={page.url.pathname.startsWith('/friends') ? 'page' : undefined}
				>
					<Icon name="users" size={22} />
					<span>Amici</span>
				</a>
			</li>
		</ul>
	</nav>

	<div class="footer">
		<ProfileMenu label={userLabel ?? 'Profilo'} />
	</div>
</aside>

<style>
	.sidebar {
		display: none;
	}

	@media (min-width: 1024px) {
		.sidebar {
			position: fixed;
			inset: 0 auto 0 0;
			z-index: var(--z-nav);
			display: flex;
			flex-direction: column;
			gap: 28px;
			box-sizing: border-box;
			width: var(--sidebar-width);
			padding: 28px 16px 20px;
			background: var(--nav-bg, var(--color-background-shelf));
			border-right: 1px solid var(--nav-border, var(--color-surface));
		}
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 12px;
		color: var(--color-primary);
		font-family: var(--font-display);
		font-size: 28px;
		line-height: 1.1;
		text-decoration: none;
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.link {
		display: flex;
		align-items: center;
		gap: 12px;
		box-sizing: border-box;
		width: 100%;
		min-height: 48px;
		padding: 0 16px;
		border: 0;
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--nav-ink, var(--color-nav-inactive));
		font-size: 15px;
		font-weight: 600;
		text-align: left;
		text-decoration: none;
		transition: background-color var(--duration-fast) var(--ease-out);
	}

	.link:hover {
		background: var(--color-surface);
	}

	.link.active {
		background: var(--nav-active-bg, var(--color-primary));
		color: var(--nav-active-fg, var(--color-on-primary));
		font-weight: 700;
	}

	.footer {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: auto;
	}
</style>
