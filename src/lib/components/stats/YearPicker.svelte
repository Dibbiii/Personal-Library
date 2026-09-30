<script lang="ts">
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';

	interface Props {
		year: number;
		years: number[];
		/** Costruisce l'indirizzo della pagina per l'anno scelto. */
		href: (year: number) => string;
	}

	let { year, years, href }: Props = $props();

	let open = $state(false);
</script>

<button
	type="button"
	class="pill"
	aria-haspopup="dialog"
	aria-label="Anno: {year}. Cambia anno"
	onclick={() => (open = true)}
	data-testid="year-pill"
>
	{year}
</button>

<BottomSheet {open} title="Scegli l'anno" onclose={() => (open = false)}>
	<ul class="years">
		{#each years as option (option)}
			<li>
				<a
					href={href(option)}
					class:current={option === year}
					aria-current={option === year ? 'page' : undefined}
					onclick={() => (open = false)}
				>
					{option}
				</a>
			</li>
		{/each}
	</ul>
</BottomSheet>

<style>
	.pill {
		position: relative;
		height: 34px;
		padding: 0 12px;
		border: 0;
		border-radius: 17px;
		background: var(--color-surface);
		color: var(--color-text-primary);
		font-size: 13px;
		font-weight: 600;
	}

	/* Area di tocco di 44px */
	.pill::after {
		content: '';
		position: absolute;
		inset: -5px -4px;
	}

	.years {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin: 8px 0 0;
		padding: 0;
		list-style: none;
	}

	a {
		display: flex;
		align-items: center;
		min-height: 48px;
		padding: 0 16px;
		border-radius: 16px;
		background: var(--color-surface);
		color: var(--color-text-primary);
		font-size: 16px;
		font-weight: 600;
		text-decoration: none;
	}

	a.current {
		background: var(--color-primary);
		color: var(--color-on-primary);
	}
</style>
