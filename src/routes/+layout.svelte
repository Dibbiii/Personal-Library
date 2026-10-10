<script lang="ts">
	import '@fontsource-variable/figtree/wght.css';
	import '@fontsource/young-serif/400.css';
	import '../app.css';
	import { onMount, type Snippet } from 'svelte';
	import { pwaInfo } from 'virtual:pwa-info';
	import ThemeProvider from '$lib/components/ThemeProvider.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	const manifestLink = pwaInfo?.webManifest.linkTag ?? '';

	onMount(async () => {
		if (!pwaInfo) return;
		const { registerSW } = await import('virtual:pwa-register');
		registerSW({ immediate: true });
	});
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html manifestLink}
</svelte:head>

<ThemeProvider themeKey={data.themeKey}>
	{@render children()}
</ThemeProvider>
