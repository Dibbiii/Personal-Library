<script lang="ts">
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import ReadingCalendar from '$lib/components/explore/ReadingCalendar.svelte';
	import WheelSection from '$lib/components/explore/WheelSection.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Esplora · Segnalibro</title></svelte:head>

<PageHeader title="Esplora" />

<div class="explore">
	<div class="wheel-col">
		<WheelSection pool={data.pool} />
	</div>
	<div class="calendar-col">
		<ReadingCalendar year={data.year} days={data.days} currentYear={data.currentYear} />
	</div>
</div>

<style>
	.explore {
		padding-bottom: 24px;
	}

	@media (min-width: 1024px) {
		.explore {
			display: grid;
			grid-template-columns: minmax(380px, 440px) minmax(0, 1fr);
			align-items: start;
			gap: 16px;
		}

		.wheel-col {
			position: sticky;
			top: 16px;
		}
	}
</style>
