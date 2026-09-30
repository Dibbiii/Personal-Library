<script lang="ts">
	import type { GenreSlug } from '$lib/contracts';
	import { GENRE_LABELS, genreScopeStyle } from '$lib/genres';

	interface Props {
		slug: GenreSlug;
		/** Di default il nome italiano del genere. */
		label?: string;
		/** filled = colore pieno del genere, soft = sfondo chiaro, outline = solo pallino. */
		variant?: 'filled' | 'soft' | 'outline';
		selected?: boolean;
		onclick?: (event: MouseEvent) => void;
		href?: string;
		size?: 'sm' | 'md' | 'lg';
	}

	let { slug, label, variant = 'filled', selected, onclick, href, size = 'md' }: Props = $props();

	const text = $derived(label ?? GENRE_LABELS[slug]);
	const interactive = $derived(Boolean(onclick || href));
	const classes = $derived(
		['genre-chip', variant, size, interactive && 'interactive', selected && 'selected']
			.filter(Boolean)
			.join(' ')
	);
	const scope = $derived(genreScopeStyle(slug));
</script>

{#snippet content()}
	<span class="dot" aria-hidden="true"></span>
	{text}
{/snippet}

{#if href}
	<a class={classes} {href} style={scope}>{@render content()}</a>
{:else if onclick}
	<button
		class={classes}
		type="button"
		{onclick}
		aria-pressed={selected === undefined ? undefined : selected}
		style={scope}
	>
		{@render content()}
	</button>
{:else}
	<span class={classes} style={scope}>{@render content()}</span>
{/if}

<style>
	.genre-chip {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		box-sizing: border-box;
		border: 1.5px solid transparent;
		font-family: var(--font-ui);
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
	}

	.sm {
		height: 26px;
		padding: 0 12px;
		border-radius: 13px;
		font-size: 12px;
	}

	.md {
		height: 32px;
		padding: 0 12px;
		border-radius: 16px;
		font-size: 13px;
	}

	.lg {
		height: 38px;
		padding: 0 14px;
		border-radius: 19px;
		font-size: 14px;
	}

	.dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--genre-current);
	}

	.filled {
		background: var(--genre-current);
		color: var(--genre-current-on);
	}

	.filled .dot {
		background: var(--genre-current-light);
	}

	.soft {
		background: var(--genre-current-light);
		color: var(--genre-current-on-light);
	}

	.outline {
		background: transparent;
		border-color: var(--color-border);
		color: var(--color-text-primary);
	}

	.interactive {
		cursor: pointer;
	}

	.interactive::after {
		content: '';
		position: absolute;
		inset: -6px -2px;
	}

	.outline.selected {
		background: var(--genre-current-light);
		border-color: var(--genre-current);
		color: var(--genre-current-on-light);
	}
</style>
