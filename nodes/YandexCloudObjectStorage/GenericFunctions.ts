import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { S3Client, ListBucketsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

/**
 * Creates and configures an S3 client for Yandex Object Storage
 */
export function createS3Client(credentials: {
	accessKeyId: string;
	secretAccessKey: string;
}): S3Client {
	return new S3Client({
		region: 'ru-central1',
		endpoint: 'https://storage.yandexcloud.net',
		credentials: {
			accessKeyId: credentials.accessKeyId,
			secretAccessKey: credentials.secretAccessKey,
		},
		forcePathStyle: false, // Use virtual-hosted-style URLs
	});
}

/**
 * Converts a stream to a buffer
 */
export async function streamToBuffer(stream: Readable): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (chunk) => chunks.push(chunk));
		stream.on('error', reject);
		stream.on('end', () => resolve(Buffer.concat(chunks)));
	});
}

/**
 * Load buckets for resource locator
 */
export async function loadBuckets(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const credentials = await this.getCredentials('yandexCloudStaticApi');

	const client = createS3Client({
		accessKeyId: credentials.accessKeyId as string,
		secretAccessKey: credentials.secretAccessKey as string,
	});

	try {
		const response = await client.send(new ListBucketsCommand({}));

		if (!response.Buckets || response.Buckets.length === 0) {
			return { results: [] };
		}

		let results = response.Buckets.map((bucket) => ({
			name: bucket.Name!,
			value: bucket.Name!,
		}));

		// Filter results if search filter is provided
		if (filter) {
			const filterLower = filter.toLowerCase();
			results = results.filter((bucket) =>
				bucket.name.toLowerCase().includes(filterLower),
			);
		}

		return { results };
	} catch (error) {
		throw new NodeOperationError(
			this.getNode(),
			`Failed to list buckets: ${error.message}`,
		);
	}
}

/**
 * Constructs the full object URL for Yandex Object Storage
 */
export function getObjectUrl(bucketName: string, objectKey: string): string {
	return `https://storage.yandexcloud.net/${bucketName}/${objectKey}`;
}

/**
 * Load objects for resource locator (used in copy/move operations)
 */
export async function loadObjects(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const credentials = await this.getCredentials('yandexCloudStaticApi');

	// Get bucket name from node parameters
	let bucketName: string;
	try {
		bucketName = this.getNodeParameter('bucketName', 0) as string;
		// If it's a resourceLocator, extract the value
		if (typeof bucketName === 'object' && bucketName !== null) {
			bucketName = (bucketName as any).value || '';
		}
	} catch (error) {
		return { results: [] };
	}

	if (!bucketName) {
		return { results: [] };
	}

	const client = createS3Client({
		accessKeyId: credentials.accessKeyId as string,
		secretAccessKey: credentials.secretAccessKey as string,
	});

	try {
		const response = await client.send(
			new ListObjectsV2Command({
				Bucket: bucketName,
				MaxKeys: 100,
			}),
		);

		if (!response.Contents || response.Contents.length === 0) {
			return { results: [] };
		}

		let results = response.Contents.map((object) => ({
			name: object.Key!,
			value: object.Key!,
		}));

		// Filter results if search filter is provided
		if (filter) {
			const filterLower = filter.toLowerCase();
			results = results.filter((object) =>
				object.name.toLowerCase().includes(filterLower),
			);
		}

		return { results };
	} catch (error) {
		throw new NodeOperationError(
			this.getNode(),
			`Failed to list objects: ${error.message}`,
		);
	}
}

