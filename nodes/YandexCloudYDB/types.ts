export interface YDBCredentials {
	serviceAccountJson: string;
	folderId?: string;
}

export interface YDBConnectionConfig {
	endpoint: string;
	database: string;
}

export interface YDBQueryParams {
	[key: string]: any;
}

export interface YDBExecutionResult {
	resultSets: any[][];
	stats?: any;
}
