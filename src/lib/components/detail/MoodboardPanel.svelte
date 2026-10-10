<script lang="ts">
	import type { Quote } from '$lib/contracts/reviews';

	interface Props {
		quotes: Quote[];
		onopenreview: () => void;
	}

	let { quotes, onopenreview }: Props = $props();
</script>

<div class="moodboard" data-testid="moodboard">
	<div class="heading">
		<div>
			<h2>La mia moodboard</h2>
			<p>Le citazioni che hai salvato per questo libro.</p>
		</div>
		{#if quotes.length > 0}
			<span class="count">{quotes.length} {quotes.length === 1 ? 'citazione' : 'citazioni'}</span>
		{/if}
	</div>

	{#if quotes.length > 0}
		<ul class="board" role="list" aria-label="Citazioni salvate" data-testid="moodboard-board">
			{#each quotes as quote, index (quote.id)}
				<li class:featured={index % 3 === 0} data-testid="moodboard-quote">
					<figure class="card">
						<span class="quote-mark" aria-hidden="true">“</span>
						<blockquote>{quote.body}</blockquote>
						{#if quote.page !== null}<figcaption>p. {quote.page}</figcaption>{/if}
					</figure>
				</li>
			{/each}
		</ul>
	{:else}
		<div class="empty" data-testid="moodboard-empty">
			<h3>La tua moodboard inizia da qui</h3>
			<p>Salva una citazione nella scheda Recensione per ritrovarla qui.</p>
			<button type="button" onclick={onopenreview}>Vai alla Recensione</button>
		</div>
	{/if}
</div>

<style>
	.moodboard {
		display: grid;
		gap: 18px;
		min-inline-size: 0;
	}

	.heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 16px;
	}

	h2,
	h3,
	p {
		margin: 0;
	}

	h2 {
		font-family: var(--font-display);
		font-size: clamp(1.5rem, 1.25rem + 1vw, 2rem);
		font-weight: 400;
		line-height: 1.15;
		color: var(--color-text-primary);
		text-wrap: balance;
	}

	.heading p,
	.empty p {
		margin-top: 8px;
		color: var(--color-text-secondary);
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.count {
		flex: 0 0 auto;
		padding: 6px 11px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--genre-current) 13%, var(--color-surface-elevated));
		color: var(--genre-current-dark);
		font-size: 0.8rem;
		font-weight: 700;
	}

	.board {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
		gap: 14px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.board > li {
		min-inline-size: 0;
	}

	.card {
		box-sizing: border-box;
		display: grid;
		grid-template-rows: auto 1fr auto;
		gap: 14px;
		min-block-size: 190px;
		height: 100%;
		margin: 0;
		padding: clamp(20px, 16px + 1vw, 28px);
		border: 1px solid color-mix(in srgb, var(--genre-current-dark) 20%, transparent);
		border-radius: 20px;
		background: var(--color-surface-elevated);
		box-shadow: var(--shadow-card);
	}

	.featured .card {
		background: color-mix(in srgb, var(--genre-current-light) 22%, var(--color-surface));
	}

	.quote-mark {
		font-family: var(--font-display);
		font-size: 3rem;
		line-height: 0.7;
		color: var(--genre-current-dark);
	}

	blockquote {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.25rem, 1.05rem + 0.75vw, 1.75rem);
		line-height: 1.4;
		color: var(--color-text-primary);
		overflow-wrap: anywhere;
		white-space: pre-line;
		text-wrap: pretty;
	}

	figcaption {
		justify-self: start;
		padding: 5px 10px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--genre-current) 12%, var(--color-background));
		color: var(--genre-current-dark);
		font-family: var(--font-ui);
		font-size: 0.8rem;
		font-weight: 700;
	}

	.empty {
		display: grid;
		justify-items: start;
		gap: 10px;
		box-sizing: border-box;
		min-block-size: 190px;
		padding: clamp(22px, 18px + 1vw, 32px);
		border: 1.5px dashed color-mix(in srgb, var(--genre-current-dark) 35%, transparent);
		border-radius: 20px;
		background: var(--color-surface);
	}

	h3 {
		font-family: var(--font-display);
		font-size: clamp(1.25rem, 1.1rem + 0.5vw, 1.55rem);
		font-weight: 400;
		line-height: 1.25;
		color: var(--color-text-primary);
		text-wrap: balance;
	}

	.empty p {
		max-inline-size: 48ch;
		margin: 0;
	}

	button {
		min-block-size: var(--tap-size);
		margin-block-start: 4px;
		padding-inline: 16px;
		border: 1px solid color-mix(in srgb, var(--genre-current-dark) 30%, transparent);
		border-radius: 999px;
		background: color-mix(in srgb, var(--genre-current) 14%, var(--color-surface-elevated));
		color: var(--genre-current-dark);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	button:hover {
		background: color-mix(in srgb, var(--genre-current) 22%, var(--color-surface-elevated));
	}

	button:focus-visible {
		outline: 3px solid var(--genre-current-dark);
		outline-offset: 3px;
	}

	@media (max-width: 540px) {
		.heading {
			align-items: start;
		}

		.count {
			margin-block-start: 3px;
		}
	}
</style>
