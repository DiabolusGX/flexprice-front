import { FC, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SearchableSelect, SelectOption } from '@/components/atoms';
import { GroupApi } from '@/api/GroupApi';
import { GROUP_ENTITY_TYPE, Group } from '@/models/Group';
import { DataType } from '@/types/common/QueryBuilder';
import { FilterOperator } from '@/types/common/QueryBuilder';
import { cn } from '@/lib/utils';

interface Props {
	onChange: (group: Group | null) => void;
	value?: string;
	error?: string;
	label?: string;
	placeholder?: string;
	description?: string;
	className?: string;
	entityType?: GROUP_ENTITY_TYPE;
	hiddenIfEmpty?: boolean;
}

const SelectGroup: FC<Props> = ({
	onChange,
	value,
	error,
	label = 'Group',
	placeholder = 'Select a group (optional)',
	description,
	className,
	entityType = GROUP_ENTITY_TYPE.PRICE,
	hiddenIfEmpty = false,
}) => {
	// Build filter to include entity_type so backend receives it in the filters array
	const filterByEntityType = useMemo(
		() => [
			{
				field: 'entity_type',
				operator: FilterOperator.EQUAL as const,
				data_type: DataType.STRING as const,
				value: { string: entityType },
			},
		],
		[entityType],
	);

	// Query for fetching groups
	const {
		data: groupsData,
		isLoading,
		isError,
	} = useQuery({
		queryKey: ['fetchGroups', { entity_type: entityType }],
		queryFn: () =>
			GroupApi.getGroupsByFilter({
				entity_type: entityType,
				limit: 100,
				offset: 0,
				filters: filterByEntityType,
			}),
	});

	const groupOptions: SelectOption[] = useMemo(() => {
		if (!groupsData?.items) return [{ label: 'None', value: '' }];

		return [
			{ label: 'None', value: '' },
			...groupsData.items.map((group: Group) => ({
				label: `${group.name} (${group.lookup_key})`,
				value: group.id,
			})),
		];
	}, [groupsData]);

	// Check if component should be hidden when empty
	const shouldHide = useMemo(() => {
		return hiddenIfEmpty && (!groupsData?.items || groupsData.items.length === 0);
	}, [hiddenIfEmpty, groupsData]);

	const handleGroupChange = useCallback(
		(selectedValue: string) => {
			if (selectedValue === '') {
				onChange(null);
			} else {
				const selectedGroup = groupsData?.items.find((group: Group) => group.id === selectedValue);
				if (selectedGroup) {
					onChange(selectedGroup);
				}
			}
		},
		[onChange, groupsData],
	);

	if (isLoading && !groupsData) {
		return <div className={cn('min-w-[200px]', className)}></div>;
	}

	if (isError && !groupsData) {
		return <div className={cn('min-w-[200px]', className)}></div>;
	}

	// Hide component if hiddenIfEmpty is true and no groups are available
	if (shouldHide) {
		return null;
	}

	return (
		<div className={cn('min-w-[200px]', className)}>
			<SearchableSelect
				error={error}
				value={value || ''}
				onChange={handleGroupChange}
				options={groupOptions}
				placeholder={placeholder}
				label={label}
				description={description}
				searchPlaceholder='Search groups...'
				emptyText='No groups found'
				noOptionsText='No groups available'
			/>
		</div>
	);
};

export default SelectGroup;
