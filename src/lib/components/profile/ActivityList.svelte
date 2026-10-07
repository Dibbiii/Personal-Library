<script lang="ts">
	import BookCover from '$lib/components/book/BookCover.svelte';
	import { ACTIVITY_VERBS, relativeTime, type ActivityItem } from '$lib/profile/overview';

	interface Props {
		items: ActivityItem[];
	}

	let { items }: Props = $props();
</script>

{#if items.length > 0}
	<ol class="activity" data-testid="profile-activity">
		{#each items as item (`${item.kind}-${item.book.id}-${item.at}`)}
			<li>
				<a href="/book/{item.book.id}">
					<BookCover book={item.book} size={34} />
					<span class="text">
						<span class="what">
							{ACTIVITY_VERBS[item.kind]} <strong>{item.book.title}</strong>
						</span>
						<time datetime={item.at}>{relativeTime(item.at)}</time>
					</span>
				</a>
			</li>
		{/each}
	</ol>
{:else}
	<p class="empty">Inizia una lettura o metti un libro in coda: qui comparirà la tua attività.</p>
{/if}

<style>
	.activity {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	a {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 0 -8px;
		padding: 6px 8px;
		border-radius: var(--radius-sm);
		color: inherit;
		text-decoration: none;
	}

	a:hover {
		background: var(--color-surface);
	}

	.text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.what {
		color: var(--color-text-primary);
		font-size: 13px;
		line-height: 1.3;
	}

	strong {
		font-weight: 700;
	}

	time {
		color: var(--color-text-muted);
		font-size: 12px;
	}

	.empty {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 13px;
		line-height: 1.45;
	}
</style>
