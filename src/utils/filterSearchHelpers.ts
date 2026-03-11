import CustomerApi from '@/api/CustomerApi';
import { PlanApi } from '@/api/PlanApi';
import { GroupApi } from '@/api/GroupApi';
import { UserApi } from '@/api';
import { SelectOption } from '@/components/atoms/Select/SearchableSelect';
import { Customer } from '@/models/Customer';
import { PlanResponse, GroupResponse } from '@/types/dto';
import { User } from '@/models/User';
import { TypedBackendFilter } from '@/types/formatters/QueryBuilder';
import { FilterOperator, DataType } from '@/types/common/QueryBuilder';

/**
 * Search customers for async filter components
 * Returns options in the format expected by FilterAsyncSelect/FilterAsyncMultiSelect
 */
export const searchCustomersForFilter = async (query: string): Promise<Array<SelectOption & { data: Customer }>> => {
	// If query is empty, get all customers without filters
	if (!query || query.trim() === '') {
		const result = await CustomerApi.searchCustomers('', 20);
		return result.items.map((customer) => ({
			value: customer.id,
			label: customer.name,
			description: customer.email,
			data: customer,
		}));
	}

	// For non-empty queries, use searchCustomers
	const result = await CustomerApi.searchCustomers(query, 20);
	return result.items.map((customer) => ({
		value: customer.id,
		label: customer.name,
		description: customer.email,
		data: customer,
	}));
};

/**
 * Search plans for async filter components
 * Returns options in the format expected by FilterAsyncSelect/FilterAsyncMultiSelect
 */
export const searchPlansForFilter = async (query: string): Promise<Array<SelectOption & { data: PlanResponse }>> => {
	// Build typed filters for search
	const filters: TypedBackendFilter[] = [];

	if (query && query.trim() !== '') {
		// Search by name using contains operator
		filters.push({
			field: 'name',
			operator: FilterOperator.CONTAINS,
			data_type: DataType.STRING,
			value: { string: query.trim() },
		});
	}

	const result = await PlanApi.getPlansByFilter({
		limit: 20,
		offset: 0,
		filters,
		sort: [],
		expand: 'entitlements,prices,meters,features,credit_grants',
	});

	return result.items.map((plan: PlanResponse) => ({
		value: plan.id,
		label: plan.name,
		description: plan.description,
		data: plan,
	}));
};

/**
 * Search groups for async filter components
 * Returns options in the format expected by FilterAsyncSelect/FilterAsyncMultiSelect
 */
export const searchGroupsForFilter = async (query: string): Promise<Array<SelectOption & { data: GroupResponse }>> => {
	const filters: TypedBackendFilter[] = [];
	if (query && query.trim() !== '') {
		filters.push({
			field: 'name',
			operator: FilterOperator.CONTAINS,
			data_type: DataType.STRING,
			value: { string: query.trim() },
		});
	}
	const result = await GroupApi.getGroupsByFilter({
		limit: 20,
		offset: 0,
		filters,
		sort: [],
	});
	return result.items.map((group: GroupResponse) => ({
		value: group.id,
		label: group.name,
		description: group.lookup_key,
		data: group,
	}));
};

/**
 * Search users for async filter components
 * Returns options in the format expected by FilterAsyncSelect/FilterAsyncMultiSelect
 */
export const searchUsersForFilter = async (query: string): Promise<Array<SelectOption & { data: User }>> => {
	// Search users - UserApi doesn't have a search method, so we get all and filter client-side
	// For better UX, we could add a search endpoint to UserApi later
	const result = await UserApi.getAllUsers();

	// Filter by query if provided
	let filteredUsers = result.items;
	if (query && query.trim() !== '') {
		const lowerQuery = query.toLowerCase();
		filteredUsers = result.items.filter(
			(user) =>
				user.email?.toLowerCase().includes(lowerQuery) ||
				user.name?.toLowerCase().includes(lowerQuery) ||
				user.id.toLowerCase().includes(lowerQuery),
		);
	}

	// Limit to 20 results
	const limitedUsers = filteredUsers.slice(0, 20);

	return limitedUsers.map((user) => ({
		value: user.id,
		label: user.email || user.name || user.id,
		description: user.name || user.email,
		data: user,
	}));
};
