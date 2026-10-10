<script lang="ts">
	import type { BookInfo } from '$lib/catalog/book-info';
	import { languageLabel } from '$lib/catalog/language';
	import Icon from '$lib/components/ui/Icon.svelte';
	import RatingStars from '$lib/components/ui/RatingStars.svelte';

	interface Props {
		info: BookInfo | null;
		loading: boolean;
		section: 'overview' | 'editions' | 'author';
		/** Titolo e autore come nella libreria (per "titolo originale" e per la ricerca "aggiungi"). */
		title: string;
		author: string;
	}

	let { info, loading, section, title, author }: Props = $props();

	const numbers = new Intl.NumberFormat('it-IT');
	let descriptionOpen = $state(false);
	let bioOpen = $state(false);

	const originalTitle = $derived(
		info && info.workTitle.trim().toLowerCase() !== title.trim().toLowerCase()
			? info.workTitle
			: null
	);
	const hasDetails = $derived(
		info !== null &&
			(originalTitle !== null ||
				info.firstPublishYear !== null ||
				info.editionCount !== null ||
				info.people.length > 0 ||
				info.places.length > 0)
	);

	function addHref(workTitle: string) {
		return `/add/search?${new URLSearchParams({ q: `${workTitle} ${author}` })}`;
	}
</script>

