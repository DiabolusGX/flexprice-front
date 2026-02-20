import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useEnvironment } from '@/hooks/useEnvironment';
import { useRestrictedEnvs, EnvRestrictionState } from '@/hooks/useRestrictedEnvs';
import { ENVIRONMENT_TYPE } from '@/models/Environment';
import ContactUsDialog from '../ContactUsDialog/ContactUsDialog';

function daysLeft(expiresAt: string): number {
	return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

const RestrictedEnvBanner: React.FC = () => {
	const { activeEnvironment } = useEnvironment();
	const { getRestriction } = useRestrictedEnvs();
	const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);

	const envId = activeEnvironment?.id ?? '';
	const isProduction = activeEnvironment?.type === ENVIRONMENT_TYPE.PRODUCTION;
	const restriction = getRestriction(envId);

	if (restriction.state === EnvRestrictionState.Active) {
		return null;
	}

	const envLabel = isProduction ? 'production account' : 'sandbox';

	if (restriction.state === EnvRestrictionState.GracePeriod && restriction.expiresAt) {
		const days = daysLeft(restriction.expiresAt);
		return (
			<>
				<div className='w-full flex items-center justify-center border-b border-sky-200/80 bg-[#E0F2F7] px-4 py-2'>
					<span className='text-sm text-slate-700'>
						Your {envLabel} is active for the next {days} day{days !== 1 ? 's' : ''}. To continue using,{' '}
						<button
							type='button'
							onClick={() => setIsContactDialogOpen(true)}
							className='inline-flex items-center gap-1 text-slate-800 underline decoration-slate-500/60 hover:decoration-slate-700'>
							talk to us
							<ExternalLink className='h-3.5 w-3.5 shrink-0' aria-hidden />
						</button>
						.
					</span>
				</div>
				<ContactUsDialog isOpen={isContactDialogOpen} onOpenChange={setIsContactDialogOpen} />
			</>
		);
	}

	// Suspended
	return (
		<>
			<div className='w-full flex items-center justify-center border-b border-red-200/80 bg-[#FEF2F2] px-4 py-2'>
				<span className='text-sm text-red-900/90'>
					Your {envLabel} is temporarily closed. To continue,{' '}
					<button
						type='button'
						onClick={() => setIsContactDialogOpen(true)}
						className='inline-flex items-center gap-1 text-red-900 underline decoration-red-400/70 hover:decoration-red-600'>
						contact us
						<ExternalLink className='h-3.5 w-3.5 shrink-0' aria-hidden />
					</button>
					.
				</span>
			</div>
			<ContactUsDialog isOpen={isContactDialogOpen} onOpenChange={setIsContactDialogOpen} />
		</>
	);
};

export default RestrictedEnvBanner;
