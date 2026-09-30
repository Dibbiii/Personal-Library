<script lang="ts">
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import {
		STATUS_CHOICES,
		currentStatusChoice,
		STATUS_CHOICE_LABELS,
		planStatusChange,
		toLocalDate,
		validateDateRange,
		type PlanContext,
		type StatusChoice
	} from '$lib/client/reading-logic';
	import type { StatusActionInputs } from '$lib/client/reading-actions';
	import DateRangeFields from './DateRangeFields.svelte';

	interface Props {
		open: boolean;
		context: PlanContext;
		/** Pagina attuale e totale: servono al DNF. */
		currentPage: number;
		pageCount: number | null;
		busy?: boolean;
		error?: string | null;
		onclose: () => void;
		onsave: (choice: StatusChoice, inputs: StatusActionInputs) => void;
	}

	let {
		open,
		context,
		currentPage,
		pageCount,
		busy = false,
		error = null,
		onclose,
		onsave
	}: Props = $props();

	const uid = $props.id();
	const today = toLocalDate(new Date());

	const initial = $derived(currentStatusChoice(context));

	let selected = $state<StatusChoice>('unread');
	let start = $state(today);
	let end = $state(today);
	let dnfPage = $state('');
	let localError = $state<string | null>(null);

	// Ogni apertura riparte dallo stato reale del libro.
	$effect(() => {
		if (open) {
			selected = initial;
			start = today;
			end = today;
			dnfPage = String(currentPage);
			localError = null;
		}
	});

	const plans = $derived(
		Object.fromEntries(STATUS_CHOICES.map((c) => [c, planStatusChange(context, c)])) as Record<
			StatusChoice,
			ReturnType<typeof planStatusChange>
		>
	);
	const plan = $derived(plans[selected]);
	const needsDates = $derived(plan.kind === 'run' && plan.inputs.includes('dates'));
	const needsDnfPage = $derived(plan.kind === 'run' && plan.inputs.includes('dnfPage'));
	const canSave = $derived(plan.kind === 'run');

	function save() {
		localError = null;
		if (plan.kind !== 'run') return;
		const inputs: StatusActionInputs = {};

		if (needsDates) {
			const problem = validateDateRange(start, end, today);
			if (problem === 'order')
				return void (localError = 'La data di inizio è dopo quella di fine.');
			if (problem === 'future') return void (localError = 'Le date non possono essere nel futuro.');
			if (problem) return void (localError = 'Inserisci date valide.');
			inputs.startDate = start;
			inputs.endDate = end;
		}

		if (needsDnfPage) {
			const page = Number(dnfPage);
			if (!Number.isInteger(page) || page < 0 || (pageCount !== null && page > pageCount)) {
				return void (localError =
					pageCount !== null
						? `Inserisci una pagina tra 0 e ${pageCount}.`
						: 'Inserisci una pagina valida.');
			}
			inputs.dnfPage = page;
		}

		onsave(selected, inputs);
	}

	function onKeydown(event: KeyboardEvent) {
		const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight';
		const backward = event.key === 'ArrowUp' || event.key === 'ArrowLeft';
		if (!forward && !backward) return;
		event.preventDefault();
		const index = STATUS_CHOICES.indexOf(selected);
		const step = forward ? 1 : -1;
		const target = STATUS_CHOICES[(index + step + STATUS_CHOICES.length) % STATUS_CHOICES.length];
		if (target && plans[target].kind !== 'unavailable') {
			selected = target;
			document.getElementById(`${uid}-${target}`)?.focus();
		}
	}
</script>