{#snippet source()}
	{#if info}
		<p class="source">
			Dati da <a href={info.workUrl} target="_blank" rel="noopener noreferrer">Open Library</a
			>{#if info.description?.source === 'google-books'}
				e Google Books{/if}
		</p>
	{/if}
{/snippet}

{#if loading && !info}
	<p class="empty" aria-busy="true" aria-label="Carico le informazioni sul libro">
		<Icon name="search" size={18} />
		Carico le informazioni pubbliche sul libro…
	</p>
{:else if !info}
	<p class="empty">
		<Icon name="search" size={18} />
		Non ho trovato informazioni pubbliche su questo libro (Open Library).
	</p>
{:else if section === 'overview'}
	<div class="grid">
		<div class="column">
			<section class="card about" aria-labelledby="about-title">
				<h3 id="about-title">Descrizione</h3>
				{#if info.description}
					<p class="description" class:open={descriptionOpen}>{info.description.text}</p>
					<div class="row">
						<button type="button" class="more" onclick={() => (descriptionOpen = !descriptionOpen)}>
							{descriptionOpen ? 'Mostra meno' : 'Mostra di più'}
							<Icon name={descriptionOpen ? 'chevron-up' : 'chevron-down'} size={16} />
						</button>
						{#if info.description.language && info.description.language !== 'it'}
							<span class="lang"
								>Testo in {languageLabel(info.description.language)?.toLowerCase()}</span
							>
						{/if}
					</div>
				{:else}
					<p class="muted">Nessuna descrizione disponibile.</p>
				{/if}
				{#if info.firstSentence}
					<blockquote>
						<span>Incipit</span>
						«{info.firstSentence}»
					</blockquote>
				{/if}
			</section>

			{#if info.subjects.length}
				<section class="card" aria-labelledby="themes-title">
					<h3 id="themes-title">Temi principali</h3>
					<ul class="chips">
						{#each info.subjects as subject (subject)}<li>{subject}</li>{/each}
					</ul>
					{#if info.links.length}
						<h4>Link</h4>
						<ul class="links">
							{#each info.links as link (link.url)}
								<li>
									<a href={link.url} target="_blank" rel="noopener noreferrer">{link.title}</a>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/if}
		</div>
		<div class="column">
			{#if info.rating || info.readers}
				<section class="card community" aria-labelledby="community-title">
					<h3 id="community-title">Lettori su Open Library</h3>
					{#if info.rating}
						<div class="score">
							<strong>{info.rating.average.toLocaleString('it-IT')}</strong>
							<div>
								<RatingStars value={Math.round(info.rating.average)} size={18} label="Voto medio" />
								<span>{numbers.format(info.rating.count)} voti</span>
							</div>
						</div>
					{/if}
					{#if info.readers}
						<ul class="readers">
							<li><strong>{numbers.format(info.readers.alreadyRead)}</strong> l'hanno letto</li>
							<li>
								<strong>{numbers.format(info.readers.currentlyReading)}</strong> lo stanno leggendo
							</li>
							<li>
								<strong>{numbers.format(info.readers.wantToRead)}</strong> lo vogliono leggere
							</li>
						</ul>
					{/if}
				</section>
			{/if}

			{#if hasDetails}
				<section class="card" aria-labelledby="facts-title">
					<h3 id="facts-title">Dettagli</h3>
					<dl class="table">
						{#if originalTitle}<div>
								<dt>Titolo originale</dt>
								<dd>{originalTitle}</dd>
							</div>{/if}
						{#if info.firstPublishYear}
							<div>
								<dt>Prima pubblicazione</dt>
								<dd>{info.firstPublishYear}</dd>
							</div>
						{/if}
						{#if info.editionCount}
							<div>
								<dt>Edizioni</dt>
								<dd>{numbers.format(info.editionCount)} nel mondo</dd>
							</div>
						{/if}
						{#if info.pagesMedian}<div>
								<dt>Pagine (media)</dt>
								<dd>{info.pagesMedian}</dd>
							</div>{/if}
						{#if info.people.length}<div>
								<dt>Personaggi</dt>
								<dd>{info.people.join(', ')}</dd>
							</div>{/if}
						{#if info.places.length}<div>
								<dt>Luoghi</dt>
								<dd>{info.places.join(', ')}</dd>
							</div>{/if}
						{#if info.times.length}<div>
								<dt>Epoca</dt>
								<dd>{info.times.join(', ')}</dd>
							</div>{/if}
					</dl>
				</section>
			{/if}
		</div>
	</div>
	{@render source()}
{:else if section === 'editions'}
	<section class="card" aria-labelledby="editions-title">
		<header class="head">
			<h3 id="editions-title">Edizioni</h3>
			{#if info.editionCount}<span class="pill">{numbers.format(info.editionCount)}</span>{/if}
		</header>
		{#if info.editions.length}
			<ul class="covers">
				{#each info.editions as edition (edition.url)}
					<li>
						<a href={edition.url} target="_blank" rel="noopener noreferrer">
							<span class="cover-box">
								{#if edition.coverUrl}
									<img
										src={edition.coverUrl}
										alt=""
										loading="lazy"
										decoding="async"
										referrerpolicy="no-referrer"
									/>
								{:else}
									<Icon name="book-open" size={22} />
								{/if}
							</span>
							<strong>{edition.title}</strong>
							<span>{[edition.publisher, edition.year].filter(Boolean).join(', ') || '—'}</span>
							{#if edition.language}<span class="tag">{languageLabel(edition.language)}</span>{/if}
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted">Nessuna edizione elencata.</p>
		{/if}
	</section>
	{@render source()}
{:else}
	<div class="author-layout">
		{#if info.author}
			<section class="card author" aria-labelledby="author-title">
				<div class="person">
					{#if info.author.photoUrl}
						<img
							class="photo"
							src={info.author.photoUrl}
							alt="Foto di {info.author.name}"
							loading="eager"
							referrerpolicy="no-referrer"
						/>
					{:else}
						<span class="photo placeholder"><Icon name="user" size={30} /></span>
					{/if}
					<div>
						<h3 id="author-title">{info.author.name}</h3>
						{#if info.author.birthDate || info.author.deathDate}
							<p class="muted">
								{info.author.birthDate ?? '?'}{#if info.author.deathDate}
									– {info.author.deathDate}{/if}
							</p>
						{/if}
						<a href={info.author.url} target="_blank" rel="noopener noreferrer" class="ext">
							Profilo su Open Library <Icon name="arrow-right" size={14} />
						</a>
					</div>
				</div>
				{#if info.author.bio}
					<p class="description" class:open={bioOpen}>{info.author.bio}</p>
					<button type="button" class="more" onclick={() => (bioOpen = !bioOpen)}>
						{bioOpen ? 'Mostra meno' : 'Mostra di più'}
						<Icon name={bioOpen ? 'chevron-up' : 'chevron-down'} size={16} />
					</button>
				{/if}
			</section>
		{/if}

		{#if info.authorWorks.length}
			<section class="card" aria-labelledby="works-title">
				<h3 id="works-title">Altri libri di {info.author?.name ?? author}</h3>
				<ul class="covers">
					{#each info.authorWorks as work (work.url)}
						<li>
							<div class="work">
								<a class="cover-box" href={work.url} target="_blank" rel="noopener noreferrer">
									{#if work.coverUrl}
										<img
											src={work.coverUrl}
											alt=""
											loading="lazy"
											decoding="async"
											referrerpolicy="no-referrer"
										/>
									{:else}
										<Icon name="book-open" size={22} />
									{/if}
								</a>
								<strong>{work.title}</strong>
								<span
									>{work.year ?? ''}{#if work.rating}
										· ★ {work.rating.toLocaleString('it-IT')}{/if}</span
								>
								<a class="add" href={addHref(work.title)}>
									<Icon name="plus" size={14} strokeWidth={2.4} /> Aggiungi
								</a>
							</div>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>
	{@render source()}
{/if}

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
		gap: 16px;
		align-items: start;
	}

	.column {
		display: flex;
		flex-direction: column;
		gap: 16px;
		min-width: 0;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 0;
		padding: 20px;
		border-radius: var(--radius-xl);
		background: var(--color-surface-elevated);
		box-shadow:
			0 0 0 1px color-mix(in srgb, var(--color-border) 18%, transparent),
			0 12px 30px -20px color-mix(in srgb, var(--color-shadow) 35%, transparent);
	}

	h3 {
		margin: 0;
		color: var(--color-primary);
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 400;
	}

	h4 {
		margin: 4px 0 0;
		font-size: 13px;
	}

	.description {
		display: -webkit-box;
		margin: 0;
		overflow: hidden;
		font-size: 15px;
		line-height: 1.6;
		white-space: pre-line;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 7;
		line-clamp: 7;
	}

	.description.open {
		display: block;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
	}

	.more {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		align-self: flex-start;
		min-height: 36px;
		padding: 0 14px;
		border: 0;
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-text-primary);
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
	}

	.lang,
	.muted,
	.source {
		color: var(--color-text-secondary);
		font-size: 12.5px;
	}

	.muted {
		margin: 0;
	}

	.source {
		margin: 12px 4px 0;
	}

	.source a,
	.links a,
	.ext {
		color: var(--color-primary);
		font-weight: 700;
	}

	blockquote {
		margin: 4px 0 0;
		padding: 12px 16px;
		border-left: 3px solid var(--genre-current, var(--color-primary));
		border-radius: 0 var(--radius-md) var(--radius-md) 0;
		background: var(--color-surface);
		font-family: var(--font-display);
		font-size: 15px;
		line-height: 1.45;
	}

	blockquote span {
		display: block;
		margin-bottom: 4px;
		color: var(--color-text-secondary);
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.score {
		--genre-current: var(--color-flame);
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.score strong {
		font-family: var(--font-display);
		font-size: 44px;
		font-weight: 400;
		line-height: 1;
	}

	.score div {
		display: flex;
		flex-direction: column;
		gap: 4px;
		color: var(--color-text-secondary);
		font-size: 13px;
	}

	.readers {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
		color: var(--color-text-secondary);
		font-size: 14px;
	}

	.readers strong {
		color: var(--color-text-primary);
	}

	.table {
		display: flex;
		flex-direction: column;
		margin: 0;
	}

	.table > div {
		display: grid;
		grid-template-columns: 140px minmax(0, 1fr);
		gap: 12px;
		padding: 8px 0;
		border-bottom: 1px solid color-mix(in srgb, var(--color-border) 25%, transparent);
		font-size: 13.5px;
	}

	.table > div:last-child {
		border-bottom: 0;
	}

	.table dt {
		color: var(--color-text-secondary);
	}

	.table dd {
		margin: 0;
	}

	.chips,
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.chips li {
		padding: 6px 12px;
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		font-size: 13px;
		font-weight: 600;
	}

	.links {
		flex-direction: column;
		gap: 4px;
		font-size: 13px;
	}

	.head {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.pill {
		padding: 3px 10px;
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		font-size: 12px;
		font-weight: 700;
	}

	.covers {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
		gap: 18px 14px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.covers a,
	.work {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
		color: var(--color-text-primary);
		font-size: 12px;
		text-decoration: none;
	}

	.cover-box {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		aspect-ratio: 2 / 3;
		margin-bottom: 6px;
		overflow: hidden;
		border-radius: 3px 8px 8px 3px;
		background: var(--color-surface);
		box-shadow: var(--shadow-cover);
		color: var(--color-text-secondary);
		transition: transform var(--duration-fast) var(--ease-out);
	}

	.covers a:hover .cover-box,
	a.cover-box:hover {
		transform: translateY(-4px);
	}

	.cover-box img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.covers strong {
		display: -webkit-box;
		overflow: hidden;
		font-size: 13px;
		line-height: 1.25;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.covers span {
		color: var(--color-text-secondary);
	}

	.tag {
		align-self: flex-start;
		margin-top: 2px;
		padding: 1px 8px;
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		font-weight: 600;
	}

	.work .add {
		display: inline-flex;
		flex-direction: row;
		align-items: center;
		gap: 4px;
		align-self: flex-start;
		margin-top: 4px;
		padding: 4px 10px;
		border-radius: var(--radius-pill);
		background: var(--color-primary-tint);
		color: var(--color-primary);
		font-weight: 700;
	}

	.author-layout {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.person {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.person p {
		margin: 2px 0 6px;
	}

	.ext {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 13px;
		text-decoration: none;
	}

	.photo {
		flex: none;
		width: 84px;
		height: 84px;
		border-radius: 50%;
		object-fit: cover;
		background: var(--color-surface);
	}

	.placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-secondary);
	}

	.empty {
		box-sizing: border-box;
		min-height: 88px;
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 0;
		padding: 18px 20px;
		border-radius: var(--radius-xl);
		background: var(--color-surface);
		color: var(--color-text-secondary);
		font-size: 14px;
	}

	@media (prefers-reduced-motion: reduce) {
		.cover-box {
			transition: none;
		}
	}
</style>
