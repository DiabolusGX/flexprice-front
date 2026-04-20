import { Loader, Page, Select, AddButton } from '@/components/atoms';
import usePagination from '@/hooks/usePagination';
import { PlanApi } from '@/api/PlanApi';
import { PriceApi } from '@/api/PriceApi';
import EntitlementApi from '@/api/EntitlementApi';
import { FilterOperator, DataType } from '@/types/common/QueryBuilder';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { billlingPeriodOptions } from '@/constants/constants';
import { useState, useMemo } from 'react';
import { PlanResponse, PriceResponse, EntitlementResponse } from '@/types';
import { GetAllPlansResponse } from '@/api/PlanApi';
import { PricingCard, type PricingCardProps } from '@/components/molecules';
import { ApiDocsContent } from '@/components/molecules';
import { PlanDrawer } from '@/components/molecules';
import {
	Price,
	BILLING_PERIOD,
	INVOICE_CADENCE,
	PRICE_TYPE,
	ENTITLEMENT_ENTITY_TYPE,
	PRICE_ENTITY_TYPE,
	ENTITY_STATUS,
	CREDIT_GRANT_SCOPE,
	CREDIT_GRANT_CADENCE,
	type CreditGrant,
} from '@/models';
import CreditGrantApi from '@/api/CreditGrantApi';
import { generateExpandQueryParams } from '@/utils/common/api_helper';
import { EXPAND } from '@/models/expand';

type PriceType = {
	currency: string;
	billing_period: string;
	billing_model: string;
	type: PRICE_TYPE;
	billing_cadence?: string;
	amount?: string;
	meter?: {
		id: string;
		name: string;
	};
	tiers: any;
};

import { PlanType } from '@/constants/planTypes';
export { PlanType };

const parseAmount = (amount: string | undefined): number => {
	if (!amount) return 0;
	const parsed = parseFloat(amount);
	return isNaN(parsed) ? 0 : parsed;
};

const isRecurringPrice = (price: PriceType) =>
	price.type === PRICE_TYPE.FIXED && price.billing_period?.toUpperCase() !== BILLING_PERIOD.ONETIME;

const isUsageBasedPrice = (price: PriceType) => price.type === PRICE_TYPE.USAGE;

const getPriceDisplayType = (prices: PriceType[]): PlanType => {
	if (!prices || prices.length === 0) return PlanType.USAGE_ONLY;

	const recurringPrices = prices.filter(isRecurringPrice);
	const usagePrices = prices.filter(isUsageBasedPrice);

	// Check if any recurring price has a non-zero amount
	const hasNonZeroRecurring = recurringPrices.some((p) => parseAmount(p.amount) > 0);
	// Check if all recurring prices are zero
	const allRecurringZero = recurringPrices.every((p) => parseAmount(p.amount) === 0);

	// Free plan: Only fixed charges with amount 0
	if (recurringPrices.length > 0 && !usagePrices.length && allRecurringZero) {
		return PlanType.FREE;
	}

	// Hybrid Free: Fixed charges with amount 0 + Usage
	if (recurringPrices.length > 0 && usagePrices.length > 0 && allRecurringZero) {
		return PlanType.HYBRID_FREE;
	}

	// Hybrid Paid: Fixed charges with amount > 0 + Usage
	if (recurringPrices.length > 0 && usagePrices.length > 0) {
		return PlanType.HYBRID_PAID;
	}

	// Usage-only: Only usage based prices
	if (usagePrices.length > 0 && recurringPrices.length === 0) {
		return PlanType.USAGE_ONLY;
	}

	// Fixed: Only fixed charges with amount > 0
	if (recurringPrices.length > 0 && hasNonZeroRecurring) {
		return PlanType.FIXED;
	}

	// Default to usage-only if nothing else matches
	return PlanType.USAGE_ONLY;
};

function grantPlanId(grant: CreditGrant, fallbackPlanId: string): string {
	const g = grant as CreditGrant & { planId?: string };
	return grant.plan_id ?? g.planId ?? fallbackPlanId;
}

function mapCreditGrantToCardProps(grant: CreditGrant): NonNullable<PricingCardProps['creditGrants']>[number] {
	const cadence = grant.cadence === CREDIT_GRANT_CADENCE.RECURRING ? ('recurring' as const) : ('onetime' as const);
	return {
		name: grant.name,
		credits: grant.credits,
		cadence,
		period: grant.period ? grant.period.toLowerCase() : null,
	};
}

