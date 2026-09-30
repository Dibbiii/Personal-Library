<script lang="ts">
	import type { DecorationKind } from '$lib/book/shelf-layout';

	/** Decorazioni dello scaffale (docs/mockup/assets): candela, pianta, tazza, pila di libri. Colori solo da token. */
	let { kind }: { kind: DecorationKind } = $props();

	const HIGHLIGHT_30 = 'color-mix(in srgb, var(--color-on-genre-white) 30%, transparent)';
	const HIGHLIGHT_40 = 'color-mix(in srgb, var(--color-on-genre-white) 40%, transparent)';
	const HIGHLIGHT_25 = 'color-mix(in srgb, var(--color-on-genre-white) 25%, transparent)';
</script>

{#if kind === 'candle'}
	<svg class="deco" width="46" height="72" viewBox="0 0 46 72" aria-hidden="true">
		<circle cx="23" cy="20" r="20" fill="var(--color-accent)" opacity=".35" />
		<path d="M23 3c4 6 5 9 0 14-5-5-4-8 0-14z" fill="var(--color-flame)" />
		<path d="M23 8c2 3 2.5 4.5 0 7-2.5-2.5-2-4 0-7z" fill="var(--color-flame-core)" />
		<rect x="21.5" y="16" width="3" height="7" rx="1" fill="var(--color-shelf-axis)" />
		<rect
			x="6"
			y="24"
			width="34"
			height="46"
			rx="8"
			fill="var(--color-surface)"
			stroke="var(--color-wax-edge)"
			stroke-width="2"
		/>
		<rect x="10" y="34" width="26" height="31" rx="5" fill="var(--color-background)" />
	</svg>
{:else if kind === 'plant'}
	<svg class="deco" width="56" height="86" viewBox="0 0 56 86" aria-hidden="true">
		<path d="M28 52C26 36 14 30 6 14c14 0 22 10 22 38z" fill="var(--color-divider)" />
		<path d="M28 52c2-16 14-22 22-38-14 0-22 10-22 38z" fill="var(--color-leaf-dark)" />
		<path d="M28 52C28 36 28 24 28 6c10 10 8 30 0 46z" fill="var(--color-leaf-light)" />
		<path d="M12 54h32l-4 30H16z" fill="var(--color-pot)" />
		<rect x="10" y="50" width="36" height="8" rx="3" fill="var(--color-pot-rim)" />
	</svg>
{:else if kind === 'mug'}
	<svg class="deco" width="46" height="50" viewBox="0 0 46 50" aria-hidden="true">
		<path
			d="M14 4c-3 4 3 6 0 10M22 2c-3 4 3 6 0 10"
			fill="none"
			stroke="var(--color-divider)"
			stroke-width="2"
			stroke-linecap="round"
			opacity=".7"
		/>
		<rect x="4" y="16" width="28" height="32" rx="7" fill="var(--color-primary)" />
		<path
			d="M32 22h3a5 5 0 0 1 0 12h-3"
			fill="none"
			stroke="var(--color-primary)"
			stroke-width="4"
		/>
		<rect x="4" y="16" width="28" height="7" rx="3.5" fill="var(--color-accent)" opacity=".5" />
	</svg>
{:else}
	<svg class="deco" width="80" height="46" viewBox="0 0 80 46" aria-hidden="true">
		<rect x="2" y="28" width="76" height="14" rx="2" fill="var(--color-divider)" />
		<rect x="2" y="29" width="76" height="3" style:fill={HIGHLIGHT_30} />
		<rect x="8" y="14" width="64" height="14" rx="2" fill="var(--color-accent)" />
		<rect x="8" y="15" width="64" height="3" style:fill={HIGHLIGHT_40} />
		<rect x="4" y="2" width="68" height="12" rx="2" fill="var(--color-primary)" />
		<rect x="4" y="3" width="68" height="3" style:fill={HIGHLIGHT_25} />
	</svg>
{/if}

<style>
	.deco {
		display: block;
		flex: none;
		margin: 0 8px;
		pointer-events: none;
	}
</style>
