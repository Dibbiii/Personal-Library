<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';

	import TextField from '$lib/components/ui/TextField.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let pending = $state(false);
</script>

<svelte:head><title>Accedi · Segnalibro</title></svelte:head>

<section class="auth-card">
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
		<div class="form-heading">
			<p>Accedi al tuo spazio</p>
			<h2>Bentornato</h2>
			<span>Inserisci le tue credenziali per continuare.</span>
		</div>

		{#if form?.message}
			<p class="alert" role="alert">{form.message}</p>
		{/if}

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
			autocomplete="current-password"
			error={form?.fieldErrors?.password ?? null}
			required
		/>

		<Button type="submit" fullWidth loading={pending}>Accedi</Button>
	</form>
</section>

<p class="switch">Non hai ancora un account? <a href="/auth/register">Registrati</a></p>

<style>
	:global(.auth-card) {
		width: 100%;
		max-width: none;
		padding: 0;
		background: transparent;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.form-heading {
		display: grid;
		gap: 8px;
		margin-bottom: 10px;
	}

	.form-heading p,
	.form-heading span {
		margin: 0;
	}

	.form-heading p {
		color: var(--color-primary);
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(36px, 4vw, 48px);
		font-weight: 400;
		line-height: 1.05;
		color: var(--color-text-primary);
	}

	.form-heading span {
		color: var(--color-text-secondary);
		font-size: 15px;
		line-height: 1.5;
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
		text-align: center;
		color: var(--color-text-secondary);
	}

	.switch a {
		color: var(--color-primary);
		font-weight: 700;
	}
</style>
