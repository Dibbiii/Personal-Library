<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';

	interface Props {
		/** URL (provider) o endpoint della cover personalizzata; null = placeholder locale. */
		src: string | null;
		width: number;
		height: number;
		/** Descrizione; vuota = decorativa (il titolo è già nel testo vicino). */
		alt?: string;
		eager?: boolean;
		/** Avvisa quando l'immagine remota non si carica (il chiamante può scartarla). */
		onfail?: () => void;
	}

	let { src, width, height, alt = '', eager = false, onfail }: Props = $props();

	let failed = $state(false);
	$effect(() => {
		// nuovo src: riprova
		void src;
		failed = false;
	});

	const showImage = $derived(src !== null && !failed);
</script>

<span class="cover" style:width="{width}px" style:height="{height}px">
	{#if showImage}
		<img
			{src}
			{alt}
			{width}
			{height}
			loading={eager ? 'eager' : 'lazy'}
			decoding="async"
			referrerpolicy="no-referrer"
			onerror={() => {
				failed = true;
				onfail?.();
			}}
		/>
	{:else}
		<span class="placeholder" role={alt ? 'img' : undefined} aria-label={alt || undefined}>
			<Icon name="book-open" size={Math.max(16, Math.round(width * 0.36))} strokeWidth={1.7} />
		</span>
	{/if}
</span>

<style>
	.cover {
		position: relative;
		display: inline-block;
		flex-shrink: 0;
		overflow: hidden;
		border-radius: 3px 8px 8px 3px;
		background: var(--color-surface);
		box-shadow:
			var(--shadow-cover),
			inset 4px 0 0 color-mix(in srgb, var(--color-text-primary) 10%, transparent),
			inset 6px 0 0 color-mix(in srgb, var(--color-on-genre-white) 16%, transparent);
	}

	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		color: color-mix(in srgb, var(--color-primary) 70%, transparent);
		background: linear-gradient(
			160deg,
			color-mix(in srgb, var(--color-accent) 40%, var(--color-surface)),
			var(--color-surface)
		);
	}
</style>
