import { ListBucketsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { createS3Client } from '@utils/awsClientFactory';
import { createResourceLoader, parseStaticApiCredentials } from '@utils/resourceLocator';

// Re-export for backward compatibility
export { createS3Client };

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
export const loadBuckets = createResourceLoader({
	credentialType: 'yandexCloudStaticApi',
	clientFactory: createS3Client,
	resourceFetcher: async (client) => {
		const response = await client.send(new ListBucketsCommand({}));
		return response.Buckets || [];
	},
	resourceMapper: (bucket) => ({
		name: bucket.Name!,
		value: bucket.Name!,
	}),
	errorMessage: 'Failed to list buckets',
	errorType: 'operation',
	credentialParser: parseStaticApiCredentials,
});

/**
 * Constructs the full object URL for Yandex Object Storage
 */
export function getObjectUrl(bucketName: string, objectKey: string): string {
	return `https://storage.yandexcloud.net/${bucketName}/${objectKey}`;
}

/**
 * Load objects for resource locator (used in copy/move operations)
 */
export const loadObjects = createResourceLoader({
	credentialType: 'yandexCloudStaticApi',
	clientFactory: createS3Client,
	resourceFetcher: async (client, context) => {
		// Get bucket name from node parameters
		let bucketName: string;
		try {
			bucketName = context.getNodeParameter('bucketName', 0) as string;
			// If it's a resourceLocator, extract the value
			if (typeof bucketName === 'object' && bucketName !== null) {
				bucketName = (bucketName as any).value || '';
			}
		} catch (error) {
			return [];
		}

		if (!bucketName) {
			return [];
		}

		const response = await client.send(
			new ListObjectsV2Command({
				Bucket: bucketName,
				MaxKeys: 100,
			}),
		);

		return response.Contents || [];
	},
	resourceMapper: (object) => ({
		name: object.Key!,
		value: object.Key!,
	}),
	errorMessage: 'Failed to list objects',
	errorType: 'operation',
	credentialParser: parseStaticApiCredentials,
});

