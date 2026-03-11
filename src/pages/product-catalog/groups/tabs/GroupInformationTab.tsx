import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Spacer, Button, Divider, Loader, Page } from '@/components/atoms';
import { GroupApi } from '@/api/GroupApi';
import { Detail, DetailsCard, MetadataModal } from '@/components/molecules';
import { getTypographyClass } from '@/lib/typography';
import { getGroupEntityTypeLabel } from '@/models/Group';
import { refetchQueries } from '@/core/services/tanstack/ReactQueryProvider';
import { logger } from '@/utils/common/Logger';
import { Pencil } from 'lucide-react';

const filterStringMetadata = (meta: Record<string, unknown> | undefined): Record<string, string> => {
	if (!meta) return {};
	return Object.fromEntries(Object.entries(meta).filter(([_, v]) => typeof v === 'string') as [string, string][]);
};

const GroupInformationTab = () => {
	const { id: groupId } = useParams();

	const { data: group, isLoading } = useQuery({
		queryKey: ['fetchGroupDetails', groupId],
		queryFn: () => GroupApi.getGroupById(groupId!),
		enabled: !!groupId,
	});

	const [showMetadataModal, setShowMetadataModal] = useState(false);
	const [metadata, setMetadata] = useState<Record<string, string>>(filterStringMetadata(group?.metadata ?? undefined));

	useEffect(() => {
		setMetadata(filterStringMetadata(group?.metadata ?? undefined));
	}, [group?.metadata]);

	if (isLoading) {
		return <Loader />;
	}

	if (!group) {
		return (
			<Page heading='Group'>
				<div className='flex items-center justify-center h-64'>
					<p className='text-muted-foreground'>Group not found.</p>
				</div>
			</Page>
		);
	}

	const groupDetails: Detail[] = [
		{
			variant: 'heading',
			label: 'Group Details',
			className: getTypographyClass('card-header') + '!text-[16px]',
		},
		{
			label: 'Name',
			value: group.name || '--',
		},
		{
			label: 'External ID',
			value: group.lookup_key || '--',
		},
		{
			label: 'Entity Type',
			value: getGroupEntityTypeLabel(group.entity_type ?? '') || '--',
		},
	];

	return (
		<div>
			<Spacer className='!h-4' />
			<DetailsCard variant='stacked' data={groupDetails} childrenAtTop cardStyle='borderless' />

			<Divider className='my-4' />

			{/* Metadata Section */}
			<div className='mt-8'>
				<div className='flex justify-between items-center mb-2'>
					<h3 className={getTypographyClass('card-header') + '!text-[16px]'}>Metadata</h3>
					<Button variant='outline' size='icon' onClick={() => setShowMetadataModal(true)}>
						<Pencil className='size-5' />
					</Button>
				</div>
				<DetailsCard
					variant='stacked'
					data={
						metadata && Object.keys(metadata).length > 0
							? Object.entries(metadata).map(([key, value]) => ({ label: key, value }))
							: [{ label: 'No metadata available.', value: '' }]
					}
					cardStyle='borderless'
				/>
			</div>

			<MetadataModal
				open={showMetadataModal}
				data={metadata}
				onSave={async (newMetadata) => {
					if (!groupId) return;
					try {
						const updated = await GroupApi.updateGroup(groupId, { metadata: newMetadata });
						setMetadata(filterStringMetadata(updated.metadata ?? undefined));
						setShowMetadataModal(false);
						refetchQueries(['fetchGroupDetails', groupId]);
					} catch (e) {
						logger.error('Failed to update group metadata', e);
					}
				}}
				onClose={() => setShowMetadataModal(false)}
			/>
		</div>
	);
};

export default GroupInformationTab;
