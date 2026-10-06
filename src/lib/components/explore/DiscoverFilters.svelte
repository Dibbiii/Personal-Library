<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import {
		DISCOVER_LANGUAGES,
		DISCOVER_TOPICS,
		DISCOVER_TOPIC_KEYS,
		MAIN_TOPICS,
		MIN_YEAR,
		defaultFilters,
		type DiscoverFilters,
		type DiscoverLanguage,
		type DiscoverTopic
	} from '$lib/catalog/discover';

	interface Props {
		filters: DiscoverFilters;
		currentYear: number;
		onchange: (filters: DiscoverFilters) => void;
	}

	let { filters, currentYear, onchange }: Props = $props();

	const uid = $props.id();
	const RATINGS = [4.5, 4, 3.5, 3];
	const OTHER_TOPICS = DISCOVER_TOPIC_KEYS.filter((topic) => !MAIN_TOPICS.includes(topic));

	let showOther = $state(false);
	// Il cursore dell'anno si muove liberamente e applica il filtro solo al rilascio.
	let from = $state(MIN_YEAR);
	let to = $state(MIN_YEAR);
	$effect(() => {
		from = filters.from;
		to = filters.to;
	});

	const span = $derived(currentYear - MIN_YEAR);
	const otherActive = $derived(filters.topics.some((topic) => OTHER_TOPICS.includes(topic)));

	function update(patch: Partial<DiscoverFilters>) {
		onchange({ ...filters, ...patch });
	}

	function toggleTopic(topic: DiscoverTopic) {
		const topics = filters.topics.includes(topic)
			? filters.topics.filter((item) => item !== topic)
			: [...filters.topics, topic];
		update({ topics });
	}

	function commitYears() {
		const low = Math.min(from, to);
		const high = Math.max(from, to);
		if (low !== filters.from || high !== filters.to) update({ from: low, to: high });
	}
</script>

