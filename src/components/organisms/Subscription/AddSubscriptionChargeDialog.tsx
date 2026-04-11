import { useState, useEffect, useCallback } from 'react';
import { uniqueId } from 'lodash';
import Dialog from '@/components/atoms/Dialog';
import { RecurringChargesForm } from '@/components/organisms/PlanForm';
import UsagePricingForm, { PriceInternalState } from '@/components/organisms/PlanForm/UsagePricingForm';
import type { InternalPrice } from '@/components/organisms/PlanForm/SetupChargesSection';
import type { CreateSubscriptionLineItemRequest } from '@/types/dto/Subscription';
import { RectangleRadiogroup, type RectangleRadiogroupOption } from '@/components/molecules';
import { INVOICE_CADENCE } from '@/models/Invoice';
import { BILLING_MODEL, PRICE_TYPE, PRICE_ENTITY_TYPE } from '@/models/Price';
import { BILLING_PERIOD } from '@/constants/constants';
import { Gauge, Repeat } from 'lucide-react';
import {
	internalPriceToSubscriptionLineItemRequest,
	subscriptionLineItemToInternalPrice,
} from '@/utils/subscription/internalPriceToSubscriptionLineItemRequest';

export type AddedSubscriptionLineItem = CreateSubscriptionLineItemRequest & { tempId: string };

const CHARGE_OPTIONS: RectangleRadiogroupOption[] = [
	{
		label: 'Fixed charges',
		value: PRICE_TYPE.FIXED,
		icon: Repeat,
		description: 'Billed on a fixed schedule (monthly, yearly, etc.)',
	},
	{
		label: 'Usage Charges',
		value: PRICE_TYPE.USAGE,
		icon: Gauge,
		description: 'Pay only for what customers actually use',
	},
];

interface AddSubscriptionChargeDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (item: AddedSubscriptionLineItem) => void;
	defaultCurrency?: string;
	defaultBillingPeriod?: BILLING_PERIOD;
	/** Default start date for new charges (e.g. subscription start_date in ISO format). */
	defaultStartDate?: string;
	/** When set, dialog is in edit mode: form pre-filled and save updates this item (same tempId). */
	initialItem?: AddedSubscriptionLineItem | null;
	/** When provided (e.g. on subscription edit page), passed to UsagePricingForm for context. */
	subscriptionId?: string;
}

function getEmptyPrice(
	defaultCurrency?: string,
	defaultBillingPeriod?: BILLING_PERIOD,
	defaultStartDate?: string,
	type: PRICE_TYPE = PRICE_TYPE.FIXED,
): Partial<InternalPrice> {
	const base = {
		currency: defaultCurrency ?? 'USD',
		billing_period: defaultBillingPeriod ?? BILLING_PERIOD.MONTHLY,
		billing_period_count: 1,
		invoice_cadence: INVOICE_CADENCE.ARREAR,
		display_name: '',
		start_date: defaultStartDate,
		internal_state: PriceInternalState.NEW,
	};
	if (type === PRICE_TYPE.USAGE) {
		return {
			...base,
			type: PRICE_TYPE.USAGE,
			billing_model: BILLING_MODEL.FLAT_FEE,
			amount: '',
		};
	}
	return {
		...base,
		type: PRICE_TYPE.FIXED,
		billing_model: BILLING_MODEL.FLAT_FEE,
		amount: '',
		min_quantity: 1,
	};
}

