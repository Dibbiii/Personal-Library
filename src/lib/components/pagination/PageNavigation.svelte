<script lang="ts">
	import { page } from '$app/state';
	import { pageHref } from '$lib/pagination';
	let {
		current,
		total,
		pageSize,
		parameter = 'page',
		label = 'Pagine'
	}: {
		current: number;
		total: number;
		pageSize: number;
		parameter?: string;
		label?: string;
	} = $props();
	const last = $derived(Math.max(1, Math.ceil(total / pageSize)));
</script>

{#if last > 1}
	<nav aria-label={label} class="pagination">
		{#if current > 1}<a
				href={pageHref(page.url, parameter, current - 1)}
				rel="prev"
				data-sveltekit-preload-data="tap">Precedente</a
			>{:else}<span aria-disabled="true">Precedente</span>{/if}
		<span class="position" aria-current="page">Pagina {current} di {last}</span>
		{#if current < last}<a
				href={pageHref(page.url, parameter, current + 1)}
				rel="next"
				data-sveltekit-preload-data="tap">Successiva</a
			>{:else}<span aria-disabled="true">Successiva</span>{/if}
	</nav>
{/if}

<style>
	.pagination {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 12px;
		padding: 16px 0;
		color: var(--color-text-primary);
	}
	a,
	span {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 44px;
		padding: 0 12px;
	}
	a {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-primary);
		background: var(--color-surface);
		text-decoration: none;
	}
	a:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 3px;
	}
	span[aria-disabled] {
		opacity: 0.5;
	}
	.position {
		padding: 0;
		font-size: 13px;
	}
</style>
