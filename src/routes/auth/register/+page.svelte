<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let pending = $state(false);
</script>

<svelte:head><title>Registrati · Segnalibro</title></svelte:head>

<Card as="section" class="auth-card">
	<form
		method="POST"
		novalidate
		use:enhance={() => {
			pending = true;
			return async ({ update }) => {
				await update({ reset: false });
				pending = false;
			};
		}}
	>
		<h2>Crea il tuo account</h2>

		{#if form?.message}<p class="alert" role="alert">{form.message}</p>{/if}

		<TextField
			label="Nome"
			name="displayName"
			autocomplete="given-name"
			value={form?.displayName ?? ''}
			error={form?.fieldErrors?.displayName ?? null}
			required
		/>
		<TextField
			label="Email"
			name="email"
			type="email"
			autocomplete="email"
			inputmode="email"
			value={form?.email ?? ''}
			error={form?.fieldErrors?.email ?? null}
			required
		/>
		<TextField
			label="Password"
			name="password"
			type="password"
			autocomplete="new-password"
			hint="Almeno 8 caratteri."
			error={form?.fieldErrors?.password ?? null}
			required
		/>

		<Button type="submit" fullWidth loading={pending}>Registrati</Button>
	</form>
</Card>

<p class="switch">Hai già un account? <a href="/auth/login">Accedi</a></p>

<style>
	:global(.auth-card) {
		width: 100%;
		max-width: 420px;
		padding: 28px 24px;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	h2 {
		font-size: 24px;
		color: var(--color-text-primary);
	}

	.alert {
		margin: 0;
		padding: 12px 14px;
		border-radius: var(--radius-md);
		background: var(--color-card);
		color: var(--color-danger);
		font-size: 14px;
		font-weight: 600;
	}

	.switch {
		margin: 0;
		font-size: 14px;
		color: var(--color-text-secondary);
	}

	.switch a {
		color: var(--color-primary);
		font-weight: 700;
	}
</style>
