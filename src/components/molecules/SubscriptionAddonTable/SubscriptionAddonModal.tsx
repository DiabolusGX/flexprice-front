import { AddAddonToSubscriptionRequest } from '@/types/dto/Addon';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/atoms';
import Dialog from '@/components/atoms/Dialog';
import { useQuery } from '@tanstack/react-query';
import AddonApi from '@/api/AddonApi';
import { Select } from '@/components/atoms';
import { toSentenceCase } from '@/utils/common/helper_functions';
import { ColumnData, FlexpriceTable } from '@/components/molecules';
import { Price, PRICE_TYPE } from '@/models/Price';
import { BILLING_PERIOD } from '@/constants/constants';
import { LineItemCommitmentConfig, LineItemCommitmentsMap } from '@/types/dto/LineItemCommitmentConfig';
import CommitmentConfigDialog from '@/components/molecules/CommitmentConfigDialog';
import { formatCommitmentSummary } from '@/utils/common/commitment_helpers';
import { isOneTimePlanPrice } from '@/utils/subscription/planPricesForSubscriptionUi';
interface Props {
	data?: AddAddonToSubscriptionRequest;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (addon: AddAddonToSubscriptionRequest) => void;
	onCancel: () => void;
	getEmptyAddon: () => Partial<AddAddonToSubscriptionRequest>;
	billingPeriod?: BILLING_PERIOD;
	currency?: string;
}

interface FormErrors {
	addon_id?: string;
}

type AddonChargeRow = {
	price: Price;
};