<div class="filters">
	<div class="head">
		<h2>Filtri</h2>
		<button type="button" class="reset" onclick={() => onchange(defaultFilters(currentYear))}>
			Cancella tutto
		</button>
	</div>

	<fieldset>
		<legend>Generi</legend>
		{#each MAIN_TOPICS as topic (topic)}
			<label class="check">
				<input
					type="checkbox"
					checked={filters.topics.includes(topic)}
					onchange={() => toggleTopic(topic)}
				/>
				<span>{DISCOVER_TOPICS[topic].label}</span>
			</label>
		{/each}
		{#if showOther || otherActive}
			{#each OTHER_TOPICS as topic (topic)}
				<label class="check">
					<input
						type="checkbox"
						checked={filters.topics.includes(topic)}
						onchange={() => toggleTopic(topic)}
					/>
					<span>{DISCOVER_TOPICS[topic].label}</span>
				</label>
			{/each}
		{/if}
		{#if !otherActive}
			<button
				type="button"
				class="more"
				aria-expanded={showOther}
				onclick={() => (showOther = !showOther)}
			>
				{showOther ? 'Meno generi' : 'Altro'}
				<Icon name={showOther ? 'chevron-up' : 'chevron-down'} size={15} strokeWidth={2.2} />
			</button>
		{/if}
	</fieldset>

	<fieldset>
		<legend>Valutazione minima</legend>
		{#each RATINGS as rating (rating)}
			<button
				type="button"
				class="rating"
				aria-pressed={filters.minRating === rating}
				aria-label="{rating.toLocaleString('it-IT')} stelle e più"
				onclick={() => update({ minRating: filters.minRating === rating ? 0 : rating })}
			>
				<span class="stars" aria-hidden="true">
					{#each [1, 2, 3, 4, 5] as n (n)}
						<span class="star" class:on={n <= rating} class:half={n - 0.5 === rating}>
							<Icon name="star" size={15} strokeWidth={1.4} />
						</span>
					{/each}
				</span>
				<span>e più</span>
			</button>
		{/each}
	</fieldset>

	<fieldset>
		<legend>Anno di pubblicazione</legend>
		<div class="years" aria-hidden="true">
			<span>{Math.min(from, to)}</span>
			<span>{Math.max(from, to)}</span>
		</div>
		<div
			class="range"
			style:--a="{((Math.min(from, to) - MIN_YEAR) / span) * 100}%"
			style:--b="{((Math.max(from, to) - MIN_YEAR) / span) * 100}%"
		>
			<input
				type="range"
				min={MIN_YEAR}
				max={currentYear}
				bind:value={from}
				onchange={commitYears}
				aria-label="Pubblicato dal"
			/>
			<input
				type="range"
				min={MIN_YEAR}
				max={currentYear}
				bind:value={to}
				onchange={commitYears}
				aria-label="Pubblicato fino al"
			/>
		</div>
	</fieldset>

	<fieldset>
		<legend><label for="{uid}-lang">Lingua</label></legend>
		<span class="select">
			<select
				id="{uid}-lang"
				value={filters.lang}
				onchange={(event) => update({ lang: event.currentTarget.value as DiscoverLanguage })}
			>
				{#each Object.entries(DISCOVER_LANGUAGES) as [code, label] (code)}
					<option value={code}>{label}</option>
				{/each}
			</select>
			<Icon name="chevron-down" size={16} strokeWidth={2.2} />
		</span>
	</fieldset>

	<fieldset>
		<legend>Disponibilità</legend>
		<label class="check">
			<input
				type="checkbox"
				checked={filters.cover}
				onchange={() => update({ cover: !filters.cover })}
			/>
			<span>Solo libri con copertina</span>
		</label>
		<p class="source">Catalogo: Open Library</p>
	</fieldset>
</div>

<style>
	.filters {
		display: flex;
		flex-direction: column;
		gap: 18px;
		color: var(--color-text-primary);
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		padding-bottom: 12px;
		border-bottom: 1px solid color-mix(in srgb, var(--color-border) 25%, transparent);
	}

	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 21px;
		font-weight: 400;
		color: var(--color-primary);
	}

	.reset {
		padding: 4px 0;
		border: 0;
		background: transparent;
		font-size: 12.5px;
		font-weight: 600;
		color: var(--color-primary);
	}

	fieldset {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}

	legend {
		margin-bottom: 8px;
		padding: 0;
		font-size: 14px;
		font-weight: 700;
	}

	.check {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 30px;
		font-size: 13.5px;
		cursor: pointer;
	}

	.check input {
		width: 17px;
		height: 17px;
		margin: 0;
		accent-color: var(--color-primary);
	}

	.more {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		align-self: flex-start;
		min-height: 30px;
		padding: 0;
		border: 0;
		background: transparent;
		font-size: 13.5px;
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	.rating {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 30px;
		padding: 0 8px;
		margin-inline: -8px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		font-size: 12.5px;
		color: var(--color-text-secondary);
	}

	.rating:hover {
		background: var(--color-surface);
	}

	.rating[aria-pressed='true'] {
		background: var(--color-primary-tint);
		color: var(--color-text-primary);
		font-weight: 700;
	}

	.stars {
		display: inline-flex;
		gap: 1px;
	}

	.star {
		display: inline-flex;
		color: color-mix(in srgb, var(--color-text-muted) 45%, transparent);
	}

	.star.on {
		color: var(--color-flame);
	}

	.star.on :global(svg),
	.star.half :global(svg) {
		fill: currentColor;
	}

	.star.half {
		color: var(--color-flame);
		-webkit-mask-image: linear-gradient(90deg, var(--color-shadow) 50%, transparent 50%);
		mask-image: linear-gradient(90deg, var(--color-shadow) 50%, transparent 50%);
	}

	.years {
		display: flex;
		justify-content: space-between;
		gap: 8px;
	}

	.years span {
		min-width: 52px;
		padding: 5px 8px;
		border: 1px solid color-mix(in srgb, var(--color-border) 40%, transparent);
		border-radius: var(--radius-sm);
		background: var(--color-card);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}

	.range {
		position: relative;
		height: 28px;
		margin-top: 6px;
	}

	.range::before {
		content: '';
		position: absolute;
		top: 12px;
		right: 0;
		left: 0;
		height: 4px;
		border-radius: 2px;
		background: linear-gradient(
			90deg,
			var(--color-surface) var(--a),
			var(--color-primary) var(--a),
			var(--color-primary) var(--b),
			var(--color-surface) var(--b)
		);
	}

	.range input {
		position: absolute;
		inset: 0;
		width: 100%;
		margin: 0;
		background: transparent;
		pointer-events: none;
		appearance: none;
	}

	.range input::-webkit-slider-thumb {
		width: 20px;
		height: 20px;
		border: 3px solid var(--color-surface-elevated);
		border-radius: 50%;
		background: var(--color-primary);
		box-shadow: var(--shadow-card);
		pointer-events: auto;
		cursor: grab;
		appearance: none;
	}

	.range input::-moz-range-thumb {
		width: 14px;
		height: 14px;
		border: 3px solid var(--color-surface-elevated);
		border-radius: 50%;
		background: var(--color-primary);
		pointer-events: auto;
		cursor: grab;
	}

	.range input:focus-visible::-webkit-slider-thumb {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.select {
		position: relative;
		display: flex;
		align-items: center;
	}

	.select select {
		width: 100%;
		min-height: 38px;
		padding: 0 34px 0 12px;
		border: 1px solid color-mix(in srgb, var(--color-border) 40%, transparent);
		border-radius: var(--radius-sm);
		background: var(--color-card);
		font: inherit;
		font-size: 14px;
		color: inherit;
		appearance: none;
	}

	.select :global(svg) {
		position: absolute;
		right: 10px;
		pointer-events: none;
	}

	.source {
		margin: 4px 0 0;
		font-size: 12px;
		color: var(--color-text-muted);
	}

	.reset:focus-visible,
	.more:focus-visible,
	.rating:focus-visible,
	.select select:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
</style>
