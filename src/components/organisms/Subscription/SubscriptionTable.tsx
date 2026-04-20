import { FC, useMemo } from 'react';
import { Subscription, SUBSCRIPTION_STATUS, SUBSCRIPTION_TYPE } from '@/models/Subscription';
import { ColumnData, FlexpriceTable } from '@/components/molecules';
import { Chip, Tooltip } from '@/components/atoms';
import { formatBillingPeriodForDisplay } from '@/utils/common/helper_functions';
import formatDate from '@/utils/common/format_date';
import SubscriptionActionButton from './SubscriptionActionButton';
import { Info } from 'lucide-react';

export interface SubscriptionTableProps {
	data: Subscription[];
	onRowClick?: (row: Subscription) => void;
	allowRedirect?: boolean;
	subscriptionOverrides?: Map<string, boolean>;
}

function subscriptionHierarchyKind(row: Subscription): 'inherited' | 'parent' | null {
	const t = row.subscription_type?.toLowerCase();
	if (t === SUBSCRIPTION_TYPE.INHERITED || Boolean(row.parent_subscription_id?.trim())) return 'inherited';
	if (t === SUBSCRIPTION_TYPE.PARENT) return 'parent';
	return null;
}

export const getSubscriptionStatus = (status: string) => {
	switch (status) {
		case SUBSCRIPTION_STATUS.ACTIVE:
			return <Chip variant='success' label='Active' />;
		case SUBSCRIPTION_STATUS.CANCELLED:
			return <Chip variant='failed' label='Cancelled' />;
		case SUBSCRIPTION_STATUS.INCOMPLETE:
			return <Chip variant='warning' label='Incomplete' />;
		case SUBSCRIPTION_STATUS.TRIALING:
			return <Chip variant='warning' label='Trialing' />;
		case SUBSCRIPTION_STATUS.DRAFT:
			return <Chip variant='warning' label='Draft' />;
		default:
			return <Chip variant='default' label='Inactive' />;
	}
};

export const formatSubscriptionStatus = (status: string) => {
	switch (status) {
		case SUBSCRIPTION_STATUS.ACTIVE:
			return 'Active';
		case SUBSCRIPTION_STATUS.CANCELLED:
			return 'Cancelled';
		case SUBSCRIPTION_STATUS.INCOMPLETE:
			return 'Incomplete';
		case SUBSCRIPTION_STATUS.TRIALING:
			return 'Trialing';
		case SUBSCRIPTION_STATUS.DRAFT:
			return 'Draft';
		default:
			return 'Inactive';
	}
};

const SubscriptionTable: FC<SubscriptionTableProps> = ({ data, onRowClick, allowRedirect = true, subscriptionOverrides }): JSX.Element => {
	const showHierarchyColumn = data.some((row) => subscriptionHierarchyKind(row) !== null);

	const columns: ColumnData<Subscription>[] = useMemo(() => {
		const hierarchyColumn: ColumnData<Subscription> = {
			title: 'Hierarchy',
			render: (row) => {
				const kind = subscriptionHierarchyKind(row);
				if (kind === 'inherited') {
					const chip = <Chip variant='info' label='Inherited' />;
					return (
						<Tooltip
							delayDuration={0}
							className='max-w-[320px] whitespace-normal text-left leading-relaxed'
							content={
								<div className='space-y-1'>
									<div className='font-semibold'>Inherited subscription</div>
									<div className='text-sm font-normal opacity-90'>
										This subscription mirrors charges from a parent subscription. Changes should be made on the parent.
									</div>
								</div>
							}>
							<span className='inline-flex cursor-default'>{chip}</span>
						</Tooltip>
					);
				}
				if (kind === 'parent') {
					return (
						<Tooltip
							className='max-w-[320px] whitespace-normal text-left leading-relaxed'
							content={
								<div className='space-y-1'>
									<div className='font-semibold'>Parent subscription</div>
									<div className='text-sm font-normal opacity-90'>
										Usage and charges from linked child subscriptions roll up into this subscription.
									</div>
								</div>
							}
							delayDuration={0}>
							<span className='inline-flex cursor-default'>
								<Chip variant='default' label='Parent' />
							</span>
						</Tooltip>
					);
				}
				return <span className='text-muted-foreground'>—</span>;
			},
		};

		return [
			{
				title: 'Plan Name',
				render: (row) => {
					const hasOverride = subscriptionOverrides?.get(row.id);
					const planName = row.plan?.name || row.plan_id || '—';

					return (
						<div className='flex items-center gap-1.5'>
							<span>{planName}</span>
							{hasOverride && (
								<Tooltip content='Plan modified' delayDuration={0}>
									<span
										tabIndex={0}
										role='img'
										aria-label='Plan modified'
										className='inline-flex cursor-default rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'>
										<Info className='h-4 w-4 shrink-0 text-muted-foreground hover:text-foreground transition-colors' />
									</span>
								</Tooltip>
							)}
						</div>
					);
				},
			},
			...(showHierarchyColumn ? [hierarchyColumn] : []),
			{
				title: 'Billing Period',
				render: (row) => <span>{formatBillingPeriodForDisplay(row.billing_period)}</span>,
			},
			{
				title: 'Status',
				render: (row) => getSubscriptionStatus(row.subscription_status),
			},
			{
				title: 'Start Date',
				render: (row) => <span>{formatDate(row.start_date)}</span>,
			},
			{
				title: 'Renewal Date',
				render: (row) => <span>{formatDate(row.current_period_end)}</span>,
			},
			...(allowRedirect
				? [
						{
							width: '30px',
							fieldVariant: 'interactive' as const,
							hideOnEmpty: true,
							render: (row: Subscription) => {
								// Inherited (child) subscriptions are managed via the parent; hide actions like edit/pause/cancel.
								if (subscriptionHierarchyKind(row) === 'inherited') return null;
								return <SubscriptionActionButton subscription={row} />;
							},
						},
					]
				: []),
		];
	}, [allowRedirect, showHierarchyColumn, subscriptionOverrides]);

	return (
		<FlexpriceTable
			onRowClick={(row) => {
				onRowClick?.(row);
			}}
			columns={columns}
			showEmptyRow
			data={data}
			variant='no-bordered'
		/>
	);
};

export default SubscriptionTable;
