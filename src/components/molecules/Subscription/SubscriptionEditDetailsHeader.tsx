import { FC, useMemo } from 'react';
import { Spacer, Button, Tooltip } from '@/components/atoms';
import { DetailsCard, UpdateSubscriptionDrawer } from '@/components/molecules';
import { getSubscriptionStatus } from '@/components/organisms/Subscription/SubscriptionTable';
import { getCurrencySymbol } from '@/utils/common/helper_functions';
import formatDate from '@/utils/common/format_date';
import { RouteNames } from '@/core/routes/Routes';
import { getTypographyClass } from '@/lib/typography';
import { Pencil, ExternalLink } from 'lucide-react';
import { Link } from 'react-router';
import type { SubscriptionResponse, UpdateSubscriptionRequest } from '@/types/dto/Subscription';
import { SUBSCRIPTION_STATUS } from '@/models/Subscription';
import { isInheritedSubscription } from '@/utils/subscription/isInheritedSubscription';

/** Subscription edit page: details header and update drawer. */
export interface SubscriptionEditDetailsHeaderProps {
	subscription: SubscriptionResponse;
	subscriptionId: string;
	onUpdate: (payload: UpdateSubscriptionRequest) => void;
	isUpdating: boolean;
	updateDrawerOpen: boolean;
	onUpdateDrawerOpenChange: (open: boolean) => void;
}

const SubscriptionEditDetailsHeader: FC<SubscriptionEditDetailsHeaderProps> = ({
	subscription,
	subscriptionId,
	onUpdate,
	isUpdating,
	updateDrawerOpen,
	onUpdateDrawerOpenChange,
}) => {
	const subscriptionReadOnly = isInheritedSubscription(subscription);

	const detailsData = useMemo(
		() => [
			{ label: 'Plan', value: subscription?.plan?.name },
			{
				label: 'Status',
				value: getSubscriptionStatus(subscription?.subscription_status ?? ''),
			},
			{
				label: 'Subscription type',
				value: subscription?.subscription_type
					? subscription.subscription_type.charAt(0).toUpperCase() + subscription.subscription_type.slice(1)
					: 'Standalone',
			},
			{ label: 'Billing Cycle', value: subscription?.billing_cycle || '--' },
			{ label: 'Start Date', value: formatDate(subscription?.start_date ?? '') },
			{ label: 'Current Period End', value: formatDate(subscription?.current_period_end ?? '') },
			...(subscription?.commitment_amount
				? [
						{
							label: 'Commitment Amount',
							value: `${getCurrencySymbol(subscription?.currency || '')} ${subscription?.commitment_amount}`,
						},
					]
				: []),
			...(subscription?.overage_factor && subscription?.overage_factor > 1
				? [{ label: 'Overage Factor', value: subscription?.overage_factor.toString() }]
				: []),
			{
				label: 'Parent subscription',
				value: subscription?.parent_subscription_id ? (
					<Link
						to={`${RouteNames.subscriptions}/${subscription.parent_subscription_id}/edit`}
						className='inline-flex items-center text-sm gap-1.5 hover:underline transition-colors'>
						{subscription.parent_subscription_id}
						<ExternalLink className='w-3.5 h-3.5' />
					</Link>
				) : (
					'None'
				),
			},
		],
		[subscription],
	);

	return (
		<div>
			<Spacer className='!h-4' />
			<div className='flex justify-between items-center'>
				<h3 className={getTypographyClass('card-header') + ' !text-[16px]'}>Subscription Details</h3>
				{subscription?.subscription_status !== SUBSCRIPTION_STATUS.CANCELLED && (
					<Tooltip
						delayDuration={0}
						content={
							subscriptionReadOnly
								? 'Inherited subscriptions mirror the parent; update the parent subscription instead.'
								: 'Update subscription'
						}>
						<span className='inline-flex'>
							<Button
								variant='outline'
								size='icon'
								disabled={subscriptionReadOnly}
								onClick={() => !subscriptionReadOnly && onUpdateDrawerOpenChange(true)}
								title={
									subscriptionReadOnly ? 'Inherited subscriptions are read-only; edit the parent subscription.' : 'Update subscription'
								}>
								<Pencil className='size-4' />
							</Button>
						</span>
					</Tooltip>
				)}
			</div>
			<Spacer className='!h-4' />
			<DetailsCard variant='stacked' data={detailsData} childrenAtTop cardStyle='borderless' />
			<UpdateSubscriptionDrawer
				open={updateDrawerOpen}
				onOpenChange={onUpdateDrawerOpenChange}
				subscriptionId={subscriptionId}
				subscription={subscription}
				onSave={onUpdate}
				isSaving={isUpdating}
				readOnly={subscriptionReadOnly}
			/>
		</div>
	);
};

export default SubscriptionEditDetailsHeader;
