import { AddButton, Page, ActionButton, Chip } from '@/components/atoms';
import { ApiDocsContent, GroupDrawer } from '@/components/molecules';
import { ColumnData } from '@/components/molecules/Table';
import { QueryableDataArea } from '@/components/organisms';
import { useNavigate } from 'react-router';
import { RouteNames } from '@/core/routes/Routes';
import { Group } from '@/models/Group';
import { getGroupEntityTypeLabel } from '@/models/Group';
import { ENTITY_STATUS } from '@/models';
import GUIDES from '@/constants/guides';
import { useState, useMemo } from 'react';
import { GroupApi } from '@/api/GroupApi';
import formatDate from '@/utils/common/format_date';
import formatChips from '@/utils/common/format_chips';
import {
	groupsFilterOptions,
	groupsSortOptions,
	groupsInitialFilters,
	groupsInitialSorts,
} from '@/pages/product-catalog/groups/groupsQueryConfig';

const GroupsPage = () => {
	const navigate = useNavigate();
	const [groupDrawerOpen, setGroupDrawerOpen] = useState(false);

	const handleOnAdd = () => {
		setGroupDrawerOpen(true);
	};

	const columns: ColumnData<Group>[] = useMemo(
		() => [
			{ fieldName: 'name', title: 'Name' },
			{
				title: 'Type',
				render: (row) => getGroupEntityTypeLabel(row.entity_type ?? ''),
			},
			{
				title: 'Status',
				render: (row) => {
					const label = formatChips(row.status);
					return <Chip variant={label === 'Active' ? 'success' : 'default'} label={label} />;
				},
			},
			{
				title: 'Updated at',
				render: (row) => formatDate(row.updated_at),
			},
			{
				fieldVariant: 'interactive',
				render: (row) => (
					<ActionButton
						id={row.id}
						deleteMutationFn={(id) => GroupApi.deleteGroup(id)}
						refetchQueryKey='fetchGroups'
						entityName='Group'
						edit={{ enabled: false }}
						archive={{ enabled: row.status === ENTITY_STATUS.PUBLISHED }}
					/>
				),
			},
		],
		[],
	);

	return (
		<Page heading='Groups' headingCTA={<AddButton onClick={handleOnAdd} />}>
			<GroupDrawer data={null} open={groupDrawerOpen} onOpenChange={setGroupDrawerOpen} refetchQueryKeys={['fetchGroups']} />
			<ApiDocsContent tags={['Groups']} />
			<div className='space-y-6'>
				<QueryableDataArea<Group>
					queryConfig={{
						filterOptions: groupsFilterOptions,
						sortOptions: groupsSortOptions,
						initialFilters: groupsInitialFilters,
						initialSorts: groupsInitialSorts,
						debounceTime: 300,
					}}
					dataConfig={{
						queryKey: 'fetchGroups',
						fetchFn: async (params) => {
							const response = await GroupApi.getGroupsByFilter({
								limit: params.limit,
								offset: params.offset,
								filters: params.filters ?? [],
								sort: params.sort ?? [],
							});
							return {
								items: response.items as Group[],
								pagination: response.pagination,
							};
						},
						probeFetchFn: async () => {
							const response = await GroupApi.getGroupsByFilter({
								limit: 1,
								offset: 0,
								filters: [],
								sort: [],
							});
							return {
								items: response.items as Group[],
								pagination: response.pagination,
							};
						},
					}}
					tableConfig={{
						columns,
						showEmptyRow: true,
						onRowClick: (row) => navigate(`${RouteNames.groups}/${row.id}`),
					}}
					paginationConfig={{ unit: 'Groups' }}
					emptyStateConfig={{
						heading: 'Groups',
						description: 'Create a group to organize your pricing entities.',
						buttonLabel: 'Create Group',
						buttonAction: handleOnAdd,
						tags: ['Groups'],
						tutorials: GUIDES.groups.tutorials,
					}}
				/>
			</div>
		</Page>
	);
};

export default GroupsPage;
