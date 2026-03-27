import { AxiosClient } from '@/core/axios/verbs';
import { RevenueDashboardRequest, RevenueDashboardResponse } from '@/types/dto/RevenueDashboard';

class RevenueDashboardApi {
	private static baseUrl = '/dashboard/revenue-dashboard';

	public static async getRevenueDashboard(payload: RevenueDashboardRequest): Promise<RevenueDashboardResponse> {
		return await AxiosClient.post<RevenueDashboardResponse>(this.baseUrl, payload);
	}
}

export default RevenueDashboardApi;
