<script lang="ts">
	let { name = null }: { name?: string | null } = $props();

	const greeting = $derived(name ? `Ciao ${name}, cosa leggi oggi?` : 'Cosa leggi oggi?');
</script>

<header class="header">
	<h1>Libreria</h1>
	<p>{greeting}</p>
</header>

<style>
	.header {
		min-width: 0;
	}

	h1 {
		margin: 0;
		color: var(--color-primary);
		font-family: var(--font-display);
		font-size: 36px;
		font-weight: 400;
		line-height: 1.05;
		letter-spacing: -0.01em;
	}

	p {
		margin: 4px 0 0;
		overflow: hidden;
		color: var(--color-text-secondary);
		font-size: 15px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (min-width: 1024px) {
		h1 {
			font-size: 50px;
		}

		p {
			font-size: 17px;
		}
	}
</style>
