<script lang="ts">
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Chip from '$lib/components/ui/Chip.svelte';
	import GenreChip from '$lib/components/ui/GenreChip.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { GenreSlug, QuotePreview } from '$lib/contracts';
	import { GENRE_ORDER, GENRE_SHORT_LABELS } from '$lib/genres';
	import {
		canShareFile,
		downloadBlob,
		exportQuoteCardPng,
		quoteCardFileName,
		shareFile
	} from '$lib/quotes/export';
	import {
		QUOTE_CARD_STYLES,
		resolveFonts,
		resolvePalette,
		type QuoteCardStyle
	} from '$lib/quotes/palette';
	import { ensureCardFonts, type QuoteCardContent } from '$lib/quotes/render';
	import QuoteCard from './QuoteCard.svelte';

	interface Props {
		open: boolean;
		quotes: QuotePreview[];
		initialQuoteId?: string;
		onclose: () => void;
	}

	let { open, quotes, initialQuoteId, onclose }: Props = $props();

	let selectedId = $state<string | null>(null);
	let style = $state<QuoteCardStyle>('genre');
	let genreOverride = $state<GenreSlug | null>(null);
	let busy = $state(false);
	let status = $state<{ kind: 'ok' | 'error'; text: string } | null>(null);
	let canShare = $state(false);

	const quote = $derived(quotes.find((item) => item.id === selectedId) ?? quotes[0] ?? null);
	const genre = $derived<GenreSlug>(genreOverride ?? quote?.genre.slug ?? 'classics');
	const content = $derived<QuoteCardContent | null>(
		quote
			? {
					body: quote.body,
					title: quote.bookTitle,
					author: quote.author,
					page: quote.page,
					genreName: GENRE_SHORT_LABELS[genre]
				}
			: null
	);

	// Ogni apertura riparte dalla citazione richiesta e dal genere del libro.
	$effect(() => {
		if (!open) return;
		selectedId = initialQuoteId ?? quotes[0]?.id ?? null;
		genreOverride = null;
		style = 'genre';
		status = null;
		canShare = canShareFile(new File([new Blob()], 'test.png', { type: 'image/png' }));
	});

	async function buildBlob(): Promise<Blob> {
		if (!content) throw new Error('Nessuna citazione');
		const fonts = resolveFonts();
		await ensureCardFonts(fonts);
		return exportQuoteCardPng(content, resolvePalette(style, genre), fonts);
	}

	async function download() {
		if (busy || !content) return;
		busy = true;
		status = null;
		try {
			const blob = await buildBlob();
			downloadBlob(blob, quoteCardFileName(content.title));
			status = { kind: 'ok', text: 'PNG salvato: lo trovi nei download.' };
		} catch {
			status = { kind: 'error', text: 'Non sono riuscito a creare l’immagine. Riprova.' };
		} finally {
			busy = false;
		}
	}

	async function share() {
		if (busy || !content) return;
		busy = true;
		status = null;
		try {
			const blob = await buildBlob();
			const file = new File([blob], quoteCardFileName(content.title), { type: 'image/png' });
			if (canShareFile(file)) {
				if (await shareFile(file, content.title)) status = { kind: 'ok', text: 'Card condivisa.' };
			} else {
				downloadBlob(blob, file.name);
				status = { kind: 'ok', text: 'La condivisione non è disponibile: PNG salvato.' };
			}
		} catch {
			status = { kind: 'error', text: 'Non sono riuscito a condividere la card. Riprova.' };
		} finally {
			busy = false;
		}
	}

	function shorten(text: string, max = 48): string {
		return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
	}
</script>

<BottomSheet {open} title="Quote Card" subtitle={quote?.bookTitle ?? ''} {onclose}>
	{#if content && quote}
		<div class="creator">
			<div class="preview">
				<QuoteCard {content} {style} {genre} />
			</div>

			<div class="controls">
				{#if quotes.length > 1}
					<label class="field">
						<span class="label">Citazione</span>
						<select bind:value={selectedId} data-testid="quote-card-select">
							{#each quotes as item (item.id)}
								<option value={item.id}>{shorten(item.body)} · {item.bookTitle}</option>
							{/each}
						</select>
					</label>
				{/if}

				<fieldset>
					<legend class="label">Stile</legend>
					<div class="chips">
						{#each QUOTE_CARD_STYLES as option (option.id)}
							<Chip
								variant="outline"
								size="lg"
								selected={style === option.id}
								onclick={() => (style = option.id)}
							>
								{option.label}
							</Chip>
						{/each}
					</div>
				</fieldset>

				<fieldset>
					<legend class="label">Colori del genere</legend>
					<div class="chips">
						{#each GENRE_ORDER as slug (slug)}
							<GenreChip
								{slug}
								label={GENRE_SHORT_LABELS[slug]}
								variant="outline"
								size="md"
								selected={genre === slug}
								onclick={() => (genreOverride = slug)}
							/>
						{/each}
					</div>
				</fieldset>

				{#if status}
					<p class="status {status.kind}" role="status">{status.text}</p>
				{/if}
			</div>
		</div>
	{:else}
		<p class="none">Nessuna citazione da trasformare in card.</p>
	{/if}

	{#snippet footer()}
		<Button variant="secondary" onclick={onclose}>Chiudi</Button>
		{#if canShare}
			<Button variant="secondary" onclick={share} disabled={busy || !content}>
				<Icon name="image" size={18} /> Condividi
			</Button>
		{/if}
		<Button onclick={download} loading={busy} disabled={!content} data-testid="quote-card-download">
			Scarica PNG
		</Button>
	{/snippet}
</BottomSheet>

<style>
	.creator {
		display: grid;
		gap: 16px;
		margin-top: 8px;
	}

	.preview {
		width: min(100%, 240px);
		margin: 0 auto;
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.label {
		display: block;
		margin-bottom: 6px;
		padding: 0;
		font-size: 12.5px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-text-secondary);
	}

	fieldset {
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.field select {
		box-sizing: border-box;
		width: 100%;
		min-height: 44px;
		padding: 0 12px;
		border: 1.5px solid color-mix(in srgb, var(--color-shelf-axis) 30%, transparent);
		border-radius: 14px;
		background: var(--color-background);
		font-size: 14px;
	}

	.status {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
	}

	.status.ok {
		color: var(--color-success);
	}

	.status.error {
		color: var(--color-danger);
	}

	.none {
		margin: 12px 0 0;
		color: var(--color-text-secondary);
	}

	@media (min-width: 720px) {
		.creator {
			grid-template-columns: 300px 1fr;
			align-items: start;
		}

		.preview {
			margin: 0;
		}
	}
</style>