<BottomSheet {open} title="Stato di lettura" {onclose}>
	<div
		class="group"
		role="radiogroup"
		aria-label="Stato di lettura"
		tabindex="-1"
		onkeydown={onKeydown}
	>
		{#each STATUS_CHOICES as choice (choice)}
			{@const unavailable = plans[choice].kind === 'unavailable'}
			{@const isSelected = selected === choice}
			<button
				id="{uid}-{choice}"
				class="option"
				class:selected={isSelected}
				type="button"
				role="radio"
				aria-checked={isSelected}
				aria-disabled={unavailable}
				aria-describedby={unavailable ? `${uid}-${choice}-why` : undefined}
				tabindex={isSelected ? 0 : -1}
				data-choice={choice}
				onclick={() => {
					if (!unavailable) selected = choice;
				}}
			>
				<span class="radio" aria-hidden="true"></span>
				<span class="text">
					{STATUS_CHOICE_LABELS[choice]}
					{#if plans[choice].kind === 'unavailable'}
						<span id="{uid}-{choice}-why" class="why">{plans[choice].reason}</span>
					{/if}
				</span>
			</button>
		{/each}
	</div>

	{#if needsDates}
		<div class="extra">
			<p class="hint">
				{selected === 'rereads' ? 'Quando hai riletto il libro?' : 'Quando lo hai letto?'}
				Le date non creano giorni di lettura nel calendario.
			</p>
			<DateRangeFields bind:start bind:end max={today} error={localError} />
		</div>
	{:else if needsDnfPage}
		<div class="extra">
			<label class="page" for="{uid}-dnf-page">
				<span>A che pagina ti sei fermato?</span>
				<input
					id="{uid}-dnf-page"
					type="number"
					inputmode="numeric"
					min="0"
					max={pageCount ?? undefined}
					bind:value={dnfPage}
					aria-invalid={localError ? 'true' : undefined}
				/>
			</label>
			{#if localError}<p class="error" role="alert">{localError}</p>{/if}
		</div>
	{/if}

	{#if error}<p class="error top" role="alert">{error}</p>{/if}

	{#snippet footer()}
		<Button variant="secondary" size="lg" disabled={busy} onclick={onclose}>Annulla</Button>
		<Button size="lg" loading={busy} disabled={!canSave} onclick={save}>Salva</Button>
	{/snippet}
</BottomSheet>

<style>
	.group {
		display: flex;
		flex-direction: column;
	}

	.option {
		display: flex;
		align-items: center;
		gap: 14px;
		width: 100%;
		min-height: 48px;
		padding: 6px 12px;
		border: 0;
		border-radius: 14px;
		background: transparent;
		color: var(--color-text-primary);
		font-family: var(--font-ui);
		font-size: 16px;
		text-align: left;
		cursor: pointer;
	}

	.option[aria-disabled='true'] {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.option.selected {
		background: color-mix(in srgb, var(--color-accent) 40%, transparent);
		font-weight: 700;
	}

	.radio {
		position: relative;
		flex: none;
		box-sizing: border-box;
		width: 24px;
		height: 24px;
		border: 2px solid color-mix(in srgb, var(--color-shelf-axis) 50%, transparent);
		border-radius: 50%;
	}

	.selected .radio {
		border-color: var(--color-primary);
	}

	.selected .radio::after {
		content: '';
		position: absolute;
		inset: 4px;
		border-radius: 50%;
		background: var(--color-primary);
	}

	.text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.why {
		font-size: 12px;
		font-weight: 500;
		line-height: 16px;
		color: var(--color-text-secondary);
	}

	.extra {
		margin-top: 12px;
		padding: 12px;
		border-radius: 16px;
		background: var(--color-surface);
	}

	.hint {
		margin: 0 0 10px;
		font-size: 13px;
		line-height: 18px;
		color: var(--color-text-secondary);
	}

	.page {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 13px;
		font-weight: 700;
		color: var(--color-text-secondary);
	}

	.page input {
		box-sizing: border-box;
		min-height: 48px;
		padding: 0 12px;
		border: 1.5px solid var(--color-border);
		border-radius: 14px;
		background: var(--color-surface-elevated);
		color: var(--color-text-primary);
		font-family: var(--font-ui);
		font-size: 16px;
	}

	.error {
		margin: 8px 0 0;
		font-size: 13px;
		color: var(--color-danger);
	}

	.error.top {
		margin-top: 12px;
	}
</style>
