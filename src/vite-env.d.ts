/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_DEPLOYMENT_REGION?: string;
}

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
	readonly VITE_PADDLE_CLIENT_TOKEN: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

interface ReoIdentity {
	username: string;
	type: 'email' | 'github' | 'linkedin' | 'gmail' | 'userID';
	firstname?: string;
	lastname?: string;
	company?: string;
	other_identities?: Array<{ username: string; type: string }>;
}

interface ReoInstance {
	init: (options: { clientID: string }) => void;
	identify: (identity: ReoIdentity) => void;
}

interface Window {
	Reo?: ReoInstance;
}