const SubscriptionAddonModal: React.FC<Props> = ({
	data,
	isOpen,
	onOpenChange,
	onSave,
	onCancel,
	getEmptyAddon,
	billingPeriod,
	currency,
}) => {
	const [formData, setFormData] = useState<Partial<AddAddonToSubscriptionRequest>>({});
	const [errors, setErrors] = useState<FormErrors>({});
	const [selectedAddonDetails, setSelectedAddonDetails] = useState<any>(null);
	const [selectedCommitmentPrice, setSelectedCommitmentPrice] = useState<Price | null>(null);
	const [isCommitmentDialogOpen, setIsCommitmentDialogOpen] = useState(false);

	// Fetch available addons - include all addons even if they have no charges
	const { data: addons = [] } = useQuery({
		queryKey: ['addons'],
		queryFn: async () => {
			const response = await AddonApi.List({ limit: 1000, offset: 0 });
			// Return all addons, including those without prices/charges
			return response.items;
		},
	});

	// Reset form when modal opens/closes
	useEffect(() => {
		if (isOpen) {
			if (data) {
				setFormData({
					...data,
					metadata: data.metadata || {},
					line_item_commitments: data.line_item_commitments || {},
				});
				// Find addon details for editing
				const addonDetails = addons.find((addon) => addon.id === data.addon_id);
				setSelectedAddonDetails(addonDetails);
			} else {
				setFormData({
					...getEmptyAddon(),
					metadata: {},
					line_item_commitments: {},
				});
				setSelectedAddonDetails(null);
			}
			setErrors({});
		}
	}, [isOpen, data, getEmptyAddon, addons]);

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

	const handleSave = useCallback(() => {
		const validation = validateForm();

		if (!validation.isValid) {
			setErrors(validation.errors);
			return;
		}

		setErrors({});

		const commitments = (formData.line_item_commitments || {}) as LineItemCommitmentsMap;
		const hasCommitments = Object.keys(commitments).length > 0;
		const addonData: AddAddonToSubscriptionRequest = {
			addon_id: formData.addon_id!,
			start_date: formData.start_date,
			metadata: formData.metadata || {},
			line_item_commitments: hasCommitments ? commitments : undefined,
		};

		onSave(addonData);
		setFormData(getEmptyAddon());
		setSelectedAddonDetails(null);
		onOpenChange(false);
	}, [formData, validateForm, onSave, getEmptyAddon, onOpenChange]);

	const handleCancel = useCallback(() => {
		setFormData({});
		setErrors({});
		setSelectedAddonDetails(null);
		onCancel();
	}, [onCancel]);

	const handleAddonSelect = useCallback(
		(addonId: string) => {
			const addonDetails = addons.find((addon) => addon.id === addonId);
			setSelectedAddonDetails(addonDetails);
			setFormData((prev) => ({
				...prev,
				addon_id: addonId,
				// Reset commitments when switching addons to avoid leaking price IDs across addons
				line_item_commitments: {},
			}));
			// Clear error for this field when user selects
			if (errors.addon_id) {
				setErrors((prev) => ({ ...prev, addon_id: undefined }));
			}
		},
		[addons, errors.addon_id],
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

	const commitmentMap = useMemo(() => {
		return ((formData.line_item_commitments || {}) as LineItemCommitmentsMap) || {};
	}, [formData.line_item_commitments]);

	const handleConfigureCommitment = useCallback((price: Price) => {
		if (price.type !== PRICE_TYPE.USAGE) return;
		setSelectedCommitmentPrice(price);
		setIsCommitmentDialogOpen(true);
	}, []);

	const setCommitmentForPrice = useCallback((priceId: string, config: LineItemCommitmentConfig | null) => {
		setFormData((prev) => {
			const nextCommitments: LineItemCommitmentsMap = { ...(((prev.line_item_commitments || {}) as LineItemCommitmentsMap) || {}) };
			if (!config) {
				delete nextCommitments[priceId];
			} else {
				nextCommitments[priceId] = config;
			}
			return {
				...prev,
				line_item_commitments: nextCommitments,
			};
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
					const config = commitmentMap[row.price.id];
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
					const hasConfig = commitmentMap[row.price.id] !== undefined;
					return (
						<Button variant='outline' onClick={() => handleConfigureCommitment(row.price)} type='button'>
							{hasConfig ? 'Edit' : 'Configure'}
						</Button>
					);
				},
			},
		],
		[commitmentMap, handleConfigureCommitment],
	);

	// const handleDateChange = useCallback(
	// 	(field: 'start_date' | 'end_date', date: Date | undefined) => {
	// 		setFormData((prev) => ({ ...prev, [field]: date?.toISOString() }));
	// 		// Clear error for end_date when user changes dates
	// 		if (field === 'end_date' && errors.end_date) {
	// 			setErrors((prev) => ({ ...prev, end_date: undefined }));
	// 		}
	// 	},
	// 	[errors.end_date],
	// );

	const filteredAddonOptions = useMemo(() => {
		return addons.map((addon) => ({
			label: addon.name,
			value: addon.id,
			description: addon.description || 'No description',
		}));
	}, [addons]);

	return (
		<Dialog
			isOpen={isOpen}
			showCloseButton={false}
			onOpenChange={onOpenChange}
			title={data ? 'Edit Addon' : 'Add Addon'}
			className='sm:max-w-[900px]'>
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

				{/* TODO: Add start and end date */}
				{/* Start and End Date on same line */}
				{/* <div className='grid grid-cols-2 gap-4'>
					<div className='space-y-2'>
						<DatePicker
							label='Start Date'
							placeholder='Select start date'
							date={formData.start_date ? new Date(formData.start_date) : undefined}
							setDate={(date) => handleDateChange('start_date', date)}
						/>
					</div>
					<div className='space-y-2'>
						<DatePicker
							label='End Date'
							placeholder='Select end date'
							date={formData.end_date ? new Date(formData.end_date) : undefined}
							setDate={(date) => handleDateChange('end_date', date)}
						/>
						{errors.end_date && <p className='text-sm text-red-500'>{errors.end_date}</p>}
					</div>
				</div> */}
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
					currentConfig={commitmentMap[selectedCommitmentPrice.id]}
					billingPeriod={billingPeriod}
				/>
			)}

			<div className='flex justify-end gap-2 mt-6'>
				<Button variant='outline' onClick={handleCancel}>
					Cancel
				</Button>
				<Button onClick={handleSave}>{data ? 'Save Changes' : 'Add Addon'}</Button>
			</div>
		</Dialog>
	);
};

export default SubscriptionAddonModal;
