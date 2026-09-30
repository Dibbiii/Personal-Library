import { newEventId, submitReadingOp, syncNow } from './outbox';

declare global {
	interface Window {
		/** Solo sotto automazione (navigator.webdriver): permette ai test e2e di usare la outbox reale. */
		__segnalibroTest?: {
			submitReadingOp: typeof submitReadingOp;
			newEventId: typeof newEventId;
			syncNow: typeof syncNow;
		};
	}
}

export function exposeTestHook(): void {
	if (typeof navigator !== 'undefined' && navigator.webdriver) {
		window.__segnalibroTest = { submitReadingOp, newEventId, syncNow };
	}
}
