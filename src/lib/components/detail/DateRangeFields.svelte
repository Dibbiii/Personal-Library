<script lang="ts">
	interface Props {
		start: string;
		end: string;
		/** Se false mostra solo la data di fine (la lettura storica parte e finisce lo stesso giorno). */
		showStart?: boolean;
		max: string;
		error?: string | null;
		startLabel?: string;
		endLabel?: string;
	}

	let {
		start = $bindable(),
		end = $bindable(),
		showStart = true,
		max,
		error = null,
		startLabel = 'Iniziato il',
		endLabel = 'Finito il'
	}: Props = $props();

	const uid = $props.id();

	// Finché l'utente non tocca la data di inizio, segue quella di fine.
	let startTouched = $state(false);

	function onEnd() {
		if (!startTouched && end) start = end;
	}
</script>

<div class="fields">
	{#if showStart}
		<label class="field" for="{uid}-start">
			<span>{startLabel}</span>
			<input
				id="{uid}-start"
				type="date"
				bind:value={start}
				{max}
				required
				oninput={() => (startTouched = true)}
				aria-invalid={error ? 'true' : undefined}
			/>
		</label>
	{/if}
	<label class="field" for="{uid}-end">
		<span>{endLabel}</span>
		<input
			id="{uid}-end"
			type="date"
			bind:value={end}
			{max}
			required
			oninput={onEnd}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={error ? `${uid}-error` : undefined}
		/>
	</label>
</div>
{#if error}<p id="{uid}-error" class="error" role="alert">{error}</p>{/if}

<style>
	.fields {
		display: flex;
		gap: 10px;
	}

	.field {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
		font-size: 12.5px;
		font-weight: 700;
		color: var(--color-text-secondary);
	}

	input {
		box-sizing: border-box;
		width: 100%;
		min-height: 48px;
		padding: 0 12px;
		border: 1.5px solid var(--color-border);
		border-radius: 14px;
		background: var(--color-surface-elevated);
		color: var(--color-text-primary);
		font-family: var(--font-ui);
		font-size: 15px;
	}

	input[aria-invalid='true'] {
		border-color: var(--color-danger);
	}

	.error {
		margin: 8px 0 0;
		font-size: 13px;
		color: var(--color-danger);
	}
</style>
