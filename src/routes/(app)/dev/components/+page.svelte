<script lang="ts">
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Chip from '$lib/components/ui/Chip.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import FormatBadge from '$lib/components/ui/FormatBadge.svelte';
	import GenreChip from '$lib/components/ui/GenreChip.svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import RatingStars from '$lib/components/ui/RatingStars.svelte';
	import StatusChip from '$lib/components/ui/StatusChip.svelte';
	import { GENRE_ORDER } from '$lib/genres';

	let sheetOpen = $state(false);
	let dialogOpen = $state(false);
	let rating = $state<number | null>(4);
	let picked = $state<'tbr' | 'reading'>('tbr');
	let genre = $state(GENRE_ORDER[4]);
</script>

<svelte:head><title>Componenti · Segnalibro</title></svelte:head>

<PageHeader title="Componenti" subtitle="Galleria di sviluppo" backHref="/library" />

<div class="gallery">
	<Card>
		<h2>Pulsanti</h2>
		<div class="row">
			<Button>Primario</Button>
			<Button variant="secondary">Secondario</Button>
			<Button variant="ghost">Ghost</Button>
			<Button size="lg" fullWidth>Sposta</Button>
			<IconButton icon="chevron-left" label="Indietro" />
			<IconButton icon="more-horizontal" label="Altre azioni" />
			<IconButton icon="camera" label="Scansiona" size={48} />
		</div>
	</Card>

	<Card>
		<h2>Chip</h2>
		<div class="row">
			{#each GENRE_ORDER as slug (slug)}
				<GenreChip {slug} variant="soft" size="sm" />
			{/each}
		</div>
		<div class="row">
			<GenreChip slug="fantasy-magical-gothic" />
			<StatusChip status="unread" />
			<StatusChip status="reading" />
			<StatusChip status="paused" />
			<StatusChip status="finished" />
			<StatusChip status="finished" completedReadingsCount={2} />
			<StatusChip status="dnf" />
			<StatusChip status="queued" size="sm" />
			<FormatBadge format="digital" />
			<FormatBadge format="physical" />
			<FormatBadge format="digital" variant="icon" />
		</div>
		<div class="row">
			<Chip variant="outline" selected={picked === 'tbr'} onclick={() => (picked = 'tbr')}>
				Tutti i non letti
			</Chip>
			<Chip variant="outline" selected={picked === 'reading'} onclick={() => (picked = 'reading')}>
				Classici
			</Chip>
			<Chip variant="dark" onremove={() => {}} removeLabel="Rimuovi Epico" size="lg">Epico</Chip>
			{#each GENRE_ORDER.slice(0, 3) as slug (slug)}
				<GenreChip
					{slug}
					variant="outline"
					selected={genre === slug}
					onclick={() => (genre = slug)}
				/>
			{/each}
		</div>
	</Card>

	<Card>
		<h2>Stelle</h2>
		<div class="row">
			<RatingStars value={3} size={14} />
			<RatingStars bind:value={rating} size={36} readonly={false} label="Voto generale" />
			<span>{rating ?? '-'}/5</span>
		</div>
	</Card>

	<Card>
		<h2>Sheet e dialog</h2>
		<div class="row">
			<Button onclick={() => (sheetOpen = true)}>Apri sheet</Button>
			<Button variant="secondary" onclick={() => (dialogOpen = true)}>Apri dialog</Button>
		</div>
	</Card>
</div>

<BottomSheet
	open={sheetOpen}
	title="Sposta il libro"
	subtitle="La paura del saggio"
	onclose={() => (sheetOpen = false)}
>
	<Button variant="ghost" fullWidth>Segna come letto</Button>
	<Button variant="ghost" fullWidth>Cambia genere</Button>
	<Button variant="ghost" fullWidth>Metti nei prossimi</Button>
</BottomSheet>

<ConfirmDialog
	open={dialogOpen}
	title="Hai già 3 libri nelle prossime letture. Vuoi aggiungerlo comunque?"
	confirmLabel="Aggiungi comunque"
	onconfirm={() => (dialogOpen = false)}
	oncancel={() => (dialogOpen = false)}
/>

<style>
	.gallery {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 0 var(--page-gutter);
	}

	h2 {
		margin-bottom: 12px;
		font-size: 20px;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		margin-bottom: 12px;
	}
</style>
