<script lang="ts">
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import type { PageProps } from './$types';
	import type { FriendLibraryVisibility, Friend, FriendPrivacy } from '$lib/contracts/friendships';

	let { data }: PageProps = $props();
	// La pagina viene caricata dal server e questi sono lo stato iniziale del form.
	// svelte-ignore state_referenced_locally
	let friends = $state<Friend[]>([...data.friendships]);
	// svelte-ignore state_referenced_locally
	let visibility = $state<FriendLibraryVisibility>(data.visibility);
	let privacy = $state<FriendPrivacy | null>(null);

	$effect(() => {
		fetch('/api/friends?privacy=1')
			.then((response) => response.json())
			.then((value: FriendPrivacy) => {
				if (value.library) privacy = value;
			})
			.catch(() => undefined);
	});
	let invite = $state<string | null>(null);
	let token = $state('');
	let busy = $state(false);
	let message = $state<string | null>(null);
	let error = $state<string | null>(null);

	async function request<T>(url: string, body: unknown): Promise<T> {
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'application/json' },
			body: JSON.stringify(body)
		});
		const payload = await response.json();
		if (!response.ok) throw new Error(payload.message ?? 'Operazione non riuscita.');
		return payload as T;
	}

	async function createInvite() {
		busy = true;
		message = null;
		error = null;
		try {
			const result = await request<{ invite: { token: string; expiresAt: string } }>('/api/friends', { action: 'create' });
			invite = result.invite.token;
			message = 'Invito creato. Copialo e invialo alla persona che vuoi aggiungere.';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Impossibile creare l’invito.';
		} finally {
			busy = false;
		}
	}

	async function redeem() {
		if (!token.trim()) return;
		busy = true;
		message = null;
		error = null;
		try {
			const result = await request<{ friendship: Friend }>('/api/friends', { action: 'redeem', token: token.trim() });
			if (!friends.some((friend) => friend.userId === result.friendship.userId)) friends = [...friends, result.friendship];
			token = '';
			message = 'Amicizia accettata.';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Codice invito non valido.';
		} finally {
			busy = false;
		}
	}

	async function setSection(
		key: 'library' | 'reviews' | 'stats' | 'quotes' | 'activity',
		next: FriendLibraryVisibility
	) {
		busy = true;
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

	async function setVisibility(next: FriendLibraryVisibility) {
		busy = true;
		try {
			await request('/api/friends', { action: 'visibility', visibility: next });
			visibility = next;
			message = next === 'friends' ? 'La libreria è visibile agli amici.' : 'La libreria è privata.';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Impossibile aggiornare la privacy.';
		} finally {
			busy = false;
		}
	}

	async function remove(friend: Friend) {
		busy = true;
		try {
			await fetch(`/api/friends/${friend.userId}`, { method: 'DELETE' });
			friends = friends.filter((item) => item.userId !== friend.userId);
			message = 'Amicizia rimossa.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Amici · Segnalibro</title></svelte:head>
<PageHeader title="Amici" backHref="/library" />

<main class="page">
	{#if message}<p class="message" role="status">{message}</p>{/if}
	{#if error}<p class="error" role="alert">{error}</p>{/if}

	<section class="card">
		<h2>Invita una persona</h2>
		<p>Crea un codice monouso e condividilo anche su WhatsApp. Il codice non espone il tuo indirizzo email.</p>
		<button type="button" disabled={busy} onclick={createInvite}>Genera codice invito</button>
		{#if invite}
			<label class="invite-label" for="invite">Codice da condividere</label>
			<input id="invite" readonly value={invite} onclick={(event) => (event.currentTarget as HTMLInputElement).select()} />
			<p class="hint">Il codice scade tra 7 giorni.</p>
		{/if}
	</section>

	<section class="card">
		<h2>Accetta un invito</h2>
		<p>Inserisci il codice ricevuto per aggiungere la persona agli amici.</p>
		<div class="inline">
			<input aria-label="Codice invito" placeholder="Incolla il codice" bind:value={token} />
			<button type="button" disabled={busy || !token.trim()} onclick={redeem}>Accetta</button>
		</div>
	</section>

	<section class="card">
		<h2>Privacy della libreria</h2>
		<label class="choice">
			<input type="radio" name="visibility" checked={visibility === 'private'} onchange={() => setVisibility('private')} />
			<span><strong>Privata</strong><small>Solo tu puoi vedere la tua libreria.</small></span>
		</label>
		<label class="choice">
			<input type="radio" name="visibility" checked={visibility === 'friends'} onchange={() => setVisibility('friends')} />
			<span><strong>Amici</strong><small>Gli amici approvati possono vedere la libreria.</small></span>
		</label>
		{#if privacy}
			<div class="privacy-grid">
				{#each [
					['reviews', 'Recensioni'],
					['stats', 'Statistiche'],
					['quotes', 'Citazioni'],
					['activity', 'Attività']
				] as [key, label] (key)}
					<label>
						{label}
						<select
							value={privacy[key as keyof Omit<FriendPrivacy, 'contractVersion'>]}
							onchange={(event) => setSection(key as 'reviews', (event.currentTarget as HTMLSelectElement).value as FriendLibraryVisibility)}
						>
							<option value="private">Privato</option>
							<option value="friends">Amici</option>
						</select>
					</label>
				{/each}
			</div>
		{/if}
	</section>

	<section class="card">
		<h2>Le tue amicizie</h2>
		{#if friends.length === 0}
			<p class="empty">Non hai ancora amici su Segnalibro.</p>
		{:else}
			<ul>
				{#each friends as friend (friend.userId)}
					<li><a href="/friends/{friend.userId}">{friend.displayName ?? 'Lettore'}</a><button type="button" disabled={busy} onclick={() => remove(friend)}>Rimuovi</button></li>
				{/each}
			</ul>
		{/if}
	</section>
</main>

<style>
	.page { display: grid; gap: 16px; padding: 0 var(--page-gutter) 32px; }
	.card { display: grid; gap: 12px; padding: 20px; border-radius: var(--radius-sheet); background: var(--color-surface); }
	h2, p { margin: 0; }
	.card p, .hint, .empty { color: var(--color-text-secondary); font-size: 14px; line-height: 1.45; }
	button { min-height: var(--tap-size); padding: 0 16px; border: 0; border-radius: var(--radius-pill); background: var(--color-primary); color: var(--color-on-primary); font-weight: 700; cursor: pointer; }
	button:disabled { opacity: .55; cursor: wait; }
	input { min-height: var(--tap-size); box-sizing: border-box; width: 100%; padding: 0 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-background); color: var(--color-text-primary); }
	.inline { display: flex; gap: 8px; }
	.inline input { min-width: 0; }
	.invite-label { font-size: 13px; font-weight: 700; }
	.choice { display: flex; gap: 10px; align-items: flex-start; padding: 12px; border-radius: var(--radius-md); background: var(--color-background); cursor: pointer; }
	.choice span { display: grid; gap: 2px; }
	.choice small { color: var(--color-text-secondary); }
	ul { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
	li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--color-divider); }
	li button { min-height: 36px; background: transparent; color: var(--color-danger); }
	.message { padding: 10px 14px; border-radius: var(--radius-pill); background: var(--color-surface); color: var(--color-success); font-weight: 700; }
	.error { padding: 10px 14px; border-radius: var(--radius-pill); background: var(--color-surface); color: var(--color-danger); font-weight: 700; }
</style>
