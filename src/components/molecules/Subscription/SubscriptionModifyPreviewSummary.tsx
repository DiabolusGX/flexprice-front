import type { FC } from 'react';
import { Receipt } from 'lucide-react';
import type { SubscriptionModifyResponse } from '@/types/dto/Subscription';
import { cn } from '@/lib/utils';
import {
	buildBillingImpactRows,
	buildLineItemChangeRows,
	getQuantityChangePreviewCopy,
	hasAnyChangedResources,
	type QuantityChangePreviewContext,
	type QuantityDeltaDirection,
} from '@/utils/subscription/subscriptionModifyPreviewPresentation';

export interface SubscriptionModifyPreviewSummaryProps {
	data: SubscriptionModifyResponse | null;
	/** When set (e.g. quantity modify dialog), drives the primary “what changes” block. */
	quantityChangeContext?: QuantityChangePreviewContext;
}

function directionShortLabel(direction: QuantityDeltaDirection): string | null {
	if (direction === 'increase') return 'Increase';
	if (direction === 'decrease') return 'Decrease';
	return null;
}

const SubscriptionModifyPreviewSummary: FC<SubscriptionModifyPreviewSummaryProps> = ({ data, quantityChangeContext }) => {
	if (!data) {
		return <p className='text-sm text-gray-500'>No preview data.</p>;
	}

	const lineItems = data.changed_resources?.line_items ?? [];
	const subscriptions = data.changed_resources?.subscriptions ?? [];
	const invoices = data.changed_resources?.invoices ?? [];

	const anyResources = hasAnyChangedResources(lineItems, subscriptions, invoices);

	const billingRows = buildBillingImpactRows(invoices, data.subscription?.latest_invoice ?? null);
	const lineRows = buildLineItemChangeRows(lineItems);

	const quantityCopy = quantityChangeContext ? getQuantityChangePreviewCopy(quantityChangeContext) : null;
	const directionHint = quantityCopy ? directionShortLabel(quantityCopy.direction) : null;

	const showLineSection = lineRows.length > 0;
	const showBillingSection = billingRows.length > 0;
	const showDividerBeforeLines = Boolean(quantityCopy && showLineSection);
	const showDividerBeforeBilling = Boolean(showBillingSection && (quantityCopy || showLineSection));

	return (
		<div className='space-y-5 text-sm text-gray-800'>
			{quantityCopy && quantityChangeContext && (
				<div className='rounded-xl border border-gray-200/90 bg-gradient-to-b from-slate-50/90 to-white p-4 shadow-sm'>
					<p className='text-[13px] font-semibold leading-tight tracking-tight text-gray-900'>
						{quantityChangeContext.lineItemDisplayName}
					</p>
					<div className='mt-3 flex flex-wrap items-center gap-x-2 gap-y-1'>
						<span className='text-2xl font-semibold tabular-nums tracking-tight text-gray-900'>{quantityCopy.fromDisplay}</span>
						<span className='text-lg font-light text-gray-300' aria-hidden>
							→
						</span>
						<span className='text-2xl font-semibold tabular-nums tracking-tight text-gray-900'>{quantityCopy.toDisplay}</span>
						{directionHint && (
							<span
								className={cn(
									'ml-0.5 rounded-md px-2 py-0.5 text-xs font-medium',
									quantityCopy.direction === 'increase' && 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-600/10',
									quantityCopy.direction === 'decrease' && 'bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-600/10',
									quantityCopy.direction === 'unchanged' && 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200',
								)}>
								{directionHint}
							</span>
						)}
					</div>
				</div>
			)}

			{showLineSection && (
				<div className={cn(showDividerBeforeLines && 'border-t border-gray-100 pt-5')}>
					<div className='overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]'>
						<div className='grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.35fr)] gap-x-3 border-b border-gray-100 bg-slate-50/80 px-3 py-2 sm:gap-x-4 sm:px-4'>
							<span className='text-[11px] font-medium uppercase tracking-wider text-gray-500'>Type</span>
							<span className='text-[11px] font-medium uppercase tracking-wider tabular-nums text-gray-500'>Qty</span>
							<span className='text-[11px] font-medium uppercase tracking-wider text-gray-500'>Period</span>
						</div>
						{lineRows.map((row, i) => (
							<div
								key={row.id}
								className={cn(
									'grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.35fr)] gap-x-3 border-b border-gray-100 px-3 py-2.5 text-[13px] last:border-b-0 sm:gap-x-4 sm:px-4',
									i % 2 === 1 && 'bg-slate-50/35',
								)}>
								<span className='font-medium text-gray-800'>{row.label}</span>
								<span className='tabular-nums text-gray-900'>{row.quantityDisplay}</span>
								<span className='text-gray-600'>{row.periodDisplay ?? '—'}</span>
							</div>
						))}
					</div>
				</div>
			)}

			{showBillingSection && (
				<div className={cn(showDividerBeforeBilling && 'border-t border-gray-100 pt-5')}>
					<div className='space-y-2'>
						{billingRows.map((r) => (
							<div
								key={r.id}
								className='flex items-center justify-between gap-3 rounded-xl border border-gray-200/90 bg-gradient-to-r from-slate-50/60 to-white px-3 py-3 shadow-sm sm:px-4'>
								<div className='flex min-w-0 items-center gap-2.5'>
									<span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-gray-200/80'>
										<Receipt className='h-4 w-4 text-gray-500' aria-hidden />
									</span>
									<div className='min-w-0'>
										<p className='font-medium leading-snug text-gray-900'>{r.title}</p>
										{!r.amountText && <p className='mt-0.5 text-xs text-gray-500'>Amount available when the invoice is finalized</p>}
									</div>
								</div>
								{r.amountText ? (
									<span className='shrink-0 text-base font-semibold tabular-nums tracking-tight text-gray-900'>{r.amountText}</span>
								) : (
									<span className='shrink-0 text-sm font-medium tabular-nums text-gray-400'>—</span>
								)}
							</div>
						))}
					</div>
				</div>
			)}

			{subscriptions.length > 0 && (
				<p className='text-gray-600'>
					<span className='font-medium text-gray-900'>Subscription</span> will be updated to reflect these changes.
				</p>
			)}

			{quantityCopy && !anyResources && (
				<p className='text-sm text-gray-600'>No additional billing details were included in this preview.</p>
			)}

			{!quantityCopy && !anyResources && <p className='text-sm text-gray-600'>No billing changes returned for this preview.</p>}
		</div>
	);
};

export default SubscriptionModifyPreviewSummary;
