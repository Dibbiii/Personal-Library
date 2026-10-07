<script lang="ts">
	import type { GenreSlug } from '$lib/contracts';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Decoration from '$lib/components/library/Decoration.svelte';
	import { GENRE_DECOR } from './decor';

	interface Props {
		slug: GenreSlug;
		name: string;
		total: number;
		read: number;
		unread: number;
		backHref?: string;
		addHref?: string;
	}

	let { slug, name, total, read, unread, backHref = '/library', addHref }: Props = $props();

	const pills = $derived([
		`${total} ${total === 1 ? 'libro' : 'libri'}`,
		`${read} ${read === 1 ? 'letto' : 'letti'}`,
		`${unread} da leggere`
	]);
	const decor = $derived(GENRE_DECOR[slug]);
</script>

<header class="hero" data-slug={slug}>
	<div class="row">
		<a class="back" href={backHref} aria-label="Indietro">
			<Icon name="chevron-left" size={22} strokeWidth={2.2} />
		</a>
		<span class="kicker"><span class="dot" aria-hidden="true"></span>GENERE</span>
		{#if addHref}
			<a class="add" href={addHref} aria-label="Aggiungi un libro a {name}">
				<Icon name="plus" size={20} strokeWidth={2.2} />
				<span class="add-text" aria-hidden="true">Aggiungi</span>
			</a>
		{:else}
			<span class="spacer" aria-hidden="true"></span>
		{/if}
	</div>

	<div class="main">
		<div class="titles">
			<h1>{name}</h1>
			<ul class="pills" aria-label="Riepilogo del genere">
				{#each pills as pill (pill)}
					<li>{pill}</li>
				{/each}
			</ul>
		</div>

		<!-- Piccola mensola con gli oggetti del genere (solo schermi larghi) -->
		<div class="still" aria-hidden="true">
			<div class="objects">
				{#each decor as kind, index (index)}
					<Decoration {kind} />
				{/each}
			</div>
			<div class="ledge"></div>
		</div>
	</div>
</header>

<style>
	.hero {
		position: relative;
		box-sizing: border-box;
		padding: 16px 18px 22px;
		overflow: hidden;
		border-radius: var(--radius-sheet);
		background:
			radial-gradient(
				ellipse 55% 120% at 100% 0%,
				color-mix(in srgb, var(--genre-current) 30%, transparent),
				transparent 70%
			),
			radial-gradient(
				ellipse 40% 90% at 0% 100%,
				color-mix(in srgb, var(--genre-current) 14%, transparent),
				transparent 70%
			),
			color-mix(in srgb, var(--genre-current) 10%, var(--color-surface-elevated));
		box-shadow:
			0 0 0 1px color-mix(in srgb, var(--genre-current) 22%, transparent),
			0 18px 36px -24px color-mix(in srgb, var(--genre-current-dark) 55%, transparent);
		color: var(--color-text-primary);
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.back,
	.add {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		height: max(44px, var(--tap-size));
		flex: none;
		text-decoration: none;
		transition:
			background-color var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}

	.back {
		width: max(44px, var(--tap-size));
		border-radius: 50%;
		background: var(--color-surface-elevated);
		box-shadow: 0 2px 8px color-mix(in srgb, var(--color-shadow) 8%, transparent);
		color: var(--color-text-primary);
	}

	.back:hover {
		background: var(--color-background);
	}

	.add {
		gap: 8px;
		min-width: max(44px, var(--tap-size));
		padding: 0 12px;
		border-radius: var(--radius-pill);
		background: var(--genre-current-dark);
		box-shadow: 0 6px 14px -4px color-mix(in srgb, var(--genre-current-dark) 60%, transparent);
		color: var(--genre-current-light);
		font-size: 14px;
		font-weight: 700;
	}

	.add:hover {
		background: color-mix(in srgb, var(--genre-current-dark) 82%, var(--genre-current-light));
	}

	.back:active,
	.add:active {
		transform: scale(0.95);
	}

	.back:focus-visible,
	.add:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 3px;
	}

	.add-text {
		display: none;
	}

	.kicker {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		color: var(--color-text-secondary);
		font-size: 12.5px;
		font-weight: 700;
		letter-spacing: 0.1em;
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--genre-current);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--genre-current) 22%, transparent);
	}

	.spacer {
		width: var(--tap-size);
	}

	.main {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 24px;
	}

	.titles {
		min-width: 0;
	}

	h1 {
		margin: 14px 0 0;
		color: var(--color-text-primary);
		font-family: var(--font-display);
		font-size: 32px;
		font-weight: 400;
		line-height: 1.08;
		letter-spacing: -0.01em;
	}

	.pills {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 14px 0 0;
		padding: 0;
		list-style: none;
	}

	.pills li {
		display: inline-flex;
		align-items: center;
		height: 30px;
		padding: 0 13px;
		border-radius: var(--radius-pill);
		background: color-mix(in srgb, var(--color-surface-elevated) 85%, transparent);
		box-shadow: 0 1px 0 color-mix(in srgb, var(--genre-current) 20%, transparent);
		color: var(--color-text-primary);
		font-size: 12.5px;
		font-weight: 700;
	}

	.pills li:first-child {
		background: var(--genre-current-dark);
		color: var(--genre-current-light);
	}

	.still {
		display: none;
	}

	@media (min-width: 720px) {
		.hero {
			padding: 22px 28px 26px;
		}

		.add-text {
			display: inline;
		}

		.add {
			padding: 0 18px 0 14px;
		}

		.still {
			display: block;
			flex: none;
			margin-bottom: -8px;
		}

		.objects {
			display: flex;
			align-items: flex-end;
			padding: 0 14px;
		}

		/* Stessa mensola in legno chiaro degli scaffali della Libreria, in piccolo */
		.ledge {
			position: relative;
			height: 14px;
			margin-top: -4px;
			border-radius: 2px 2px 6px 6px;
			background:
				linear-gradient(
					180deg,
					color-mix(in srgb, var(--color-on-genre-white) 55%, transparent) 0 1px,
					transparent 45%,
					color-mix(in srgb, var(--color-wood-ink) 16%, transparent)
				),
				var(--gradient-wood-detail);
			box-shadow:
				0 3px 0 -1px color-mix(in srgb, var(--color-wood-detail-bottom) 85%, var(--color-wood-ink)),
				0 14px 16px -10px color-mix(in srgb, var(--color-wood-ink) 55%, transparent);
		}
	}

	@media (min-width: 1024px) {
		h1 {
			margin-top: 18px;
			font-size: 48px;
		}

		.pills {
			margin-top: 18px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.back,
		.add {
			transition: none;
		}
	}
</style>
