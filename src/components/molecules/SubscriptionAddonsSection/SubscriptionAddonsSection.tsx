import { FC, useState, useMemo, useCallback, ReactNode } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { Button, Card, CardHeader, Chip, Dialog, AddButton, Tooltip, NoDataCard } from '@/components/atoms';
import { FlexpriceTable, ColumnData } from '@/components/molecules';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { BsThreeDotsVertical } from 'react-icons/bs';
import SubscriptionApi from '@/api/SubscriptionApi';
import { ADDON_TYPE } from '@/models/Addon';
import { ADDON_ASSOCIATION_STATUS } from '@/models/AddonAssociation';
import { AddonAssociationResponse } from '@/types/dto/Subscription';
import { toSentenceCase } from '@/utils/common/helper_functions';
import { Price, PRICE_TYPE } from '@/models/Price';
import { getCurrentPriceAmount } from '@/utils/common/price_override_helpers';
import { getTotalPayableTextWithCoupons } from '@/utils/common/helper_functions';
import toast from 'react-hot-toast';
import AddAddonDialog from './AddAddonDialog';
import { formatDateTimeWithSecondsAndTimezone } from '@/utils/common/format_date';

interface SubscriptionAddonsSectionProps {
	subscriptionId: string;
}

const getAddonTypeChip = (type: string) => {
	switch (type.toLowerCase()) {
		case ADDON_TYPE.ONETIME:
			return <Chip textColor='#4B5563' bgColor='#F3F4F6' label={toSentenceCase(type)} className='text-xs' />;
		case ADDON_TYPE.MULTIPLE:
		case ADDON_TYPE.MULTIPLE_INSTANCE:
			return <Chip textColor='#1E40AF' bgColor='#DBEAFE' label={toSentenceCase(type)} className='text-xs' />;
		default:
			return <Chip textColor='#6B7280' bgColor='#F9FAFB' label={toSentenceCase(type)} className='text-xs' />;
	}
};

const formatAddonCharges = (prices: Price[] = []): string => {
	if (!prices || prices.length === 0) return '--';

	const recurringPrices = prices.filter((p) => p.type === PRICE_TYPE.FIXED);
	const usagePrices = prices.filter((p) => p.type === PRICE_TYPE.USAGE);

	const hasUsage = usagePrices.length > 0;

	if (recurringPrices.length === 0) {
		return hasUsage ? 'Depends on usage' : '--';
	}

	// Calculate total recurring amount
	const recurringTotal = recurringPrices.reduce((acc, charge) => {
		const currentAmount = getCurrentPriceAmount(charge, {});
		return acc + parseFloat(currentAmount);
	}, 0);

	// Use the same helper as Preview component for consistent display
	return getTotalPayableTextWithCoupons(recurringPrices, usagePrices, recurringTotal, []);
};

type AddonStatus = `${ADDON_ASSOCIATION_STATUS}`;

const getStatusVariant = (status: AddonStatus): 'info' | 'default' | 'success' => {
	switch (status) {
		case 'upcoming':
		case 'pending':
		case 'scheduled':
			return 'info';
		case 'inactive':
		case 'cancelled':
			return 'default';
		case 'active':
		default:
			return 'success';
	}
};

const formatAddonAssociationTooltip = (association: AddonAssociationResponse): ReactNode => {
	const { start_date, end_date } = association;
	const items: ReactNode[] = [];

	if (start_date && start_date.trim() !== '') {
		const parsed = new Date(start_date);
		if (!isNaN(parsed.getTime())) {
			items.push(
				<div key='start' className='flex items-center gap-2'>
					<span className='text-xs font-medium text-gray-500'>Start</span>
					<span className='text-sm font-medium'>{formatDateTimeWithSecondsAndTimezone(parsed)}</span>
				</div>,
			);
		}
	}

	if (end_date && end_date.trim() !== '') {
		const parsed = new Date(end_date);
		if (!isNaN(parsed.getTime())) {
			items.push(
				<div key='end' className='flex items-center gap-2'>
					<span className='text-xs font-medium text-gray-500'>End</span>
					<span className='text-sm font-medium'>{formatDateTimeWithSecondsAndTimezone(parsed)}</span>
				</div>,
			);
		}
	}

	if (items.length === 0) {
		return <span className='text-sm'>No date information</span>;
	}

	return <div className='flex flex-col gap-2'>{items}</div>;
};

