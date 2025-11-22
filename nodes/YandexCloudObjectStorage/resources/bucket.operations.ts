import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { S3Client } from '@aws-sdk/client-s3';
import {
	CreateBucketCommand,
	DeleteBucketCommand,
	GetBucketLocationCommand,
	HeadBucketCommand,
	ListBucketsCommand,
	PutBucketAclCommand,
	PutBucketVersioningCommand,
} from '@aws-sdk/client-s3';

import type { IOperationContext, OperationResult } from '../types';
import { BUCKET_OPERATIONS, PARAMS } from '../types';

/**
 * Execute a bucket operation based on the operation type
 */
export async function executeBucketOperation(
	context: IOperationContext,
	operation: string,
): Promise<OperationResult> {
	const { executeFunctions, client, itemIndex } = context;

	switch (operation) {
		case BUCKET_OPERATIONS.LIST:
			return await listBuckets(executeFunctions, client);
		case BUCKET_OPERATIONS.CREATE:
			return await createBucket(executeFunctions, client, itemIndex);
		case BUCKET_OPERATIONS.DELETE:
			return await deleteBucket(executeFunctions, client, itemIndex);
		case BUCKET_OPERATIONS.GET:
			return await getBucket(executeFunctions, client, itemIndex);
		case BUCKET_OPERATIONS.SET_ACL:
			return await setBucketAcl(executeFunctions, client, itemIndex);
		case BUCKET_OPERATIONS.SET_VERSIONING:
			return await setBucketVersioning(executeFunctions, client, itemIndex);
		default:
			throw new NodeOperationError(
				executeFunctions.getNode(),
				`Unknown bucket operation: ${operation}`,
			);
	}
}

/**
 * List all buckets
 */
async function listBuckets(
	executeFunctions: IExecuteFunctions,
	client: S3Client,
): Promise<INodeExecutionData[]> {
	try {
		const response = await client.send(new ListBucketsCommand({}));

		const buckets = (response.Buckets || []).map((bucket) => ({
			json: {
				name: bucket.Name,
				creationDate: bucket.CreationDate,
			},
			pairedItem: { item: 0 },
		}));

		return buckets;
	} catch (error) {
		throw new NodeOperationError(
			executeFunctions.getNode(),
			`Failed to list buckets: ${error.message}`,
		);
	}
}

/**
 * Create a new bucket
 */
async function createBucket(
	executeFunctions: IExecuteFunctions,
	client: S3Client,
	i: number,
): Promise<INodeExecutionData> {
	const bucketName = executeFunctions.getNodeParameter(PARAMS.BUCKET_NAME, i) as string;
	const additionalFields = executeFunctions.getNodeParameter(PARAMS.ADDITIONAL_FIELDS, i) as {
		acl?: string;
	};

	const params: any = {
		Bucket: bucketName,
	};

	if (additionalFields.acl) {
		params.ACL = additionalFields.acl;
	}

	await client.send(new CreateBucketCommand(params));

	return {
		json: {
			success: true,
			bucket: bucketName,
			message: 'Bucket created successfully',
		},
		pairedItem: { item: i },
	};
}

/**
 * Delete a bucket
 */
async function deleteBucket(
	executeFunctions: IExecuteFunctions,
	client: S3Client,
	i: number,
): Promise<INodeExecutionData> {
	const bucketName = executeFunctions.getNodeParameter(PARAMS.BUCKET_NAME, i, '', {
		extractValue: true,
	}) as string;

	await client.send(new DeleteBucketCommand({ Bucket: bucketName }));

	return {
		json: {
			success: true,
			bucket: bucketName,
			message: 'Bucket deleted successfully',
		},
		pairedItem: { item: i },
	};
}

/**
 * Get bucket information
 */
async function getBucket(
	executeFunctions: IExecuteFunctions,
	client: S3Client,
	i: number,
): Promise<INodeExecutionData> {
	const bucketName = executeFunctions.getNodeParameter(PARAMS.BUCKET_NAME, i, '', {
		extractValue: true,
	}) as string;

	const headResponse = await client.send(new HeadBucketCommand({ Bucket: bucketName }));

	let location;
	try {
		const locationResponse = await client.send(
			new GetBucketLocationCommand({ Bucket: bucketName }),
		);
		location = locationResponse.LocationConstraint;
	} catch (error) {
		// Ignore location errors
	}

	return {
		json: {
			success: true,
			bucket: bucketName,
			location,
			metadata: headResponse.$metadata,
		},
		pairedItem: { item: i },
	};
}

/**
 * Set bucket ACL
 */
async function setBucketAcl(
	executeFunctions: IExecuteFunctions,
	client: S3Client,
	i: number,
): Promise<INodeExecutionData> {
	const bucketName = executeFunctions.getNodeParameter(PARAMS.BUCKET_NAME, i, '', {
		extractValue: true,
	}) as string;
	const acl = executeFunctions.getNodeParameter(PARAMS.ACL, i) as string;

	await client.send(
		new PutBucketAclCommand({
			Bucket: bucketName,
			ACL: acl as any,
		}),
	);

	return {
		json: {
			success: true,
			bucket: bucketName,
			acl,
			message: 'Bucket ACL set successfully',
		},
		pairedItem: { item: i },
	};
}

/**
 * Set bucket versioning
 */
async function setBucketVersioning(
	executeFunctions: IExecuteFunctions,
	client: S3Client,
	i: number,
): Promise<INodeExecutionData> {
	const bucketName = executeFunctions.getNodeParameter(PARAMS.BUCKET_NAME, i, '', {
		extractValue: true,
	}) as string;
	const versioningStatus = executeFunctions.getNodeParameter(PARAMS.VERSIONING_STATUS, i) as string;

	await client.send(
		new PutBucketVersioningCommand({
			Bucket: bucketName,
			VersioningConfiguration: {
				Status: versioningStatus as any,
			},
		}),
	);

	return {
		json: {
			success: true,
			bucket: bucketName,
			versioningStatus,
			message: 'Bucket versioning set successfully',
		},
		pairedItem: { item: i },
	};
}