const findBestPriceCombination = (
	plans: Array<PlanResponse & { prices: PriceResponse[]; entitlements: EntitlementResponse[] }>,
	availableCurrencyOptions: Array<{ value: string }>,
	availablePeriodOptions: Array<{ value: string }>,
) => {
	let maxPlans = 0;
	let bestCurrency = '';
	let bestPeriod = '';

	// First try to find preferred pricing combination
	for (const currency of availableCurrencyOptions) {
		for (const period of availablePeriodOptions) {
			const testFiltered = plans
				.map((plan) => ({
					...plan,
					prices: plan.prices?.filter(
						(price: PriceResponse) =>
							price.currency.toUpperCase() === currency.value && price.billing_period === period.value && isRecurringPrice(price),
					),
				}))
				.filter((plan) => plan.prices && plan.prices.length > 0);

			if (testFiltered.length > 0) {
				return {
					currency: currency.value,
					period: period.value,
					hasPreferred: true,
				};
			}
		}
	}

	// Fall back to any pricing type if no preferred found
	for (const currency of availableCurrencyOptions) {
		for (const period of availablePeriodOptions) {
			const testFiltered = plans
				.map((plan) => ({
					...plan,
					prices: plan.prices?.filter(
						(price: PriceResponse) => price.currency.toUpperCase() === currency.value && price.billing_period === period.value,
					),
				}))
				.filter((plan) => (plan.prices?.length ?? 0) > 0);

			if (testFiltered.length > maxPlans) {
				maxPlans = testFiltered.length;
				bestCurrency = currency.value;
				bestPeriod = period.value;
			}
		}
	}

	return {
		currency: bestCurrency,
		period: bestPeriod,
		hasPreferred: false,
	};
};

