<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';

	let { name = null }: { name?: string | null } = $props();

	const greeting = $derived(name ? `Ciao ${name}, cosa leggi oggi?` : 'Cosa leggi oggi?');
</script>

<header class="header">
	<div class="brand">
		<h1>
			<Icon name="bookmark" size={24} strokeWidth={2} />
			<span class="name">Segnalibro</span>
		</h1>
		<p>{greeting}</p>
	</div>
	<a class="camera" href="/add/scan" aria-label="Scansiona il codice ISBN">
		<Icon name="camera" size={22} />
	</a>
</header>

<style>
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		box-sizing: content-box;
		height: 64px;
		padding: 20px 20px 12px;
	}

	.brand {
		min-width: 0;
		color: var(--color-primary);
	}

	h1 {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 28px;
		line-height: 1.1;
	}

	p {
		margin: 2px 0 0;
		overflow: hidden;
		color: var(--color-text-secondary);
		font-size: 13px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Desktop: il marchio e' gia' nella sidebar, in pagina resta il saluto come titolo */
	@media (min-width: 1024px) {
		h1 {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
		}

		p {
			margin: 0;
			color: var(--color-primary);
			font-family: var(--font-display);
			font-size: 26px;
			line-height: 1.15;
		}
	}

	.camera {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--color-surface);
		color: var(--color-primary);
	}
</style>
