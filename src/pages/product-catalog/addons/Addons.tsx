import { AddButton, Page, ActionButton, Chip } from '@/components/atoms';
import { ApiDocsContent, AddonDrawer } from '@/components/molecules';
import { ColumnData } from '@/components/molecules/Table';
import { QueryableDataArea } from '@/components/organisms';
import Addon from '@/models/Addon';
import GUIDES from '@/constants/guides';
import { useState, useMemo } from 'react';
import AddonApi from '@/api/AddonApi';
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
import { ENTITY_STATUS } from '@/models';
import { useNavigate } from 'react-router';
import { RouteNames } from '@/core/routes/Routes';
import formatChips from '@/utils/common/format_chips';
import formatDate from '@/utils/common/format_date';

const sortingOptions: SortOption[] = [
	{
		field: 'name',
		label: 'Name',
		direction: SortDirection.ASC,
	},
	{
		field: 'created_at',
		label: 'Created At',
		direction: SortDirection.DESC,
	},
	{
		field: 'updated_at',
		label: 'Updated At',
		direction: SortDirection.DESC,
	},
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
		field: 'created_at',
		label: 'Created At',
		fieldType: FilterFieldType.DATEPICKER,
		operators: DEFAULT_OPERATORS_PER_DATA_TYPE[DataType.DATE],
		dataType: DataType.DATE,
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
		field: 'status',
		operator: FilterOperator.IN,
		valueArray: [ENTITY_STATUS.PUBLISHED],
		dataType: DataType.ARRAY,
		id: 'initial-status',
	},
];

const initialSorts: SortOption[] = [
	{
		field: 'updated_at',
		label: 'Updated At',
		direction: SortDirection.DESC,
	},
];

const AddonsPage = () => {
	const [activeAddon, setActiveAddon] = useState<Addon | null>(null);
	const [addonDrawerOpen, setAddonDrawerOpen] = useState(false);
	const navigate = useNavigate();

	const handleOnAdd = () => {
		setActiveAddon(null);
		setAddonDrawerOpen(true);
	};

	const handleEdit = (addon: Addon) => {
		setActiveAddon(addon);
		setAddonDrawerOpen(true);
	};

	const columns: ColumnData<Addon>[] = useMemo(
		() => [
			{
				fieldName: 'name',
				title: 'Addon Name',
			},
			{
				fieldName: 'lookup_key',
				title: 'Lookup Key',
			},
			{
				title: 'Status',
				render: (row) => {
					const label = formatChips(row?.status);
					return <Chip variant={label === 'Active' ? 'success' : 'default'} label={label} />;
				},
			},
			{
				title: 'Updated At',
				render: (row) => {
					return formatDate(row?.updated_at);
				},
			},
			{
				fieldVariant: 'interactive',
				render(row) {
					return (
						<ActionButton
							id={row?.id}
							deleteMutationFn={async () => {
								return await AddonApi.Delete(row?.id);
							}}
							refetchQueryKey='fetchAddons'
							entityName={row?.name}
							edit={{
								enabled: false,
								onClick: () => handleEdit(row),
							}}
							archive={{
								enabled: row?.status !== ENTITY_STATUS.ARCHIVED,
							}}
						/>
					);
				},
			},
		],
		[],
	);

	return (
		<Page heading='Addons' headingCTA={<AddButton onClick={handleOnAdd} />}>
			<AddonDrawer data={activeAddon} open={addonDrawerOpen} onOpenChange={setAddonDrawerOpen} refetchQueryKeys={['fetchAddons']} />
			<ApiDocsContent tags={['Addons']} />
			<div className='space-y-6'>
				<QueryableDataArea<Addon>
					queryConfig={{
						filterOptions,
						sortOptions: sortingOptions,
						initialFilters,
						initialSorts,
						debounceTime: 500,
					}}
					dataConfig={{
						queryKey: 'fetchAddons',
						fetchFn: async (params) => AddonApi.ListByFilter(params),
						probeFetchFn: async (params) =>
							AddonApi.ListByFilter({
								...params,
								limit: 1,
								offset: 0,
								filters: [],
								sort: [],
							}),
					}}
					tableConfig={{
						columns,
						onRowClick: (row) => {
							navigate(RouteNames.addonDetails + `/${row?.id}`);
						},
						showEmptyRow: true,
					}}
					paginationConfig={{
						unit: 'Addons',
					}}
					emptyStateConfig={{
						heading: 'Addons',
						description: 'Create your first addon to define additional services customers can purchase.',
						buttonLabel: 'Create Addon',
						buttonAction: handleOnAdd,
						tags: ['Addons'],
						tutorials: GUIDES.addons.tutorials,
					}}
				/>
			</div>
		</Page>
	);
};
export default AddonsPage;
