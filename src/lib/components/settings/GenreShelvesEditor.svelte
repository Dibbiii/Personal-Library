<script lang="ts">
	import type { UserGenreShelf } from '$lib/contracts/settings';

	interface Props {
		genres: UserGenreShelf[];
		busy?: boolean;
		onsave: (genres: UserGenreShelf[]) => void;
	}

	let { genres, busy = false, onsave }: Props = $props();
	// L'editor conserva le modifiche locali fino al salvataggio esplicito.
	/* svelte-ignore state_referenced_locally */
	let draft = $state<UserGenreShelf[]>(genres.map((genre) => ({ ...genre })));

	function move(index: number, direction: -1 | 1) {
		const target = index + direction;
		if (target < 0 || target >= draft.length) return;
		const next = [...draft];
		const [moved] = next.splice(index, 1);
		if (!moved) return;
		next.splice(target, 0, moved);
		draft = next.map((genre, position) => ({ ...genre, sortOrder: position + 1 }));
	}

	function rename(index: number, name: string) {
		draft = draft.map((genre, current) => (current === index ? { ...genre, name } : genre));
	}

	function save() {
		if (busy || draft.some((genre) => !genre.name.trim())) return;
		onsave(draft.map((genre, index) => ({ ...genre, name: genre.name.trim(), sortOrder: index + 1 })));
	}
</script>

<p class="intro">
	Rinomina i tuoi {genres.length} scaffali e scegli l’ordine in cui appaiono nella libreria.
</p>
<ol class="shelves">
	{#each draft as genre, index (genre.slug)}
		<li>
			<label for={`genre-${genre.slug}`}>Nome dello scaffale {index + 1}</label>
			<div class="row">
				<input
					id={`genre-${genre.slug}`}
					value={genre.name}
					maxlength="80"
					disabled={busy}
					oninput={(event) => rename(index, event.currentTarget.value)}
				/>
				<div class="move" aria-label={`Sposta ${genre.name}`}>
					<button type="button" disabled={busy || index === 0} onclick={() => move(index, -1)}>
						Su
					</button>
					<button
						type="button"
						disabled={busy || index === draft.length - 1}
						onclick={() => move(index, 1)}>Giù</button
					>
				</div>
			</div>
		</li>
	{/each}
</ol>
<button class="save" type="button" disabled={busy || draft.some((genre) => !genre.name.trim())} onclick={save}>
	{busy ? 'Salvataggio…' : 'Salva scaffali'}
</button>

<style>
	.intro { margin: 0 0 14px; color: var(--color-text-secondary); font-size: 14px; line-height: 1.45; }
	.shelves { display: grid; gap: 10px; margin: 0; padding: 0; list-style-position: inside; }
	li { padding: 10px; border-radius: var(--radius-lg); background: var(--color-surface-elevated); }
	label { display: block; margin-bottom: 6px; color: var(--color-text-secondary); font-size: 12px; font-weight: 700; }
	.row { display: flex; gap: 8px; }
	input { min-width: 0; flex: 1; min-height: var(--tap-size); box-sizing: border-box; padding: 0 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-text-primary); font: inherit; }
	input:focus-visible, button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
	.move { display: flex; gap: 4px; }
	.move button, .save { min-height: var(--tap-size); border: 1px solid var(--color-primary-outline); border-radius: var(--radius-md); background: transparent; color: var(--color-primary); font: inherit; font-weight: 700; cursor: pointer; }
	.move button { padding: 0 10px; }
	.save { margin-top: 14px; padding: 0 18px; border-radius: var(--radius-pill); }
	button:disabled { opacity: .55; cursor: not-allowed; }
	@media (max-width: 420px) { .row { flex-wrap: wrap; } .move { width: 100%; } .move button { flex: 1; } }
</style>
