<script lang="ts">
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import SettingsCard from '$lib/components/settings/SettingsCard.svelte';
	import type { PageProps } from './$types';
	import type { Friend, FriendLibraryVisibility, FriendPrivacy } from '$lib/contracts/friendships';

	let { data }: PageProps = $props();
	// svelte-ignore state_referenced_locally
	let friends = $state<Friend[]>([...data.friendships]);
	// svelte-ignore state_referenced_locally
	let visibility = $state<FriendLibraryVisibility>(data.visibility);
	let privacy = $state<FriendPrivacy | null>(null);
	let invite = $state<string | null>(null);
	let token = $state('');
	let busy = $state(false);
	let copied = $state(false);
	let message = $state<string | null>(null);
	let error = $state<string | null>(null);

	const privacyRows = [
		['library', 'Libreria', 'Titoli, autori e stato di lettura'],
		['reviews', 'Recensioni', 'Voti e aggettivi'],
		['stats', 'Statistiche', 'Libri finiti e non finiti'],
		['quotes', 'Citazioni', 'Frasi salvate'],
		['activity', 'Attività', 'Ultimi libri toccati']
	] as const;

	const shareText = $derived(
		invite
			? `Ti voglio aggiungere agli amici su Segnalibro. Apri il link e accetta o rifiuta: ${location.origin}/friends?code=${invite}`
			: ''
	);

	$effect(() => {
		fetch('/api/friends?privacy=1')
			.then((response) => response.json())
			.then((value: FriendPrivacy) => {
				if (value.library) privacy = value;
			})
			.catch(() => undefined);
	});

	async function createInvite() {
		busy = true;
		message = null;
		error = null;
		copied = false;
		try {
			const response = await fetch('/api/friends', {
				method: 'POST',
				headers: { 'content-type': 'application/json', accept: 'application/json' },
				body: JSON.stringify({ action: 'create' })
			});
			const payload = await response.json();
			if (!response.ok) throw new Error(payload.message ?? 'Impossibile creare l’invito.');
			invite = payload.invite.token;
			message = 'Invito pronto. Copialo o mandalo su WhatsApp.';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Impossibile creare l’invito.';
		} finally {
			busy = false;
		}
	}

	async function copyInvite() {
		if (!invite) return;
		await navigator.clipboard.writeText(invite);
		copied = true;
	}

	async function redeem() {
		if (!token.trim()) return;
		busy = true;
		message = null;
		error = null;
		try {
			const response = await fetch('/api/friends', {
				method: 'POST',
				headers: { 'content-type': 'application/json', accept: 'application/json' },
				body: JSON.stringify({ action: 'redeem', token: token.trim() })
			});
			const payload = await response.json();
			if (!response.ok) throw new Error(payload.message ?? 'Codice non valido o già usato.');
			if (!friends.some((friend) => friend.userId === payload.friendship.userId)) {
				friends = [...friends, payload.friendship];
			}
			token = '';
			message = 'Amicizia accettata.';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Codice invito non valido.';
		} finally {
			busy = false;
		}
	}

	async function setSection(key: (typeof privacyRows)[number][0], next: FriendLibraryVisibility) {
		busy = true;
		error = null;
		try {
			const response = await fetch('/api/friends/privacy', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json', accept: 'application/json' },
				body: JSON.stringify({ [key]: next })
			});
			const result = (await response.json()) as FriendPrivacy;
			if (!response.ok) throw new Error('Impossibile aggiornare la privacy.');
			privacy = result;
			if (key === 'library') visibility = next;
			message = 'Privacy aggiornata.';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Impossibile aggiornare la privacy.';
		} finally {
			busy = false;
		}
	}

	async function remove(friend: Friend) {
		if (!confirm(`Rimuovere ${friend.displayName ?? 'questo amico'}?`)) return;
		busy = true;
		try {
			const response = await fetch(`/api/friends/${friend.userId}`, { method: 'DELETE' });
			if (!response.ok) throw new Error('Impossibile rimuovere l’amicizia.');
			friends = friends.filter((item) => item.userId !== friend.userId);
			message = 'Amicizia rimossa.';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Impossibile rimuovere l’amicizia.';
		} finally {
			busy = false;
		}
	}

	function initial(name: string | null) {
		return (name?.trim().charAt(0) || 'A').toUpperCase();
	}
</script>

<svelte:head><title>Amici · Segnalibro</title></svelte:head>
<PageHeader title="Amici" subtitle="Invita, accetta e scegli cosa condividere." backHref="/profile" />

