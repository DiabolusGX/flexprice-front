import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Page, AddButton, Card, CardHeader, Loader, Button, Input, Label, ShortPagination, Dialog } from '@/components/atoms';
import { FlatTabs, FlexpriceTable } from '@/components/molecules';
import { UserApi } from '@/api/UserApi';
import { User } from '@/models';
import toast from 'react-hot-toast';
import { ColumnData } from '@/components/molecules/Table/Table';
import { AlertTriangle, Copy, Eye, EyeOff, Info, Lock, Mail } from 'lucide-react';
import { refetchQueries } from '@/core/services/tanstack/ReactQueryProvider';
import usePagination, { PAGINATION_PREFIX } from '@/hooks/usePagination';

const MEMBERS_QUERY_KEY = ['settings-team-members'];
const MEMBERS_PAGE_SIZE = 20;

function getRoleDisplay(_user: User): string {
	// Roles not supported yet; every user is admin
	// TODO: Add support when rbac roles are supported for user accounts as well.
	return 'Admin';
}

/** API error shape when add user fails (e.g. user limit reached, duplicate email) */
function getAddUserErrorMessage(err: any): string {
	const internal = err?.error?.internal_error ?? '';
	const msg = err?.error?.message ?? err?.message ?? '';
	if (typeof internal === 'string' && internal.toLowerCase().includes('user limit')) {
		return 'User limit reached for this organization.';
	}
	if (typeof msg === 'string' && (msg.toLowerCase().includes('limit reached') || msg.toLowerCase().includes('maximum'))) {
		return 'User limit reached for this organization.';
	}
	if (typeof msg === 'string' && msg.toLowerCase().includes('already exists')) {
		return 'A user with this email already exists!';
	}
	if (typeof msg === 'string' && msg.length) return msg;
	return 'Failed to add user';
}

