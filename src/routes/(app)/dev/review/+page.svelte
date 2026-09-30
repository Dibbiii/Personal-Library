<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { ReviewCard, ReviewPanel } from '$lib/components/review';
	import Button from '$lib/components/ui/Button.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { GENRE_LABELS, GENRE_ORDER } from '$lib/genres';
	import type { GenreSlug } from '$lib/contracts/enums';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let scoresReset = $state(false);
	let genreError = $state<string | null>(null);

	async function changeGenre(slug: GenreSlug) {
		if (!data.detail) return;
		genreError = null;
		const response = await fetch(`/api/books/${data.detail.book.id}/genre`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ genreSlug: slug })
		});
		if (!response.ok) {
			genreError = 'Cambio genere non riuscito.';
			return;
		}
		const body = (await response.json()) as { reviewScoresReset?: boolean };
		scoresReset = body.reviewScoresReset === true;
		await invalidateAll();
	}
</script>

<svelte:head><title>Recensione (dev) · Segnalibro</title></svelte:head>

{#if data.detail}
	{@const detail = data.detail}
	<PageHeader title={detail.book.title} subtitle={detail.book.author} backHref="/dev/review" />

	<div class="page">
		<div class="dev-tools">
			<label>
				Genere (dev)
				<select
					data-testid="dev-genre"
					value={detail.book.genre.slug}
					onchange={(event) => changeGenre(event.currentTarget.value as GenreSlug)}
				>
					{#each GENRE_ORDER as slug (slug)}
						<option value={slug}>{GENRE_LABELS[slug]}</option>
					{/each}
				</select>
			</label>
			{#if genreError}<p role="alert">{genreError}</p>{/if}
		</div>

		<ReviewPanel {detail} {scoresReset} onsaved={() => void invalidateAll()}>
			{#snippet lockedFooter()}
				<Button size="lg" fullWidth>Sposta</Button>
			{/snippet}
			{#snippet afterScores()}
				<ReviewCard title="Date di lettura">
					<p class="placeholder">Segnaposto: le date sono del dettaglio libro.</p>
				</ReviewCard>
			{/snippet}
		</ReviewPanel>
	</div>
{:else}
	<PageHeader title="Recensione" subtitle="Scegli un libro (solo sviluppo)" backHref="/library" />
	<ul class="choices">
		{#each data.choices as book (book.id)}
			<li>
				<a href="/dev/review?book={book.id}">
					<strong>{book.title}</strong>
					<span>{book.author} · letture completate: {book.completed}</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.page {
		padding: 0 var(--page-gutter) 120px;
	}

	.dev-tools {
		margin-bottom: 14px;
		font-size: 13px;
		color: var(--color-text-secondary);
	}

	select {
		display: block;
		min-height: var(--tap-size);
		margin-top: 4px;
		padding: 0 12px;
		border: 1.5px solid var(--color-border);
		border-radius: 12px;
		background: var(--color-surface-elevated);
		color: var(--color-text-primary);
		font: inherit;
	}

	.placeholder {
		margin: 0;
		font-size: 14px;
		color: var(--color-text-secondary);
	}

	.choices {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin: 0;
		padding: 0 var(--page-gutter) 40px;
		list-style: none;
	}

	.choices a {
		display: flex;
		flex-direction: column;
		min-height: var(--tap-size);
		padding: 10px 14px;
		border-radius: 14px;
		background: var(--color-surface);
		color: var(--color-text-primary);
		text-decoration: none;
	}

	.choices span {
		font-size: 12.5px;
		color: var(--color-text-secondary);
	}
</style>
