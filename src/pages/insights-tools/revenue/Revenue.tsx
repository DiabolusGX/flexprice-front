import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Page, Select } from '@/components/atoms';
import { Button } from '@/components/ui/button';
import { RedirectCell, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/molecules';
import { getCurrencySymbol } from '@/utils';
import RevenueDashboardApi from '@/api/RevenueDashboardApi';
import { RouteNames } from '@/core/routes/Routes';

type RevenueFilterValue = 'this_month' | 'this_quarter' | 'this_year' | 'last_month' | 'last_quarter' | 'last_year';

const FILTER_OPTIONS = [
	{ value: 'this_month', label: 'This month' },
	{ value: 'this_quarter', label: 'This quarter' },
	{ value: 'this_year', label: 'This year' },
	{ value: 'last_month', label: 'Last month' },
	{ value: 'last_quarter', label: 'Last quarter' },
	{ value: 'last_year', label: 'Last year' },
] satisfies { value: RevenueFilterValue; label: string }[];

const getDateRangeForPeriod = (period: RevenueFilterValue) => {
	const now = new Date();

	const startOfMonth = (year: number, month: number) => new Date(year, month, 1, 0, 0, 0, 0);
	const endOfMonth = (year: number, month: number) => new Date(year, month + 1, 0, 23, 59, 59, 999);
	const startOfQuarter = (year: number, quarter: number) => new Date(year, quarter * 3, 1, 0, 0, 0, 0);
	const endOfQuarter = (year: number, quarter: number) => new Date(year, quarter * 3 + 3, 0, 23, 59, 59, 999);

	switch (period) {
		case 'this_month':
			return { start: startOfMonth(now.getFullYear(), now.getMonth()), end: now };
		case 'last_month': {
			const lastMonth = now.getMonth() - 1;
			const year = lastMonth < 0 ? now.getFullYear() - 1 : now.getFullYear();
			const month = (lastMonth + 12) % 12;
			return { start: startOfMonth(year, month), end: endOfMonth(year, month) };
		}
		case 'this_quarter': {
			const quarter = Math.floor(now.getMonth() / 3);
			return { start: startOfQuarter(now.getFullYear(), quarter), end: now };
		}
		case 'last_quarter': {
			const currentQuarter = Math.floor(now.getMonth() / 3);
			const quarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
			const year = currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
			return { start: startOfQuarter(year, quarter), end: endOfQuarter(year, quarter) };
		}
		case 'this_year':
			return { start: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0), end: now };
		case 'last_year':
			return {
				start: new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0),
				end: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999),
			};
		default:
			return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
	}
};

