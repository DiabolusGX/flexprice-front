import { AddAddonToSubscriptionRequest } from '@/types/dto/Addon';
import React, { useState, useEffect } from 'react';
import { Button, DatePicker } from '@/components/atoms';
import { Sheet } from '@/components/atoms';
import { useQuery } from '@tanstack/react-query';
import AddonApi from '@/api/AddonApi';
import { Select } from '@/components/atoms';

interface Props {
	data?: AddAddonToSubscriptionRequest;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (addon: AddAddonToSubscriptionRequest) => void;
	onCancel: () => void;
	getEmptyAddon: () => Partial<AddAddonToSubscriptionRequest>;
}

const AddonModal: React.FC<Props> = ({ data, isOpen, onOpenChange, onSave, onCancel, getEmptyAddon }) => {
	const [formData, setFormData] = useState<Partial<AddAddonToSubscriptionRequest>>({});
	const [errors, setErrors] = useState<Record<string, string>>({});

	// Fetch available addons
	const { data: addons = [] } = useQuery({
		queryKey: ['addons'],
		queryFn: async () => {
			const response = await AddonApi.List({ limit: 1000, offset: 0 });
			return response.items;
		},
	});

	// Reset form when modal opens/closes
	useEffect(() => {
		if (isOpen) {
			if (data) {
				setFormData(data);
			} else {
				setFormData(getEmptyAddon());
			}
			setErrors({});
		}
	}, [isOpen, data, getEmptyAddon]);

	const validateForm = (): boolean => {
		const newErrors: Record<string, string> = {};

		if (!formData.addon_id) {
			newErrors.addon_id = 'Addon is required';
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSave = () => {
		if (!validateForm()) {
			return;
		}

		const addonData: AddAddonToSubscriptionRequest = {
			addon_id: formData.addon_id!,
			start_date: formData.start_date,
			metadata: formData.metadata || {},
		};

		onSave(addonData);
	};

	const handleCancel = () => {
		setFormData({});
		setErrors({});
		onCancel();
	};

	const addonOptions = addons.map((addon) => ({
		label: addon.name,
		value: addon.id,
		description: addon.description || 'No description',
	}));

	return (
		<Sheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={data ? 'Edit Addon' : 'Add Addon'}
			description={data ? 'Edit addon configuration' : 'Add an addon to the subscription'}>
			<div className='space-y-4 mt-6'>
				<Select
					label='Addon*'
					placeholder='Select addon'
					options={addonOptions}
					value={formData.addon_id || ''}
					onChange={(value) => setFormData({ ...formData, addon_id: value })}
					error={errors.addon_id}
				/>

				<DatePicker
					label='Start Date'
					placeholder='Select start date'
					date={formData.start_date ? new Date(formData.start_date) : undefined}
					setDate={(date) => setFormData({ ...formData, start_date: date?.toISOString() })}
				/>

				<div className='flex justify-end space-x-2 pt-4'>
					<Button variant='outline' onClick={handleCancel}>
						Cancel
					</Button>
					<Button onClick={handleSave}>{data ? 'Update' : 'Add'} Addon</Button>
				</div>
			</div>
		</Sheet>
	);
};

export default AddonModal;
