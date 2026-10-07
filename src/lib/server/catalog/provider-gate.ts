import { DataAccessError } from '$lib/data/errors';

/** Shared per-process request pacing, with bounded queue and Retry-After cooldown. */
export class ProviderGate {
	private nextAt = 0;
	private cooldownUntil = 0;
	constructor(
		private intervalMs: number,
		private now = Date.now
	) {}
	reserve(): number {
		const now = this.now();
		this.check();
		const delay = Math.max(0, this.nextAt - now);
		if (delay > 5000) throw new DataAccessError('RATE_LIMITED', 'Troppe richieste in attesa');
		this.nextAt = now + delay + this.intervalMs;
		return delay;
	}
	check() {
		if (this.now() < this.cooldownUntil)
			throw new DataAccessError('RATE_LIMITED', 'Servizio in pausa dopo troppe richieste');
	}
	pause(header: string | null) {
		const now = this.now();
		const value = header?.trim();
		const delay =
			value && /^\d+$/.test(value)
				? Number(value) * 1000
				: value
					? Date.parse(value) - now
					: 60_000;
		this.cooldownUntil = Math.max(
			this.cooldownUntil,
			now + Math.max(1000, Math.min(300_000, Number.isFinite(delay) ? delay : 60_000))
		);
	}
}
