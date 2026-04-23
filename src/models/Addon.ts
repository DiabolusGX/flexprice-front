import { BaseModel, Metadata } from './base';

interface Addon extends BaseModel {
	readonly name: string;
	readonly description: string;
	readonly lookup_key: string;
	readonly metadata: Metadata;
}

export default Addon;
