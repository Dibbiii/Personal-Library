<script lang="ts">
	import ProfileView from '$lib/components/profile/ProfileView.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Profilo · Segnalibro</title></svelte:head>

<ProfileView {...data} />
