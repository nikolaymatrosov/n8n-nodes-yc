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
