import { S3Client } from '@aws-sdk/client-s3';
import { KinesisClient } from '@aws-sdk/client-kinesis';
import { SQSClient } from '@aws-sdk/client-sqs';

/**
 * Credentials interface for AWS SDK-compatible services
 */
export interface IAwsCredentials {
	accessKeyId: string;
	secretAccessKey: string;
}

/**
 * Common configuration for all Yandex Cloud AWS SDK-compatible services
 */
const COMMON_AWS_CONFIG = {
	region: 'ru-central1',
} as const;

/**
 * Creates and configures an S3 client for Yandex Object Storage.
 *
 * @param credentials - AWS-compatible credentials (access key and secret)
 * @returns Configured S3Client instance
 *
 * @example
 * ```typescript
 * const client = createS3Client({
 *   accessKeyId: 'YOUR_KEY',
 *   secretAccessKey: 'YOUR_SECRET'
 * });
 * const response = await client.send(new ListBucketsCommand({}));
 * ```
 */
export function createS3Client(credentials: IAwsCredentials): S3Client {
	return new S3Client({
		...COMMON_AWS_CONFIG,
		endpoint: 'https://storage.yandexcloud.net',
		credentials: {
			accessKeyId: credentials.accessKeyId,
			secretAccessKey: credentials.secretAccessKey,
		},
		forcePathStyle: false, // Use virtual-hosted-style URLs
	});
}

/**
 * Creates and configures a Kinesis client for Yandex Data Streams.
 *
 * @param credentials - AWS-compatible credentials (access key and secret)
 * @returns Configured KinesisClient instance
 *
 * @example
 * ```typescript
 * const client = createKinesisClient({
 *   accessKeyId: 'YOUR_KEY',
 *   secretAccessKey: 'YOUR_SECRET'
 * });
 * const response = await client.send(new ListStreamsCommand({}));
 * ```
 */
export function createKinesisClient(credentials: IAwsCredentials): KinesisClient {
	return new KinesisClient({
		...COMMON_AWS_CONFIG,
		endpoint: 'https://yds.serverless.yandexcloud.net',
		credentials: {
			accessKeyId: credentials.accessKeyId,
			secretAccessKey: credentials.secretAccessKey,
		},
	});
}

/**
 * Creates and configures an SQS client for Yandex Message Queue.
 *
 * @param credentials - AWS-compatible credentials (access key and secret)
 * @returns Configured SQSClient instance
 *
 * @example
 * ```typescript
 * const client = createSQSClient({
 *   accessKeyId: 'YOUR_KEY',
 *   secretAccessKey: 'YOUR_SECRET'
 * });
 * const response = await client.send(new ListQueuesCommand({}));
 * ```
 */
export function createSQSClient(credentials: IAwsCredentials): SQSClient {
	return new SQSClient({
		...COMMON_AWS_CONFIG,
		endpoint: 'https://message-queue.api.cloud.yandex.net',
		credentials: {
			accessKeyId: credentials.accessKeyId,
			secretAccessKey: credentials.secretAccessKey,
		},
	});
}

/**
 * Generic AWS client factory for custom services.
 * Use this if you need to create a client for a service not covered by the specific factories above.
 *
 * @param ClientClass - AWS SDK client class constructor
 * @param endpoint - Service endpoint URL
 * @param credentials - AWS-compatible credentials
 * @param additionalConfig - Additional client configuration options
 * @returns Configured client instance
 *
 * @example
 * ```typescript
 * const client = createAwsClient(
 *   SESClient,
 *   'https://postbox.api.cloud.yandex.net',
 *   { accessKeyId: 'KEY', secretAccessKey: 'SECRET' }
 * );
 * ```
 */
export function createAwsClient<T>(
	ClientClass: new (config: any) => T,
	endpoint: string,
	credentials: IAwsCredentials,
	additionalConfig?: Record<string, any>,
): T {
	return new ClientClass({
		...COMMON_AWS_CONFIG,
		endpoint,
		credentials: {
			accessKeyId: credentials.accessKeyId,
			secretAccessKey: credentials.secretAccessKey,
		},
		...additionalConfig,
	});
}