interface AddonAssociationWithStatus extends AddonAssociationResponse {
	precomputedStatus: AddonStatus;
	statusVariant: 'info' | 'default' | 'success';
	statusLabel: string;
	tooltipContent: ReactNode;
}

const computeAssociationStatus = (association: AddonAssociationResponse): AddonStatus => {
	const raw = association.addon_status?.toLowerCase() as AddonStatus | undefined;
	if (
		raw === ADDON_ASSOCIATION_STATUS.CANCELLED ||
		raw === ADDON_ASSOCIATION_STATUS.INACTIVE ||
		raw === ADDON_ASSOCIATION_STATUS.ACTIVE ||
		raw === ADDON_ASSOCIATION_STATUS.UPCOMING ||
		raw === ADDON_ASSOCIATION_STATUS.PENDING ||
		raw === ADDON_ASSOCIATION_STATUS.SCHEDULED
	) {
		return raw;
	}

	// Fallback to date-based computation
	const now = new Date();
	if (association.start_date && association.start_date.trim() !== '') {
		const start = new Date(association.start_date);
		if (!isNaN(start.getTime()) && start > now) return 'upcoming';
	}
	if (association.end_date && association.end_date.trim() !== '') {
		const end = new Date(association.end_date);
		if (!isNaN(end.getTime()) && end < now) return 'inactive';
	}
	return 'active';
};

