declare module 'generate-schema' {
	export interface SchemaObject {
		type: string;
		properties?: Record<string, any>;
		items?: any;
		required?: string[];
		[key: string]: any;
	}

	export function json(data: any): SchemaObject;
}