function MembersSection() {
	const [addOpen, setAddOpen] = useState(false);
	const [email, setEmail] = useState('');
	const [addError, setAddError] = useState<string | null>(null);
	const [oneTimePassword, setOneTimePassword] = useState<string | null>(null);
	const [addedUserEmail, setAddedUserEmail] = useState<string | null>(null);
	const [showPassword, setShowPassword] = useState(false);
	const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

	const { limit, offset, page } = usePagination({
		initialLimit: MEMBERS_PAGE_SIZE,
		prefix: PAGINATION_PREFIX.SETTINGS_MEMBERS,
	});

	const { data, isLoading, isError, refetch } = useQuery({
		queryKey: [...MEMBERS_QUERY_KEY, page, limit, offset],
		queryFn: () => UserApi.getTenantMembers({ limit, offset }),
	});

	useEffect(() => {
		if (isError) toast.error('Failed to load members');
	}, [isError]);

	const isValidEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value);

	const createUser = useMutation({
		mutationFn: (payload: { type: 'user'; email: string }) => UserApi.addUserToTenant(payload),
		onSuccess: (res, variables) => {
			setAddOpen(false);
			setAddError(null);
			setAddedUserEmail(variables.email);
			setEmail('');
			setOneTimePassword(res.password);
			setShowPassword(false);
			setPasswordDialogOpen(true);
			refetchQueries(MEMBERS_QUERY_KEY);
		},
		onError: (err: any) => {
			const message = getAddUserErrorMessage(err);
			setAddError(message);
			toast.error(message);
		},
	});

	const handleAddUser = () => {
		if (createUser.isPending) return;
		const trimmed = email.trim();
		setAddError(null);
		if (!trimmed) {
			toast.error('Enter an email address');
			return;
		}
		if (!isValidEmail(trimmed)) {
			toast.error('Please enter a valid email address');
			setAddError('Please enter a valid email address');
			return;
		}
		createUser.mutate({ type: 'user', email: trimmed });
	};

	const handleAddDialogOpenChange = (open: boolean) => {
		if (!open) setAddError(null);
		setAddOpen(open);
	};

	const handleCopyPassword = async () => {
		if (!oneTimePassword) return;
		try {
			await navigator.clipboard.writeText(oneTimePassword);
			toast.success('Copied to clipboard');
		} catch {
			toast.error('Could not copy to clipboard');
		}
	};

	const handleClosePasswordDialog = () => {
		setOneTimePassword(null);
		setAddedUserEmail(null);
		setPasswordDialogOpen(false);
	};

	const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

	const members: User[] = data?.items ?? [];
	const totalMembers = data?.pagination?.total ?? 0;
	const columns: ColumnData<User>[] = [
		{ title: 'Email', fieldName: 'email' },
		{
			title: 'Role',
			render: (row) => getRoleDisplay(row),
		},
	];

	return (
		<>
			<Card variant='default' className='rounded-[6px]'>
				<CardHeader title='Members' cta={<AddButton label='Add' onClick={() => setAddOpen(true)} />} />
				{isLoading && <Loader />}
				{!isLoading && isError && (
					<div className='flex flex-col items-center justify-center gap-3 py-8 text-center'>
						<p className='text-sm text-red-600'>Failed to load members. Please try again.</p>
						<Button variant='outline' onClick={() => refetch()}>
							Retry
						</Button>
					</div>
				)}
				{!isLoading && !isError && (
					<>
						<FlexpriceTable columns={columns} data={members} showEmptyRow />
						<ShortPagination
							prefix={PAGINATION_PREFIX.SETTINGS_MEMBERS}
							unit='members'
							totalItems={totalMembers}
							pageSize={MEMBERS_PAGE_SIZE}
						/>
					</>
				)}
			</Card>

			{/* Add member dialog */}
			<Dialog isOpen={addOpen} onOpenChange={handleAddDialogOpenChange} title='Add member' className='sm:max-w-[425px]'>
				<div className='grid gap-4 mt-3'>
					{addError && (
						<div className='w-full flex items-center gap-2.5 rounded-md border border-red-300 bg-red-50 px-3 py-2.5' role='alert'>
							<AlertTriangle className='h-4 w-4 flex-shrink-0 text-red-600' />
							<span className='text-sm font-medium text-red-800 leading-relaxed'>{addError}</span>
						</div>
					)}
					<div className='grid gap-2'>
						<Label label='Email' htmlFor='member-email' />
						<Input
							id='member-email'
							type='email'
							placeholder='user@example.com'
							value={email}
							onChange={(value) => setEmail(value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									handleAddUser();
								}
							}}
						/>
					</div>
					<Button onClick={handleAddUser} disabled={createUser.isPending} isLoading={createUser.isPending}>
						Add user
					</Button>
				</div>
			</Dialog>

			{/* Login credentials dialog */}
			<Dialog
				isOpen={passwordDialogOpen}
				onOpenChange={(open) => (open ? setPasswordDialogOpen(true) : handleClosePasswordDialog())}
				title='Login Credentials'
				className='w-full max-w-[520px] border border-gray-200 shadow-xl'>
				<div className='space-y-5 mt-3'>
					{addedUserEmail && (
						<div className='flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-3 border border-blue-200'>
							<Mail className='h-4 w-4 text-blue-600 flex-shrink-0' />
							<span className='flex-1 min-w-0 text-sm font-semibold text-blue-900 truncate'>{addedUserEmail}</span>
						</div>
					)}
					{/* Password: Lock on left */}
					<div className='space-y-2'>
						<div className='flex items-center gap-2'>
							<Lock className='h-4 w-4 text-gray-500' />
							<span className='text-sm font-medium text-gray-700'>Password</span>
						</div>
						<div className='relative bg-gray-100 rounded-md'>
							<Input
								id='temp-password'
								readOnly
								type={showPassword ? 'text' : 'password'}
								value={oneTimePassword ?? ''}
								className='pr-16 border-none bg-transparent font-mono text-gray-700'
							/>
							<div className='absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1'>
								<button
									type='button'
									onClick={togglePasswordVisibility}
									className='p-1 text-gray-500 hover:text-gray-700'
									title={showPassword ? 'Hide password' : 'Show password'}
									aria-label={showPassword ? 'Hide password' : 'Show password'}>
									{showPassword ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
								</button>
								<button
									type='button'
									onClick={handleCopyPassword}
									className='p-1 text-gray-500 hover:text-gray-700'
									title='Copy password'
									aria-label='Copy password'>
									<Copy className='h-4 w-4' />
								</button>
							</div>
						</div>
					</div>
					{/* Warning (yellow): password can be reset later */}
					<div className='flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5'>
						<AlertTriangle className='h-4 w-4 flex-shrink-0 text-amber-600' />
						<span className='text-sm text-amber-900'>This password can be reset later.</span>
					</div>
					{/* Info: sign in with email/password or Google */}
					<div className='flex items-center gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5'>
						<Info className='h-4 w-4 flex-shrink-0 text-sky-600' />
						<span className='text-sm text-sky-900'>The user can log in using email/password or Google login.</span>
					</div>
					<div className='pt-2'>
						<Button onClick={handleClosePasswordDialog}>Done</Button>
					</div>
				</div>
			</Dialog>
		</>
	);
}

const SettingsDashboard = () => {
	return (
		<Page heading='Settings' documentTitle='Settings'>
			<FlatTabs
				tabs={[
					{
						value: 'team',
						label: 'Team',
						content: <MembersSection />,
					},
				]}
				defaultValue='team'
			/>
		</Page>
	);
};

export default SettingsDashboard;
