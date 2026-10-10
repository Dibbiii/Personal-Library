import type { IconName } from '$lib/components/ui/icons';

export interface NavItem {
	href: string;
	label: string;
	icon: IconName;
	/** Prefissi di percorso che tengono attiva la voce. */
	match: readonly string[];
}

export const NAV_ITEMS: readonly NavItem[] = [
	{
		href: '/library',
		label: 'Libreria',
		icon: 'library',
		match: ['/library', '/genre', '/book', '/add']
	},
	{ href: '/explore', label: 'Esplora', icon: 'compass', match: ['/explore'] },
	{
		href: '/profile',
		label: 'Profilo',
		icon: 'user',
		match: ['/profile', '/stats', '/bingo', '/quotes']
	},
	{ href: '/friends', label: 'Amici', icon: 'users', match: ['/friends'] }
];

export function isNavActive(item: NavItem, pathname: string): boolean {
	return item.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
