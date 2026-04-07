import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowRight, Check, Loader2, X } from 'lucide-react';
import { RouteNames } from '@/core/routes/Routes';
import { parsePricingWithLLM } from '@/api/ai/llm';
import { orchestrateSetup } from '@/api/ai/orchestrator';
import { schemaToPricingCardProps } from '@/api/ai/preview';
import { PRICING_TEMPLATES, type TemplateDefinition } from '@/api/ai/templates';
import type { SetupStep, PricingSchema } from '@/api/ai/types';
import { cn } from '@/lib/utils';
import { PricingCard } from '@/components/molecules';

// ============================================
// Progress step labels
// ============================================

const STEP_LABELS: Record<SetupStep, string> = {
	parsing: 'Parsing your pricing...',
	creating_features: 'Creating features...',
	creating_plans: 'Creating plans...',
	creating_prices: 'Setting up prices...',
	creating_entitlements: 'Linking entitlements...',
	creating_credit_grants: 'Adding credit grants...',
	done: 'Done! Redirecting to your plans...',
};

const STEP_ORDER: SetupStep[] = [
	'parsing',
	'creating_features',
	'creating_plans',
	'creating_prices',
	'creating_entitlements',
	'creating_credit_grants',
	'done',
];

const VISIBLE_PROGRESS_STEPS = STEP_ORDER.filter((s) => s !== 'done');

/** Template previews skip the API but show the same AI loading moment before cards. */
const TEMPLATE_PREVIEW_DELAY_MS = 3000;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Phase = 'input' | 'preview' | 'creating';

// ============================================
// Component
// ============================================

