import { BILLING_MODEL, BILLING_PERIOD, INVOICE_CADENCE, PRICE_TYPE, TIER_MODE, PRICE_UNIT_TYPE } from '@/models';
import type { CreateSubscriptionLineItemRequest, SubscriptionPriceCreateRequest } from '@/types/dto/Subscription';
import type { InternalPrice } from '@/components/organisms/PlanForm/SetupChargesSection';
import { PriceInternalState } from '@/components/organisms/PlanForm/UsagePricingForm';

/** Item shape for subscription-added line (request + tempId). */
export type AddedSubscriptionLineItemLike = CreateSubscriptionLineItemRequest & { tempId: string };

/**
 * Converts form state (InternalPrice from fixed-charge RecurringChargesForm or UsagePricingForm) into
 * CreateSubscriptionLineItemRequest for subscription-level line items.
 */
export function internalPriceToSubscriptionLineItemRequest(
	partial: Partial<InternalPrice>,
	quantity?: number,
): CreateSubscriptionLineItemRequest {
	const isUsage = partial.type === PRICE_TYPE.USAGE;

	if (isUsage) {
		const price: SubscriptionPriceCreateRequest = {
			type: PRICE_TYPE.USAGE,
			price_unit_type: partial.price_unit_type ?? PRICE_UNIT_TYPE.FIAT,
			billing_period: (partial.billing_period as BILLING_PERIOD) ?? BILLING_PERIOD.MONTHLY,
			billing_period_count: partial.billing_period_count ?? 1,
			billing_model: (partial.billing_model as BILLING_MODEL) ?? BILLING_MODEL.FLAT_FEE,
			invoice_cadence: (partial.invoice_cadence as INVOICE_CADENCE) ?? INVOICE_CADENCE.ARREAR,
			display_name: partial.display_name,
			start_date: partial.start_date,
			meter_id: partial.meter_id,
			filter_values: partial.filter_values ?? undefined,
		};
		if (partial.amount != null) price.amount = partial.amount;
		if (partial.tier_mode != null) price.tier_mode = partial.tier_mode as TIER_MODE;
		if (partial.tiers?.length) price.tiers = partial.tiers;
		if (partial.transform_quantity) price.transform_quantity = partial.transform_quantity;
		if (partial.price_unit_type === PRICE_UNIT_TYPE.CUSTOM && partial.price_unit_config) {
			price.price_unit_config = partial.price_unit_config;
		}
		return {
			price,
			quantity: 0,
			display_name: partial.display_name,
			start_date: partial.start_date,
		};
	}

	// FIXED (fixed charge)
	const price: SubscriptionPriceCreateRequest = {
		type: partial.type ?? PRICE_TYPE.FIXED,
		price_unit_type: partial.price_unit_type ?? PRICE_UNIT_TYPE.FIAT,
		billing_period: (partial.billing_period as BILLING_PERIOD) ?? BILLING_PERIOD.MONTHLY,
		billing_period_count: partial.billing_period_count ?? 1,
		billing_model: (partial.billing_model as BILLING_MODEL) ?? BILLING_MODEL.FLAT_FEE,
		invoice_cadence: (partial.invoice_cadence as INVOICE_CADENCE) ?? INVOICE_CADENCE.ARREAR,
		amount: partial.amount,
		display_name: partial.display_name,
		min_quantity: partial.min_quantity,
		start_date: partial.start_date,
	};

	if (partial.price_unit_type === PRICE_UNIT_TYPE.CUSTOM && partial.price_unit_config) {
		price.price_unit_config = { ...partial.price_unit_config };
		if (partial.amount !== undefined) {
			price.price_unit_config.amount = partial.amount;
		}
		delete price.amount;
	} else {
		price.amount = partial.amount;
	}

	return {
		price,
		quantity: quantity ?? partial.min_quantity ?? 1,
		display_name: partial.display_name,
		start_date: partial.start_date,
	};
}

export interface SubscriptionLineItemToInternalPriceDefaults {
	currency?: string;
	billingPeriod?: string;
}

/**
 * Converts an added subscription line item back to form state (InternalPrice).
 * Used when editing an existing subscription-level charge so RecurringChargesForm (fixed) or UsagePricingForm can be pre-filled.
 */
export function subscriptionLineItemToInternalPrice(
	item: AddedSubscriptionLineItemLike,
	defaults?: SubscriptionLineItemToInternalPriceDefaults,
): Partial<InternalPrice> {
	const p = item.price;
	if (!p) {
		return {
			display_name: item.display_name ?? '',
			min_quantity: item.quantity ?? 1,
			start_date: item.start_date,
			internal_state: PriceInternalState.EDIT,
		};
	}
	const isUsage = p.type === PRICE_TYPE.USAGE;
	const isCustom = p.price_unit_type === PRICE_UNIT_TYPE.CUSTOM;
	const base: Partial<InternalPrice> = {
		display_name: item.display_name ?? p.display_name ?? '',
		billing_period: (p.billing_period as BILLING_PERIOD) ?? (defaults?.billingPeriod as BILLING_PERIOD) ?? BILLING_PERIOD.MONTHLY,
		billing_period_count: p.billing_period_count ?? 1,
		invoice_cadence: (p.invoice_cadence as INVOICE_CADENCE) ?? INVOICE_CADENCE.ARREAR,
		billing_model: (p.billing_model as BILLING_MODEL) ?? BILLING_MODEL.FLAT_FEE,
		type: (p.type as PRICE_TYPE) ?? PRICE_TYPE.FIXED,
		min_quantity: item.quantity ?? p.min_quantity ?? 1,
		start_date: item.start_date ?? p.start_date,
		price_unit_type: p.price_unit_type ?? PRICE_UNIT_TYPE.FIAT,
		internal_state: PriceInternalState.EDIT,
	};

	if (isUsage) {
		const usageBase: Partial<InternalPrice> = {
			...base,
			type: PRICE_TYPE.USAGE,
			meter_id: p.meter_id,
			filter_values: p.filter_values,
			tier_mode: p.tier_mode,
			tiers: p.tiers as InternalPrice['tiers'],
			transform_quantity: p.transform_quantity ?? undefined,
			currency: (p as { currency?: string }).currency ?? defaults?.currency ?? 'USD',
		};
		const pWithMeter = p as SubscriptionPriceCreateRequest & { meter?: unknown };
		if (pWithMeter.meter) {
			(usageBase as Record<string, unknown>).meter = pWithMeter.meter;
		}
		if (isCustom && p.price_unit_config) {
			return { ...usageBase, price_unit_config: p.price_unit_config, amount: p.price_unit_config.amount ?? p.amount };
		}
		return { ...usageBase, amount: p.amount };
	}

	if (isCustom && p.price_unit_config) {
		return {
			...base,
			price_unit_config: p.price_unit_config,
			amount: p.price_unit_config.amount ?? p.amount,
		};
	}
	return {
		...base,
		amount: p.amount,
		currency: (p as { currency?: string }).currency ?? defaults?.currency ?? 'USD',
	};
}
