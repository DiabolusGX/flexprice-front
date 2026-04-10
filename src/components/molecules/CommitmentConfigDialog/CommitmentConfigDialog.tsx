import { FC, useState, useEffect } from 'react';
import { Dialog, Button, Input, Select } from '@/components/atoms';
import { Switch } from '@/components/ui';
import { Price } from '@/models/Price';
import { LineItemCommitmentConfig, CommitmentType } from '@/types/dto/LineItemCommitmentConfig';
import { validateCommitment, supportsWindowCommitment } from '@/utils/common/commitment_helpers';
import { removeFormatting } from '@/components/atoms/Input/Input';
import { getCurrencySymbol } from '@/utils/common/helper_functions';
import { BILLING_PERIOD } from '@/constants/constants';

interface CommitmentConfigDialogProps {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	price: Price;
	onSave: (priceId: string, config: LineItemCommitmentConfig | null) => void;
	currentConfig: LineItemCommitmentConfig | undefined;
	billingPeriod?: BILLING_PERIOD;
}

const commitmentTypeOptions = [
	{
		label: 'Amount',
		value: CommitmentType.AMOUNT,
		description: 'Commitment based on monetary amount',
	},
	{
		label: 'Quantity',
		value: CommitmentType.QUANTITY,
		description: 'Commitment based on usage quantity',
	},
];