const AddSubscriptionChargeDialog: React.FC<AddSubscriptionChargeDialogProps> = ({
	isOpen,
	onOpenChange,
	onSave,
	defaultCurrency,
	defaultBillingPeriod,
	defaultStartDate,
	initialItem = null,
	subscriptionId,
}) => {
	const isEditMode = !!initialItem;
	const editType = initialItem?.price?.type;
	const resolvedEditType = editType === PRICE_TYPE.USAGE ? PRICE_TYPE.USAGE : PRICE_TYPE.FIXED;

	const [selectedChargeType, setSelectedChargeType] = useState<PRICE_TYPE | null>(null);
	const [price, setPrice] = useState<Partial<InternalPrice>>(() => getEmptyPrice(defaultCurrency, defaultBillingPeriod, defaultStartDate));

	useEffect(() => {
		if (isOpen) {
			if (initialItem) {
				setSelectedChargeType(resolvedEditType);
				setPrice(
					subscriptionLineItemToInternalPrice(initialItem, {
						currency: defaultCurrency,
						billingPeriod: defaultBillingPeriod,
					}),
				);
			} else {
				setSelectedChargeType(null);
				setPrice(getEmptyPrice(defaultCurrency, defaultBillingPeriod, defaultStartDate));
			}
		}
	}, [isOpen, defaultCurrency, defaultBillingPeriod, defaultStartDate, initialItem, resolvedEditType]);

	const handleOpenChange = useCallback(
		(open: boolean) => {
			if (!open) setSelectedChargeType(null);
			onOpenChange(open);
		},
		[onOpenChange],
	);

	const handleChargeTypeSelect = useCallback(
		(type: PRICE_TYPE) => {
			setSelectedChargeType(type);
			setPrice(getEmptyPrice(defaultCurrency, defaultBillingPeriod, defaultStartDate, type));
		},
		[defaultCurrency, defaultBillingPeriod, defaultStartDate],
	);

	const buildAndSave = useCallback(
		(partial: Partial<InternalPrice>, tempId: string) => {
			const isUsage = partial.type === PRICE_TYPE.USAGE;
			const quantity = isUsage ? 0 : partial.min_quantity != null ? Number(partial.min_quantity) : 1;
			const request = internalPriceToSubscriptionLineItemRequest(partial, quantity);
			const item: AddedSubscriptionLineItem = { ...request, tempId };
			onSave(item);
			onOpenChange(false);
		},
		[onSave, onOpenChange],
	);

	const handleAdd = useCallback(
		(partial: Partial<InternalPrice>) => {
			buildAndSave(partial, uniqueId('sub_'));
		},
		[buildAndSave],
	);

	const handleUpdate = useCallback(
		(partial: Partial<InternalPrice>) => {
			if (!initialItem) return;
			buildAndSave(partial, initialItem.tempId);
		},
		[initialItem, buildAndSave],
	);

	const showRadiogroup = !initialItem && selectedChargeType === null;
	const showRecurringForm = selectedChargeType === PRICE_TYPE.FIXED || (initialItem && resolvedEditType === PRICE_TYPE.FIXED);
	const showUsageForm = selectedChargeType === PRICE_TYPE.USAGE || (initialItem && resolvedEditType === PRICE_TYPE.USAGE);

	const getTitle = () => {
		if (showRadiogroup) return 'Add charge';
		if (isEditMode) return resolvedEditType === PRICE_TYPE.USAGE ? 'Edit usage charge' : 'Edit fixed charge';
		return showUsageForm ? 'Add usage charge' : 'Add fixed charge';
	};

	const getDescription = () => {
		if (showRadiogroup) return undefined;
		return 'Add a subscription-level charge. It will appear in the charges table and be included when the subscription is created.';
	};

	return (
		<Dialog isOpen={isOpen} onOpenChange={handleOpenChange} title={getTitle()} description={getDescription()} className='max-w-4xl w-full'>
			{showRadiogroup && (
				<div className='-mt-1'>
					<RectangleRadiogroup options={CHARGE_OPTIONS} onChange={(value) => handleChargeTypeSelect(value as PRICE_TYPE)} />
				</div>
			)}
			{showRecurringForm && (
				<RecurringChargesForm
					price={price}
					onAdd={handleAdd}
					onUpdate={handleUpdate}
					onEditClicked={() => {}}
					onDeleteClicked={() => onOpenChange(false)}
					entityName=''
				/>
			)}
			{showUsageForm && (
				<UsagePricingForm
					price={price}
					onAdd={handleAdd}
					onUpdate={handleUpdate}
					onEditClicked={() => {}}
					onDeleteClicked={() => onOpenChange(false)}
					entityType={PRICE_ENTITY_TYPE.SUBSCRIPTION}
					entityId={subscriptionId}
				/>
			)}
		</Dialog>
	);
};

export default AddSubscriptionChargeDialog;
