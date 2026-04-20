import { FC, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sheet, Button, Select, Spacer } from '@/components/atoms';
import { SelectOption } from '@/components/atoms/Select/Select';
import SubscriptionApi from '@/api/SubscriptionApi';
import { SUBSCRIPTION_STATUS } from '@/models/Subscription';
import { SubscriptionResponse, UpdateSubscriptionRequest } from '@/types/dto/Subscription';
import { isInheritedSubscription } from '@/utils/subscription/isInheritedSubscription';

function getPlanName(sub: SubscriptionResponse): string {
	return sub.plan?.name ?? '—';
}

export interface UpdateSubscriptionDrawerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	subscriptionId: string;
	subscription: SubscriptionResponse | null | undefined;
	onSave: (payload: UpdateSubscriptionRequest) => void;
	isSaving?: boolean;
	/** When true, parent field and save are disabled (e.g. inherited subscription). */
	readOnly?: boolean;
}

const UpdateSubscriptionDrawer: FC<UpdateSubscriptionDrawerProps> = ({
	open,
	onOpenChange,
	subscriptionId,
	subscription,
	onSave,
	isSaving = false,
	readOnly: readOnlyProp,
}) => {
	const [parentId, setParentId] = useState<string>('');
	const readOnly = readOnlyProp ?? (subscription ? isInheritedSubscription(subscription) : false);

	useEffect(() => {
		if (open && subscription) {
			setParentId(subscription.parent_subscription_id ?? '');
		}
	}, [open, subscription?.id, subscription?.parent_subscription_id]);

	const { data: subscriptionsData } = useQuery({
		queryKey: ['updateSubscriptionDrawer', 'activeSubscriptions', open, subscriptionId],
		queryFn: async () => {
			return await SubscriptionApi.listSubscriptions({
				subscription_status: [SUBSCRIPTION_STATUS.ACTIVE],
				customer_id: subscription?.customer_id,
				limit: 100,
			});
		},
		enabled: open && !!subscriptionId,
	});

	const items = subscriptionsData?.items ?? [];
	const excludedCurrent = useMemo(() => items.filter((sub) => sub.id !== subscriptionId), [items, subscriptionId]);

	const parentOptions: SelectOption[] = useMemo(() => {
		const list = excludedCurrent.map((sub) => ({
			value: sub.id,
			label: getPlanName(sub),
		}));
		if (parentId && !excludedCurrent.some((s) => s.id === parentId)) {
			return [{ value: parentId, label: parentId }, ...list];
		}
		return list;
	}, [excludedCurrent, parentId]);

	const hasChanges = parentId !== (subscription?.parent_subscription_id ?? '');

	const handleSave = () => {
		if (readOnly || !hasChanges) return;
		const payload: UpdateSubscriptionRequest = {};
		if (parentId !== (subscription?.parent_subscription_id ?? '')) {
			payload.parent_subscription_id = parentId.trim() || null;
		}
		if (Object.keys(payload).length > 0) {
			onSave(payload);
		}
	};

	return (
		<Sheet
			isOpen={open}
			onOpenChange={onOpenChange}
			title='Update subscription'
			description='Set parent subscription for this subscription.'
			size='md'>
			<div className='space-y-6 mt-4'>
				<div>
					<Select
						label='Parent subscription'
						placeholder='Select parent subscription'
						options={parentOptions}
						value={parentId}
						onChange={(value) => setParentId(value)}
						noOptionsText='No subscriptions found'
						disabled={readOnly}
					/>
				</div>

				<Spacer className='!h-4' />
				<div className='flex justify-end gap-2'>
					<Button variant='outline' onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={readOnly || !hasChanges || isSaving}>
						{isSaving ? 'Saving…' : 'Save'}
					</Button>
				</div>
			</div>
		</Sheet>
	);
};

export default UpdateSubscriptionDrawer;
