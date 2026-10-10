import { describe, expect, it, vi } from 'vitest';
const invalidate = vi.hoisted(() => vi.fn(async (_predicate: (url: URL) => boolean) => {}));
vi.mock('$app/navigation', () => ({ invalidate }));
import { refreshData } from '../../src/lib/client/refresh-data';

describe('targeted data refresh', () => {
	it('batches overlapping notifications without refreshing unrelated dependencies', async () => {
		invalidate.mockClear();
		await Promise.all([refreshData(['app:library']), refreshData(['app:library', 'app:profile'])]);
		expect(invalidate).toHaveBeenCalledTimes(1);
		const predicate = invalidate.mock.calls[0]![0];
		expect(predicate(new URL('app:library'))).toBe(true);
		expect(predicate(new URL('app:profile'))).toBe(true);
		expect(predicate(new URL('app:user'))).toBe(false);
	});
	it('accepts new changes during a refresh and recovers after failure', async () => {
		let release!: () => void;
		invalidate.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					release = resolve;
				})
		);
		const first = refreshData(['app:reading']);
		await Promise.resolve();
		const second = refreshData(['app:quotes']);
		release();
		await Promise.all([first, second]);
		const predicate = invalidate.mock.calls.at(-1)![0];
		expect(predicate(new URL('app:quotes'))).toBe(true);
		invalidate.mockRejectedValueOnce(new Error('network'));
		await expect(refreshData(['app:library'])).rejects.toThrow('network');
		await expect(refreshData(['app:library'])).resolves.toBeUndefined();
	});
	it('does not lose a notification arriving while the completed batch is settling', async () => {
		invalidate.mockClear();
		const first = refreshData(['app:library']);
		await Promise.resolve();
		await Promise.resolve();
		const second = refreshData(['app:quotes']);
		await Promise.all([first, second]);
		expect(invalidate).toHaveBeenCalledTimes(2);
		expect(invalidate.mock.calls[1]![0](new URL('app:quotes'))).toBe(true);
	});
});
