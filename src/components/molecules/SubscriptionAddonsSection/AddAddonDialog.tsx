import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Select } from '@/components/atoms';
import Dialog from '@/components/atoms/Dialog';
import AddonApi from '@/api/AddonApi';
import SubscriptionApi from '@/api/SubscriptionApi';
import { toSentenceCase } from '@/utils/common/helper_functions';
import { ADDON_TYPE } from '@/models/Addon';
import { AddAddonRequest } from '@/types/dto/Subscription';
import { AddonResponse } from '@/types/dto/Addon';
import toast from 'react-hot-toast';
import { refetchQueries } from '@/core/services/tanstack/ReactQueryProvider';
import { ColumnData, FlexpriceTable } from '@/components/molecules';
import { Price, PRICE_TYPE } from '@/models/Price';
import { BILLING_PERIOD } from '@/constants/constants';
import { LineItemCommitmentConfig, LineItemCommitmentsMap } from '@/types/dto/LineItemCommitmentConfig';
import CommitmentConfigDialog from '@/components/molecules/CommitmentConfigDialog';
import { formatCommitmentSummary } from '@/utils/common/commitment_helpers';
import { isOneTimePlanPrice } from '@/utils/subscription/planPricesForSubscriptionUi';

interface Props {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	subscriptionId: string;
	existingAddons: AddonResponse[];
	billingPeriod?: BILLING_PERIOD;
	currency?: string;
}

interface FormErrors {
	addon_id?: string;
}

