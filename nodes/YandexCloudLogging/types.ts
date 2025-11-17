/**
 * Yandex Cloud Logging API Types
 * Based on API documentation from logging.md
 */

/**
 * Log level enum
 */
export enum LogLevel {
	LEVEL_UNSPECIFIED = 'LEVEL_UNSPECIFIED',
	TRACE = 'TRACE',
	DEBUG = 'DEBUG',
	INFO = 'INFO',
	WARN = 'WARN',
	ERROR = 'ERROR',
	FATAL = 'FATAL',
}

/**
 * Log entry destination
 */
export interface IDestination {
	logGroupId?: string;
	folderId?: string;
}

/**
 * Log entry resource specification
 */
export interface ILogEntryResource {
	type?: string;
	id?: string;
}

/**
 * Incoming log entry for write operation
 */
export interface IIncomingLogEntry {
	timestamp?: string | Date;
	level?: LogLevel;
	message: string;
	jsonPayload?: Record<string, any>;
	streamName?: string;
}

/**
 * Log entry defaults
 */
export interface ILogEntryDefaults {
	level?: LogLevel;
	jsonPayload?: Record<string, any>;
	streamName?: string;
}

/**
 * Write request payload
 */
export interface IWriteRequest {
	destination: IDestination;
	resource?: ILogEntryResource;
	entries: IIncomingLogEntry[];
	defaults?: ILogEntryDefaults;
}

/**
 * Write response
 */
export interface IWriteResponse {
	errors?: Record<number, any>;
}

/**
 * Read criteria for filtering log entries
 */
export interface IReadCriteria {
	logGroupId: string;
	resourceTypes?: string[];
	resourceIds?: string[];
	since?: string | Date;
	until?: string | Date;
	levels?: LogLevel[];
	filter?: string;
	streamNames?: string[];
	pageSize?: number;
	maxResponseSize?: number;
}

/**
 * Read request
 */
export interface IReadRequest {
	pageToken?: string;
	criteria?: IReadCriteria;
}

/**
 * Log entry from read response
 */
export interface ILogEntry {
	uid: string;
	resource?: ILogEntryResource;
	timestamp: string | Date;
	ingestedAt?: string | Date;
	savedAt?: string | Date;
	level: LogLevel;
	message: string;
	jsonPayload?: Record<string, any>;
	streamName?: string;
}

/**
 * Read response
 */
export interface IReadResponse {
	logGroupId: string;
	entries: ILogEntry[];
	nextPageToken?: string;
	previousPageToken?: string;
}

/**
 * Log group status
 */
export enum LogGroupStatus {
	STATUS_UNSPECIFIED = 'STATUS_UNSPECIFIED',
	CREATING = 'CREATING',
	ACTIVE = 'ACTIVE',
	DELETING = 'DELETING',
	ERROR = 'ERROR',
}

/**
 * Log group
 */
export interface ILogGroup {
	id: string;
	folderId: string;
	cloudId: string;
	createdAt: string | Date;
	name: string;
	description?: string;
	labels?: Record<string, string>;
	status: LogGroupStatus;
	retentionPeriod?: string;
	dataStream?: string;
}

/**
 * List log groups request
 */
export interface IListLogGroupsRequest {
	folderId: string;
	pageSize?: number;
	pageToken?: string;
	filter?: string;
}

/**
 * List log groups response
 */
export interface IListLogGroupsResponse {
	groups: ILogGroup[];
	nextPageToken?: string;
}

/**
 * Service Account JSON credentials
 */
export interface IServiceAccountJson {
	serviceAccountId: string;
	accessKeyId: string;
	privateKey: string;
}
