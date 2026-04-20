import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
import EmptyState from '../EmptyState';
import { usePortalConfig } from '@/context/PortalConfigContext';
import { downloadInvoiceLineItemsCsv } from '@/utils/invoices/downloadInvoiceLineItemsCsv';

/** Priority: paid > voided > draft > overdue > pending */
const getStatusChip = (invoice: Invoice) => {
	if (invoice.payment_status === PAYMENT_STATUS.SUCCEEDED) return <Chip label='Paid' variant='success' />;
	if (invoice.invoice_status === INVOICE_STATUS.VOIDED) return <Chip label='Voided' variant='default' />;
	if (invoice.invoice_status === INVOICE_STATUS.DRAFT) return <Chip label='Draft' variant='default' />;
	const isOverdue = new Date(invoice.due_date) < new Date();
	if (isOverdue) return <Chip label='Overdue' variant='failed' />;
	return <Chip label='Pending' variant='warning' />;
};

interface InvoicesTableProps {
	invoices: Invoice[];
	currencySymbol: string;
	onOpenDownloadFormat: (invoice: Invoice) => void;
	downloadPendingId: string | null;
	hasTheme: boolean;
}

const InvoicesTable = ({ invoices, currencySymbol, onOpenDownloadFormat, downloadPendingId, hasTheme }: InvoicesTableProps) => (
	<div className='overflow-x-auto'>
		<table className='w-full'>
			<thead>
				<tr
					className='border-b'
					style={{
						backgroundColor: 'var(--portal-surface, #f9fafb)',
						borderColor: 'var(--portal-border, #E9E9E9)',
					}}>
					{(['DATE', 'INVOICE #', 'STATUS', 'AMOUNT', 'DOWNLOAD'] as const).map((col) => (
						<th
							key={col}
							className={`px-4 py-3 text-xs font-medium uppercase tracking-wider ${col === 'AMOUNT' ? 'text-right' : col === 'DOWNLOAD' ? 'text-center' : 'text-left'}`}
							style={{ color: 'var(--portal-text-secondary, #71717a)' }}>
							{col}
						</th>
					))}
				</tr>
			</thead>
			<tbody className='divide-y' style={{ borderColor: 'var(--portal-border, #E9E9E9)' }}>
				{invoices.map((invoice) => (
					<tr key={invoice.id} className='transition-colors' style={{ backgroundColor: 'var(--portal-surface, white)' }}>
						<td className='px-4 py-3 text-sm' style={{ color: 'var(--portal-text-secondary, #71717a)' }}>
							{invoice.finalized_at ? formatDateShort(invoice.finalized_at) : formatDateShort(invoice.created_at)}
						</td>
						<td className='px-4 py-3 text-sm font-medium' style={{ color: 'var(--portal-text-primary, #09090b)' }}>
							{invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`}
						</td>
						<td className='px-4 py-3'>{getStatusChip(invoice)}</td>
						<td className='px-4 py-3 text-sm text-right font-medium' style={{ color: 'var(--portal-text-primary, #09090b)' }}>
							{currencySymbol}
							{formatAmount(String(invoice.total ?? 0))}
						</td>
						<td className='px-4 py-3 text-center'>
							{invoice.invoice_status === INVOICE_STATUS.FINALIZED && (
								<button
									onClick={() => onOpenDownloadFormat(invoice)}
									disabled={downloadPendingId !== null}
									className='p-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
									style={hasTheme ? { backgroundColor: 'var(--portal-primary)', color: 'white' } : { color: '#71717a' }}>
									{downloadPendingId === invoice.id ? <Loader2 className='h-4 w-4 animate-spin' /> : <Download className='h-4 w-4' />}
								</button>
							)}
						</td>
					</tr>
				))}
			</tbody>
		</table>
		{invoices.length === 0 && (
			<div className='py-8'>
				<EmptyState title='No invoices found' description='No invoices match your search criteria' />
			</div>
		)}
	</div>
);

const InvoicesWidget = () => {
	const [searchQuery, setSearchQuery] = useState('');
	const [downloadTarget, setDownloadTarget] = useState<Invoice | null>(null);
	const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
	const [isCsvExportPending, setIsCsvExportPending] = useState(false);
	const { config } = usePortalConfig();
	const hasTheme = !!config.theme;

	const {
		data: invoicesData,
		isLoading,
		isError,
	} = useQuery({
		queryKey: portalInvoicesQueryKey,
		queryFn: () => CustomerPortalApi.getInvoices({ limit: 100, offset: 0 }),
	});

	const { mutateAsync: downloadPdfAsync, isPending: isDownloading } = useMutation({
		mutationFn: (invoiceId: string) => CustomerPortalApi.downloadInvoicePdf(invoiceId),
		onSuccess: () => toast.success('Invoice downloaded'),
		onError: () => toast.error('Failed to download invoice'),
	});

	useEffect(() => {
		if (isError) toast.error('Failed to load invoices');
	}, [isError]);

	const invoices = useMemo(() => invoicesData?.items ?? [], [invoicesData?.items]);
	const filteredInvoices = useMemo(() => {
		if (!searchQuery) return invoices;
		const query = searchQuery.toLowerCase();
		return invoices.filter(
			(invoice) =>
				invoice.invoice_number?.toLowerCase().includes(query) ||
				invoice.invoice_status?.toLowerCase().includes(query) ||
				invoice.payment_status?.toLowerCase().includes(query),
		);
	}, [invoices, searchQuery]);

	const openInvoiceDownload = (invoice: Invoice) => {
		setDownloadTarget(invoice);
		setIsDownloadDialogOpen(true);
	};

	const busyDownloadInvoiceId = isDownloading || isCsvExportPending ? (downloadTarget?.id ?? null) : null;

	if (isLoading) {
		return (
			<div className='space-y-6'>
				<div className='h-10 bg-zinc-100 animate-pulse rounded-md'></div>
				<Card
					className='rounded-xl p-4'
					style={{ backgroundColor: 'var(--portal-surface, white)', border: '1px solid var(--portal-border, #E9E9E9)' }}>
					<div className='animate-pulse space-y-3'>
						{[1, 2, 3, 4].map((i) => (
							<div key={i} className='h-12 bg-zinc-100 rounded'></div>
						))}
					</div>
				</Card>
			</div>
		);
	}

	const currency = invoices[0]?.currency || 'USD';
	const currencySymbol = getCurrencySymbol(currency);

	if (invoices.length === 0) {
		return (
			<Card
				className='rounded-xl p-6'
				style={{ backgroundColor: 'var(--portal-surface, white)', border: '1px solid var(--portal-border, #E9E9E9)' }}>
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
				isPdfPending={isDownloading}
				isCsvPending={isCsvExportPending}
				onSelectPdf={async () => {
					if (!downloadTarget) return;
					await downloadPdfAsync(downloadTarget.id);
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
			{/* Search — styled to match portal surface when themed */}
			<div className='relative'>
				<Search
					className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4'
					style={{ color: 'var(--portal-text-secondary, #a1a1aa)' }}
				/>
				<input
					type='text'
					placeholder='Search invoices...'
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className='w-full pl-10 pr-4 py-2.5 text-sm rounded-lg outline-none focus:ring-1 transition-colors'
					style={{
						backgroundColor: 'var(--portal-surface, white)',
						border: '1px solid var(--portal-border, #E9E9E9)',
						color: 'var(--portal-text-primary, #09090b)',
					}}
				/>
			</div>

			<Card
				className='rounded-xl overflow-hidden'
				style={{ backgroundColor: 'var(--portal-surface, white)', border: '1px solid var(--portal-border, #E9E9E9)' }}>
				<InvoicesTable
					invoices={filteredInvoices}
					currencySymbol={currencySymbol}
					onOpenDownloadFormat={openInvoiceDownload}
					downloadPendingId={busyDownloadInvoiceId}
					hasTheme={hasTheme}
				/>
			</Card>
		</div>
	);
};

export default InvoicesWidget;
