import { SUBSCRIPTION_TYPE } from '@/models/Subscription';

/** Child mirror subscription: explicit type or linked to a parent (matches hierarchy UI). */
export function isInheritedSubscription(sub: { subscription_type?: string | null; parent_subscription_id?: string | null }): boolean {
	const t = sub.subscription_type?.toLowerCase();
	if (t === SUBSCRIPTION_TYPE.INHERITED) return true;
	if (sub.parent_subscription_id?.trim()) return true;
	return false;
}
