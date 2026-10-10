<script lang="ts">
	import type { BookSummary } from '$lib/contracts';
	import Icon from '$lib/components/ui/Icon.svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';

	interface Props {
		book: BookSummary;
		queued: boolean;
		/** Nascosto per i libri in lettura: iniziare a leggere toglie già il libro dai prossimi. */
		canQueue: boolean;
		onedit: () => void;
		onmove: () => void;
		onformat: () => void;
		onqueue: () => void;
		oncover: () => void;
		onremove?: () => void;
	}

	let { book, queued, canQueue, onedit, onmove, onformat, onqueue, oncover, onremove }: Props =
		$props();

	const uid = $props.id();
	let open = $state(false);
	let root: HTMLDivElement | undefined = $state();
	let trigger: HTMLElement | undefined = $state();

	function close(restoreFocus = true) {
		open = false;
		if (restoreFocus) trigger?.querySelector('button')?.focus();
	}

	function choose(action: () => void) {
		close(false);
		action();
	}

	function onKeydown(event: KeyboardEvent) {
		if (!open) return;
		if (event.key === 'Escape') {
			event.stopPropagation();
			close();
			return;
		}
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			const items = [...(root?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
			if (items.length === 0) return;
			event.preventDefault();
			const index = items.indexOf(document.activeElement as HTMLElement);
			const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
			items[(next + items.length) % items.length]?.focus();
		}
	}

	function onWindowPointer(event: PointerEvent) {
		if (open && root && !root.contains(event.target as Node)) open = false;
	}

	$effect(() => {
		if (open) root?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
	});
</script>

<svelte:window onpointerdown={onWindowPointer} onkeydown={onKeydown} />

<div class="menu" bind:this={root}>
	<span bind:this={trigger}>
		<IconButton
			icon="more-horizontal"
			label="Altre azioni"
			aria-haspopup="menu"
			aria-expanded={open}
			aria-controls="{uid}-menu"
			onclick={() => (open = !open)}
		/>
	</span>

	{#if open}
		<div id="{uid}-menu" class="popover" role="menu" aria-label="Azioni per {book.title}">
			<button class="item" type="button" role="menuitem" onclick={() => choose(onmove)}>
				<span class="tile"><Icon name="library" size={20} strokeWidth={1.9} /></span>
				Sposta il libro
			</button>
			<button class="item" type="button" role="menuitem" onclick={() => choose(onedit)}>
				<span class="tile"><Icon name="pencil" size={20} strokeWidth={1.9} /></span>
				Modifica edizione e dati
			</button>
			<button class="item" type="button" role="menuitem" onclick={() => choose(onformat)}>
				Modifica formato
			</button>
			{#if canQueue}
				<button
					class="item"
					type="button"
					role="menuitem"
					onclick={() => choose(onqueue)}
					data-testid="menu-queue"
				>
					<span class="tile">
						<Icon name={queued ? 'close' : 'bookmark'} size={20} strokeWidth={1.9} />
					</span>
					{queued ? 'Rimuovi dai prossimi' : 'Metti nei prossimi'}
				</button>
			{/if}
			<button class="item" type="button" role="menuitem" onclick={() => choose(oncover)}>
				<span class="tile"><Icon name="image" size={20} strokeWidth={1.9} /></span>
				Cambia copertina
			</button>
			{#if onremove}
				<button
					class="item destructive"
					type="button"
					role="menuitem"
					onclick={() => onremove && choose(onremove)}
					data-testid="menu-remove"
				>
					<span class="tile"><Icon name="trash" size={20} strokeWidth={1.9} /></span>
					Elimina dalla libreria
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.menu {
		position: relative;
	}

	.popover {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: var(--z-overlay);
		box-sizing: border-box;
		width: 272px;
		padding: 6px;
		border-radius: 20px;
		background: var(--color-background);
		box-shadow: var(--shadow-dialog);
	}

	.popover :global(.item),
	.item {
		display: flex;
		align-items: center;
		gap: 12px;
		box-sizing: border-box;
		width: 100%;
		min-height: 52px;
		padding: 4px 8px;
		border: 0;
		border-radius: 14px;
		background: transparent;
		color: var(--color-text-primary);
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 600;
		text-align: left;
		cursor: pointer;
	}

	.item.destructive,
	.item.destructive .tile {
		color: var(--color-error, var(--color-danger));
	}

	.item:hover,
	.item:focus-visible {
		background: var(--color-surface);
	}

	.popover :global(.tile),
	.tile {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 36px;
		height: 36px;
		border-radius: 12px;
		background: var(--color-surface);
		color: var(--color-primary);
	}
</style>
