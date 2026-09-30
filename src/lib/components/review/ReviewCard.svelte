<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		/** Asterisco "obbligatorio" accanto al titolo. */
		required?: boolean;
		/** Contenuto a destra del titolo (contatore, pill del genere). */
		aside?: Snippet;
		children: Snippet;
		class?: string;
		/** id del titolo, per aria-labelledby dei gruppi interni. */
		titleId?: string;
	}

	let { title, required = false, aside, children, class: className, titleId }: Props = $props();

	const uid = $props.id();
	const headingId = $derived(titleId ?? `${uid}-title`);
</script>

<section class="review-card {className ?? ''}" aria-labelledby={headingId}>
	<header>
		<h3 id={headingId}>
			{title}{#if required}&nbsp;<span class="required" role="img" aria-label="obbligatorio">*</span
				>{/if}
		</h3>
		{#if aside}<div class="aside">{@render aside()}</div>{/if}
	</header>
	{@render children()}
</section>

<style>
	.review-card {
		box-sizing: border-box;
		min-width: 0;
		padding: 18px;
		border-radius: 22px;
		background: var(--color-surface);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 12px;
		min-height: 26px;
	}

	h3 {
		margin: 0;
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 700;
		line-height: 1.25;
		color: var(--color-text-primary);
	}

	.required {
		color: var(--color-primary);
	}

	.aside {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}
</style>
