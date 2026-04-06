export interface ServerError {
	success: false;
	error: { message: string; internal_error: string; details: Record<string, string> };
}

/** Flat API error body (e.g. validation_error) returned as axios `response.data` */
export interface FlatApiError {
	code?: string;
	message?: string;
	http_status_code?: number;
}

/**
 * User-facing message from rejected API calls. Handles:
 * - `{ error: { message } }` (ServerError)
 * - `{ message, code, http_status_code }` (flat validation / API errors)
 * - `Error` instances
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error && error.message) {
		return error.message;
	}
	if (error && typeof error === 'object') {
		const e = error as Record<string, unknown>;
		const nested = e.error;
		if (nested && typeof nested === 'object' && nested !== null) {
			const msg = (nested as { message?: unknown }).message;
			if (typeof msg === 'string' && msg.trim()) {
				return msg;
			}
		}
		const top = e.message;
		if (typeof top === 'string' && top.trim()) {
			return top;
		}
	}
	return fallback;
}

// adds the same shape to the global namespace for legacy code, tests, etc.
declare global {
	interface ServerError {
		success: false;
		error: { message: string; internal_error: string; details: Record<string, string> };
	}
}
