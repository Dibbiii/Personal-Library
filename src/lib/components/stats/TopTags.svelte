<script lang="ts">
	interface Props {
		tags: { id: number; label: string; count: number }[];
	}

	let { tags }: Props = $props();
</script>

<ul class="tags">
	{#each tags as tag (tag.id)}
		<li>
			<span class="label">{tag.label}</span>
			<span class="count" aria-label="{tag.count} {tag.count === 1 ? 'volta' : 'volte'}"
				>{tag.count}</span
			>
		</li>
	{/each}
</ul>

<style>
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 14px 0 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		box-sizing: border-box;
		height: 36px;
		padding: 0 6px 0 14px;
		border-radius: 18px;
		background: var(--color-background);
		font-size: 14px;
		font-weight: 600;
		color: var(--color-text-primary);
	}

	.count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		min-width: 24px;
		height: 24px;
		padding: 0 6px;
		border-radius: 12px;
		background: var(--color-shelf-axis);
		color: var(--color-background);
		font-size: 12px;
		font-weight: 700;
	}
</style>
