import { AxiosClient } from '@/core/axios/verbs';
import { ACTIVE_ENVIRONMENT_ID_KEY } from '@/hooks/useEnvironment';
import { Environment } from '@/models';
import { CreateEnvironmentPayload, ListEnvironmentResponse } from '@/types/dto';

class EnvironmentApi {
	private static baseUrl = '/environments';

	// API Methods
	public static async getAllEnvironments(): Promise<ListEnvironmentResponse> {
		try {
			return await AxiosClient.get<ListEnvironmentResponse>(this.baseUrl);
		} catch (error) {
			return { environments: [], total: 0 } as ListEnvironmentResponse;
		}
	}

	public static async getEnvironmentById(id: string): Promise<Environment | null> {
		try {
			return await AxiosClient.get<Environment>(`${this.baseUrl}/${id}`);
		} catch (error) {
			return null;
		}
	}

	public static async createEnvironment(payload: CreateEnvironmentPayload): Promise<Environment | null> {
		return await AxiosClient.post<Environment>(this.baseUrl, payload);
	}

	public static getActiveEnvironmentId(): string | null {
		return localStorage.getItem(ACTIVE_ENVIRONMENT_ID_KEY);
	}

	public static setActiveEnvironmentId(environmentId: string): void {
		localStorage.setItem(ACTIVE_ENVIRONMENT_ID_KEY, environmentId);
	}
}

export default EnvironmentApi;
