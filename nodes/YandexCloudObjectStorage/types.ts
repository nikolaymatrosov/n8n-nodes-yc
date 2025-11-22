import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import type { S3Client } from '@aws-sdk/client-s3';

/**
 * Context passed to all operation functions
 */
export interface IOperationContext {
	executeFunctions: IExecuteFunctions;
	client: S3Client;
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
	BUCKET: 'bucket',
	OBJECT: 'object',
} as const;

export type Resource = (typeof RESOURCES)[keyof typeof RESOURCES];

/**
 * Bucket operation constants
 */
export const BUCKET_OPERATIONS = {
	LIST: 'list',
	CREATE: 'create',
	DELETE: 'delete',
	GET: 'get',
	SET_ACL: 'setAcl',
	SET_VERSIONING: 'setVersioning',
} as const;

export type BucketOperation = (typeof BUCKET_OPERATIONS)[keyof typeof BUCKET_OPERATIONS];

/**
 * Object operation constants
 */
export const OBJECT_OPERATIONS = {
	UPLOAD: 'upload',
	DOWNLOAD: 'download',
	DELETE: 'delete',
	LIST: 'list',
	GET: 'get',
	COPY: 'copy',
	MOVE: 'move',
	SET_ACL: 'setAcl',
	GET_PRESIGNED_URL: 'getPresignedUrl',
} as const;

export type ObjectOperation = (typeof OBJECT_OPERATIONS)[keyof typeof OBJECT_OPERATIONS];

/**
 * Parameter name constants
 * Used with getNodeParameter() to ensure type safety and consistency
 */
export const PARAMS = {
	// Common parameters
	BUCKET_NAME: 'bucketName',
	OBJECT_KEY: 'objectKey',
	ACL: 'acl',
	ADDITIONAL_FIELDS: 'additionalFields',

	// Object upload parameters
	INPUT_DATA_TYPE: 'inputDataType',
	BINARY_PROPERTY: 'binaryProperty',
	TEXT_CONTENT: 'textContent',
	JSON_CONTENT: 'jsonContent',

	// Object copy/move parameters
	SOURCE_BUCKET: 'sourceBucket',
	SOURCE_OBJECT_KEY: 'sourceObjectKey',
	DESTINATION_BUCKET: 'destinationBucket',
	DESTINATION_OBJECT_KEY: 'destinationObjectKey',

	// Bucket versioning parameter
	VERSIONING_STATUS: 'versioningStatus',

	// Presigned URL parameter
	EXPIRES_IN: 'expiresIn',
} as const;

export type ParamName = (typeof PARAMS)[keyof typeof PARAMS];
