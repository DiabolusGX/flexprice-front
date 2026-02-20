import { useMemo, useCallback } from 'react';

/** Raw parsed env config: env id -> ISO date or "suspended" */
export type RestrictedEnvsConfig = Record<string, string>;

export enum EnvRestrictionState {
	Active = 'active',
	GracePeriod = 'grace_period',
	Suspended = 'suspended',
}

export interface EnvRestrictionResult {
	state: EnvRestrictionState;
	isRestricted: boolean;
	expiresAt?: string;
}

const SUSPENDED_VALUE = 'suspended';

function parseRestrictedEnvsConfig(): RestrictedEnvsConfig {
	try {
		const raw = import.meta.env.VITE_RESTRICTED_ENVS;
		if (raw == null || typeof raw !== 'string') return {};
		const parsed = JSON.parse(raw) as unknown;
		if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return parsed as RestrictedEnvsConfig;
		}
		return {};
	} catch {
		return {};
	}
}

const PARSED_CONFIG = parseRestrictedEnvsConfig();

/**
 * Resolves restriction state for an environment id.
 * Pure function: no side effects.
 */
export function getEnvRestriction(envId: string, config: RestrictedEnvsConfig = PARSED_CONFIG): EnvRestrictionResult {
	if (!envId) return { state: EnvRestrictionState.Active, isRestricted: false };

	const value = config[envId];
	if (value == null || value === '') return { state: EnvRestrictionState.Active, isRestricted: false };

	if (value === SUSPENDED_VALUE) {
		return { state: EnvRestrictionState.Suspended, isRestricted: true };
	}

	const expiresAtDate = new Date(value);
	if (Number.isNaN(expiresAtDate.getTime())) {
		return { state: EnvRestrictionState.Active, isRestricted: false };
	}

	const now = Date.now();
	if (now > expiresAtDate.getTime()) {
		return { state: EnvRestrictionState.Suspended, isRestricted: true };
	}

	return {
		state: EnvRestrictionState.GracePeriod,
		isRestricted: true,
		expiresAt: value,
	};
}

export interface UseRestrictedEnvsReturn {
	/** Map of env id -> restriction result for every env id in VITE_RESTRICTED_ENVS */
	restrictedEnvs: Record<string, EnvRestrictionResult>;
	/** Get restriction (and expiry) for a given env id */
	getRestriction: (envId: string) => EnvRestrictionResult;
}

/**
 * Hook for FE-only restricted environments (env-driven).
 * Reads VITE_RESTRICTED_ENVS: { [envId]: ISO date | "suspended" }.
 */
export function useRestrictedEnvs(): UseRestrictedEnvsReturn {
	const restrictedEnvs = useMemo(() => {
		const acc: Record<string, EnvRestrictionResult> = {};
		for (const envId of Object.keys(PARSED_CONFIG)) {
			acc[envId] = getEnvRestriction(envId, PARSED_CONFIG);
		}
		return acc;
	}, []);

	const getRestriction = useCallback((envId: string) => {
		return getEnvRestriction(envId, PARSED_CONFIG);
	}, []);

	return { restrictedEnvs, getRestriction };
}

export default useRestrictedEnvs;
