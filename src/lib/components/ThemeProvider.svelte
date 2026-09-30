<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ThemeController, setThemeController } from '$lib/themes/controller.svelte';

	interface Props {
		/** Chiave del tema risolta lato server dal cookie sb-theme. */
		themeKey: string;
		children: Snippet;
	}

	let { themeKey, children }: Props = $props();

	// Il controller nasce una sola volta con la chiave iniziale; dopo comanda lui.
	// svelte-ignore state_referenced_locally
	setThemeController(new ThemeController(themeKey));
</script>

{@render children()}
