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
function pickMessage(value: unknown): string | undefined {
	if (typeof value === 'string' && value.trim()) {
		return value.trim();
	}
	if (Array.isArray(value) && value.length > 0) {
		const parts = value.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).filter(Boolean);
		if (parts.length) return parts.join(' ');
	}
	return undefined;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
	if (typeof error === 'string') {
		const trimmed = error.trim();
		if (trimmed.startsWith('{')) {
			try {
				const parsed = JSON.parse(trimmed) as Record<string, unknown>;
				const fromJson =
					pickMessage(parsed.message) ||
					pickMessage(parsed.detail) ||
					(parsed.error && typeof parsed.error === 'object' && parsed.error !== null
						? pickMessage((parsed.error as { message?: unknown }).message)
						: undefined);
				if (fromJson) return fromJson;
			} catch {
				/* use raw string */
			}
		}
		if (trimmed) return trimmed;
	}
	if (error instanceof Error && error.message) {
		return error.message;
	}
	if (error && typeof error === 'object') {
		const e = error as Record<string, unknown>;
		const nested = e.error;
		if (nested && typeof nested === 'object' && nested !== null) {
			const msg = pickMessage((nested as { message?: unknown }).message);
			if (msg) return msg;
		}
		const fromTop = pickMessage(e.message) || pickMessage(e.detail);
		if (fromTop) return fromTop;
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
