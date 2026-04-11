import { ENVIRONMENT_TYPE, Pagination, Environment } from '@/models';

export interface UpdateEnvironmentPayload {
	name?: string;
	type?: ENVIRONMENT_TYPE;
}

export interface CreateEnvironmentPayload {
	name: string;
	type: ENVIRONMENT_TYPE;
}
export interface ListEnvironmentResponse extends Pagination {
	environments: Environment[];
}
