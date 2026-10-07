<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { GENRE_ORDER, GENRE_SHORT_LABELS } from '$lib/genres';
	import { formatNumber, plural } from '$lib/components/stats/format';
	import type { GenreShare, LibraryCounts } from '$lib/profile/overview';
	import ShareBars from './ShareBars.svelte';

	interface Props {
		name: string;
		email: string | null;
		year: number;
		counts: LibraryCounts;
		genres: GenreShare[];
		readingDays: number;
	}

	let { name, email, year, counts, genres, readingDays }: Props = $props();

	const initial = $derived(name.trim().charAt(0).toUpperCase() || '?');

	// Scaffale decorativo del banner: dorsi deterministici nei colori dei generi.
	const SHELVES = 2;
	const PER_SHELF = 120;
	const spines = Array.from({ length: SHELVES * PER_SHELF }, (_, i) => {
		const seed = (i * 37 + 11) % 23;
		const slug = GENRE_ORDER[(i * 5 + (i >> 2)) % GENRE_ORDER.length]!;
		return {
			slug,
			dark: seed % 3 === 0,
			height: 62 + ((seed * 7) % 34),
			width: 9 + (seed % 7),
			tilt: seed === 4 ? -8 : 0
		};
	});

	const genreRows = $derived(
		genres.slice(0, 6).map((genre) => ({
			key: genre.slug,
			label: GENRE_SHORT_LABELS[genre.slug],
			percent: genre.percent,
			color: `var(--genre-${genre.slug})`,
			title: `${genre.count} ${plural(genre.count, 'libro', 'libri')}`
		}))
	);
</script>