const CommitmentConfigDialog: FC<CommitmentConfigDialogProps> = ({ isOpen, onOpenChange, price, onSave, currentConfig, billingPeriod }) => {
	const [commitmentType, setCommitmentType] = useState<CommitmentType>(CommitmentType.AMOUNT);
	const [commitmentAmount, setCommitmentAmount] = useState<string>('');
	const [commitmentQuantity, setCommitmentQuantity] = useState<string>('');
	const [overageFactor, setOverageFactor] = useState<string>('1.0');
	const [enableTrueUp, setEnableTrueUp] = useState<boolean>(false);
	const [isWindowCommitment, setIsWindowCommitment] = useState<boolean>(() => supportsWindowCommitment(price));
	const [commitmentDuration, setCommitmentDuration] = useState<string>(billingPeriod?.toUpperCase() || '');
	const [validationError, setValidationError] = useState<string | null>(null);

	const commitmentDurationOptions = [
		{ label: 'Monthly', value: BILLING_PERIOD.MONTHLY },
		{ label: 'Quarterly', value: BILLING_PERIOD.QUARTERLY },
		{ label: 'Half-Yearly', value: BILLING_PERIOD.HALF_YEARLY },
		{ label: 'Annual', value: BILLING_PERIOD.ANNUAL },
	];

	const currencySymbol = getCurrencySymbol(price.currency);
	const meterDisplayName = price.meter?.name || price.display_name || 'this charge';
	const showWindowCommitment = supportsWindowCommitment(price);

	// Initialize form with current config or defaults
	useEffect(() => {
		if (currentConfig) {
			// Determine commitment type from fields if not explicitly set
			const type =
				currentConfig.commitment_type ||
				(currentConfig.commitment_amount !== undefined && currentConfig.commitment_amount !== null
					? CommitmentType.AMOUNT
					: currentConfig.commitment_quantity !== undefined && currentConfig.commitment_quantity !== null
						? CommitmentType.QUANTITY
						: CommitmentType.AMOUNT);
			setCommitmentType(type);
			setCommitmentAmount(currentConfig.commitment_amount?.toString() || '');
			setCommitmentQuantity(currentConfig.commitment_quantity?.toString() || '');
			setOverageFactor(currentConfig.overage_factor?.toString() || '1.0');
			setEnableTrueUp(currentConfig.enable_true_up ?? false);
			setIsWindowCommitment(currentConfig.is_window_commitment ?? showWindowCommitment);
			setCommitmentDuration(currentConfig.commitment_duration || billingPeriod?.toUpperCase() || '');
		} else {
			// Reset to defaults when opening without existing config
			setCommitmentType(CommitmentType.AMOUNT);
			setCommitmentAmount('');
			setCommitmentQuantity('');
			setOverageFactor('1.0');
			setEnableTrueUp(false);
			setIsWindowCommitment(showWindowCommitment);
			setCommitmentDuration(billingPeriod?.toUpperCase() || '');
		}
		setValidationError(null);
	}, [currentConfig, isOpen, showWindowCommitment]);

	const handleSave = () => {
		const config: Partial<LineItemCommitmentConfig> = {
			commitment_type: commitmentType,
			overage_factor: parseFloat(overageFactor) || 1.0,
			enable_true_up: enableTrueUp,
			is_window_commitment: isWindowCommitment,
			commitment_duration: commitmentDuration ? (commitmentDuration as BILLING_PERIOD) : undefined,
		};

		if (commitmentType === CommitmentType.AMOUNT) {
			config.commitment_amount = commitmentAmount ? parseFloat(removeFormatting(commitmentAmount)) : undefined;
		} else {
			config.commitment_quantity = commitmentQuantity ? parseInt(commitmentQuantity, 10) : undefined;
		}

		// Validate
		const error = validateCommitment(config);
		if (error) {
			setValidationError(error);
			return;
		}

		// Save
		onSave(price.id, config as LineItemCommitmentConfig);
		onOpenChange(false);
	};

	const handleClear = () => {
		onSave(price.id, null);
		onOpenChange(false);
	};

	const handleCancel = () => {
		setValidationError(null);
		onOpenChange(false);
	};

	const hasExistingConfig = currentConfig !== undefined;

	return (
		<Dialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title='Configure Commitment'
			description={`Set up commitment configuration for ${meterDisplayName}`}
			className='w-auto min-w-[32rem] max-w-[90vw]'>
			<div className='space-y-6 max-h-[80vh] overflow-y-auto'>
				{/* Commitment Type Selection */}
				<div className='space-y-3'>
					<label className='text-sm font-medium text-gray-700'>Commitment Type*</label>
					<div className='flex gap-2'>
						{commitmentTypeOptions.map((option) => (
							<button
								key={option.value}
								type='button'
								onClick={() => {
									setCommitmentType(option.value);
									setValidationError(null);
								}}
								className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
									commitmentType === option.value
										? 'border-primary bg-primary/5 text-primary font-medium'
										: 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
								}`}>
								<div className='text-sm font-medium'>{option.label}</div>
								<div className='text-xs text-gray-500 mt-0.5'>{option.description}</div>
							</button>
						))}
					</div>
				</div>

				{/* Conditional: Commitment Amount + Duration */}
				{commitmentType === CommitmentType.AMOUNT && (
					<div className='grid grid-cols-2 gap-4 items-start'>
						<div className='space-y-1'>
							<label className='text-sm font-medium text-gray-700'>Commitment Amount ({price.currency})*</label>
							<Input
								type='formatted-number'
								value={commitmentAmount}
								onChange={(value) => {
									setCommitmentAmount(value);
									setValidationError(null);
								}}
								placeholder='Enter commitment amount'
								suffix={currencySymbol}
								className='w-full'
								error={validationError && validationError.includes('amount') ? validationError : undefined}
							/>
							<p className='text-xs text-gray-500'>The minimum monetary commitment</p>
						</div>
						<div className='space-y-1'>
							<label className='text-sm font-medium text-gray-700'>Commitment Period</label>
							<Select
								value={commitmentDuration}
								options={commitmentDurationOptions}
								onChange={(value) => {
									setCommitmentDuration(value);
									setValidationError(null);
								}}
								placeholder='Same as billing period'
							/>
							<p className='text-xs text-gray-500'>Duration the commitment applies for</p>
						</div>
					</div>
				)}

				{/* Conditional: Commitment Quantity + Duration */}
				{commitmentType === CommitmentType.QUANTITY && (
					<div className='grid grid-cols-2 gap-4 items-start'>
						<div className='space-y-1'>
							<label className='text-sm font-medium text-gray-700'>Commitment Quantity*</label>
							<Input
								type='number'
								value={commitmentQuantity}
								onChange={(value) => {
									setCommitmentQuantity(value);
									setValidationError(null);
								}}
								placeholder='Enter commitment quantity'
								className='w-full'
								error={validationError && validationError.includes('quantity') ? validationError : undefined}
							/>
							<p className='text-xs text-gray-500'>The minimum usage quantity</p>
						</div>
						<div className='space-y-1'>
							<label className='text-sm font-medium text-gray-700'>Commitment Period</label>
							<Select
								value={commitmentDuration}
								options={commitmentDurationOptions}
								onChange={(value) => {
									setCommitmentDuration(value);
									setValidationError(null);
								}}
								placeholder='Same as billing period'
							/>
							<p className='text-xs text-gray-500'>Duration the commitment applies for</p>
						</div>
					</div>
				)}

				{/* Overage Factor */}
				<div className='space-y-2'>
					<label className='text-sm font-medium text-gray-700'>Overage Factor*</label>
					<Input
						type='number'
						value={overageFactor}
						onChange={(value) => {
							setOverageFactor(value);
							setValidationError(null);
						}}
						placeholder='1.0'
						className='w-full'
						error={validationError && validationError.includes('overage') ? validationError : undefined}
					/>
					<p className='text-xs text-gray-500'>Multiplier applied to usage beyond commitment (e.g., 1.2 = 20% premium on overage)</p>
				</div>

				{/* Enable True Up */}
				<div className='flex items-center justify-between p-4 bg-gray-50 rounded-lg'>
					<div className='flex-1'>
						<label className='text-sm font-medium text-gray-700 block mb-1'>Enable True Up</label>
						<p className='text-xs text-gray-500'>Charge the commitment amount even if usage is below the commitment</p>
					</div>
					<Switch checked={enableTrueUp} onCheckedChange={setEnableTrueUp} />
				</div>

				{/* Conditional: Window Commitment (only if meter has bucket_size) */}
				{showWindowCommitment && (
					<div className='flex items-center justify-between p-4 bg-gray-50 rounded-lg'>
						<div className='flex-1'>
							<label className='text-sm font-medium text-gray-700 block mb-1'>Window Commitment</label>
							<p className='text-xs text-gray-500'>
								Apply commitment to each bucket window (meter has bucket size: {price.meter?.aggregation?.bucket_size})
							</p>
						</div>
						<Switch checked={isWindowCommitment} onCheckedChange={setIsWindowCommitment} />
					</div>
				)}

				{/* General Validation Error */}
				{validationError && !validationError.includes('amount') && !validationError.includes('quantity') && (
					<div className='p-3 bg-red-50 border border-red-200 rounded-lg'>
						<p className='text-sm text-red-700'>{validationError}</p>
					</div>
				)}

				{/* Existing Config Notice */}
				{hasExistingConfig && (
					<div className='p-3 bg-blue-50 border border-blue-200 rounded-lg'>
						<p className='text-sm text-blue-700'>This price already has a commitment configuration. Your changes will update it.</p>
					</div>
				)}

				{/* Action Buttons */}
				<div className='flex gap-3 pt-4 border-t'>
					<Button variant='outline' onClick={handleCancel} className='flex-1'>
						Cancel
					</Button>
					{hasExistingConfig && (
						<Button variant='outline' onClick={handleClear} className='flex-1 text-red-600 hover:bg-red-50'>
							Clear Commitment
						</Button>
					)}
					<Button onClick={handleSave} className='flex-1'>
						{hasExistingConfig ? 'Update Commitment' : 'Save Commitment'}
					</Button>
				</div>
			</div>
		</Dialog>
	);
};

export default CommitmentConfigDialog;
