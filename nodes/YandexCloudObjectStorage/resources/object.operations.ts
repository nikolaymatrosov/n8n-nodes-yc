import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { S3Client } from '@aws-sdk/client-s3';
import {
	CopyObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	PutObjectAclCommand,
	PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

import { getObjectUrl, streamToBuffer } from '../GenericFunctions';
import type { IOperationContext, OperationResult } from '../types';
import { OBJECT_OPERATIONS, PARAMS } from '../types';

/**
 * Execute an object operation based on the operation type
 */
export async function executeObjectOperation(
	context: IOperationContext,
	operation: string,
): Promise<OperationResult> {
	const { executeFunctions, client, itemIndex } = context;

	switch (operation) {
		case OBJECT_OPERATIONS.UPLOAD:
			return await uploadObject(executeFunctions, client, itemIndex);
		case OBJECT_OPERATIONS.DOWNLOAD:
			return await downloadObject(executeFunctions, client, itemIndex);
		case OBJECT_OPERATIONS.DELETE:
			return await deleteObject(executeFunctions, client, itemIndex);
		case OBJECT_OPERATIONS.LIST:
			return await listObjects(executeFunctions, client, itemIndex);
		case OBJECT_OPERATIONS.GET:
			return await getObjectMetadata(executeFunctions, client, itemIndex);
		case OBJECT_OPERATIONS.COPY:
			return await copyObject(executeFunctions, client, itemIndex);
		case OBJECT_OPERATIONS.MOVE:
			return await moveObject(executeFunctions, client, itemIndex);
		case OBJECT_OPERATIONS.SET_ACL:
			return await setObjectAcl(executeFunctions, client, itemIndex);
		case OBJECT_OPERATIONS.GET_PRESIGNED_URL:
			return await getPresignedUrl(executeFunctions, client, itemIndex);
		default:
			throw new NodeOperationError(
				executeFunctions.getNode(),
				`Unknown object operation: ${operation}`,
			);
	}
}

/**
 * Upload an object to a bucket
 */
async function uploadObject(
	executeFunctions: IExecuteFunctions,
	client: S3Client,
	i: number,
): Promise<INodeExecutionData> {
	const bucketName = executeFunctions.getNodeParameter(PARAMS.BUCKET_NAME, i, '', {
		extractValue: true,
	}) as string;
	const objectKey = executeFunctions.getNodeParameter(PARAMS.OBJECT_KEY, i) as string;
	const inputDataType = executeFunctions.getNodeParameter(PARAMS.INPUT_DATA_TYPE, i) as string;
	const additionalFields = executeFunctions.getNodeParameter(PARAMS.ADDITIONAL_FIELDS, i) as {
		acl?: string;
		contentType?: string;
		storageClass?: string;
		metadata?: {
			metadataItem?: Array<{
				key: string;
				value: string;
			}>;
		};
	};

	const items = executeFunctions.getInputData();
	let body: Buffer;
	let contentType = additionalFields.contentType;

	if (inputDataType === 'binary') {
		const binaryProperty = executeFunctions.getNodeParameter(PARAMS.BINARY_PROPERTY, i) as string;
		const binaryData = await executeFunctions.helpers.getBinaryDataBuffer(i, binaryProperty);
		body = binaryData;

		// Try to get content type from binary data if not specified
		if (!contentType) {
			const itemBinaryData = items[i].binary?.[binaryProperty];
			if (itemBinaryData?.mimeType) {
				contentType = itemBinaryData.mimeType;
			}
		}
	} else if (inputDataType === 'text') {
		const textContent = executeFunctions.getNodeParameter(PARAMS.TEXT_CONTENT, i) as string;
		body = Buffer.from(textContent, 'utf-8');
		if (!contentType) {
			contentType = 'text/plain';
		}
	} else if (inputDataType === 'json') {
		const jsonContent = executeFunctions.getNodeParameter(PARAMS.JSON_CONTENT, i);
		body = Buffer.from(JSON.stringify(jsonContent), 'utf-8');
		if (!contentType) {
			contentType = 'application/json';
		}
	} else {
		throw new NodeOperationError(
			executeFunctions.getNode(),
			`Unknown input data type: ${inputDataType}`,
		);
	}

	const params: any = {
		Bucket: bucketName,
		Key: objectKey,
		Body: body,
	};

	if (contentType) {
		params.ContentType = contentType;
	}

	if (additionalFields.acl) {
		params.ACL = additionalFields.acl;
	}

	if (additionalFields.storageClass) {
		params.StorageClass = additionalFields.storageClass;
	}

	if (additionalFields.metadata?.metadataItem) {
		const metadata: Record<string, string> = {};
		for (const item of additionalFields.metadata.metadataItem) {
			if (item.key) {
				metadata[item.key] = item.value;
			}
		}
		params.Metadata = metadata;
	}

	const response = await client.send(new PutObjectCommand(params));

	return {
		json: {
			success: true,
			bucket: bucketName,
			key: objectKey,
			objectUrl: getObjectUrl(bucketName, objectKey),
			etag: response.ETag,
			versionId: response.VersionId,
		},
		pairedItem: { item: i },
	};
}

/**
 * Download an object from a bucket
 */
async function downloadObject(
	executeFunctions: IExecuteFunctions,
	client: S3Client,
	i: number,
): Promise<INodeExecutionData> {
	const bucketName = executeFunctions.getNodeParameter(PARAMS.BUCKET_NAME, i, '', {
		extractValue: true,
	}) as string;
	const objectKey = executeFunctions.getNodeParameter(PARAMS.OBJECT_KEY, i) as string;

	const response = await client.send(
		new GetObjectCommand({
			Bucket: bucketName,
			Key: objectKey,
		}),
	);

	const bodyBuffer = await streamToBuffer(response.Body as Readable);

	const binaryData = await executeFunctions.helpers.prepareBinaryData(
		bodyBuffer,
		objectKey.split('/').pop() || 'file',
		response.ContentType,
	);

	return {
		json: {
			success: true,
			bucket: bucketName,
			key: objectKey,
			size: response.ContentLength,
			contentType: response.ContentType,
			lastModified: response.LastModified,
			etag: response.ETag,
		},
		binary: {
			data: binaryData,
		},
		pairedItem: { item: i },
	};
}

/**
 * Delete an object from a bucket
 */
async function deleteObject(
	executeFunctions: IExecuteFunctions,
	client: S3Client,
	i: number,
): Promise<INodeExecutionData> {
	const bucketName = executeFunctions.getNodeParameter(PARAMS.BUCKET_NAME, i, '', {
		extractValue: true,
	}) as string;
	const objectKey = executeFunctions.getNodeParameter(PARAMS.OBJECT_KEY, i) as string;

	await client.send(
		new DeleteObjectCommand({
			Bucket: bucketName,
			Key: objectKey,
		}),
	);

	return {
		json: {
			success: true,
			bucket: bucketName,
			key: objectKey,
			message: 'Object deleted successfully',
		},
		pairedItem: { item: i },
	};
}

/**
 * List objects in a bucket
 */
async function listObjects(
	executeFunctions: IExecuteFunctions,
	client: S3Client,
	i: number,
): Promise<INodeExecutionData[]> {
	const bucketName = executeFunctions.getNodeParameter(PARAMS.BUCKET_NAME, i, '', {
		extractValue: true,
	}) as string;
	const additionalFields = executeFunctions.getNodeParameter(PARAMS.ADDITIONAL_FIELDS, i) as {
		prefix?: string;
		maxKeys?: number;
		startAfter?: string;
	};

	const params: any = {
		Bucket: bucketName,
	};

	if (additionalFields.prefix) {
		params.Prefix = additionalFields.prefix;
	}

	if (additionalFields.maxKeys) {
		params.MaxKeys = additionalFields.maxKeys;
	}

	if (additionalFields.startAfter) {
		params.StartAfter = additionalFields.startAfter;
	}

	const response = await client.send(new ListObjectsV2Command(params));

	const objects = (response.Contents || []).map((object) => ({
		json: {
			key: object.Key,
			size: object.Size,
			lastModified: object.LastModified,
			etag: object.ETag,
			storageClass: object.StorageClass,
		},
		pairedItem: { item: i },
	}));

	return objects;
}

/**
 * Get object metadata
 */
async function getObjectMetadata(
	executeFunctions: IExecuteFunctions,
	client: S3Client,
	i: number,
): Promise<INodeExecutionData> {
	const bucketName = executeFunctions.getNodeParameter(PARAMS.BUCKET_NAME, i, '', {
		extractValue: true,
	}) as string;
	const objectKey = executeFunctions.getNodeParameter(PARAMS.OBJECT_KEY, i) as string;

	const response = await client.send(
		new HeadObjectCommand({
			Bucket: bucketName,
			Key: objectKey,
		}),
	);

	return {
		json: {
			success: true,
			bucket: bucketName,
			key: objectKey,
			size: response.ContentLength,
			contentType: response.ContentType,
			lastModified: response.LastModified,
			etag: response.ETag,
			versionId: response.VersionId,
			storageClass: response.StorageClass,
			metadata: response.Metadata,
		},
		pairedItem: { item: i },
	};
}

/**
 * Copy an object
 */
async function copyObject(
	executeFunctions: IExecuteFunctions,
	client: S3Client,
	i: number,
): Promise<INodeExecutionData> {
	const sourceBucket = executeFunctions.getNodeParameter(PARAMS.SOURCE_BUCKET, i, '', {
		extractValue: true,
	}) as string;
	const sourceObjectKey = executeFunctions.getNodeParameter(PARAMS.SOURCE_OBJECT_KEY, i) as string;
	const destinationBucket = executeFunctions.getNodeParameter(PARAMS.DESTINATION_BUCKET, i, '', {
		extractValue: true,
	}) as string;
	const destinationObjectKey = executeFunctions.getNodeParameter(
		PARAMS.DESTINATION_OBJECT_KEY,
		i,
	) as string;

	const copySource = `${sourceBucket}/${sourceObjectKey}`;

	const response = await client.send(
		new CopyObjectCommand({
			Bucket: destinationBucket,
			Key: destinationObjectKey,
			CopySource: copySource,
		}),
	);

	return {
		json: {
			success: true,
			sourceBucket,
			sourceKey: sourceObjectKey,
			destinationBucket,
			destinationKey: destinationObjectKey,
			objectUrl: getObjectUrl(destinationBucket, destinationObjectKey),
			etag: response.CopyObjectResult?.ETag,
			lastModified: response.CopyObjectResult?.LastModified,
		},
		pairedItem: { item: i },
	};
}

/**
 * Move an object (copy + delete)
 */
async function moveObject(
	executeFunctions: IExecuteFunctions,
	client: S3Client,
	i: number,
): Promise<INodeExecutionData> {
	const sourceBucket = executeFunctions.getNodeParameter(PARAMS.SOURCE_BUCKET, i, '', {
		extractValue: true,
	}) as string;
	const sourceObjectKey = executeFunctions.getNodeParameter(PARAMS.SOURCE_OBJECT_KEY, i) as string;
	const destinationBucket = executeFunctions.getNodeParameter(PARAMS.DESTINATION_BUCKET, i, '', {
		extractValue: true,
	}) as string;
	const destinationObjectKey = executeFunctions.getNodeParameter(
		PARAMS.DESTINATION_OBJECT_KEY,
		i,
	) as string;

	const copySource = `${sourceBucket}/${sourceObjectKey}`;

	// Copy object
	const copyResponse = await client.send(
		new CopyObjectCommand({
			Bucket: destinationBucket,
			Key: destinationObjectKey,
			CopySource: copySource,
		}),
	);

	// Delete source object
	await client.send(
		new DeleteObjectCommand({
			Bucket: sourceBucket,
			Key: sourceObjectKey,
		}),
	);

	return {
		json: {
			success: true,
			sourceBucket,
			sourceKey: sourceObjectKey,
			destinationBucket,
			destinationKey: destinationObjectKey,
			objectUrl: getObjectUrl(destinationBucket, destinationObjectKey),
			etag: copyResponse.CopyObjectResult?.ETag,
			lastModified: copyResponse.CopyObjectResult?.LastModified,
		},
		pairedItem: { item: i },
	};
}

/**
 * Set object ACL
 */
async function setObjectAcl(
	executeFunctions: IExecuteFunctions,
	client: S3Client,
	i: number,
): Promise<INodeExecutionData> {
	const bucketName = executeFunctions.getNodeParameter(PARAMS.BUCKET_NAME, i, '', {
		extractValue: true,
	}) as string;
	const objectKey = executeFunctions.getNodeParameter(PARAMS.OBJECT_KEY, i) as string;
	const acl = executeFunctions.getNodeParameter(PARAMS.ACL, i) as string;

	await client.send(
		new PutObjectAclCommand({
			Bucket: bucketName,
			Key: objectKey,
			ACL: acl as any,
		}),
	);

	return {
		json: {
			success: true,
			bucket: bucketName,
			key: objectKey,
			acl,
			message: 'Object ACL set successfully',
		},
		pairedItem: { item: i },
	};
}

/**
 * Get presigned URL for an object
 */
async function getPresignedUrl(
	executeFunctions: IExecuteFunctions,
	client: S3Client,
	i: number,
): Promise<INodeExecutionData> {
	const bucketName = executeFunctions.getNodeParameter(PARAMS.BUCKET_NAME, i, '', {
		extractValue: true,
	}) as string;
	const objectKey = executeFunctions.getNodeParameter(PARAMS.OBJECT_KEY, i) as string;
	const expiresIn = executeFunctions.getNodeParameter(PARAMS.EXPIRES_IN, i) as number;

	const command = new GetObjectCommand({
		Bucket: bucketName,
		Key: objectKey,
	});

	const presignedUrl = await getSignedUrl(client, command, {
		expiresIn,
	});

	return {
		json: {
			success: true,
			bucket: bucketName,
			key: objectKey,
			presignedUrl,
			expiresIn,
		},
		pairedItem: { item: i },
	};
}