<section class="hero" aria-labelledby="profile-name">
	<div class="banner" aria-hidden="true">
		<span class="glow"></span>
		{#each Array.from({ length: SHELVES }, (_, s) => s) as shelf (shelf)}
			<div class="shelf">
				{#each spines.slice(shelf * PER_SHELF, (shelf + 1) * PER_SHELF) as spine, i (i)}
					<span
						class="spine"
						style:height="{spine.height}%"
						style:width="{spine.width}px"
						style:rotate="{spine.tilt}deg"
						style:background="var(--genre-{spine.slug}{spine.dark ? '-dark' : ''})"
					></span>
				{/each}
			</div>
		{/each}
	</div>

	<div class="identity">
		<div class="avatar-wrap">
			<span class="avatar" aria-hidden="true">{initial}</span>
			<a class="edit" href="/settings" aria-label="Modifica profilo">
				<Icon name="pencil" size={17} strokeWidth={2.2} />
			</a>
		</div>

		<div class="who">
			<div class="title-row">
				<div class="names">
					<h1 id="profile-name">{name}</h1>
					{#if email && email !== name}<p class="handle">{email}</p>{/if}
				</div>
				<div class="actions">
					<a class="primary" href="/friends">
						<Icon name="user" size={17} strokeWidth={2} />Amici
					</a>
					<a class="primary" href="/settings">
						<Icon name="settings" size={17} strokeWidth={2} />Modifica profilo
					</a>
					<form method="POST" action="/auth/logout">
						<button class="ghost" type="submit" aria-label="Esci dall’account">
							<Icon name="logout" size={18} />
						</button>
					</form>
				</div>
			</div>

			<p class="bio">
				{formatNumber(counts.total)}
				{plural(counts.total, 'libro', 'libri')} in libreria
				{#if readingDays > 0}
					· {formatNumber(readingDays)}
					{plural(readingDays, 'giorno', 'giorni')} di lettura nel {year}
				{/if}
			</p>

			<dl class="counters">
				<div>
					<dt>Libri letti</dt>
					<dd>{formatNumber(counts.read)}</dd>
				</div>
				<div>
					<dt>In lettura</dt>
					<dd>{formatNumber(counts.reading)}</dd>
				</div>
				<div>
					<dt>Da leggere</dt>
					<dd>{formatNumber(counts.unread)}</dd>
				</div>
			</dl>
		</div>
	</div>

	<aside class="genres" aria-labelledby="profile-genres">
		<header>
			<h2 id="profile-genres">I miei generi</h2>
			<span class="year">{year}</span>
		</header>
		{#if genreRows.length > 0}
			<ShareBars rows={genreRows} />
		{:else}
			<p class="empty">Finisci un libro nel {year} per vedere quali generi leggi di più.</p>
		{/if}
	</aside>
</section>

<style>
	.hero {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0 20px;
	}

	/* ---- Banner ------------------------------------------------------- */
	.banner {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: 10px;
		height: 150px;
		overflow: hidden;
		padding: 0 0 10px;
		border-radius: var(--radius-xl);
		background: var(--gradient-wood-back);
	}

	.banner::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			180deg,
			transparent 40%,
			color-mix(in srgb, var(--color-wood-bottom) 45%, transparent)
		);
		pointer-events: none;
	}

	.glow {
		position: absolute;
		top: -40%;
		left: 18%;
		width: 260px;
		height: 260px;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			color-mix(in srgb, var(--color-flame) 55%, transparent),
			transparent 68%
		);
		opacity: 0.55;
	}

	.shelf {
		position: relative;
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 58px;
		padding: 0 16px;
		border-bottom: 6px solid var(--color-wood-mid);
		box-shadow: 0 4px 6px -3px color-mix(in srgb, var(--color-shadow) 60%, transparent);
	}

	.spine {
		flex: none;
		border-radius: 2px 2px 0 0;
		box-shadow: inset -2px 0 0 color-mix(in srgb, var(--color-shadow) 25%, transparent);
		transform-origin: bottom left;
		opacity: 0.92;
	}

	/* ---- Identità ----------------------------------------------------- */
	.identity {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		margin: -56px 12px 0;
		padding: 0 16px 20px;
		border-radius: var(--radius-xl);
		background: var(--color-surface-elevated);
		box-shadow: var(--shadow-card);
		text-align: center;
	}

	.avatar-wrap {
		position: relative;
		margin-top: -44px;
	}

	.avatar {
		display: grid;
		place-items: center;
		width: 104px;
		height: 104px;
		border: 5px solid var(--color-surface-elevated);
		border-radius: 50%;
		background: radial-gradient(
			circle at 35% 30%,
			var(--color-primary-subtle),
			color-mix(in srgb, var(--color-primary) 35%, var(--color-primary-subtle))
		);
		color: var(--color-primary-deep);
		font-family: var(--font-display);
		font-size: 46px;
		line-height: 1;
		box-shadow: var(--shadow-card);
	}

	.edit {
		position: absolute;
		right: 0;
		bottom: 2px;
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border: 3px solid var(--color-surface-elevated);
		border-radius: 50%;
		background: var(--color-surface);
		color: var(--color-primary);
	}

	.edit:hover {
		background: var(--color-primary-subtle);
	}

	.who {
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 100%;
		min-width: 0;
	}

	.title-row {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}

	.names {
		min-width: 0;
	}

	h1 {
		margin: 0;
		color: var(--color-text-primary);
		font-family: var(--font-display);
		font-size: 30px;
		font-weight: 400;
		line-height: 1.1;
		overflow-wrap: anywhere;
	}

	.handle {
		margin: 2px 0 0;
		color: var(--color-text-secondary);
		font-size: 14px;
		overflow-wrap: anywhere;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.primary {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: var(--tap-size);
		padding: 0 18px;
		border-radius: var(--radius-sm);
		background: var(--color-primary);
		color: var(--color-on-primary);
		font-size: 14px;
		font-weight: 700;
		text-decoration: none;
		box-shadow: var(--shadow-button);
	}

	.primary:hover {
		background: var(--color-primary-hover);
	}

	.ghost {
		display: grid;
		place-items: center;
		width: var(--tap-size);
		height: var(--tap-size);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-danger);
	}

	.ghost:hover {
		background: var(--color-surface);
	}

	.bio {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 14px;
		line-height: 1.45;
	}

	.counters {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		margin: 4px 0 0;
	}

	.counters div {
		display: flex;
		flex-direction: column-reverse;
		gap: 2px;
		padding: 0 8px;
	}

	.counters div + div {
		border-left: 1px solid var(--color-divider);
	}

	dt {
		color: var(--color-text-secondary);
		font-size: 12px;
	}

	dd {
		margin: 0;
		color: var(--color-text-primary);
		font-size: 22px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	/* ---- Generi ------------------------------------------------------- */
	.genres {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin-top: 16px;
		padding: 18px 20px 20px;
		border: 1px solid color-mix(in srgb, var(--color-border) 55%, transparent);
		border-radius: var(--radius-lg);
		background: var(--color-surface-elevated);
		box-shadow: var(--shadow-card);
	}

	.genres header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.genres h2 {
		margin: 0;
		color: var(--color-primary-deep);
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: 400;
	}

	.year {
		color: var(--color-text-muted);
		font-size: 12px;
		font-weight: 600;
	}

	.empty {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 13px;
		line-height: 1.45;
	}

	@media (min-width: 720px) {
		.identity {
			flex-direction: row;
			align-items: flex-start;
			gap: 24px;
			margin: -64px 20px 0;
			padding: 18px 24px 22px;
			text-align: left;
		}

		.avatar-wrap {
			margin-top: -64px;
		}

		.avatar {
			width: 140px;
			height: 140px;
			font-size: 60px;
		}

		.title-row {
			flex-direction: row;
			align-items: flex-start;
			justify-content: space-between;
		}

		.counters {
			max-width: 380px;
		}

		.counters div:first-child {
			padding-left: 0;
		}
	}

	@media (min-width: 1180px) {
		.hero {
			grid-template-columns: minmax(0, 1fr) 330px;
			grid-template-rows: 190px auto;
		}

		.banner {
			grid-area: 1 / 1 / 2 / -1;
			height: auto;
		}

		.identity {
			grid-area: 2 / 1;
			margin: -72px 0 0 20px;
		}

		.genres {
			z-index: 1;
			grid-area: 1 / 2 / 3 / 3;
			margin: 18px 18px 0 0;
			align-self: start;
		}
	}
</style>
