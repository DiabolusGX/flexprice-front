import React from 'react';
import { Mail, CalendarDays } from 'lucide-react';
import { Dialog } from '@/components/atoms';

const SLACK_LINK = 'https://join.slack.com/t/flexpricecommunity/shared_invite/zt-39uat51l0-n8JmSikHZP~bHJNXladeaQ';
const EMAIL_LINK = 'mailto:support@flexprice.io';
const CALENDLY_LINK = 'https://calendly.com/nikhil-flexprice/30min';

const openExternal = (url: string) => {
	window.open(url, '_blank', 'noopener noreferrer');
};

interface ContactUsDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	title?: string;
	description?: string;
}

const ContactUsDialog: React.FC<ContactUsDialogProps> = ({
	isOpen,
	onOpenChange,
	title = 'Contact us',
	description = 'Reach out to continue or get help.',
}) => {
	return (
		<Dialog isOpen={isOpen} onOpenChange={onOpenChange} title={title} className='max-w-[550px]' description={description}>
			<div className='flex gap-8 justify-center items-center px-4 pt-2'>
				<button
					type='button'
					onClick={() => openExternal(SLACK_LINK)}
					className='flex flex-col items-center gap-2 group transition-transform duration-300 ease-in-out hover:scale-[1.03]'
					aria-label='Contact Slack'>
					<div
						className='h-14 w-14 rounded-xl flex items-center justify-center shadow-sm transition-shadow duration-300 ease-in-out group-hover:shadow-md'
						style={{ backgroundColor: '#4A154B' }}>
						<img src='/assets/logo/slack-logo.png' alt='Slack' className='h-7 w-7 object-contain' />
					</div>
					<span className='text-xs font-medium text-gray-700 group-hover:text-[#4A154B] transition-colors duration-300 ease-in-out'>
						Slack
					</span>
				</button>
				<button
					type='button'
					onClick={() => openExternal(EMAIL_LINK)}
					className='flex flex-col items-center gap-2 group transition-transform duration-300 ease-in-out hover:scale-[1.03]'
					aria-label='Contact Email'>
					<div
						className='h-14 w-14 rounded-xl flex items-center justify-center shadow-sm transition-shadow duration-300 ease-in-out group-hover:shadow-md'
						style={{ backgroundColor: '#E5E7EB' }}>
						<Mail className='h-7 w-7 text-gray-700' strokeWidth={1.5} />
					</div>
					<span className='text-xs font-medium text-gray-700 group-hover:text-gray-900 transition-colors duration-300 ease-in-out'>
						Email
					</span>
				</button>
				<button
					type='button'
					onClick={() => openExternal(CALENDLY_LINK)}
					className='flex flex-col items-center gap-2 group transition-transform duration-300 ease-in-out hover:scale-[1.03]'
					aria-label='Book a call'>
					<div
						className='h-14 w-14 rounded-xl flex items-center justify-center shadow-sm transition-shadow duration-300 ease-in-out group-hover:shadow-md'
						style={{ backgroundColor: '#0069FF' }}>
						<CalendarDays className='h-7 w-7 text-white' strokeWidth={1.5} />
					</div>
					<span className='text-xs font-medium text-gray-700 group-hover:text-[#0069FF] transition-colors duration-300 ease-in-out'>
						Book a call
					</span>
				</button>
			</div>
		</Dialog>
	);
};

export default ContactUsDialog;
