<script lang="ts">
	interface Props {
		/** 0..100 */
		percent: number | null;
		label?: string;
		/** Colore della pista: `background` sulle card, `surface` dentro gli sheet. */
		track?: 'background' | 'surface';
	}

	let { percent, label = 'Avanzamento della lettura', track = 'background' }: Props = $props();
</script>

<div
	class="bar {track}"
	role="progressbar"
	aria-label={label}
	aria-valuemin="0"
	aria-valuemax="100"
	aria-valuenow={percent ?? undefined}
>
	<div class="fill" style:width="{percent ?? 0}%"></div>
</div>

<style>
	.bar {
		height: 8px;
		overflow: hidden;
		border-radius: 4px;
		background: var(--color-background);
	}

	.bar.surface {
		background: var(--color-surface);
	}

	.fill {
		height: 100%;
		border-radius: inherit;
		background: var(--color-primary);
		transition: width var(--duration-base) var(--ease-out);
	}
</style>
