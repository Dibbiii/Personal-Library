<script lang="ts">
	import type { Snippet } from 'svelte';
	import AppShell from '$lib/components/layout/AppShell.svelte';
	import AppRuntime from '$lib/components/offline/AppRuntime.svelte';
	import QueueConfirmHost from '$lib/components/queue/QueueConfirmHost.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<AppShell userLabel={data.user?.displayName ?? data.user?.email ?? null}>
	{@render children()}
</AppShell>
<AppRuntime userId={data.user?.id} />
<QueueConfirmHost />
