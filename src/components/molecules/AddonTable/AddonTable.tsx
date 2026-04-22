import { FC } from 'react';
import FlexpriceTable, { ColumnData } from '../Table';
import Addon from '@/models/Addon';
import { ENTITY_STATUS } from '@/models';
import { ActionButton, Chip } from '@/components/atoms';
import formatChips from '@/utils/common/format_chips';
import formatDate from '@/utils/common/format_date';
import { useNavigate } from 'react-router';
import { RouteNames } from '@/core/routes/Routes';
import AddonApi from '@/api/AddonApi';

interface Props {
	data: Addon[];
	onEdit?: (addon: Addon) => void;
}

const AddonTable: FC<Props> = ({ data, onEdit }) => {
	const navigate = useNavigate();

	const columnData: ColumnData<Addon>[] = [
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
							onClick: () => onEdit?.(row),
						}}
						archive={{
							enabled: row?.status !== ENTITY_STATUS.ARCHIVED,
						}}
					/>
				);
			},
		},
	];

	return (
		<div>
			<FlexpriceTable
				data={data}
				columns={columnData}
				showEmptyRow
				onRowClick={(row) => {
					navigate(RouteNames.addonDetails + `/${row?.id}`);
				}}
			/>
		</div>
	);
};

export default AddonTable;
