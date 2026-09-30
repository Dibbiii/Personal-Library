<script lang="ts">
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';

	interface Props {
		open: boolean;
		/** Email dell'account: va riscritta per confermare. */
		email: string;
		busy?: boolean;
		error?: string | null;
		onclose: () => void;
		onconfirm: (input: { email: string; password: string }) => void;
	}

	let { open, email, busy = false, error = null, onclose, onconfirm }: Props = $props();

	let typedEmail = $state('');
	let password = $state('');

	$effect(() => {
		if (open) {
			typedEmail = '';
			password = '';
		}
	});

	const emailMatches = $derived(typedEmail.trim().toLowerCase() === email.trim().toLowerCase());
	const ready = $derived(emailMatches && password.length > 0 && !busy);
</script>

<BottomSheet
	{open}
	title="Elimina account"
	subtitle="Azione definitiva: non si può annullare"
	{onclose}
>
	<form
		id="delete-account-form"
		class="form"
		onsubmit={(event) => {
			event.preventDefault();
			if (ready) onconfirm({ email: typedEmail.trim(), password });
		}}
	>
		<p class="warning">
			Verranno eliminati per sempre libri, letture, recensioni, citazioni, bingo, temi e copertine
			caricate. Ti consigliamo di <a href="/api/export/json" download>scaricare prima i tuoi dati</a
			>.
		</p>
		<TextField
			label={`Scrivi la tua email (${email})`}
			name="confirm-email"
			type="email"
			autocomplete="off"
			bind:value={typedEmail}
		/>
		<TextField
			label="Password"
			name="confirm-password"
			type="password"
			autocomplete="current-password"
			bind:value={password}
		/>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
	</form>

	{#snippet footer()}
		<Button variant="secondary" fullWidth disabled={busy} onclick={onclose} data-autofocus>
			Annulla
		</Button>
		<button class="danger" type="submit" form="delete-account-form" disabled={!ready}>
			{busy ? 'Elimino…' : 'Elimina per sempre'}
		</button>
	{/snippet}
</BottomSheet>

<style>
	.form {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding-top: 6px;
	}

	.warning {
		margin: 0;
		font-size: 14px;
		line-height: 1.45;
		color: var(--color-text-secondary);
	}

	.warning a {
		color: var(--color-text-link);
		font-weight: 700;
	}

	.error {
		margin: 0;
		font-size: 14px;
		color: var(--color-danger);
	}

	.danger {
		flex: 1;
		min-height: 50px;
		border: 1.5px solid transparent;
		border-radius: var(--radius-pill);
		background: var(--color-danger);
		color: var(--color-on-danger);
		font-size: 16px;
		font-weight: 700;
	}

	.danger:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
