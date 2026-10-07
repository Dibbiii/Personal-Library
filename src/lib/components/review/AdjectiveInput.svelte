<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import {
		ADJECTIVE_COUNT,
		ADJECTIVE_ERROR_MESSAGES,
		ADJECTIVE_MAX_LENGTH,
		addAdjective,
		removeAdjective,
		type AdjectiveError
	} from '$lib/review/adjectives';
	import ReviewCard from './ReviewCard.svelte';

	interface Props {
		/** Gli aggettivi attuali (0-3). */
		adjectives: string[];
		onchange: (adjectives: string[]) => void;
	}

	let { adjectives, onchange }: Props = $props();

	const uid = $props.id();
	let text = $state('');
	let error = $state<AdjectiveError | null>(null);
	let input = $state<HTMLInputElement>();

	const full = $derived(adjectives.length >= ADJECTIVE_COUNT);

	function commit(): boolean {
		if (text.trim() === '') {
			error = null;
			return true;
		}
		const result = addAdjective(adjectives, text);
		if (!result.ok) {
			error = result.error;
			return false;
		}
		error = null;
		text = '';
		onchange(result.adjectives);
		return true;
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ',') {
			event.preventDefault();
			commit();
		} else if (event.key === 'Backspace' && text === '' && adjectives.length > 0) {
			onchange(removeAdjective(adjectives, adjectives.length - 1));
		}
	}

	function remove(index: number) {
		error = null;
		onchange(removeAdjective(adjectives, index));
		queueMicrotask(() => input?.focus());
	}
</script>

<ReviewCard title="Il libro in 3 aggettivi">
	{#snippet aside()}
		<span class="counter" aria-live="polite">
			<span class="sr-only">Aggettivi inseriti: </span>{adjectives.length}/{ADJECTIVE_COUNT}
		</span>
	{/snippet}

	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="field" class:invalid={error !== null} onclick={() => input?.focus()}>
		<ul class="chips" aria-label="Aggettivi scelti">
			{#each adjectives as adjective, index (adjective)}
				<li class="chip">
					<span>{adjective}</span>
					<button
						type="button"
						class="remove"
						aria-label="Rimuovi {adjective}"
						onclick={(event) => {
							event.stopPropagation();
							remove(index);
						}}
					>
						<Icon name="close" size={14} strokeWidth={2.4} />
					</button>
				</li>
			{/each}
		</ul>
		{#if !full}
			<input
				bind:this={input}
				bind:value={text}
				{onkeydown}
				onblur={() => {
					commit();
				}}
				class="entry"
				type="text"
				enterkeyhint="done"
				autocomplete="off"
				autocapitalize="sentences"
				maxlength={ADJECTIVE_MAX_LENGTH + 8}
				aria-label="Aggiungi un aggettivo"
				aria-describedby="{uid}-help"
				aria-invalid={error !== null}
				placeholder={adjectives.length === 0 ? 'Es. Epico' : 'Un altro aggettivo'}
			/>
		{/if}
	</div>

	<p id="{uid}-help" class="help" class:error={error !== null} role={error ? 'alert' : undefined}>
		{error
			? ADJECTIVE_ERROR_MESSAGES[error]
			: 'Facoltativi: puoi aggiungerne fino a 3, tutti distinti.'}
	</p>
</ReviewCard>

<style>
	.counter {
		font-size: 12.5px;
		font-weight: 700;
		color: var(--color-info);
	}

	.field {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		box-sizing: border-box;
		padding: 10px;
		border: 1.5px solid color-mix(in srgb, var(--genre-current-dark) 35%, transparent);
		border-radius: 16px;
		background: var(--color-background);
		cursor: text;
	}

	.field:focus-within {
		border-color: var(--genre-current-dark);
	}

	.field.invalid {
		border-color: var(--color-danger);
	}

	.chips {
		display: contents;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.chip {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 36px;
		box-sizing: border-box;
		padding: 0 10px 0 14px;
		border-radius: 18px;
		background: var(--genre-current-dark);
		color: var(--genre-current-light);
		font-size: 14px;
		font-weight: 600;
	}

	.remove {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: inherit;
		cursor: pointer;
		transform: rotate(0deg);
	}

	/* Area di tocco di 44px intorno alla X */
	.remove::after {
		content: '';
		position: absolute;
		inset: -12px;
	}

	.entry {
		flex: 1 1 120px;
		min-width: 0;
		height: 36px;
		padding: 0 4px;
		border: 0;
		outline: none;
		background: transparent;
		color: var(--color-text-primary);
		font: inherit;
		font-size: 16px;
		font-weight: 500;
	}

	.entry::placeholder {
		color: var(--color-text-secondary);
		opacity: 0.7;
	}

	.help {
		margin: 8px 0 0;
		font-size: 12.5px;
		line-height: 1.4;
		color: var(--color-text-secondary);
	}

	.help.error {
		color: var(--color-danger);
		font-weight: 600;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
