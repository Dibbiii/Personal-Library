<script lang="ts">
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const hidden = 'Questa sezione è privata.';
</script>

<svelte:head><title>{data.displayName ?? 'Amico'} · Segnalibro</title></svelte:head>
<PageHeader title={data.displayName ?? 'Amico'} backHref="/friends" />

<main class="page">
	<section>
		<h2>Libreria</h2>
		{#if data.library}
			<ul>
				{#each data.library as book (book.id)}
					<li><strong>{book.title}</strong> · {book.author}</li>
				{:else}<li>Nessun libro condiviso.</li>{/each}
			</ul>
		{:else}<p>{hidden}</p>{/if}
	</section>
	<section>
		<h2>Recensioni</h2>
		{#if data.reviews}
			<ul>{#each data.reviews as review (review.bookId)}<li>{review.rating}/5</li>{:else}<li>Nessuna recensione.</li>{/each}</ul>
		{:else}<p>{hidden}</p>{/if}
	</section>
	<section>
		<h2>Statistiche</h2>
		{#if data.stats}<p>{data.stats.booksFinished} letti · {data.stats.dnf} non finiti</p>{:else}<p>{hidden}</p>{/if}
	</section>
	<section>
		<h2>Citazioni</h2>
		{#if data.quotes}
			<ul>{#each data.quotes as quote (quote.id)}<li>“{quote.body}”</li>{:else}<li>Nessuna citazione.</li>{/each}</ul>
		{:else}<p>{hidden}</p>{/if}
	</section>
	<section>
		<h2>Attività</h2>
		{#if data.activity}
			<ul>{#each data.activity as item (item.bookId)}<li>{item.title}</li>{:else}<li>Nessuna attività.</li>{/each}</ul>
		{:else}<p>{hidden}</p>{/if}
	</section>
</main>

<style>
	.page { display: grid; gap: 16px; padding: 0 var(--page-gutter) 32px; }
	section { padding: 18px; border-radius: var(--radius-sheet); background: var(--color-surface); }
	h2, p { margin: 0 0 8px; }
	ul { margin: 0; padding-left: 18px; }
</style>
