import { describe, expect, it } from 'vitest';
import { isNavActive, NAV_ITEMS } from '../../src/lib/navigation';

describe('primary navigation', () => {
	const friends = NAV_ITEMS.find((item) => item.href === '/friends');
	const profile = NAV_ITEMS.find((item) => item.href === '/profile');

	it('lists Amici with the other primary destinations', () => {
		expect(NAV_ITEMS.map((item) => item.label)).toEqual([
			'Libreria',
			'Esplora',
			'Profilo',
			'Amici'
		]);
	});

	it('keeps Amici active on a friend profile without highlighting Profilo', () => {
		expect(friends).toBeDefined();
		expect(profile).toBeDefined();
		expect(isNavActive(friends!, '/friends')).toBe(true);
		expect(isNavActive(friends!, '/friends/abc')).toBe(true);
		expect(isNavActive(profile!, '/friends')).toBe(false);
		expect(isNavActive(profile!, '/profile')).toBe(true);
	});
});
