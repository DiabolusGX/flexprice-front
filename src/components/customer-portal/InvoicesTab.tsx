import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import CustomerPortalApi from '@/api/CustomerPortalApi';
import { portalInvoicesQueryKey } from '@/components/customer-portal/queryKeys';
import { Card, Chip } from '@/components/atoms';
import { InvoiceDownloadFormatDialog } from '@/components/molecules';
import { Invoice, INVOICE_STATUS } from '@/models/Invoice';
import { PAYMENT_STATUS } from '@/constants/payment';
import { formatDateShort, getCurrencySymbol } from '@/utils/common/helper_functions';
import { formatAmount } from '@/components/atoms/Input/Input';
import { Download, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui';
import EmptyState from './EmptyState';
import { downloadInvoiceLineItemsCsv } from '@/utils/invoices/downloadInvoiceLineItemsCsv';

const getStatusChip = (invoice: Invoice) => {
	// Check payment status first
	if (invoice.payment_status === PAYMENT_STATUS.SUCCEEDED) {
		return <Chip label='Paid' variant='success' />;
	}

	if (invoice.invoice_status === INVOICE_STATUS.VOIDED) {
		return <Chip label='Voided' variant='default' />;
	}

	if (invoice.invoice_status === INVOICE_STATUS.DRAFT) {
		return <Chip label='Draft' variant='default' />;
	}

	// Check if overdue (we already know payment is not SUCCEEDED at this point)
	const isOverdue = new Date(invoice.due_date) < new Date();
	if (isOverdue) {
		return <Chip label='Overdue' variant='failed' />;
	}

	return <Chip label='Pending' variant='warning' />;
};

const InvoicesTab = () => {
	const [searchQuery, setSearchQuery] = useState('');
	const [downloadTarget, setDownloadTarget] = useState<Invoice | null>(null);
	const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
	const [isCsvExportPending, setIsCsvExportPending] = useState(false);

	const {
		data: invoicesData,
		isLoading,
		isError,
	} = useQuery({
		queryKey: portalInvoicesQueryKey,
		queryFn: () => CustomerPortalApi.getInvoices({ limit: 100, offset: 0 }),
	});

	const { mutateAsync: downloadPortalPdfAsync, isPending: isPdfDownloadPending } = useMutation({
		mutationFn: (invoiceId: string) => CustomerPortalApi.downloadInvoicePdf(invoiceId),
		onSuccess: () => {
			toast.success('Invoice downloaded');
		},
		onError: () => {
			toast.error('Failed to download invoice');
		},
	});

	if (isError) {
		toast.error('Failed to load invoices');
	}

	if (isLoading) {
		return (
			<div className='space-y-6'>
				{/* Summary Cards Skeleton */}
				<div className='grid grid-cols-2 gap-4'>
					<Card className='bg-white border border-[#E9E9E9] rounded-xl p-4'>
						<div className='animate-pulse'>
							<div className='h-4 bg-zinc-100 rounded w-1/2 mb-2'></div>
							<div className='h-6 bg-zinc-100 rounded w-3/4'></div>
						</div>
					</Card>
					<Card className='bg-white border border-[#E9E9E9] rounded-xl p-4'>
						<div className='animate-pulse'>
							<div className='h-4 bg-zinc-100 rounded w-1/2 mb-2'></div>
							<div className='h-6 bg-zinc-100 rounded w-3/4'></div>
						</div>
					</Card>
				</div>
				{/* Search Skeleton */}
				<div className='h-10 bg-zinc-100 animate-pulse rounded-md'></div>
				{/* Table Skeleton */}
				<Card className='bg-white border border-[#E9E9E9] rounded-xl p-4'>
					<div className='animate-pulse space-y-3'>
						<div className='h-10 bg-zinc-100 rounded'></div>
						<div className='h-12 bg-zinc-100 rounded'></div>
						<div className='h-12 bg-zinc-100 rounded'></div>
						<div className='h-12 bg-zinc-100 rounded'></div>
					</div>
				</Card>
			</div>
		);
	}

	const invoices = invoicesData?.items || [];

	// Filter invoices based on search
	const filteredInvoices = invoices.filter((invoice) => {
		if (!searchQuery) return true;
		const query = searchQuery.toLowerCase();
		return (
			invoice.invoice_number?.toLowerCase().includes(query) ||
			invoice.invoice_status?.toLowerCase().includes(query) ||
			invoice.payment_status?.toLowerCase().includes(query)
		);
	});

	// Calculate totals for finalized invoices
	// const totalInvoiced = invoices
	// 	.filter((inv) => inv.invoice_status === INVOICE_STATUS.FINALIZED)
	// 	.reduce((sum, inv) => sum + (inv.total || 0), 0);

	// const totalOverdue = invoices
	// 	.filter(
	// 		(inv) =>
	// 			inv.invoice_status === INVOICE_STATUS.FINALIZED &&
	// 			inv.payment_status !== PAYMENT_STATUS.SUCCEEDED &&
	// 			new Date(inv.due_date) < new Date(),
	// 	)
	// 	.reduce((sum, inv) => sum + (inv.amount_remaining || 0), 0);

	const currency = invoices[0]?.currency || 'USD';
	const currencySymbol = getCurrencySymbol(currency);

	const openInvoiceDownload = (invoice: Invoice) => {
		setDownloadTarget(invoice);
		setIsDownloadDialogOpen(true);
	};

	const busyDownloadInvoiceId = isPdfDownloadPending || isCsvExportPending ? (downloadTarget?.id ?? null) : null;

	if (invoices.length === 0) {
		return (
			<Card className='bg-white border border-[#E9E9E9] rounded-xl p-6'>
				<EmptyState title='No invoices' description='No invoices have been generated yet' />
			</Card>
		);
	}

	return (
		<div className='space-y-6'>
			<InvoiceDownloadFormatDialog
				open={isDownloadDialogOpen}
				onOpenChange={(open) => {
					setIsDownloadDialogOpen(open);
					if (!open) {
						setDownloadTarget(null);
					}
				}}
				isPdfPending={isPdfDownloadPending}
				isCsvPending={isCsvExportPending}
				onSelectPdf={async () => {
					if (!downloadTarget) return;
					await downloadPortalPdfAsync(downloadTarget.id);
				}}
				onSelectCsv={async () => {
					if (!downloadTarget) return;
					setIsCsvExportPending(true);
					try {
						const full = downloadTarget.line_items?.length ? downloadTarget : await CustomerPortalApi.getInvoice(downloadTarget.id);
						const rows = downloadInvoiceLineItemsCsv(full);
						if (rows === 0) {
							toast.error('No billable line items to export');
						} else {
							toast.success('Invoice CSV downloaded');
						}
					} catch {
						toast.error('Failed to export invoice');
					} finally {
						setIsCsvExportPending(false);
					}
				}}
			/>
			{/* Summary Cards */}
			{/* <div className='grid grid-cols-2 gap-4'>
				<Card className='bg-white border border-[#E9E9E9] rounded-xl p-4'>
					<span className='text-sm text-zinc-500'>Total invoiced</span>
					<p className='text-xl font-semibold text-zinc-950 mt-1'>
						{currencySymbol}
						{formatAmount(String(totalInvoiced))}
					</p>
				</Card>
				<Card className='bg-white border border-[#E9E9E9] rounded-xl p-4'>
					<div className='flex items-center gap-1.5'>
						<span className='text-sm text-zinc-500'>Total overdue</span>
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger>
									<Info className='h-3.5 w-3.5 text-zinc-400' />
								</TooltipTrigger>
								<TooltipContent>
									<p>Unpaid invoices past due date</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</div>
					<p className={`text-xl font-semibold mt-1 ${totalOverdue > 0 ? 'text-red-600' : 'text-zinc-950'}`}>
						{currencySymbol}
						{formatAmount(String(totalOverdue))}
					</p>
				</Card>
			</div> */}

			{/* Search */}
			<div className='relative'>
				<Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-400' />
				<Input
					placeholder='Search invoices...'
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className='pl-10 bg-white border-[#E9E9E9]'
				/>
			</div>

			{/* Invoices Table */}
			<Card className='bg-white border border-[#E9E9E9] rounded-xl overflow-hidden'>
				<div className='overflow-x-auto'>
					<table className='w-full'>
						<thead>
							<tr className='border-b border-[#E9E9E9] bg-zinc-50'>
								<th className='text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider'>Date</th>
								<th className='text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider'>Invoice #</th>
								<th className='text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider'>Status</th>
								<th className='text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider'>Amount</th>
								<th className='text-center px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider'>Download</th>
							</tr>
						</thead>
						<tbody className='divide-y divide-[#E9E9E9]'>
							{filteredInvoices.map((invoice) => (
								<tr key={invoice.id} className='hover:bg-zinc-50 transition-colors'>
									<td className='px-4 py-3 text-sm text-zinc-700'>
										{invoice.finalized_at ? formatDateShort(invoice.finalized_at) : formatDateShort(invoice.created_at)}
									</td>
									<td className='px-4 py-3 text-sm text-zinc-900 font-medium'>
										{invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`}
									</td>
									<td className='px-4 py-3'>{getStatusChip(invoice)}</td>
									<td className='px-4 py-3 text-sm text-zinc-900 text-right font-medium'>
										{currencySymbol}
										{formatAmount(String(invoice.total ?? 0))}
									</td>
									<td className='px-4 py-3 text-center'>
										{invoice.invoice_status === INVOICE_STATUS.FINALIZED && (
											<button
												onClick={() => openInvoiceDownload(invoice)}
												disabled={busyDownloadInvoiceId !== null}
												className='p-2 hover:bg-zinc-100 rounded-md transition-colors text-zinc-500 hover:text-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed'>
												{busyDownloadInvoiceId === invoice.id ? (
													<Loader2 className='h-4 w-4 animate-spin' />
												) : (
													<Download className='h-4 w-4' />
												)}
											</button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{filteredInvoices.length === 0 && (
					<div className='py-8'>
						<EmptyState title='No invoices found' description='No invoices match your search criteria' />
					</div>
				)}
			</Card>
		</div>
	);
};

export default InvoicesTab;
