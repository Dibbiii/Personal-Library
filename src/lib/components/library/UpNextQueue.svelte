<script lang="ts">
	import { draggable } from '$lib/actions/drag';
	import { dropzone } from '$lib/actions/drag';
	import BookCover from '$lib/components/book/BookCover.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Decoration from './Decoration.svelte';
	import QueueItemMenu from './QueueItemMenu.svelte';
	import ShelfFrame from './ShelfFrame.svelte';
	import type { HomeDnd } from './home-dnd.svelte';
	import type { HomeState } from './home-state.svelte';
	import { hoverPreview, type HoverPreview } from './hover-preview.svelte';

	interface Props {
		home: HomeState;
		dnd: HomeDnd;
		preview: HoverPreview;
	}

	let { home, dnd, preview }: Props = $props();

	const queue = $derived(home.sortedQueue);
	const count = $derived(queue.length);
	const pill = $derived(count > 3 ? `${count} libri` : `${count} su 3`);

	let scroller = $state<HTMLElement | null>(null);
	let titles = $state<HTMLElement | null>(null);
	let menuFor = $state<string | null>(null);
	const menuEntry = $derived(queue.find((entry) => entry.book.id === menuFor));

	// I titoli stanno sotto la plancia: seguono lo scroll orizzontale dello scaffale.
	function syncTitles() {
		if (scroller && titles) titles.scrollLeft = scroller.scrollLeft;
	}
</script>

<ShelfFrame
	title="I prossimi 3"
	accent="var(--color-divider)"
	height={140}
	inset={11}
	{pill}
	target={dnd.hover === 'queue'}
	zone={dnd.queueZone()}
	label="I prossimi, {count} {count === 1 ? 'libro' : 'libri'}"
	bind:scroller
	onscroll={syncTitles}
>
	{#each queue as entry (entry.book.id)}
		{@const position = entry.position}
		<div
			class="item"
			class:source={dnd.draggingId === entry.book.id}
			class:drop={dnd.hover === `slot:${position}`}
			class:minor={position > 3}
			class:previewed={preview.book?.id === entry.book.id}
			use:draggable={dnd.source({ kind: 'queue-book', book: entry.book, position })}
			use:dropzone={dnd.slotZone(position)}
			use:hoverPreview={{ preview, book: entry.book }}
		>
			<a
				class="cover-link"
				href="/book/{entry.book.id}"
				aria-label="{position}. {entry.book.title}, di {entry.book.author}"
			>
				<BookCover book={entry.book} size={72} queueNumber={position} priority />
			</a>
			<button
				type="button"
				class="more"
				aria-label="Azioni per {entry.book.title}"
				aria-haspopup="dialog"
				onclick={() => (menuFor = entry.book.id)}
			>
				<Icon name="more-horizontal" size={16} />
			</button>
		</div>
	{/each}

	<div class="slot">
		<Icon name="plus" size={20} strokeWidth={2} />
		<span>Trascina<br />qui</span>
	</div>
	<Decoration kind="mug" />
	<Decoration kind="stack" />
	<Decoration kind="cactus" />

	{#snippet below()}
		<div class="titles" bind:this={titles} aria-hidden="true">
			{#each queue as entry (entry.book.id)}
				<span class="name">{entry.book.title}</span>
			{/each}
			<span class="spacer"></span>
		</div>
	{/snippet}
</ShelfFrame>

{#if menuEntry}
	<QueueItemMenu
		open={menuFor !== null}
		title={menuEntry.book.title}
		position={menuEntry.position}
		total={count}
		onclose={() => (menuFor = null)}
		onmove={(to) => dnd.reorder(menuEntry.book, to)}
		onremove={() => dnd.remove(menuEntry.book)}
	/>
{/if}

<style>
	.item {
		position: relative;
		flex: none;
		width: 72px;
		height: 108px;
		margin: 0 7px;
		touch-action: pan-x pan-y;
		-webkit-touch-callout: none;
		user-select: none;
	}

	.item {
		transition: transform var(--duration-fast) var(--ease-out);
	}

	.item.previewed {
		z-index: 2;
		transform: translateY(-6px);
	}

	.item.previewed :global(.cover) {
		box-shadow:
			0 12px 18px -8px color-mix(in srgb, var(--color-shadow) 45%, transparent),
			0 0 0 2px color-mix(in srgb, var(--color-primary) 35%, transparent);
	}

	.item.minor :global(.cover) {
		opacity: 0.82;
	}

	.cover-link {
		display: block;
		border-radius: 3px 8px 8px 3px;
		color: inherit;
		text-decoration: none;
	}

	.item.source .cover-link,
	.item.source .more {
		visibility: hidden;
	}

	.item.source::after {
		content: '';
		position: absolute;
		inset: 0;
		border: 2px dashed color-mix(in srgb, var(--color-shelf-axis) 45%, transparent);
		border-radius: 8px;
		background: color-mix(in srgb, var(--color-divider) 14%, transparent);
	}

	/* indicatore di inserimento durante il riordino */
	.item.drop::before {
		content: '';
		position: absolute;
		z-index: 2;
		inset: -4px auto -4px -8px;
		width: 4px;
		border-radius: 2px;
		background: var(--color-primary);
	}

	.more {
		position: absolute;
		z-index: 1;
		bottom: 4px;
		right: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: color-mix(in srgb, var(--color-background) 82%, transparent);
		color: var(--color-primary-deep);
	}

	.more::after {
		content: '';
		position: absolute;
		inset: -11px;
	}

	.slot {
		display: flex;
		flex: none;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		box-sizing: border-box;
		width: 72px;
		height: 108px;
		margin: 0 7px;
		border: 2px dashed color-mix(in srgb, var(--color-divider) 70%, transparent);
		border-radius: 8px;
		background: color-mix(in srgb, var(--color-divider) 10%, transparent);
		color: var(--color-text-secondary);
		font-size: 11px;
		font-weight: 600;
		line-height: 13px;
		text-align: center;
	}

	.titles {
		display: flex;
		align-items: flex-start;
		box-sizing: content-box;
		height: 44px;
		padding: 14px 11px 0;
		overflow: hidden;
	}

	.name {
		display: -webkit-box;
		flex: none;
		width: 72px;
		margin: 0 7px;
		overflow: hidden;
		font-size: 11px;
		font-weight: 700;
		line-height: 14px;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow-wrap: anywhere;
	}

	.spacer {
		flex: none;
		width: 160px;
	}
</style>
