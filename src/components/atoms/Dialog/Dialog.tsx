import { Dialog as ShadcnDialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { FC, ReactNode } from 'react';

interface Props {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	title: string | ReactNode;
	description?: string | ReactNode;
	children?: ReactNode;
	className?: string;
	titleClassName?: string;
	descriptionClassName?: string;
	showCloseButton?: boolean;
}

const Dialog: FC<Props> = ({
	className,
	isOpen,
	onOpenChange,
	title,
	description,
	children,
	titleClassName,
	descriptionClassName,
	showCloseButton = true,
}) => {
	return (
		<ShadcnDialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className={cn('bg-white rounded-[10px] max-h-[80vh] overflow-y-auto', className)} showCloseButton={showCloseButton}>
				<DialogHeader className=''>
					<DialogTitle className={cn('font-medium text-xl', titleClassName)}>
						{typeof title === 'string' ? title : <>{title}</>}
					</DialogTitle>
					{description && <DialogDescription className={cn('mt-6', descriptionClassName)}>{description}</DialogDescription>}
				</DialogHeader>
				<div className='mt-4 w-full min-w-0'>{children}</div>
			</DialogContent>
		</ShadcnDialog>
	);
};

export default Dialog;
