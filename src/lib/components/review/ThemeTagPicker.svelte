<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import {
		TAG_COLLAPSED_COUNT,
		THEME_TAGS,
		orderTagsForDisplay,
		visibleTags
	} from '$lib/review/tags';
	import ReviewCard from './ReviewCard.svelte';

	interface Props {
		/** Slug dei tag selezionati. */
		selected: string[];
		ontoggle: (slug: string) => void;
	}

	let { selected, ontoggle }: Props = $props();

	const uid = $props.id();
	// Ordine fissato alla prima apertura: i chip non si spostano mentre si seleziona.
	// svelte-ignore state_referenced_locally
	const ordered = orderTagsForDisplay(selected);
	let expanded = $state(false);

	const shown = $derived(visibleTags(ordered, selected, expanded));
	const hiddenCount = $derived(THEME_TAGS.length - shown.length);
	const canCollapse = $derived(THEME_TAGS.length > TAG_COLLAPSED_COUNT);
</script>

<ReviewCard title="Tag tematici">
	{#snippet aside()}
		{#if selected.length > 0}<span class="count">{selected.length} scelti</span>{/if}
	{/snippet}

	<ul class="tags" id="{uid}-tags">
		{#each shown as tag (tag.slug)}
			{@const isOn = selected.includes(tag.slug)}
			<li>
				<button
					type="button"
					class="tag"
					class:on={isOn}
					aria-pressed={isOn}
					onclick={() => ontoggle(tag.slug)}
				>
					{#if isOn}<Icon name="check" size={14} strokeWidth={2.6} />{/if}
					{tag.label}
				</button>
			</li>
		{/each}
	</ul>

	{#if canCollapse}
		<button
			type="button"
			class="more"
			aria-expanded={expanded}
			aria-controls="{uid}-tags"
			onclick={() => (expanded = !expanded)}
		>
			{expanded ? 'Mostra meno' : `Mostra tutti i tag (+${hiddenCount})`}
		</button>
	{/if}
</ReviewCard>

<style>
	.count {
		font-size: 12.5px;
		font-weight: 700;
		color: var(--color-info);
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.tag {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 38px;
		box-sizing: border-box;
		padding: 0 14px;
		border: 1.5px solid color-mix(in srgb, var(--genre-current-dark) 35%, transparent);
		border-radius: 19px;
		background: transparent;
		color: var(--genre-current-dark);
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
	}

	/* 38px visivi, 44px di area di tocco */
	.tag::after {
		content: '';
		position: absolute;
		inset: -3px 0;
	}

	.tag.on {
		border-color: var(--genre-current-dark);
		background: var(--genre-current-dark);
		color: var(--genre-current-light);
	}

	.more {
		display: block;
		min-height: 44px;
		margin: 4px 0 -8px;
		padding: 0 4px;
		border: 0;
		background: transparent;
		color: var(--color-text-link);
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
	}
</style>
