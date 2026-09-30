/** Icone a tratto su griglia 24x24 (sprite del mockup: docs/mockup/assets/icons-sprite.svg). Markup SVG interno. */
export const ICONS = {
	bookmark: '<path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z"/>',
	camera:
		'<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
	'book-open':
		'<path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2z"/><path d="M12 6.5v13"/>',
	'chevron-right': '<path d="M9 6l6 6-6 6"/>',
	'chevron-left': '<path d="M15 6l-6 6 6 6"/>',
	'chevron-down': '<path d="M6 9l6 6 6-6"/>',
	'chevron-up': '<path d="M6 15l6-6 6 6"/>',
	plus: '<path d="M12 5v14M5 12h14"/>',
	smartphone: '<rect x="5.5" y="2.5" width="13" height="19" rx="2.5"/><path d="M10 18h4"/>',
	library:
		'<rect x="4" y="3" width="16" height="18" rx="1.8"/><path d="M4 12h16"/><path d="M8 6.5v3M11 6v3.5M15.5 6.8v2.7M8 15v3M12 14.5v3.5M15.5 15.2v2.8"/>',
	compass: '<circle cx="12" cy="12" r="9"/><path d="M15.6 8.4l-2 5.2-5.2 2 2-5.2z"/>',
	'bar-chart': '<path d="M5 20v-8M12 20V5M19 20v-5"/>',
	sort: '<path d="M8 5v14M4.5 15.5L8 19l3.5-3.5M16 19V5M12.5 8.5L16 5l3.5 3.5"/>',
	'arrow-down': '<path d="M12 5v13M6.5 13l5.5 5.5 5.5-5.5"/>',
	'more-horizontal':
		'<circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
	'file-text': '<path d="M6 3.5h9l3 3V20H6z"/><path d="M9 11h6M9 14.5h6"/>',
	check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
	tag: '<path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9z"/><circle cx="8" cy="8" r="1.2"/>',
	calendar:
		'<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
	quote:
		'<path d="M10 7H6.5A1.5 1.5 0 0 0 5 8.5V12a1.5 1.5 0 0 0 1.5 1.5H9v1.2A2.3 2.3 0 0 1 6.7 17M19 7h-3.5A1.5 1.5 0 0 0 14 8.5V12a1.5 1.5 0 0 0 1.5 1.5H18v1.2a2.3 2.3 0 0 1-2.3 2.3"/>',
	shuffle:
		'<path d="M3 7h3c4 0 4 10 8 10h5M3 17h3c1.6 0 2.6-1 3.4-2.4M14 7h5M16.5 4.5L19 7l-2.5 2.5M16.5 14.5L19 17l-2.5 2.5"/>',
	user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.6-3.6 3.4-5.5 7-5.5s6.4 1.9 7 5.5"/>',
	sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
	flame:
		'<path d="M12 3c.6 3.2 4.5 4.6 4.5 9a4.5 4.5 0 0 1-9 0c0-1.7.7-3 1.7-4 .2 1.2.7 1.9 1.5 2.3C10.8 7.6 11 5.4 12 3z"/>',
	image:
		'<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M3.5 17l5-4.5 4 3 3-2.5 5 4"/>',
	flower:
		'<circle cx="12" cy="12" r="2.2"/><path d="M12 9.8C12 7 13 5 12 3.5 11 5 12 7 12 9.8zM14.2 12c2.8 0 4.8 1 6.3 0-1.5-1-3.5 0-6.3 0zM12 14.2c0 2.8-1 4.8 0 6.3 1-1.5 0-3.5 0-6.3zM9.8 12C7 12 5 11 3.5 12c1.5 1 3.5 0 6.3 0z"/>',
	trophy:
		'<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v1.5A3 3 0 0 0 8 10.5M16 6h3v1.5a3 3 0 0 1-3 3M12 13v4M8.5 20h7M10 17h4"/>',
	'bingo-bestseller':
		'<circle cx="12" cy="9" r="5"/><path d="M12 6.8v4.4M10.7 8l1.3-1.2M9 13.5L7.5 21l4.5-2.5 4.5 2.5L15 13.5"/>',
	'bingo-film':
		'<path d="M3.5 10h17v9.5h-17zM3.5 10l1.6-4.6 14.6 3.6-.5 1M8 6.5l2.2 3M12.5 7.6l2.2 3"/>',
	'bingo-hearts':
		'<path d="M8 11.5C4.5 9 5 5.5 7.4 5.5c.6 0 .6.4.6.4s0-.4.6-.4C11 5.5 11.5 9 8 11.5zM16.5 16C12.2 13 13 8.7 15.8 8.7c.7 0 .7.5.7.5s0-.5.7-.5c2.8 0 3.6 4.3-.7 7.3zM8 20.5C5.3 18.6 5.7 16 7.4 16c.6 0 .6.3.6.3s0-.3.6-.3c1.7 0 2.1 2.6-.6 4.5z"/>',
	'bingo-feather':
		'<path d="M20 4c-8 0-13 4-13 11l-2.5 4.5M20 4c0 7-4 11-11 11M9.5 13.5H15M11 10.5h4.5"/>',
	'bingo-scribble': '<path d="M4 14c2-9 9-10 10-6s-8 9-8 4 10-7 11-2-5 10-9 9-1-7 4-7 4 5 1 6"/>',
	'bingo-laurel':
		'<path d="M12 20c-4.5 0-8-3.5-8-8M12 20c4.5 0 8-3.5 8-8M5 15c-1.6-1-2-2.6-1.4-4.2M19 15c1.6-1 2-2.6 1.4-4.2M4.6 9.5C3.6 8.4 3.6 7 4.6 5.8M19.4 9.5c1-1.1 1-2.5 0-3.7M8 18.2c-1.8 0-3-.8-3.6-2.2M16 18.2c1.8 0 3-.8 3.6-2.2"/>',
	'bingo-temple': '<path d="M5 6h14M7 6v2h10V6M8.5 8v10M12 8v10M15.5 8v10M6 18h12M4.5 21h15"/>',
	'bingo-search':
		'<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5M8 9.5c.4-1 1.2-1.8 2.3-2"/>',
	'bingo-sparkle':
		'<path d="M12 3.5c.7 4.6 2.2 6.3 7 7.5-4.8 1.2-6.3 2.9-7 7.5-.7-4.6-2.2-6.3-7-7.5 4.8-1.2 6.3-2.9 7-7.5zM19 3v3M17.5 4.5h3"/>',
	'bingo-academia':
		'<path d="M6 21V10l6-6 6 6v11M3.5 21h17M10 21v-5a2 2 0 0 1 4 0v5M12 4V2M9.5 11.5h.01M14.5 11.5h.01"/>',
	'bingo-pulse': '<path d="M2.5 12.5H8l2-6 3.5 12 2.5-6h5.5"/>',
	'bingo-plane': '<path d="M21 4.5L10 14.5M21 4.5l-6 15-3.5-6.5L5 9.5zM10 14.5l-.5 5 2-2.5"/>',
	'bingo-music':
		'<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
	close: '<path d="M6 6l12 12M18 6L6 18"/>',
	search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>',
	settings:
		'<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
	logout:
		'<path d="M10 4.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 19.5h4M15 8l4 4-4 4M19 12H9.5"/>',
	mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="M4 7.5l8 6 8-6"/>',
	lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
	pencil:
		'<path d="M4.5 19.5l.8-4L16 4.8a1.6 1.6 0 0 1 2.2 0l1 1a1.6 1.6 0 0 1 0 2.2L8.5 18.7z"/><path d="M14 7l3 3"/>',
	trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7M10 11v5M14 11v5"/>'
} as const;

export type IconName = keyof typeof ICONS;

/** Forma piena della stella usata da RatingStars. */
export const STAR_PATH =
	'M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.2 6.6 20.1l1-6.1-4.4-4.3 6.1-.9z';
