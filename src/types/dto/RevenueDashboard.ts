export interface RevenueDashboardRequest {
	period_start: string;
	period_end: string;
	customer_ids: string[];
}

export interface RevenueDashboardSummary {
	total_revenue: number | string | null;
	total_usage_revenue: number | string | null;
	total_fixed_revenue: number | string | null;
	cpm: number | string | null;
	voice_minutes: number | string | null;
}

export interface RevenueDashboardItem {
	customer_id: string;
	external_customer_id: string;
	customer_name: string;
	total_revenue?: number | string | null;
	total_usage_revenue: number | string | null;
	total_fixed_revenue: number | string | null;
	cpm?: number | string | null;
	voice_minutes?: number | string | null;
}

export interface RevenueDashboardResponse {
	summary: RevenueDashboardSummary;
	items: RevenueDashboardItem[];
}
