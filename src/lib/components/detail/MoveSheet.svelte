<script lang="ts">
	import type { GenreSlug } from '$lib/contracts';
	import { GENRE_LABELS, GENRE_ORDER } from '$lib/genres';
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	interface Props {
		open: boolean;
		title: string;
		currentGenre: GenreSlug;
		/** Mostra "Segna come letto" (nascosto se il libro è già letto e non c'è una lettura in corso). */
		canMarkRead: boolean;
		/** Mostra la riga della coda (nascosta per i libri in lettura). */
		canQueue: boolean;
		queued: boolean;
		queueCount: number;
		busy?: boolean;
		onclose: () => void;
		onmarkread: () => void;
		onchangegenre: (slug: GenreSlug) => void;
		onqueue: () => void;
	}

	let {
		open,
		title,
		currentGenre,
		canMarkRead,
		canQueue,
		queued,
		queueCount,
		busy = false,
		onclose,
		onmarkread,
		onchangegenre,
		onqueue
	}: Props = $props();

	let genresOpen = $state(false);

	$effect(() => {
		if (!open) genresOpen = false;
	});
</script>

<BottomSheet {open} title="Sposta il libro" subtitle={title} {onclose}>
	<ul class="actions" role="list">
		{#if canMarkRead}
			<li>
				<button class="row" type="button" disabled={busy} onclick={onmarkread}>
					<span class="tile"><Icon name="check" size={22} strokeWidth={1.9} /></span>
					<span class="label">Segna come letto</span>
					<span class="trail"><Icon name="chevron-right" size={18} strokeWidth={2.2} /></span>
				</button>
			</li>
		{/if}

		<li>
			<button
				class="row"
				type="button"
				aria-expanded={genresOpen}
				aria-controls="move-genres"
				disabled={busy}
				onclick={() => (genresOpen = !genresOpen)}
			>
				<span class="tile"><Icon name="tag" size={22} strokeWidth={1.9} /></span>
				<span class="label">Cambia genere</span>
				<span class="trail">
					<Icon name={genresOpen ? 'chevron-down' : 'chevron-right'} size={18} strokeWidth={2.4} />
				</span>
			</button>

			{#if genresOpen}
				<ul id="move-genres" class="genres" role="list">
					{#each GENRE_ORDER as slug (slug)}
						{@const current = slug === currentGenre}
						<li>
							<button
								class="genre"
								class:current
								type="button"
								aria-current={current ? 'true' : undefined}
								disabled={busy}
								onclick={() => (current ? (genresOpen = false) : onchangegenre(slug))}
								style:--dot="var(--genre-{slug})"
							>
								<span class="dot" aria-hidden="true"></span>
								<span class="name">{GENRE_LABELS[slug]}</span>
								{#if current}<Icon name="check" size={18} strokeWidth={2.6} />{/if}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</li>

		{#if canQueue}
			<li>
				<button
					class="row"
					type="button"
					disabled={busy}
					onclick={onqueue}
					data-testid="move-queue"
				>
					<span class="tile">
						<Icon name={queued ? 'close' : 'bookmark'} size={22} strokeWidth={1.9} />
					</span>
					<span class="label">{queued ? 'Rimuovi dai prossimi' : 'Metti nei prossimi'}</span>
					{#if !queued}
						<span class="pill" aria-label="{queueCount} libri su 3 nei prossimi">
							{queueCount} su 3
						</span>
					{/if}
				</button>
			</li>
		{/if}
	</ul>
</BottomSheet>

<style>
	.actions {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.actions > li + li {
		border-top: 1px solid var(--color-surface);
	}

	.row {
		display: flex;
		align-items: center;
		gap: 14px;
		width: 100%;
		min-height: 60px;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--color-text-primary);
		font-family: var(--font-ui);
		text-align: left;
		cursor: pointer;
	}

	.row:disabled,
	.genre:disabled {
		opacity: 0.55;
		cursor: progress;
	}

	.tile {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 42px;
		height: 42px;
		border-radius: 14px;
		background: var(--color-surface);
		color: var(--color-primary);
	}

	.label {
		flex: 1;
		font-size: 16px;
		font-weight: 600;
	}

	.trail {
		display: inline-flex;
		color: var(--color-shelf-axis);
	}

	.pill {
		display: inline-flex;
		align-items: center;
		height: 28px;
		padding: 0 12px;
		border: 1.5px solid var(--color-divider);
		border-radius: 14px;
		color: var(--color-shelf-axis);
		font-size: 12px;
		font-weight: 600;
	}

	.genres {
		margin: 0 0 6px 56px;
		padding: 6px;
		border-radius: 16px;
		background: var(--color-surface);
		list-style: none;
	}

	.genre {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 44px;
		padding: 4px 12px;
		border: 0;
		border-radius: 12px;
		background: transparent;
		color: var(--color-text-primary);
		font-family: var(--font-ui);
		font-size: 14.5px;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
	}

	.genre.current {
		background: color-mix(in srgb, var(--color-accent) 40%, transparent);
		font-weight: 700;
	}

	.genre .name {
		flex: 1;
	}

	.genre.current :global(svg) {
		color: var(--color-primary);
	}

	.dot {
		flex: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--dot);
		box-shadow: 0 0 8px 1px color-mix(in srgb, var(--dot) 60%, transparent);
	}
</style>
