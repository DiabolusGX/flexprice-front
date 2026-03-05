import { AddButton, Page, ActionButton, Chip } from '@/components/atoms';
import { ApiDocsContent, GroupDrawer } from '@/components/molecules';
import { ColumnData } from '@/components/molecules/Table';
import { QueryableDataArea } from '@/components/organisms';
import { Group } from '@/models/Group';
import { GROUP_ENTITY_TYPE } from '@/models/Group';
import { ENTITY_STATUS } from '@/models';
import GUIDES from '@/constants/guides';
import { useState, useMemo } from 'react';
import { GroupApi } from '@/api/GroupApi';
import {
	FilterField,
	FilterFieldType,
	DEFAULT_OPERATORS_PER_DATA_TYPE,
	DataType,
	FilterOperator,
	SortOption,
	SortDirection,
	FilterCondition,
} from '@/types/common/QueryBuilder';
import formatDate from '@/utils/common/format_date';
import formatChips from '@/utils/common/format_chips';

const sortingOptions: SortOption[] = [
	{ field: 'name', label: 'Name', direction: SortDirection.ASC },
	{ field: 'created_at', label: 'Created At', direction: SortDirection.DESC },
	{ field: 'updated_at', label: 'Updated At', direction: SortDirection.DESC },
];

const filterOptions: FilterField[] = [
	{
		field: 'name',
		label: 'Name',
		fieldType: FilterFieldType.INPUT,
		operators: DEFAULT_OPERATORS_PER_DATA_TYPE[DataType.STRING],
		dataType: DataType.STRING,
	},
	{
		field: 'lookup_key',
		label: 'Lookup Key',
		fieldType: FilterFieldType.INPUT,
		operators: DEFAULT_OPERATORS_PER_DATA_TYPE[DataType.STRING],
		dataType: DataType.STRING,
	},
	{
		field: 'status',
		label: 'Status',
		fieldType: FilterFieldType.MULTI_SELECT,
		operators: [FilterOperator.IN, FilterOperator.NOT_IN],
		dataType: DataType.ARRAY,
		options: [
			{ value: ENTITY_STATUS.PUBLISHED, label: 'Active' },
			{ value: ENTITY_STATUS.ARCHIVED, label: 'Inactive' },
		],
	},
	{
		field: 'created_at',
		label: 'Created At',
		fieldType: FilterFieldType.DATEPICKER,
		operators: DEFAULT_OPERATORS_PER_DATA_TYPE[DataType.DATE],
		dataType: DataType.DATE,
	},
];

const initialFilters: FilterCondition[] = [
	{
		field: 'name',
		operator: FilterOperator.CONTAINS,
		valueString: '',
		dataType: DataType.STRING,
		id: 'initial-name',
	},
	{
		field: 'lookup_key',
		operator: FilterOperator.CONTAINS,
		valueString: '',
		dataType: DataType.STRING,
		id: 'initial-lookup_key',
	},
	{
		field: 'status',
		operator: FilterOperator.IN,
		valueArray: [ENTITY_STATUS.PUBLISHED],
		dataType: DataType.ARRAY,
		id: 'initial-status',
	},
];

const initialSorts: SortOption[] = [{ field: 'updated_at', label: 'Updated At', direction: SortDirection.DESC }];

const GroupsPage = () => {
	const [activeGroup, setActiveGroup] = useState<Group | null>(null);
	const [groupDrawerOpen, setGroupDrawerOpen] = useState(false);

	const handleOnAdd = () => {
		setActiveGroup(null);
		setGroupDrawerOpen(true);
	};

	const handleEdit = (group: Group) => {
		setActiveGroup(group);
		setGroupDrawerOpen(true);
	};

	const columns: ColumnData<Group>[] = useMemo(
		() => [
			{ fieldName: 'name', title: 'Name' },
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
						edit={{ onClick: () => handleEdit(row) }}
						archive={{ enabled: row.status === ENTITY_STATUS.PUBLISHED }}
					/>
				),
			},
		],
		[],
	);

	return (
		<Page heading='Groups' headingCTA={<AddButton onClick={handleOnAdd} />}>
			<GroupDrawer data={activeGroup} open={groupDrawerOpen} onOpenChange={setGroupDrawerOpen} refetchQueryKeys={['fetchGroups']} />
			<ApiDocsContent tags={['Groups']} />
			<div className='space-y-6'>
				<QueryableDataArea<Group>
					queryConfig={{
						filterOptions,
						sortOptions: sortingOptions,
						initialFilters,
						initialSorts,
						debounceTime: 300,
					}}
					dataConfig={{
						queryKey: 'fetchGroups',
						fetchFn: async (params) => {
							const response = await GroupApi.getGroupsByFilter({
								entity_type: GROUP_ENTITY_TYPE.PRICE,
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
						probeFetchFn: async (_params) => {
							const response = await GroupApi.getGroupsByFilter({
								entity_type: GROUP_ENTITY_TYPE.PRICE,
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
					}}
					paginationConfig={{ unit: 'Groups' }}
					emptyStateConfig={{
						heading: 'Groups',
						description: 'Create a group to organize your pricing entities.',
						buttonLabel: 'Create Group',
						buttonAction: handleOnAdd,
						tags: ['Groups'],
						tutorials: GUIDES.plans.tutorials,
					}}
				/>
			</div>
		</Page>
	);
};

export default GroupsPage;
