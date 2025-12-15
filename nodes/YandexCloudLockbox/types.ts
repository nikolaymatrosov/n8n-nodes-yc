import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import type { secretService, payloadService } from '@yandex-cloud/nodejs-sdk/dist/clients/lockbox-v1';

/**
 * Context passed to all operation functions
 */
export interface IOperationContext {
	executeFunctions: IExecuteFunctions;
	secretClient: secretService.SecretServiceClient;
	payloadClient: payloadService.PayloadServiceClient;
	itemIndex: number;
}

/**
 * Shared return type for operations
 */
export type OperationResult = INodeExecutionData | INodeExecutionData[];

/**
 * Resource constants
 */
export const RESOURCES = {
	SECRET: 'secret',
	VERSION: 'version',
	PAYLOAD: 'payload',
} as const;

export type Resource = (typeof RESOURCES)[keyof typeof RESOURCES];

/**
 * Secret operation constants
 */
export const SECRET_OPERATIONS = {
	LIST: 'list',
	GET: 'get',
	CREATE: 'create',
	UPDATE: 'update',
	DELETE: 'delete',
	ACTIVATE: 'activate',
	DEACTIVATE: 'deactivate',
} as const;

export type SecretOperation = (typeof SECRET_OPERATIONS)[keyof typeof SECRET_OPERATIONS];

/**
 * Version operation constants
 */
export const VERSION_OPERATIONS = {
	LIST: 'list',
	ADD: 'add',
	SCHEDULE_DESTRUCTION: 'scheduleDestruction',
	CANCEL_DESTRUCTION: 'cancelDestruction',
} as const;

export type VersionOperation = (typeof VERSION_OPERATIONS)[keyof typeof VERSION_OPERATIONS];

/**
 * Payload operation constants
 */
export const PAYLOAD_OPERATIONS = {
	GET: 'get',
	GET_BY_NAME: 'getByName',
} as const;

export type PayloadOperation = (typeof PAYLOAD_OPERATIONS)[keyof typeof PAYLOAD_OPERATIONS];

/**
 * Parameter name constants
 * Used with getNodeParameter() to ensure type safety and consistency
 */
export const PARAMS = {
	// Common parameters
	RESOURCE: 'resource',
	OPERATION: 'operation',
	FOLDER_ID: 'folderId',

	// Secret parameters
	SECRET_ID: 'secretId',
	SECRET_NAME: 'secretName',
	DESCRIPTION: 'description',
	DELETION_PROTECTION: 'deletionProtection',
	LABELS: 'labels',
	KMS_KEY_ID: 'kmsKeyId',

	// Version parameters
	VERSION_ID: 'versionId',
	VERSION_DESCRIPTION: 'versionDescription',
	BASE_VERSION_ID: 'baseVersionId',
	PENDING_PERIOD: 'pendingPeriod',

	// Payload parameters
	PAYLOAD_ENTRIES: 'payloadEntries',

	// Pagination parameters
	RETURN_ALL: 'returnAll',
	LIMIT: 'limit',

	// Additional fields
	ADDITIONAL_FIELDS: 'additionalFields',
} as const;

export type ParamName = (typeof PARAMS)[keyof typeof PARAMS];

/**
 * Payload entry for create/update operations
 */
export interface IPayloadEntry {
	key: string;
	valueType: 'text' | 'binary';
	textValue?: string;
	binaryValue?: string;
}

/**
 * Label entry for secret metadata
 */
export interface ILabelEntry {
	key: string;
	value: string;
}
