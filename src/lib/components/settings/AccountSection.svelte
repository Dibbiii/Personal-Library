<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import { displayNameSchema } from '$lib/contracts/settings';
	import { sendJson } from './preferences';

	interface Props {
		displayName: string;
		email: string;
		onsaved: (displayName: string) => void;
	}

	let { displayName, email, onsaved }: Props = $props();

	// svelte-ignore state_referenced_locally
	let name = $state(displayName);
	let busy = $state(false);
	let error = $state<string | null>(null);

	const changed = $derived(name.trim() !== displayName.trim());

	async function save(event: SubmitEvent) {
		event.preventDefault();
		const parsed = displayNameSchema.safeParse(name);
		if (!parsed.success) {
			error = parsed.error.issues[0]?.message ?? 'Nome non valido';
			return;
		}
		busy = true;
		error = null;
		try {
			await sendJson('/api/settings', 'PATCH', { displayName: parsed.data });
			onsaved(parsed.data);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Non sono riuscito a salvare il nome.';
		} finally {
			busy = false;
		}
	}
</script>

<form class="account" onsubmit={save}>
	<TextField
		label="Come ti chiami?"
		name="displayName"
		bind:value={name}
		{error}
		maxlength={80}
		autocomplete="name"
	/>
	<div class="email">
		<span class="label">Email</span>
		<span class="value" data-testid="account-email">{email}</span>
	</div>
	<div class="actions">
		<Button type="submit" size="sm" loading={busy} disabled={!changed}>Salva nome</Button>
	</div>
</form>

<form class="logout" method="POST" action="/auth/logout">
	<Button type="submit" variant="secondary" size="sm">Esci</Button>
</form>

<style>
	.account {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.email {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.label {
		font-size: 14px;
		font-weight: 700;
	}

	.value {
		font-size: 16px;
		color: var(--color-text-secondary);
		overflow-wrap: anywhere;
	}

	.actions {
		display: flex;
	}

	.logout {
		margin-top: 18px;
		padding-top: 16px;
		border-top: 1px solid var(--color-divider);
	}
</style>