const formatCurrency = (value: number | null, currency: string) => {
	if (value == null) return 'N/A';
	return `${getCurrencySymbol(currency)} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

const formatDecimal = (value: number | null) => {
	if (value == null) return 'N/A';
	return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const formatInteger = (value: number | null) => {
	if (value == null) return 'N/A';
	return value.toLocaleString();
};

const toNumberOrNull = (value: unknown): number | null => {
	if (value == null) return null;
	const numeric = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(numeric) ? numeric : null;
};

const Revenue = () => {
	const [selectedFilter, setSelectedFilter] = useState<RevenueFilterValue>('this_month');
	const { start, end } = useMemo(() => getDateRangeForPeriod(selectedFilter), [selectedFilter]);

	const { data, isLoading } = useQuery({
		queryKey: ['revenue-dashboard', selectedFilter],
		queryFn: async () => {
			return await RevenueDashboardApi.getRevenueDashboard({
				period_start: start.toISOString(),
				period_end: end.toISOString(),
				customer_ids: [],
			});
		},
	});

	const summary = data?.summary;
	const items = data?.items ?? [];
	const hasRows = items.length > 0;
	const hasAnyMetricData = [
		toNumberOrNull(summary?.total_revenue),
		toNumberOrNull(summary?.total_fixed_revenue),
		toNumberOrNull(summary?.total_usage_revenue),
		toNumberOrNull(summary?.voice_minutes),
		toNumberOrNull(summary?.cpm),
	].some((value) => Number(value ?? 0) > 0);
	const showGlobalEmpty = !isLoading && !hasRows && !hasAnyMetricData;

	const normalizedSummary = {
		netRevenue: toNumberOrNull(summary?.total_revenue),
		fixedContractRevenue: toNumberOrNull(summary?.total_fixed_revenue),
		usageRevenue: toNumberOrNull(summary?.total_usage_revenue),
		totalMinutes: toNumberOrNull(summary?.voice_minutes),
		cpm: toNumberOrNull(summary?.cpm),
		currency: 'usd',
	};

	return (
		<Page
			heading='Revenue'
			headingCTA={
				<div className='w-[220px]'>
					<Select options={FILTER_OPTIONS} value={selectedFilter} onChange={(value) => setSelectedFilter(value as RevenueFilterValue)} />
				</div>
			}>
			<div className='space-y-6 pt-3'>
				<div className='relative'>
					<div className={showGlobalEmpty ? 'blur-[3px] select-none pointer-events-none' : ''}>
						<div className='rounded-xl border border-gray-200 bg-white overflow-hidden'>
							<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5'>
								<MetricTile
									title='Net Revenue'
									value={formatCurrency(normalizedSummary.netRevenue, normalizedSummary.currency)}
									loading={isLoading}
								/>
								<MetricTile
									title='Fixed Contract Revenue'
									value={formatCurrency(normalizedSummary.fixedContractRevenue, normalizedSummary.currency)}
									loading={isLoading}
								/>
								<MetricTile
									title='Usage Revenue'
									value={formatCurrency(normalizedSummary.usageRevenue, normalizedSummary.currency)}
									loading={isLoading}
								/>
								<MetricTile title='Total Minutes' value={formatInteger(normalizedSummary.totalMinutes)} loading={isLoading} />
								<MetricTile title='CPM' value={formatDecimal(normalizedSummary.cpm)} loading={isLoading} isLast />
							</div>
						</div>
					</div>

					{showGlobalEmpty && (
						<div className='absolute inset-0 flex items-center justify-center rounded-lg backdrop-blur-md bg-white/45'>
							<div className='text-center max-w-sm px-4'>
								<h3 className='text-xl font-semibold text-zinc-900'>This range is empty</h3>
								<p className='text-sm text-zinc-600 mt-2'>
									Not enough revenue data is available in the selected range to show this statistics.
								</p>
								<Button onClick={() => setSelectedFilter('this_month')} className='mt-4'>
									View latest data
								</Button>
							</div>
						</div>
					)}
				</div>

				<div className='pt-8'>
					<h2 className='text-lg font-medium text-gray-900 mb-4'>Revenue by Customer</h2>
					<div className='rounded-md border border-gray-200 bg-white overflow-hidden shadow-sm'>
						<Table>
							<TableHeader className='h-10 bg-gray-50 border-b border-gray-200 rounded-t-md'>
								<TableRow className='rounded-t-md border-b border-gray-200'>
									<TableHead className='rounded-tl-md pl-4 font-semibold text-gray-700 text-[13px]'>Customer</TableHead>
									<TableHead className='font-semibold text-gray-700 text-[13px]'>Net Revenue</TableHead>
									<TableHead className='font-semibold text-gray-700 text-[13px]'>Fixed Contract Revenue</TableHead>
									<TableHead className='font-semibold text-gray-700 text-[13px]'>Usage Revenue</TableHead>
									<TableHead className='font-semibold text-gray-700 text-[13px]'>Total Minutes</TableHead>
									<TableHead className='rounded-tr-md font-semibold text-gray-700 text-[13px]'>CPM</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{items.map((row) => (
									<TableRow
										key={`${row.customer_id}:${row.external_customer_id}`}
										className='h-10 align-middle border-b border-gray-200 bg-white hover:bg-gray-50/50 transition-colors'>
										<TableCell className='py-2.5 pl-4 font-normal text-gray-700 text-[13px] align-middle'>
											<RedirectCell redirectUrl={`${RouteNames.customers}/${row.customer_id}`} allowRedirect={Boolean(row.customer_id)}>
												{row.customer_name || row.external_customer_id || 'Unknown'}
											</RedirectCell>
										</TableCell>
										<TableCell className='py-2.5 font-semibold text-gray-700 text-[13px]'>
											{formatCurrency(
												toNumberOrNull(row.total_revenue) ??
													(toNumberOrNull(row.total_usage_revenue) ?? 0) + (toNumberOrNull(row.total_fixed_revenue) ?? 0),
												normalizedSummary.currency,
											)}
										</TableCell>
										<TableCell className='py-2.5 font-normal text-gray-600 text-[13px]'>
											{formatCurrency(toNumberOrNull(row.total_fixed_revenue), normalizedSummary.currency)}
										</TableCell>
										<TableCell className='py-2.5 font-normal text-gray-600 text-[13px]'>
											{formatCurrency(toNumberOrNull(row.total_usage_revenue), normalizedSummary.currency)}
										</TableCell>
										<TableCell className='py-2.5 font-normal text-gray-600 text-[13px]'>
											{formatInteger(toNumberOrNull(row.voice_minutes))}
										</TableCell>
										<TableCell className='py-2.5 font-normal text-gray-600 text-[13px]'>{formatDecimal(toNumberOrNull(row.cpm))}</TableCell>
									</TableRow>
								))}
								{items.length === 0 && (
									<TableRow className='bg-white'>
										<TableCell colSpan={6} className='pl-4 py-4 font-normal text-gray-500 text-[13px]'>
											--
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>
				</div>
			</div>
		</Page>
	);
};

const MetricTile = ({
	title,
	value,
	loading = false,
	isLast = false,
}: {
	title: string;
	value: string;
	loading?: boolean;
	isLast?: boolean;
}) => {
	return (
		<div
			className={`px-5 py-4 min-h-[104px] flex flex-col ${!isLast ? 'lg:border-r lg:border-gray-200' : ''} border-b sm:border-b-0 border-gray-200`}>
			<p className='text-[12px] leading-4 text-zinc-600 whitespace-normal break-words'>{title}</p>
			<p className='mt-4 text-[22px] leading-[1.2] font-medium text-zinc-900'>{loading ? '...' : value}</p>
		</div>
	);
};

export default Revenue;