const SubscriptionAddonsSection: FC<SubscriptionAddonsSectionProps> = ({ subscriptionId }) => {
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [addonToDelete, setAddonToDelete] = useState<AddonAssociationResponse | null>(null);
	const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
	const queryClient = useQueryClient();

	// Fetch subscription details (for billing_period + currency context)
	const { data: subscriptionDetails } = useQuery({
		queryKey: ['subscriptionDetails', subscriptionId],
		queryFn: async () => {
			return await SubscriptionApi.getSubscription(subscriptionId);
		},
		enabled: !!subscriptionId,
	});

	// Fetch active addons (backend returns { items, pagination })
	const {
		data: addonAssociationsResponse,
		isLoading,
		isError,
	} = useQuery({
		queryKey: ['subscriptionActiveAddons', subscriptionId],
		queryFn: async () => {
			return await SubscriptionApi.getActiveAddons(subscriptionId);
		},
		enabled: !!subscriptionId,
		retry: false,
		refetchOnWindowFocus: false,
	});

	// Normalize response to always be an array for rendering
	const addonAssociations = useMemo<AddonAssociationResponse[]>(() => {
		if (!addonAssociationsResponse) return [];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const response = addonAssociationsResponse as any;
		return response.items ?? response ?? [];
	}, [addonAssociationsResponse]);

	const processedAddonAssociations = useMemo<AddonAssociationWithStatus[]>(() => {
		return addonAssociations.map((association) => {
			const status = computeAssociationStatus(association);
			const statusVariant = getStatusVariant(status);
			const statusLabel = toSentenceCase(status || 'active');
			const tooltipContent = formatAddonAssociationTooltip(association);

			return {
				...association,
				precomputedStatus: status,
				statusVariant,
				statusLabel,
				tooltipContent,
			};
		});
	}, [addonAssociations]);

	const addonNameToDelete = useMemo(() => {
		if (!addonToDelete) return 'this addon';
		return addonAssociations.find((a) => a.id === addonToDelete.id)?.addon?.name || 'this addon';
	}, [addonToDelete, addonAssociations]);

	// Delete addon mutation
	const { mutate: deleteAddon, isPending: isDeletingAddon } = useMutation({
		mutationFn: async (addonAssociationId: string) => {
			return await SubscriptionApi.removeAddonFromSubscription({
				addon_association_id: addonAssociationId,
			});
		},
		onSuccess: () => {
			toast.success('Addon removed successfully');
			queryClient.invalidateQueries({ queryKey: ['subscriptionActiveAddons', subscriptionId] });
			queryClient.invalidateQueries({ queryKey: ['subscriptionDetails', subscriptionId] });
			setIsDeleteDialogOpen(false);
			setAddonToDelete(null);
		},
		onError: (error: any) => {
			toast.error(error?.error?.message || 'Failed to remove addon');
		},
	});

	const handleDelete = useCallback((addon: AddonAssociationResponse) => {
		setDropdownOpen(null);
		setAddonToDelete(addon);
		setIsDeleteDialogOpen(true);
	}, []);

	const confirmDelete = useCallback(() => {
		if (!addonToDelete) return;
		deleteAddon(addonToDelete.id);
	}, [addonToDelete, deleteAddon]);

	const cancelDelete = useCallback(() => {
		setIsDeleteDialogOpen(false);
		setAddonToDelete(null);
	}, []);

	const columns: ColumnData<AddonAssociationWithStatus>[] = useMemo(
		() => [
			{
				title: 'Name',
				render: (row) => <span>{row.addon?.name || row.addon_id}</span>,
			},
			{
				title: 'Type',
				render: (row) => (row.addon ? getAddonTypeChip(row.addon.type) : '--'),
			},
			{
				title: 'Status',
				render: (row) => (
					<Tooltip
						content={row.tooltipContent}
						delayDuration={0}
						sideOffset={5}
						className='bg-white border border-gray-200 shadow-lg text-sm text-gray-900 px-4 py-3 rounded-lg max-w-[320px]'>
						<span>
							<Chip label={row.statusLabel} variant={row.statusVariant} />
						</span>
					</Tooltip>
				),
			},
			{
				title: 'Charges',
				render: (row) => {
					const prices = row.addon?.prices || [];
					return <span>{formatAddonCharges(prices)}</span>;
				},
			},
			{
				title: '',
				width: '30px',
				fieldVariant: 'interactive',
				hideOnEmpty: true,
				render: (row) => (
					<div
						data-interactive='true'
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
						}}>
						<DropdownMenu open={dropdownOpen === row.id} onOpenChange={(open) => setDropdownOpen(open ? row.id : null)}>
							<DropdownMenuTrigger asChild>
								<button className='focus:outline-none'>
									<BsThreeDotsVertical className='text-base text-muted-foreground hover:text-foreground transition-colors' />
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align='end'>
								<DropdownMenuItem
									onSelect={(e) => {
										e.preventDefault();
										handleDelete(row);
									}}
									className='flex gap-2 items-center cursor-pointer text-red-600'>
									<Trash2 className='h-4 w-4' />
									<span>Delete</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				),
			},
		],
		[dropdownOpen, handleDelete],
	);

	if (isLoading) {
		return (
			<Card variant='notched'>
				<CardHeader title='Addons' cta={<AddButton onClick={() => setIsAddDialogOpen(true)} />} />
				<div className='flex justify-center items-center py-8'>
					<span className='text-gray-500'>Loading addons...</span>
				</div>
			</Card>
		);
	}

	if (isError) {
		return null;
	}

	return (
		<>
			{processedAddonAssociations.length > 0 ? (
				<Card variant='notched'>
					<CardHeader title='Addons' cta={<AddButton onClick={() => setIsAddDialogOpen(true)} />} />
					<FlexpriceTable showEmptyRow data={processedAddonAssociations} columns={columns} variant='no-bordered' />
				</Card>
			) : (
				<NoDataCard
					title='Addons'
					subtitle='No addons added to this subscription yet'
					cta={<AddButton onClick={() => setIsAddDialogOpen(true)} />}
				/>
			)}

			{/* Add Addon Dialog */}
			<AddAddonDialog
				isOpen={isAddDialogOpen}
				onOpenChange={setIsAddDialogOpen}
				subscriptionId={subscriptionId}
				existingAddons={addonAssociations.map((a) => a.addon).filter((addon): addon is NonNullable<typeof addon> => Boolean(addon))}
				billingPeriod={subscriptionDetails?.billing_period}
				currency={subscriptionDetails?.currency}
			/>

			{/* Delete Confirmation Dialog */}
			<Dialog
				title={`Are you sure you want to delete the addon "${addonNameToDelete}"?`}
				description='This action cannot be undone.'
				titleClassName='text-lg font-normal text-gray-800'
				isOpen={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
				showCloseButton={false}>
				<div className='flex flex-col gap-4 items-end justify-center'>
					<div className='flex gap-4'>
						<Button variant='outline' onClick={cancelDelete} disabled={isDeletingAddon}>
							Cancel
						</Button>
						<Button variant='destructive' onClick={confirmDelete} disabled={isDeletingAddon}>
							{isDeletingAddon ? 'Deleting...' : 'Delete'}
						</Button>
					</div>
				</div>
			</Dialog>
		</>
	);
};

export default SubscriptionAddonsSection;
