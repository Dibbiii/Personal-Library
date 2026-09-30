<script lang="ts">
	import type { BookFormat } from '$lib/contracts';
	import Icon from '$lib/components/ui/Icon.svelte';

	interface Props {
		format: BookFormat;
		/** 16 = dorso (icona 10), 20 = cover (icona 12). */
		size?: 16 | 20;
		class?: string;
	}

	let { format, size = 20, class: className }: Props = $props();

	const label = $derived(format === 'digital' ? 'Digitale' : 'Cartaceo');
	const icon = $derived(format === 'digital' ? 'smartphone' : 'book-open');
</script>

<!-- Cerchietto con icona cartaceo/digitale, da posizionare dal genitore (bottom/right). -->
<span class="format-icon s{size} {className ?? ''}" role="img" aria-label={label}>
	<Icon name={icon} size={size === 16 ? 10 : 12} strokeWidth={size === 16 ? 2.2 : 2} />
</span>

<style>
	.format-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		border-radius: 50%;
		background: color-mix(in srgb, var(--color-background) 92%, transparent);
		color: var(--color-primary-deep);
		pointer-events: none;
	}

	.s16 {
		width: 16px;
		height: 16px;
	}

	.s20 {
		width: 20px;
		height: 20px;
		opacity: 0.92;
	}
</style>