<main class="page">
	{#if message}<p class="toast" role="status">{message}</p>{/if}
	{#if error}<p class="toast error" role="alert">{error}</p>{/if}

	<div class="grid">
		<SettingsCard icon="mail" title="Invita qualcuno" wide>
			<p class="lead">Il codice è monouso, scade dopo 7 giorni e non mostra la tua email.</p>
			<Button loading={busy} onclick={createInvite}>
				{#snippet icon()}<Icon name="plus" size={18} />{/snippet}
				Crea invito
			</Button>
			{#if invite}
				<div class="invite">
					<code>{invite}</code>
					<div class="invite-actions">
						<Button variant="secondary" size="sm" onclick={copyInvite}>
							{copied ? 'Copiato' : 'Copia'}
						</Button>
						<Button
							variant="secondary"
							size="sm"
							href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
						>
							WhatsApp
						</Button>
					</div>
				</div>
			{/if}
		</SettingsCard>

		<SettingsCard icon="check" title="Accetta un invito">
			<p class="lead">Incolla il codice ricevuto. Puoi rifiutare semplicemente non usandolo.</p>
			<form class="accept" onsubmit={(event) => (event.preventDefault(), redeem())}>
				<input aria-label="Codice invito" placeholder="Incolla il codice" bind:value={token} />
				<Button type="submit" disabled={busy || !token.trim()}>Accetta</Button>
			</form>
		</SettingsCard>

		<SettingsCard icon="lock" title="Cosa vedono gli amici" wide>
			<p class="lead">Di base è tutto privato. Puoi aprire una sezione solo agli amici confermati.</p>
			<ul class="privacy">
				{#each privacyRows as [key, label, hint] (key)}
					{@const current = key === 'library' ? visibility : (privacy?.[key] ?? 'private')}
					<li>
						<div>
							<strong>{label}</strong>
							<span>{hint}</span>
						</div>
						<div class="segment" role="group" aria-label={label}>
							<button type="button" aria-pressed={current === 'private'} onclick={() => setSection(key, 'private')}>Privato</button>
							<button type="button" aria-pressed={current === 'friends'} onclick={() => setSection(key, 'friends')}>Amici</button>
						</div>
					</li>
				{/each}
			</ul>
		</SettingsCard>

		<SettingsCard icon="user" title="I tuoi amici" wide>
			{#if friends.length === 0}
				<p class="empty">Ancora nessun amico. Crea un invito oppure accetta un codice.</p>
			{:else}
				<ul class="people">
					{#each friends as friend (friend.userId)}
						<li>
							<a class="person" href="/friends/{friend.userId}">
								<span class="avatar" aria-hidden="true">{initial(friend.displayName)}</span>
								<span>
									<strong>{friend.displayName ?? 'Lettore'}</strong>
									<small>Vedi profilo e libreria condivisa</small>
								</span>
							</a>
							<Button variant="ghost" size="sm" disabled={busy} onclick={() => remove(friend)}>Rimuovi</Button>
						</li>
					{/each}
				</ul>
			{/if}
		</SettingsCard>
	</div>
</main>

<style>
	.page { padding: 0 var(--page-gutter) 40px; }
	.grid { display: grid; gap: 16px; }
	.lead, .empty { margin: 0 0 14px; color: var(--color-text-secondary); font-size: 14px; line-height: 1.45; }
	.toast { margin: 0 0 14px; padding: 10px 14px; border-radius: var(--radius-pill); background: var(--color-surface); color: var(--color-success); font-weight: 700; }
	.toast.error { color: var(--color-danger); }
	.invite { display: grid; gap: 10px; margin-top: 16px; padding: 14px; border-radius: var(--radius-md); background: var(--color-background); }
	code { overflow-wrap: anywhere; font-size: 13px; }
	.invite-actions, .accept { display: flex; flex-wrap: wrap; gap: 8px; }
	.accept input, .privacy { width: 100%; }
	input { min-height: var(--tap-size); box-sizing: border-box; min-width: 0; flex: 1; padding: 0 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-background); color: var(--color-text-primary); }
	.privacy, .people { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
	.privacy li, .people li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; border-radius: var(--radius-md); background: var(--color-background); }
	.privacy span, .person small { display: block; color: var(--color-text-secondary); font-size: 13px; }
	.segment { display: flex; padding: 3px; border-radius: var(--radius-pill); background: var(--color-surface); }
	.segment button { min-height: 36px; padding: 0 12px; border: 0; border-radius: var(--radius-pill); background: transparent; color: var(--color-text-secondary); font-weight: 700; cursor: pointer; }
	.segment button[aria-pressed='true'] { background: var(--color-primary); color: var(--color-on-primary); }
	.person { display: flex; align-items: center; gap: 12px; min-width: 0; color: inherit; text-decoration: none; }
	.avatar { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; background: var(--color-primary-tint); color: var(--color-primary); font-weight: 800; }
	@media (min-width: 900px) { .grid { grid-template-columns: 1fr 1fr; } }
</style>