const AddAddonDialog: React.FC<Props> = ({ isOpen, onOpenChange, subscriptionId, existingAddons, billingPeriod, currency }) => {
	const [formData, setFormData] = useState<Partial<AddAddonRequest>>({});
	const [errors, setErrors] = useState<FormErrors>({});
	const [selectedAddonDetails, setSelectedAddonDetails] = useState<AddonResponse | null>(null);
	const [lineItemCommitments, setLineItemCommitments] = useState<LineItemCommitmentsMap>({});
	const [selectedCommitmentPrice, setSelectedCommitmentPrice] = useState<Price | null>(null);
	const [isCommitmentDialogOpen, setIsCommitmentDialogOpen] = useState(false);

	// Fetch available addons
	const { data: addonsResponse } = useQuery({
		queryKey: ['subaddons', subscriptionId],
		queryFn: async () => {
			return await AddonApi.List({ limit: 1000, offset: 0 });
		},
	});

	const existingAddonIds = useMemo(() => existingAddons.map((addon) => addon.id), [existingAddons]);

	// Reset form when modal opens/closes
	useEffect(() => {
		if (isOpen) {
			setFormData({});
			setErrors({});
			setSelectedAddonDetails(null);
			setLineItemCommitments({});
			setSelectedCommitmentPrice(null);
			setIsCommitmentDialogOpen(false);
		}
	}, [isOpen]);

	const validateForm = useCallback((): { isValid: boolean; errors: FormErrors } => {
		const newErrors: FormErrors = {};

		if (!formData.addon_id) {
			newErrors.addon_id = 'Addon is required';
		}

		return {
			isValid: Object.keys(newErrors).length === 0,
			errors: newErrors,
		};
	}, [formData]);

	// Add addon mutation
	const { mutate: addAddon, isPending: isAddingAddon } = useMutation({
		mutationFn: async (payload: AddAddonRequest) => {
			return await SubscriptionApi.addAddonToSubscription(payload);
		},
		onSuccess: () => {
			toast.success('Addon added successfully');
			refetchQueries(['subscriptionActiveAddons', subscriptionId]);
			refetchQueries(['subscriptionDetails', subscriptionId]);
			setFormData({});
			setErrors({});
			onOpenChange(false);
		},
		onError: (error: any) => {
			toast.error(error?.error?.message || 'Failed to add addon');
		},
	});

	const handleSave = useCallback(() => {
		const validation = validateForm();

		if (!validation.isValid) {
			setErrors(validation.errors);
			return;
		}

		setErrors({});
		const hasCommitments = Object.keys(lineItemCommitments || {}).length > 0;
		const addonData: AddAddonRequest = {
			subscription_id: subscriptionId,
			addon_id: formData.addon_id!,
			line_item_commitments: hasCommitments ? lineItemCommitments : undefined,
		};

		addAddon(addonData);
	}, [formData, validateForm, subscriptionId, addAddon, lineItemCommitments]);

	const handleCancel = useCallback(() => {
		setFormData({});
		setErrors({});
		onOpenChange(false);
	}, [onOpenChange]);

	const handleAddonSelect = useCallback(
		(addonId: string) => {
			const addonDetails = (addonsResponse?.items || []).find((addon: AddonResponse) => addon.id === addonId) || null;
			setSelectedAddonDetails(addonDetails);
			// Reset commitments when switching addons to avoid leaking configs across addons
			setLineItemCommitments({});
			setFormData((prev) => ({ ...prev, addon_id: addonId }));
			// Clear error for this field when user selects
			if (errors.addon_id) {
				setErrors((prev) => ({ ...prev, addon_id: undefined }));
			}
		},
		[errors.addon_id, addonsResponse?.items],
	);

	const selectedAddonPrices = useMemo(() => {
		const prices: Price[] = (selectedAddonDetails?.prices as Price[]) || [];
		let filtered = prices;
		if (currency) {
			filtered = filtered.filter((p) => p.currency?.toLowerCase() === currency.toLowerCase());
		}
		if (billingPeriod) {
			const periodKey = billingPeriod.toUpperCase();
			filtered = filtered.filter((p) => isOneTimePlanPrice(p) || p.billing_period?.toUpperCase() === periodKey);
		}
		return filtered;
	}, [selectedAddonDetails, billingPeriod, currency]);

	type AddonChargeRow = { price: Price };

	const handleConfigureCommitment = useCallback((price: Price) => {
		if (price.type !== PRICE_TYPE.USAGE) return;
		setSelectedCommitmentPrice(price);
		setIsCommitmentDialogOpen(true);
	}, []);

	const setCommitmentForPrice = useCallback((priceId: string, config: LineItemCommitmentConfig | null) => {
		setLineItemCommitments((prev) => {
			const next: LineItemCommitmentsMap = { ...(prev || {}) };
			if (!config) {
				delete next[priceId];
			} else {
				next[priceId] = config;
			}
			return next;
		});
	}, []);

	const addonChargeColumns: ColumnData<AddonChargeRow>[] = useMemo(
		() => [
			{
				title: 'Charge',
				render: (row) => <span>{row.price.display_name || row.price.meter?.name || 'Charge'}</span>,
			},
			{
				title: 'Type',
				render: (row) => <span>{toSentenceCase(row.price.type || '--')}</span>,
			},
			{
				title: 'Commitment',
				render: (row) => {
					if (row.price.type !== PRICE_TYPE.USAGE) {
						return <span className='text-sm text-gray-400'>Not available</span>;
					}
					const config = lineItemCommitments[row.price.id];
					return config ? <span className='text-sm text-gray-600'>{formatCommitmentSummary(config)}</span> : <span>—</span>;
				},
			},
			{
				fieldVariant: 'interactive',
				hideOnEmpty: true,
				title: '',
				width: 140,
				align: 'right',
				render: (row) => {
					const canConfigure = row.price.type === PRICE_TYPE.USAGE;
					if (!canConfigure) return null;
					const hasConfig = lineItemCommitments[row.price.id] !== undefined;
					return (
						<Button variant='outline' onClick={() => handleConfigureCommitment(row.price)} type='button'>
							{hasConfig ? 'Edit' : 'Configure'}
						</Button>
					);
				},
			},
		],
		[lineItemCommitments, handleConfigureCommitment],
	);

	// Filter addon options based on existing addons and addon type
	const filteredAddonOptions = useMemo(() => {
		// Filter out addons that are already added to the subscription
		const filteredAddons =
			addonsResponse?.items?.filter((addon) => {
				if (addon.type === ADDON_TYPE.ONETIME) {
					return !existingAddonIds.includes(addon.id);
				}
				return true;
			}) || [];

		return filteredAddons.map((addon: AddonResponse) => ({
			label: addon.name,
			value: addon.id,
			description: `${toSentenceCase(addon.type)} - ${addon.description || 'No description'}`,
		}));
	}, [addonsResponse, existingAddonIds]);

	return (
		<Dialog isOpen={isOpen} showCloseButton={false} onOpenChange={onOpenChange} title='Add Addon' className='sm:max-w-[600px]'>
			<div className='grid gap-4 mt-3'>
				<div className='space-y-2'>
					<Select
						label='Addon'
						placeholder='Select addon'
						options={filteredAddonOptions}
						value={formData.addon_id || ''}
						onChange={handleAddonSelect}
						error={errors.addon_id}
					/>
				</div>

				{/* Addon Charges & Commitments */}
				{formData.addon_id && (
					<div className='space-y-2'>
						<div className='flex items-center justify-between'>
							<div>
								<p className='text-sm font-medium text-gray-700'>Addon Charges</p>
								<p className='text-xs text-gray-500'>
									Filtered by {billingPeriod ? toSentenceCase(billingPeriod.replace('_', ' ')) : 'billing period'} and{' '}
									{currency ? currency.toUpperCase() : 'currency'}
								</p>
							</div>
						</div>
						{selectedAddonPrices.length > 0 ? (
							<div className='rounded-xl border border-gray-200'>
								<FlexpriceTable columns={addonChargeColumns} data={selectedAddonPrices.map((p) => ({ price: p }))} />
							</div>
						) : (
							<div className='rounded-xl border border-gray-200 p-4'>
								<p className='text-sm text-gray-600'>No charges for this billing period/currency.</p>
							</div>
						)}
						<p className='text-xs text-gray-500'>Commitments can be configured only for usage-based charges.</p>
					</div>
				)}
			</div>

			{/* Commitment Configuration Dialog */}
			{selectedCommitmentPrice && (
				<CommitmentConfigDialog
					isOpen={isCommitmentDialogOpen}
					onOpenChange={setIsCommitmentDialogOpen}
					price={selectedCommitmentPrice}
					onSave={(priceId, config) => {
						setCommitmentForPrice(priceId, config);
					}}
					currentConfig={lineItemCommitments[selectedCommitmentPrice.id]}
					billingPeriod={billingPeriod}
				/>
			)}

			<div className='flex justify-end gap-2 mt-6'>
				<Button variant='outline' onClick={handleCancel} disabled={isAddingAddon}>
					Cancel
				</Button>
				<Button onClick={handleSave} disabled={isAddingAddon}>
					{isAddingAddon ? 'Adding...' : 'Add Addon'}
				</Button>
			</div>
		</Dialog>
	);
};

export default AddAddonDialog;
