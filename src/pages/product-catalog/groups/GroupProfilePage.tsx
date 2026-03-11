import { Outlet, useNavigate, useParams, useLocation } from 'react-router';
import { useEffect, useState } from 'react';
import { useBreadcrumbsStore } from '@/store';
import { useQuery } from '@tanstack/react-query';
import { GroupApi } from '@/api/GroupApi';
import { Loader, Page } from '@/components/atoms';
import { cn } from '@/lib/utils';
import { ApiDocsContent } from '@/components/molecules';
import GroupHeader from '@/pages/product-catalog/groups/GroupHeader';
import { RouteNames } from '@/core/routes/Routes';

const tabs = [
	{ id: '', label: 'Overview' },
	{ id: 'information', label: 'Information' },
] as const;

type TabId = (typeof tabs)[number]['id'];

const getActiveTab = (pathTabId: string): TabId => {
	const validTabId = tabs.find((tab) => tab.id === pathTabId);
	return validTabId ? validTabId.id : '';
};

const GroupProfilePage = () => {
	const { id: groupId } = useParams();
	const location = useLocation();
	const [activeTab, setActiveTab] = useState<TabId>(tabs[0]?.id);
	const navigate = useNavigate();

	const { data: group, isLoading } = useQuery({
		queryKey: ['fetchGroupDetails', groupId],
		queryFn: async () => await GroupApi.getGroupById(groupId!),
		enabled: !!groupId,
	});

	const { updateBreadcrumb, setSegmentLoading } = useBreadcrumbsStore();

	useEffect(() => {
		const pathSegments = location.pathname.split('/').filter(Boolean);
		const pathTabId = pathSegments[pathSegments.length - 1];
		const isTabSegment = tabs.some((t) => t.id === pathTabId);
		const newActiveTab = isTabSegment ? getActiveTab(pathTabId) : '';
		setActiveTab(newActiveTab);
	}, [location.pathname]);

	useEffect(() => {
		if (activeTab !== '') {
			setSegmentLoading(3, true);
		}
		const activeTabData = tabs.find((tab) => tab.id === activeTab);
		setSegmentLoading(2, true);
		if (activeTab !== '' && activeTabData) {
			updateBreadcrumb(3, activeTabData.label);
		}
		if (group?.name) {
			updateBreadcrumb(2, group.name);
		}
	}, [activeTab, updateBreadcrumb, setSegmentLoading, group]);

	const onTabChange = (tabId: TabId) => {
		const base = `${RouteNames.groups}/${groupId}`;
		navigate(tabId ? `${base}/${tabId}` : base);
	};

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

	return (
		<Page className='space-y-6'>
			<ApiDocsContent tags={['Groups']} />
			<GroupHeader groupId={groupId!} />

			<div className='border-b border-border mt-4 mb-6'>
				<nav className='flex space-x-4' aria-label='Tabs'>
					{tabs.map((tab, index) => (
						<button
							key={tab.id}
							onClick={() => onTabChange(tab.id)}
							className={cn(
								'px-4 py-2 text-sm font-normal transition-colors focus-visible:outline-none',
								index === 0 && 'px-0',
								activeTab === tab.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
							)}
							role='tab'
							aria-selected={activeTab === tab.id}>
							{tab.label}
						</button>
					))}
				</nav>
			</div>
			<Outlet />
		</Page>
	);
};

export default GroupProfilePage;
