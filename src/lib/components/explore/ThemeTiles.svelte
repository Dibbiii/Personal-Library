<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { IconName } from '$lib/components/ui/icons';
	import type { DiscoverTopic } from '$lib/catalog/discover';
	import type { GenreSlug } from '$lib/contracts/enums';

	interface Props {
		onselect: (topic: DiscoverTopic) => void;
		onseeall: () => void;
	}

	let { onselect, onseeall }: Props = $props();

	const uid = $props.id();

	/** Ogni tema prende i colori di un genere della libreria. */
	const THEMES: { topic: DiscoverTopic; label: string; genre: GenreSlug; icon: IconName }[] = [
		{ topic: 'adventure', label: 'Avventura', genre: 'contemporary-historical', icon: 'compass' },
		{ topic: 'space', label: 'Spazio', genre: 'dystopia-scifi', icon: 'moon' },
		{ topic: 'dystopia', label: 'Mondi distopici', genre: 'thriller-mystery', icon: 'flame' },
		{ topic: 'history', label: 'Storia', genre: 'classics', icon: 'bingo-temple' },
		{
			topic: 'mystery',
			label: 'Misteri da risolvere',
			genre: 'mythology-epic-retelling',
			icon: 'search'
		},
		{ topic: 'romance', label: 'Storie d’amore', genre: 'romance-ya-na', icon: 'bingo-hearts' }
	];
</script>

<section class="themes" aria-labelledby="{uid}-title">
	<header>
		<h2 id="{uid}-title">Esplora per tema</h2>
		<button type="button" class="see-all" onclick={onseeall} aria-label="Vedi tutti i temi">
			Vedi tutti <Icon name="chevron-right" size={15} strokeWidth={2.2} />
		</button>
	</header>
	<ul>
		{#each THEMES as theme (theme.topic)}
			<li>
				<button
					type="button"
					class="tile"
					style:--tile="var(--genre-{theme.genre})"
					style:--tile-dark="var(--genre-{theme.genre}-dark)"
					onclick={() => onselect(theme.topic)}
				>
					<span class="glyph" aria-hidden="true"
						><Icon name={theme.icon} size={54} strokeWidth={1.3} /></span
					>
					<span class="label">{theme.label}</span>
				</button>
			</li>
		{/each}
	</ul>
</section>

<style>
	.themes {
		padding: 18px 16px 16px;
		border-radius: var(--radius-xl);
		background: color-mix(in srgb, var(--color-card) 70%, transparent);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-border) 16%, transparent);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 12px;
	}

	h2 {
		min-width: 0;
		margin: 0;
		font-family: var(--font-display);
		font-size: 20px;
		white-space: nowrap;
		font-weight: 400;
		color: var(--color-primary);
	}

	.see-all {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		min-height: 32px;
		padding: 0 4px 0 8px;
		border: 0;
		border-radius: var(--radius-pill);
		background: transparent;
		white-space: nowrap;
		font-size: 12.5px;
		font-weight: 700;
		color: var(--color-primary);
	}

	ul {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.tile {
		position: relative;
		isolation: isolate;
		display: flex;
		align-items: flex-end;
		width: 100%;
		aspect-ratio: 4 / 3;
		padding: 10px;
		overflow: hidden;
		border: 0;
		border-radius: var(--radius-md);
		background:
			radial-gradient(
				circle at 75% 25%,
				color-mix(in srgb, var(--tile) 70%, var(--color-flame-core)),
				transparent 60%
			),
			linear-gradient(160deg, var(--tile), var(--tile-dark));
		text-align: left;
		color: var(--color-on-primary);
	}

	.tile::after {
		content: '';
		position: absolute;
		z-index: -1;
		inset: 40% 0 0;
		background: linear-gradient(
			to top,
			color-mix(in srgb, var(--color-shadow) 55%, transparent),
			transparent
		);
	}

	.glyph {
		position: absolute;
		z-index: -1;
		top: 8px;
		right: 6px;
		opacity: 0.35;
		transition: transform var(--duration-base) var(--ease-out);
	}

	.tile:hover .glyph {
		transform: scale(1.08) rotate(-4deg);
	}

	.label {
		font-size: 13px;
		font-weight: 700;
		line-height: 1.2;
	}

	.tile:focus-visible,
	.see-all:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
</style>
