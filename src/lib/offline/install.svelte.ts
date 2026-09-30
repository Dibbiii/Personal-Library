/** Evento non standard di Chromium (beforeinstallprompt). */
interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

class InstallState {
	/** Il browser ha offerto l'installazione e il prompt è utilizzabile. */
	canPrompt = $state(false);
	/** L'app gira già installata (display-mode: standalone) o è stata appena installata. */
	installed = $state(false);
	/** Service worker che controlla la pagina: l'app shell è disponibile offline. */
	offlineReady = $state(false);
	isIos = $state(false);

	#deferred: BeforeInstallPromptEvent | null = null;

	start(): () => void {
		const standalone =
			matchMedia('(display-mode: standalone)').matches ||
			(navigator as Navigator & { standalone?: boolean }).standalone === true;
		this.installed = standalone;
		this.isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

		const refreshWorker = () => {
			this.offlineReady = Boolean(navigator.serviceWorker?.controller);
		};
		refreshWorker();
		navigator.serviceWorker?.addEventListener('controllerchange', refreshWorker);
		void navigator.serviceWorker?.ready.then(refreshWorker).catch(() => {});

		const onPrompt = (event: Event) => {
			event.preventDefault();
			this.#deferred = event as BeforeInstallPromptEvent;
			this.canPrompt = true;
		};
		const onInstalled = () => {
			this.installed = true;
			this.canPrompt = false;
			this.#deferred = null;
		};

		window.addEventListener('beforeinstallprompt', onPrompt);
		window.addEventListener('appinstalled', onInstalled);
		return () => {
			window.removeEventListener('beforeinstallprompt', onPrompt);
			window.removeEventListener('appinstalled', onInstalled);
			navigator.serviceWorker?.removeEventListener('controllerchange', refreshWorker);
		};
	}

	/** Mostra il prompt di installazione del browser. Restituisce l'esito scelto dall'utente. */
	async install(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
		const event = this.#deferred;
		if (!event) return 'unavailable';
		this.#deferred = null;
		this.canPrompt = false;
		await event.prompt();
		const { outcome } = await event.userChoice;
		if (outcome === 'accepted') this.installed = true;
		return outcome;
	}
}

export const installState = new InstallState();
