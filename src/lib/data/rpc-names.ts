/**
 * Un'unica source of truth per i nomi delle RPC.
 * I componenti non devono conoscere questi nomi.
 */
export const RPC = {
	libraryHome: 'get_library_home',
	shelfPage: 'get_shelf_page',
	genreView: 'get_genre_view',
	bookDetail: 'get_book_detail',

	explorePool: 'get_explore_pool',

	readingCalendar: 'get_reading_calendar',
	yearStats: 'get_year_stats',
	statsDashboard: 'get_stats_dashboard',

	bingoBoard: 'get_bingo_board',
	bingoAssignBook: 'assign_bingo_book',
	bingoListBoards: 'list_bingo_boards',
	bingoCreateBoard: 'create_bingo_board',

	listQuotes: 'list_quotes',
	listCompletedBooks: 'list_completed_books',
	yearGenreBreakdown: 'get_year_genre_breakdown',

	queueAdd: 'queue_add',
	queueRemove: 'queue_remove',
	queueMove: 'queue_move',

	startReading: 'start_reading',
	pauseReading: 'pause_reading',
	resumeReading: 'resume_reading',
	recordProgress: 'record_progress',
	correctProgress: 'correct_progress',
	finishReading: 'finish_reading',
	markDnf: 'mark_dnf',
	addCompletedReading: 'add_completed_reading',

	changeBookGenre: 'change_book_genre',
	saveReview: 'save_review',
	reviewReference: 'get_review_reference',
	addQuote: 'add_quote',
	updateQuote: 'update_quote',
	deleteQuote: 'delete_quote',

	getThemeSelection: 'get_theme_selection',
	setThemeSelection: 'set_theme_selection',

	getUserSettings: 'get_user_settings',
	updateUserSettings: 'update_user_settings',
	listCustomThemes: 'list_custom_themes',
	saveCustomTheme: 'save_custom_theme',
	deleteCustomTheme: 'delete_custom_theme',
	exportUserData: 'export_user_data'
} as const;

export type RpcName = (typeof RPC)[keyof typeof RPC];
