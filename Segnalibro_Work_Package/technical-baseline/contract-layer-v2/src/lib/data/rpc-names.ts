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

  getThemeSelection: 'get_theme_selection',
  setThemeSelection: 'set_theme_selection',
} as const;

export type RpcName = (typeof RPC)[keyof typeof RPC];