const PricingPage = () => {
	const { limit, offset, page } = usePagination();
	const [selectedBillingPeriod, setSelectedBillingPeriod] = useState<string>('');
	const [selectedCurrency, setSelectedCurrency] = useState<string>('');
	const [planDrawerOpen, setPlanDrawerOpen] = useState<boolean>(false);

	// Fetch plans
	const fetchPlans = async () => {
		return await PlanApi.getPlansByFilter({
			limit,
			offset,
			filters: [
				{
					field: 'status',
					operator: FilterOperator.EQUAL,
					data_type: DataType.STRING,
					value: { string: 'published' },
				},
			],
			sort: [],
		});
	};

	const {
		data: plansData,
		isLoading: isLoadingPlans,
		isError: isErrorPlans,
	} = useQuery<GetAllPlansResponse>({
		queryKey: ['fetchPlansPricingCard', page],
		queryFn: fetchPlans,
	});

	const PAGE_SIZE = 500;
	/** Per-plan list calls match PlanCreditGrantsTab; multi-ID GET can be unreliable on some backends. */
	const PLAN_CREDIT_GRANT_FETCH_CHUNK = 12;
	const PLAN_CREDIT_GRANT_LIST_LIMIT = 500;

	// Fetch all prices for all plans (paginated until no more pages)
	const {
		data: allPricesData,
		isLoading: isLoadingPrices,
		isError: isErrorPrices,
	} = useQuery({
		queryKey: ['fetchAllPricesForPlans', plansData?.items?.map((p) => p.id)],
		queryFn: async () => {
			if (!plansData?.items || plansData.items.length === 0) return { items: [] };

			const planIds = plansData.items.map((p) => p.id);
			const items: PriceResponse[] = [];
			let offset = 0;

			while (true) {
				const response = await PriceApi.searchPrices({
					filters: [
						{
							field: 'entity_type',
							operator: FilterOperator.EQUAL,
							data_type: DataType.STRING,
							value: { string: PRICE_ENTITY_TYPE.PLAN },
						},
						{
							field: 'entity_id',
							operator: FilterOperator.IN,
							data_type: DataType.ARRAY,
							value: { array: planIds },
						},
						{
							field: 'status',
							operator: FilterOperator.EQUAL,
							data_type: DataType.STRING,
							value: { string: ENTITY_STATUS.PUBLISHED },
						},
					],
					limit: PAGE_SIZE,
					offset,
				});
				items.push(...response.items);
				if (response.items.length < PAGE_SIZE) break;
				const total = response.pagination?.total;
				if (total != null && offset + response.items.length >= total) break;
				offset += PAGE_SIZE;
			}
			return { items };
		},
		enabled: !!plansData?.items && plansData.items.length > 0,
	});

	// Fetch all entitlements for all plans (paginated until no more pages)
	const {
		data: allEntitlementsData,
		isLoading: isLoadingEntitlements,
		isError: isErrorEntitlements,
	} = useQuery({
		queryKey: ['fetchAllEntitlementsForPlans', plansData?.items?.map((p) => p.id)],
		queryFn: async () => {
			if (!plansData?.items || plansData.items.length === 0) return { items: [] };

			const planIds = plansData.items.map((p) => p.id);
			const items: EntitlementResponse[] = [];
			let offset = 0;

			while (true) {
				const response = await EntitlementApi.search({
					filters: [
						{
							field: 'entity_type',
							operator: FilterOperator.EQUAL,
							data_type: DataType.STRING,
							value: { string: ENTITLEMENT_ENTITY_TYPE.PLAN },
						},
						{
							field: 'entity_id',
							operator: FilterOperator.IN,
							data_type: DataType.ARRAY,
							value: { array: planIds },
						},
					],
					status: ENTITY_STATUS.PUBLISHED,
					limit: PAGE_SIZE,
					offset,
					expand: generateExpandQueryParams([EXPAND.FEATURES]),
				});
				items.push(...response.items);
				if (response.items.length < PAGE_SIZE) break;
				const total = response.pagination?.total;
				if (total != null && offset + response.items.length >= total) break;
				offset += PAGE_SIZE;
			}
			return { items };
		},
		enabled: !!plansData?.items && plansData.items.length > 0,
	});

	const planIdsForGrantsKey = plansData?.items?.map((p) => p.id).join('\0') ?? '';

	const {
		data: planCreditGrantsData,
		isLoading: isLoadingPlanCreditGrants,
		isError: isErrorPlanCreditGrants,
	} = useQuery({
		queryKey: ['fetchPlanCreditGrantsForPricingWidgets', planIdsForGrantsKey],
		queryFn: async () => {
			if (!plansData?.items?.length) return { items: [] as CreditGrant[] };

			const planIds = plansData.items.map((p) => p.id);
			const merged: CreditGrant[] = [];

			for (let i = 0; i < planIds.length; i += PLAN_CREDIT_GRANT_FETCH_CHUNK) {
				const chunk = planIds.slice(i, i + PLAN_CREDIT_GRANT_FETCH_CHUNK);
				const chunkResults = await Promise.all(
					chunk.map(async (planId) => {
						const res = await CreditGrantApi.list({
							plan_ids: [planId],
							scope: CREDIT_GRANT_SCOPE.PLAN,
							limit: PLAN_CREDIT_GRANT_LIST_LIMIT,
							offset: 0,
						});
						return { planId, res };
					}),
				);

				for (const { planId, res } of chunkResults) {
					for (const grant of res.items) {
						const resolvedPlanId = grantPlanId(grant, planId);
						merged.push({ ...grant, plan_id: resolvedPlanId } as CreditGrant);
					}
				}
			}

			return { items: merged };
		},
		enabled: !!plansData?.items && plansData.items.length > 0,
	});

	const isLoading = isLoadingPlans || isLoadingPrices || isLoadingEntitlements || isLoadingPlanCreditGrants;
	const isError = isErrorPlans || isErrorPrices || isErrorEntitlements || isErrorPlanCreditGrants;

	// Create a map of plan IDs to their prices and entitlements
	const planDataMap = useMemo(() => {
		const map = new Map<string, { prices: PriceResponse[]; entitlements: EntitlementResponse[] }>();

		if (!plansData?.items) return map;

		plansData.items.forEach((plan) => {
			const planPrices = allPricesData?.items?.filter((price) => price.entity_id === plan.id) || [];
			const planEntitlements = allEntitlementsData?.items?.filter((ent) => ent.entity_id === plan.id) || [];

			map.set(plan.id, {
				prices: planPrices,
				entitlements: planEntitlements,
			});
		});

		return map;
	}, [plansData, allPricesData, allEntitlementsData]);

	const grantsByPlanId = useMemo(() => {
		const map = new Map<string, CreditGrant[]>();
		for (const grant of planCreditGrantsData?.items ?? []) {
			const planId = grantPlanId(grant, '');
			if (!planId) continue;
			const list = map.get(planId) ?? [];
			list.push(grant);
			map.set(planId, list);
		}
		return map;
	}, [planCreditGrantsData?.items]);

	// Combine plans with their prices and entitlements
	const plansWithData = useMemo(() => {
		if (!plansData?.items) return [];

		return plansData.items.map((plan) => {
			const data = planDataMap.get(plan.id);
			return {
				...plan,
				prices: data?.prices || [],
				entitlements: data?.entitlements || [],
			};
		});
	}, [plansData, planDataMap]);

	const { uniqueCurrencies, uniqueBillingPeriods, filteredPlans } = useMemo(() => {
		if (!plansWithData || plansWithData.length === 0) {
			return { uniqueCurrencies: [], uniqueBillingPeriods: [], filteredPlans: [] };
		}

		const plans = plansWithData;

		// Collect unique currencies and billing periods
		const currencies = new Set<string>();
		const billingPeriods = new Set<string>();

		plans.forEach((plan) => {
			plan.prices?.forEach((price) => {
				currencies.add(price.currency);
				billingPeriods.add(price.billing_period);
			});
		});

		const allCurrencyOptions = Array.from(currencies).map((currency) => ({
			label: currency.toUpperCase(),
			value: currency.toUpperCase(),
		}));

		const allPeriodOptions = billlingPeriodOptions;

		// Filter available options based on selections
		const availableCurrencyOptions = selectedBillingPeriod
			? allCurrencyOptions.filter((currency) =>
					plans.some((plan) =>
						plan.prices?.some((price) => price.currency.toUpperCase() === currency.value && price.billing_period === selectedBillingPeriod),
					),
				)
			: allCurrencyOptions;

		const availablePeriodOptions = selectedCurrency
			? allPeriodOptions.filter((period) =>
					plans.some((plan) =>
						plan.prices?.some((price) => price.currency.toUpperCase() === selectedCurrency && price.billing_period === period.value),
					),
				)
			: allPeriodOptions;

		// Set default selections if needed
		if (!selectedCurrency || !selectedBillingPeriod) {
			const bestCombo = findBestPriceCombination(plans, availableCurrencyOptions, availablePeriodOptions);

			if (bestCombo.currency && !selectedCurrency) {
				setSelectedCurrency(bestCombo.currency);
			}
			if (bestCombo.period && !selectedBillingPeriod) {
				setSelectedBillingPeriod(bestCombo.period);
			}
		}

		// Filter and transform plans
		const filtered = plans
			.map((plan) => {
				const allMatchingPrices =
					plan.prices?.filter(
						(price) => price.currency.toUpperCase() === selectedCurrency && price.billing_period === selectedBillingPeriod,
					) || [];

				return {
					...plan,
					prices: allMatchingPrices,
				};
			})
			.filter((plan) => plan.prices?.length > 0);

		// Sort plans based on industry standard pricing display order
		const sortedPlans = filtered.sort((a, b) => {
			// Simple helper functions
			const getRecurringAmount = (plan: any) => {
				const recurringPrice = plan.prices?.find((price: PriceType) => isRecurringPrice(price));
				return recurringPrice ? parseFloat(recurringPrice.amount || '0') : 0;
			};

			const getUsageFlag = (plan: any) => {
				return plan.prices?.some((price: PriceType) => price.type === PRICE_TYPE.USAGE) ? 1 : 0;
			};

			// Get values for comparison
			const r1 = getRecurringAmount(a);
			const r2 = getRecurringAmount(b);
			const u1 = getUsageFlag(a);
			const u2 = getUsageFlag(b);

			// Sort by recurring amount first, then by usage flag
			if (r1 !== r2) return r1 - r2;
			return u1 - u2;
		});

		return {
			uniqueCurrencies: availableCurrencyOptions,
			uniqueBillingPeriods: availablePeriodOptions,
			filteredPlans: sortedPlans,
		};
	}, [plansWithData, selectedBillingPeriod, selectedCurrency]);

	const transformedPlans: PricingCardProps[] = filteredPlans.map((plan) => {
		const prices = plan.prices as Price[];
		const displayType = getPriceDisplayType(prices || []);
		const recurringPrice = prices?.find(isRecurringPrice);
		const usageCharges =
			prices?.filter(isUsageBasedPrice).map((price) => ({
				amount: price.amount,
				currency: price.currency,
				billing_model: price.billing_model,
				tiers: price.tiers as unknown as { up_to: number | null; unit_amount: string; flat_amount: string }[],
				meter_name: price.meter?.name || 'Usage',
				billing_period: price.billing_period,
				type: price.type,
				invoice_cadence: price.invoice_cadence as INVOICE_CADENCE,
			})) || [];

		// For display purposes, we prioritize showing the recurring price if it exists
		const displayPrice = recurringPrice || usageCharges[0];

		// const showUsageCharges = ['hybrid-free', 'hybrid-paid', 'usage-only'].includes(displayType);

		return {
			id: plan.id,
			name: plan.name,
			description: plan.description,
			price: {
				amount: displayPrice?.amount,
				currency: displayPrice?.currency,
				billingPeriod: displayPrice?.billing_period,
				type: displayPrice?.type,
				displayType,
			},
			usageCharges,
			entitlements:
				plan.entitlements?.map((e) => ({
					id: e.id,
					feature_id: e.feature?.id || '',
					name: e.feature?.name || '',
					type: e.feature_type.toUpperCase() as 'STATIC' | 'BOOLEAN' | 'METERED',
					value:
						e.feature_type === 'boolean'
							? e.is_enabled
							: e.feature_type === 'metered'
								? e.usage_limit || 'Unlimited'
								: e.static_value || '',
					description: e.feature?.description,
					usage_reset_period: e.usage_reset_period || '',
				})) || [],
			creditGrants: (grantsByPlanId.get(plan.id) ?? []).map(mapCreditGrantToCardProps),
		};
	});

	if (isLoading) {
		return <Loader />;
	}

	if (isError) {
		toast.error('Error fetching plans');
		return null;
	}

	if ((plansData?.items ?? []).length === 0) {
		return (
			<div className='space-y-6'>
				<Page
					heading='Pricing Widgets'
					headingCTA={
						<AddButton
							onClick={() => {
								setPlanDrawerOpen(true);
							}}
						/>
					}>
					<ApiDocsContent tags={['Plans', 'Prices']} />
					<div className='flex flex-col items-center mt-6'>
						{/* 3 Dotted Placeholder Boxes */}
						<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 w-full mb-16'>
							{[1, 2, 3].map((index) => (
								<div
									key={index}
									className='min-h-[260px] w-full rounded-2xl border-2 border-dashed border-slate-300 bg-gradient-to-b from-white to-slate-50/90 p-6 shadow-sm'
								/>
							))}
						</div>

						{/* Empty State Message and Button */}
						<div className='flex flex-col items-center'>
							<h2 className='font-regular text-[16px] leading-normal text-gray-600 text-center mb-8'>No Pricing Widget Exists</h2>
						</div>
					</div>
				</Page>
				<PlanDrawer open={planDrawerOpen} onOpenChange={setPlanDrawerOpen} refetchQueryKeys={['fetchPlansPricingCard']} />
			</div>
		);
	}

	return (
		<Page
			headingClassName='items-center'
			heading='Pricing Widgets'
			headingCTA={
				<div className='w-full flex justify-start gap-4'>
					<Select
						className='w-40 !rounded-xl'
						value={selectedBillingPeriod}
						options={uniqueBillingPeriods}
						onChange={setSelectedBillingPeriod}
						placeholder='Select billing period'
					/>
					<Select
						className='w-40 !rounded-xl'
						value={selectedCurrency}
						options={uniqueCurrencies}
						onChange={setSelectedCurrency}
						placeholder='Select currency'
					/>
				</div>
			}>
			<ApiDocsContent tags={['Plans', 'Prices']} />
			{/* filters */}

			<div className='flex flex-col'>
				<div className='grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-3 lg:gap-6'>
					<div className='contents'>
						{transformedPlans.map((plan, index) => (
							<div className='w-full flex' key={index}>
								<PricingCard {...plan} className='w-full' useModernChrome />
							</div>
						))}
					</div>
					{/* Add empty divs to maintain grid layout when less than 3 items */}
					{transformedPlans.length === 2 && <div className='hidden lg:block' />}
					{transformedPlans.length === 1 && (
						<>
							<div className='hidden md:block' />
							<div className='hidden lg:block' />
						</>
					)}
				</div>
			</div>
		</Page>
	);
};

export default PricingPage;
