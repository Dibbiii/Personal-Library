<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';

	interface Props {
		bookId: string;
		title: string;
		author: string;
		page: number | null;
	}

	let { bookId, title, author, page }: Props = $props();
</script>

<a class="tomb" href="/book/{bookId}" data-testid="tombstone">
	<span class="icon"><Icon name="book-open" size={18} strokeWidth={1.7} /></span>
	<span class="title">{title}</span>
	<span class="author">{author}</span>
	<span class="rule" aria-hidden="true"></span>
	<span class="rest"
		>{#if page}Riposa a pag. {page}{:else}Riposa qui{/if}</span
	>
</a>

<style>
	.tomb {
		display: flex;
		flex-direction: column;
		align-items: center;
		box-sizing: border-box;
		min-width: 0;
		min-height: 156px;
		padding: 26px 6px 10px;
		border: 1.5px solid color-mix(in srgb, var(--color-shelf-axis) 22%, transparent);
		border-radius: 52px 52px 10px 10px;
		background: linear-gradient(180deg, var(--tomb-top), var(--tomb-bottom));
		box-shadow: 0 8px 12px -6px color-mix(in srgb, var(--color-shelf-axis) 40%, transparent);
		color: var(--color-shelf-axis);
		text-align: center;
		text-decoration: none;
	}

	.icon {
		line-height: 0;
		opacity: 0.7;
	}

	.title {
		margin-top: 6px;
		font-family: var(--font-display);
		font-size: 14px;
		line-height: 17px;
		color: var(--color-text-primary);
		overflow-wrap: break-word;
	}

	.author {
		margin-top: 2px;
		font-size: 11px;
		line-height: 14px;
		color: var(--color-text-secondary);
	}

	.rule {
		width: 28px;
		height: 1.5px;
		margin: 8px 0 6px;
		background: color-mix(in srgb, var(--color-shelf-axis) 30%, transparent);
	}

	.rest {
		font-size: 11px;
		font-weight: 700;
		line-height: 14px;
	}
</style>
