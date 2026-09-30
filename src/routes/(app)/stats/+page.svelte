<script lang="ts">
	import StatsView from '$lib/components/stats/StatsView.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const yearHref = (year: number) => (year === data.currentYear ? '/stats' : `/stats/${year}`);
</script>

<svelte:head><title>Statistiche · Segnalibro</title></svelte:head>

<StatsView
	year={data.year}
	years={data.years}
	stats={data.stats}
	genreBreakdown={data.genreBreakdown}
	bingo={data.bingo}
	quotes={data.quotes}
	dnf={data.dnf}
	{yearHref}
/>
