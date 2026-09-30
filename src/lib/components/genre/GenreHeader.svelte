<script lang="ts">
	import type { GenreSlug } from '$lib/contracts';
	import Icon from '$lib/components/ui/Icon.svelte';

	interface Props {
		slug: GenreSlug;
		name: string;
		total: number;
		read: number;
		unread: number;
		backHref?: string;
	}

	let { slug, name, total, read, unread, backHref = '/library' }: Props = $props();

	const pills = $derived([
		`${total} ${total === 1 ? 'libro' : 'libri'}`,
		`${read} ${read === 1 ? 'letto' : 'letti'}`,
		`${unread} da leggere`
	]);
</script>

<header class="hero" data-slug={slug}>
	<div class="row">
		<a class="back" href={backHref} aria-label="Indietro">
			<Icon name="chevron-left" size={22} strokeWidth={2.2} />
		</a>
		<span class="kicker">GENERE</span>
		<span class="spacer" aria-hidden="true"></span>
	</div>
	<h1>{name}</h1>
	<ul class="pills" aria-label="Riepilogo del genere">
		{#each pills as pill (pill)}
			<li>{pill}</li>
		{/each}
	</ul>
</header>

<style>
	.hero {
		box-sizing: border-box;
		padding: 16px var(--page-gutter) 26px;
		border-radius: 0 0 32px 32px;
		background: var(--genre-current);
		color: var(--genre-current-on);
		box-shadow:
			0 16px 34px -8px color-mix(in srgb, var(--genre-current) 65%, transparent),
			0 4px 0 0 color-mix(in srgb, var(--genre-current) 50%, transparent);
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.back {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--tap-size);
		height: var(--tap-size);
		border-radius: 50%;
		background: var(--genre-current-light);
		color: var(--genre-current-dark);
		text-decoration: none;
	}

	.kicker {
		font-size: 12.5px;
		font-weight: 700;
		letter-spacing: 0.08em;
	}

	.spacer {
		width: var(--tap-size);
	}

	h1 {
		margin: 14px 0 0;
		font-size: 30px;
		line-height: 1.14;
		color: var(--genre-current-on);
	}

	/* Nel mockup il titolo di Mitologia è bianco: a 30px il contrasto (3,8:1) regge per testo grande. */
	.hero[data-slug='mythology-epic-retelling'] h1 {
		color: var(--color-on-genre-white);
	}

	.pills {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 16px 0 0;
		padding: 0;
		list-style: none;
	}

	.pills li {
		display: inline-flex;
		align-items: center;
		height: 30px;
		padding: 0 12px;
		border-radius: 15px;
		background: var(--genre-current-dark);
		color: var(--genre-current-light);
		font-size: 12.5px;
		font-weight: 700;
	}

	@media (min-width: 1024px) {
		.hero {
			padding-top: 28px;
			padding-bottom: 32px;
		}

		h1 {
			font-size: 40px;
		}
	}
</style>