const PricingSetupPage = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const [prompt, setPrompt] = useState('');
	const [selectedTemplate, setSelectedTemplate] = useState<TemplateDefinition | null>(null);
	const [phase, setPhase] = useState<Phase>('input');
	const [schema, setSchema] = useState<PricingSchema | null>(null);
	const [isParsing, setIsParsing] = useState(false);
	const [currentStep, setCurrentStep] = useState<SetupStep | null>(null);
	const [completedSteps, setCompletedSteps] = useState<Set<SetupStep>>(new Set());

	const fromPlans = location.state?.from === 'plans';

	const previewCards = useMemo(() => (schema ? schemaToPricingCardProps(schema) : []), [schema]);

	const handleTemplateClick = (tpl: TemplateDefinition) => {
		setSelectedTemplate(tpl);
		setPrompt(tpl.displayPrompt);
	};

	const handleClearTemplate = () => {
		setSelectedTemplate(null);
		setPrompt('');
	};

	const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		if (selectedTemplate) return;
		setPrompt(e.target.value);
	};

	const handleParseAndPreview = async () => {
		if (!prompt.trim()) {
			toast.error('Please enter a pricing description first.');
			return;
		}
		if (selectedTemplate) {
			setIsParsing(true);
			try {
				await delay(TEMPLATE_PREVIEW_DELAY_MS);
				setSchema(selectedTemplate.schema);
				setPhase('preview');
			} finally {
				setIsParsing(false);
			}
			return;
		}
		setIsParsing(true);
		try {
			const parsed = await parsePricingWithLLM(prompt);
			setSchema(parsed);
			setPhase('preview');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Something went wrong');
		} finally {
			setIsParsing(false);
		}
	};

	const handleConfirmCreate = async () => {
		if (!schema) return;
		setPhase('creating');
		setCompletedSteps(new Set());
		setCurrentStep('creating_features');
		try {
			await orchestrateSetup(schema, (step) => {
				const stepIndex = STEP_ORDER.indexOf(step);
				setCompletedSteps(() => {
					const next = new Set<SetupStep>();
					for (let i = 0; i < stepIndex; i++) next.add(STEP_ORDER[i]);
					return next;
				});
				setCurrentStep(step);
			});
			setCompletedSteps(new Set(STEP_ORDER));
			toast.success('Your pricing has been set up!');
			setTimeout(() => navigate(RouteNames.plan), 1200);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Something went wrong');
			setPhase('preview');
			setCurrentStep(null);
		}
	};

	const handleBack = () => {
		setPhase('input');
		setSchema(null);
	};

	const handleSkip = () => {
		navigate(fromPlans ? RouteNames.plan : RouteNames.homeDashboard);
	};

	const activeStepIdx = currentStep && currentStep !== 'done' ? VISIBLE_PROGRESS_STEPS.indexOf(currentStep) : -1;

	return (
		<div
			className='fixed inset-0 z-50 flex min-h-screen flex-col items-center justify-center overflow-y-auto px-6 py-16'
			style={{
				backgroundImage: `linear-gradient(rgba(0,0,0,0.62), rgba(0,0,0,0.62)), url('/assets/onboarding.png')`,
				backgroundSize: 'cover',
				backgroundPosition: 'center',
			}}>
			{phase === 'input' && isParsing && (
				<div className='fixed inset-0 z-[60] flex items-center justify-center bg-black/40' role='status' aria-live='polite'>
					<div className='flex items-center gap-3 rounded-xl bg-white px-5 py-3 shadow-md'>
						<Loader2 className='h-5 w-5 animate-spin text-gray-900' aria-hidden />
						<span className='text-sm font-medium text-gray-900'>Analyzing</span>
					</div>
				</div>
			)}

			{/* ── Phase: input ─────────────────────────────────────── */}
			{phase === 'input' && (
				<div className='w-full max-w-3xl' style={{ width: 'min(70vw, 760px)', minWidth: '520px' }}>
					{/* Header */}
					<div className='mb-8 text-center'>
						<h1 className='text-[2rem] font-semibold tracking-tight text-white'>Set up your pricing</h1>
						<p className='mt-2.5 text-[15px] text-white/60'>Describe your pricing model, or start from a template.</p>
					</div>

					{/* Template badge */}
					{selectedTemplate && (
						<div className='mb-3 flex items-center justify-between rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 backdrop-blur-sm'>
							<span className='text-sm text-white/80'>
								<span className='mr-1.5 text-base'>{selectedTemplate.icon}</span>
								Using <span className='font-semibold text-white'>{selectedTemplate.label}</span> template
							</span>
							<button
								type='button'
								onClick={handleClearTemplate}
								aria-label='Clear template'
								className='ml-3 rounded-lg p-1 text-white/40 transition-colors hover:text-white'>
								<X className='h-3.5 w-3.5' />
							</button>
						</div>
					)}

					{/* Textarea card */}
					<div className='rounded-2xl border border-gray-200 bg-white shadow-sm'>
						<textarea
							placeholder='My app has a free plan and a pro plan at $20/month with 500 API calls included…'
							value={prompt}
							onChange={handlePromptChange}
							readOnly={!!selectedTemplate}
							rows={7}
							className={cn(
								'w-full resize-none rounded-t-2xl bg-transparent px-5 pt-5 text-[15px] leading-relaxed text-gray-800 outline-none',
								'placeholder:text-gray-400',
								selectedTemplate && 'cursor-default text-gray-500',
							)}
						/>
						<div className='flex items-center justify-end border-t border-gray-100 px-4 py-3'>
							<button
								type='button'
								onClick={handleParseAndPreview}
								disabled={!prompt.trim() || isParsing}
								className={cn(
									'flex h-9 w-9 items-center justify-center rounded-xl bg-gray-900 text-white transition-all',
									'hover:bg-gray-700 active:scale-95',
									'disabled:cursor-not-allowed disabled:opacity-30',
								)}
								aria-label='Generate pricing preview'>
								{isParsing ? <Loader2 className='h-4 w-4 animate-spin' aria-hidden /> : <ArrowRight className='h-4 w-4' strokeWidth={2} />}
							</button>
						</div>
					</div>

					{/* Templates row */}
					<div className='mt-7'>
						<div className='mb-3 flex items-center gap-3'>
							<div className='h-px flex-1 bg-white/15' />
							<span className='text-xs font-medium text-white/40'>Templates</span>
							<div className='h-px flex-1 bg-white/15' />
						</div>
						<div className='flex justify-center gap-2.5 flex-wrap'>
							{PRICING_TEMPLATES.map((t) => (
								<button
									type='button'
									key={t.label}
									onClick={() => handleTemplateClick(t)}
									className={cn(
										'flex shrink-0 items-center gap-2.5 rounded-xl border bg-white px-4 py-2.5 text-left text-sm shadow-sm',
										'transition-all hover:border-gray-400 hover:shadow active:scale-95',
										selectedTemplate?.label === t.label
											? 'border-gray-900 bg-gray-900 text-white shadow-md'
											: 'border-gray-200 text-gray-700',
									)}>
									<span className={cn('text-[15px] leading-none', selectedTemplate?.label === t.label ? 'opacity-100' : 'opacity-60')}>
										{t.icon}
									</span>
									<span className='flex flex-col gap-0.5'>
										<span className={cn('font-medium leading-none', selectedTemplate?.label === t.label ? 'text-white' : 'text-gray-900')}>
											{t.label}
										</span>
										<span
											className={cn(
												'text-[11px] font-normal leading-none',
												selectedTemplate?.label === t.label ? 'text-white/70' : 'text-gray-400',
											)}>
											{t.subtitle}
										</span>
									</span>
								</button>
							))}
						</div>
					</div>

					{/* Skip */}
					<div className='mt-6 text-center'>
						<button type='button' onClick={handleSkip} className='text-sm text-white/30 transition-colors hover:text-white/60'>
							or skip to dashboard
						</button>
					</div>
				</div>
			)}

			{/* ── Phase: preview ───────────────────────────────────── */}
			{phase === 'preview' && schema && (
				<div className='w-full' style={{ width: 'min(85vw, 1100px)', minWidth: '600px' }}>
					{/* Header — light text for dark background */}
					<div className='mb-7 text-center'>
						<h2 className='text-[1.75rem] font-semibold tracking-tight text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.85)]'>
							Here's what will be created
						</h2>
						<p className='mt-2 text-[15px] font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.85)]'>
							{schema.features.length} feature{schema.features.length !== 1 ? 's' : ''} · {schema.plans.length} plan
							{schema.plans.length !== 1 ? 's' : ''}
							{(schema.credit_grants ?? []).length > 0 &&
								` · ${(schema.credit_grants ?? []).length} credit grant${(schema.credit_grants ?? []).length !== 1 ? 's' : ''}`}
						</p>
					</div>

					{/* Scrollable plan cards */}
					<div className='overflow-y-auto' style={{ maxHeight: 'calc(100vh - 280px)' }}>
						<div
							className={cn(
								'grid gap-5',
								previewCards.length === 1
									? 'grid-cols-1 max-w-sm mx-auto'
									: previewCards.length === 2
										? 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto'
										: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
							)}>
							{previewCards.map((card) => (
								<PricingCard key={card.id} {...card} className='w-full' />
							))}
						</div>

						{/* Credit grants */}
						{(schema.credit_grants ?? []).length > 0 && (
							<div className='mt-5 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm'>
								<p className='mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400'>Credit grants</p>
								<div className='flex flex-wrap gap-x-6 gap-y-1.5'>
									{(schema.credit_grants ?? []).map((g, i) => (
										<span key={i} className='text-sm text-gray-600'>
											<span className='font-semibold text-gray-900'>{g.plan_name}</span>
											{' → '}
											{g.credits.toLocaleString()} credits
											{g.cadence === 'recurring' && g.period ? `/${g.period}` : ' (one-time)'}
										</span>
									))}
								</div>
							</div>
						)}
					</div>

					{/* Navigation */}
					<div className='mt-6 flex items-center justify-between'>
						<button
							type='button'
							onClick={handleBack}
							className='flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-600 shadow-sm transition-all hover:border-gray-300 hover:text-gray-900 active:scale-95'>
							<ArrowLeft className='h-4 w-4' strokeWidth={2} />
							Back
						</button>
						<button
							type='button'
							onClick={handleConfirmCreate}
							className='flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-gray-700 active:scale-95'>
							Confirm & Create
							<ArrowRight className='h-4 w-4' strokeWidth={2} />
						</button>
					</div>
				</div>
			)}

			{/* ── Phase: creating ──────────────────────────────────── */}
			{phase === 'creating' && (
				<div className='w-full max-w-md'>
					<div className='rounded-2xl border border-gray-200 bg-white p-8 shadow-sm'>
						<h2 className='text-center text-xl font-semibold text-gray-900'>Building your pricing</h2>
						<p className='mt-1.5 text-center text-sm text-gray-500'>This usually takes a few seconds</p>

						<div className='mt-8 space-y-2'>
							{VISIBLE_PROGRESS_STEPS.map((step, idx) => {
								const isCompleted = completedSteps.has(step);
								const isActive = activeStepIdx === idx;

								return (
									<div
										key={step}
										className={cn(
											'flex items-center gap-3 rounded-xl px-4 py-3 transition-all',
											isActive && 'bg-gray-50',
											!isActive && !isCompleted && 'opacity-40',
										)}>
										<div
											className={cn(
												'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
												isCompleted
													? 'bg-gray-900 text-white'
													: isActive
														? 'bg-gray-100 text-gray-600 ring-2 ring-gray-900/20'
														: 'bg-gray-100 text-gray-400',
											)}>
											{isCompleted ? (
												<Check className='h-3.5 w-3.5' strokeWidth={2.5} />
											) : isActive ? (
												<span className='h-2 w-2 animate-pulse rounded-full bg-gray-500' />
											) : (
												<span>{idx + 1}</span>
											)}
										</div>
										<span
											className={cn(
												'text-sm',
												isActive ? 'font-medium text-gray-900' : 'text-gray-500',
												isCompleted && 'text-gray-400 line-through',
											)}>
											{STEP_LABELS[step]}
										</span>
									</div>
								);
							})}
						</div>

						{currentStep === 'done' && (
							<div className='mt-6 flex justify-center'>
								<div className='flex items-center gap-2 text-sm font-medium text-gray-600'>
									<Loader2 className='h-4 w-4 animate-spin' aria-hidden />
									Redirecting to your plans…
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
};

export default PricingSetupPage;
