export type DataErrorCode =
	| 'AUTH_REQUIRED'
	| 'NOT_FOUND'
	| 'CONFLICT'
	| 'VALIDATION'
	| 'RATE_LIMITED'
	| 'NETWORK'
	| 'SERVER'
	| 'CONTRACT';

export class DataAccessError extends Error {
	constructor(
		public readonly code: DataErrorCode,
		message: string,
		public readonly cause?: unknown
	) {
		super(message);
		this.name = 'DataAccessError';
	}
}
