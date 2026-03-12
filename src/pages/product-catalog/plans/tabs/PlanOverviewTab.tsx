import { useEffect } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { PlanPriceTable } from '@/components/organisms';
import { PlanApi } from '@/api';
import { refetchQueries } from '@/core/services/tanstack/ReactQueryProvider';
import { Loader } from '@/components/atoms';
import toast from 'react-hot-toast';

const PlanOverviewTab = () => {
	const { planId } = useParams<{ planId: string }>();

	const {
		data: planData,
		isLoading: isPlanLoading,
		isError: isPlanError,
	} = useQuery({
		queryKey: ['fetchPlan', planId],
		queryFn: async () => {
			return await PlanApi.getPlanById(planId!);
		},
		enabled: !!planId,
	});

	useEffect(() => {
		if (isPlanError) {
			toast.error('Error loading plan data');
		}
	}, [isPlanError]);

	if (isPlanLoading) {
		return <Loader />;
	}

	if (isPlanError || !planData) {
		return null;
	}

	return (
		<div className='space-y-6'>
			<PlanPriceTable
				plan={planData}
				onPriceUpdate={() => {
					refetchQueries(['fetchPlan', planId!]);
					refetchQueries(['planChargesSearch', planId!]);
				}}
			/>
		</div>
	);
};

export default PlanOverviewTab;
