<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { BookDetailResponse } from '$lib/contracts/rpc';
	import type { Quote } from '$lib/contracts/reviews';
	import ReviewEditor from './ReviewEditor.svelte';
	import ReviewLockedCard from './ReviewLockedCard.svelte';

	interface Props {
		detail: BookDetailResponse;
		/** Sotto la card bloccata (il pulsante "Sposta" del dettaglio libro). */
		lockedFooter?: Snippet | undefined;
		/** Fra "Valutazioni specifiche" e "Tag tematici" (card "Date di lettura"). */
		afterScores?: Snippet | undefined;
		/** Chiamata dopo ogni salvataggio riuscito della recensione. */
		onsaved?: (() => void) | undefined;
		/** Aggiorna le citazioni mostrate anche fuori dalla scheda Recensione. */
		onquoteschange?: ((quotes: Quote[]) => void) | undefined;
		/** Forza l'avviso "valutazioni specifiche azzerate" (risposta di changeGenre). */
		scoresReset?: boolean;
	}

	let {
		detail,
		lockedFooter,
		afterScores,
		onsaved,
		onquoteschange,
		scoresReset = false
	}: Props = $props();

	// La recensione si abilita con almeno una lettura completata, non con lo stato corrente:
	// una rilettura in corso resta recensibile (spec sez. 6 e 48.17).
	const unlocked = $derived(detail.book.completedReadingsCount >= 1);
</script>

{#if unlocked}
	{#key detail.book.id}
		<ReviewEditor {detail} {afterScores} {onsaved} {onquoteschange} {scoresReset} />
	{/key}
{:else}
	<ReviewLockedCard footer={lockedFooter} />
{/if}
