/** Upper bound for `sessions.num_courts` and `leagues.last_court_count` (see DB check constraints). */
export const MAX_SESSION_COURTS = 50;
export const MIN_SESSION_COURTS = 1;

/** Above this count, per-game court selection uses a dropdown instead of radios. */
export const SESSION_GAME_COURT_RADIO_MAX = 12;
