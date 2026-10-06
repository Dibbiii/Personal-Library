<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { SORT_OPTIONS, type LibrarySort, type LibraryView } from './library-filter';

	interface Props {
		query: string;
		sort: LibrarySort;
		view: LibraryView;
	}

	let { query = $bindable(), sort = $bindable(), view = $bindable() }: Props = $props();

	const sortLabel = $derived(SORT_OPTIONS.find((option) => option.value === sort)?.label ?? '');
</script>

<div class="toolbar">
	<label class="search">
		<Icon name="search" size={20} />
		<input
			type="search"
			bind:value={query}
			placeholder="Cerca libri, autori, generi…"
			aria-label="Cerca nella libreria"
			autocomplete="off"
			enterkeyhint="search"
		/>
		{#if query}
			<button
				type="button"
				class="clear"
				aria-label="Cancella la ricerca"
				onclick={() => (query = '')}
			>
				<Icon name="close" size={16} strokeWidth={2.2} />
			</button>
		{/if}
	</label>

	<div class="controls">
		<label class="sort" title="Ordina">
			<Icon name="sort" size={19} />
			<span class="sort-label" aria-hidden="true">{sort === 'recent' ? 'Ordina' : sortLabel}</span>
			<select bind:value={sort} aria-label="Ordina i libri">
				{#each SORT_OPTIONS as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</label>

		<div class="views" role="group" aria-label="Vista">
			<button
				type="button"
				aria-pressed={view === 'grid'}
				aria-label="Vista scaffali"
				onclick={() => (view = 'grid')}
			>
				<Icon name="grid" size={19} />
			</button>
			<button
				type="button"
				aria-pressed={view === 'list'}
				aria-label="Vista elenco"
				onclick={() => (view = 'list')}
			>
				<Icon name="list" size={19} />
			</button>
		</div>

		<a class="scan" href="/add/scan" aria-label="Scansiona il codice ISBN">
			<Icon name="camera" size={20} />
		</a>

		<a class="add" href="/add" aria-label="Aggiungi libro">
			<Icon name="plus" size={20} strokeWidth={2.2} />
			<span>Aggiungi libro</span>
		</a>
	</div>
</div>

<style>
	.toolbar {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.search {
		position: relative;
		display: flex;
		align-items: center;
		gap: 10px;
		box-sizing: border-box;
		height: 48px;
		padding: 0 8px 0 16px;
		border: 1px solid color-mix(in srgb, var(--color-border) 45%, transparent);
		border-radius: var(--radius-md);
		background: var(--color-surface-elevated);
		box-shadow: 0 2px 8px color-mix(in srgb, var(--color-shadow) 5%, transparent);
		color: var(--color-text-secondary);
		transition:
			border-color var(--duration-fast) var(--ease-out),
			box-shadow var(--duration-fast) var(--ease-out);
	}

	.search:focus-within {
		border-color: var(--color-primary-outline);
		box-shadow: 0 0 0 3px var(--color-primary-tint);
	}

	input {
		flex: 1;
		min-width: 0;
		height: 100%;
		padding: 0;
		border: 0;
		outline: none;
		background: transparent;
		color: var(--color-text-primary);
		font: inherit;
		font-size: 15px;
	}

	input::placeholder {
		color: var(--color-text-muted);
	}

	input::-webkit-search-cancel-button {
		display: none;
	}

	.clear {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: var(--color-text-secondary);
	}

	.clear:hover {
		background: var(--color-surface);
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.sort,
	.views,
	.scan {
		box-sizing: border-box;
		height: 48px;
		border: 1px solid color-mix(in srgb, var(--color-border) 35%, transparent);
		border-radius: var(--radius-md);
		background: var(--color-surface-elevated);
		box-shadow: 0 2px 8px color-mix(in srgb, var(--color-shadow) 5%, transparent);
		color: var(--color-text-primary);
	}

	.sort {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 0 16px;
		font-size: 14px;
		font-weight: 600;
		white-space: nowrap;
	}

	/* La select nativa copre il bottone: tastiera e lettori di schermo restano quelli del sistema. */
	.sort select {
		position: absolute;
		inset: 0;
		width: 100%;
		opacity: 0;
		cursor: pointer;
		font-size: 16px;
	}

	.sort:focus-within {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.views {
		display: inline-flex;
		gap: 2px;
		padding: 3px;
	}

	.views button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 42px;
		height: 100%;
		padding: 0;
		border: 0;
		border-radius: calc(var(--radius-md) - 4px);
		background: transparent;
		color: var(--color-text-secondary);
		transition: background-color var(--duration-fast) var(--ease-out);
	}

	.views button[aria-pressed='true'] {
		background: var(--color-primary);
		color: var(--color-on-primary);
	}

	.views button:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.scan {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		color: var(--color-primary);
	}

	.add {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		box-sizing: border-box;
		height: 48px;
		margin-left: auto;
		padding: 0 18px;
		border-radius: var(--radius-md);
		background: var(--color-primary);
		box-shadow: var(--shadow-button);
		color: var(--color-on-primary);
		font-size: 15px;
		font-weight: 700;
		text-decoration: none;
		white-space: nowrap;
		transition: background-color var(--duration-fast) var(--ease-out);
	}

	.add:hover {
		background: var(--color-primary-hover);
	}

	.scan:focus-visible,
	.add:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	@media (max-width: 420px) {
		.sort-label,
		.add span {
			display: none;
		}

		.sort {
			width: 48px;
			justify-content: center;
			padding: 0;
		}

		.add {
			width: 48px;
			justify-content: center;
			padding: 0;
		}
	}

	@media (min-width: 1024px) {
		.toolbar {
			flex-direction: row;
			align-items: center;
			gap: 16px;
		}

		.search {
			flex: 1;
			max-width: 520px;
		}

		.controls {
			flex: 1;
			justify-content: flex-end;
			gap: 12px;
		}

		.add {
			margin-left: 8px;
		}

		.scan {
			display: none;
		}
	}
</style>
