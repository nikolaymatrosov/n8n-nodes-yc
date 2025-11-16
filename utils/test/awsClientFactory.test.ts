import { S3Client } from '@aws-sdk/client-s3';
import { KinesisClient } from '@aws-sdk/client-kinesis';
import { SQSClient } from '@aws-sdk/client-sqs';
import {
	createS3Client,
	createKinesisClient,
	createSQSClient,
	createAwsClient,
	type IAwsCredentials,
} from '../awsClientFactory';

describe('awsClientFactory', () => {
	const mockCredentials: IAwsCredentials = {
		accessKeyId: 'test-access-key',
		secretAccessKey: 'test-secret-key',
	};

	describe('createS3Client', () => {
		it('should create S3Client with correct configuration', () => {
			const client = createS3Client(mockCredentials);

			expect(client).toBeInstanceOf(S3Client);
			expect(client.config.region).toBeDefined();
		});

		it('should configure client with Yandex Object Storage endpoint', async () => {
			const client = createS3Client(mockCredentials);
			const endpoint = await client.config.endpoint?.();

			expect(endpoint?.hostname).toBe('storage.yandexcloud.net');
		});

		it('should use ru-central1 region', async () => {
			const client = createS3Client(mockCredentials);
			const region = await client.config.region();

			expect(region).toBe('ru-central1');
		});

		it('should configure credentials correctly', async () => {
			const client = createS3Client(mockCredentials);
			const credentials = await client.config.credentials();

			expect(credentials.accessKeyId).toBe('test-access-key');
			expect(credentials.secretAccessKey).toBe('test-secret-key');
		});
	});

	describe('createKinesisClient', () => {
		it('should create KinesisClient with correct configuration', () => {
			const client = createKinesisClient(mockCredentials);

			expect(client).toBeInstanceOf(KinesisClient);
			expect(client.config.region).toBeDefined();
		});

		it('should configure client with Yandex Data Streams endpoint', async () => {
			const client = createKinesisClient(mockCredentials);
			const endpoint = await client.config.endpoint?.();

			expect(endpoint?.hostname).toBe('yds.serverless.yandexcloud.net');
		});

		it('should use ru-central1 region', async () => {
			const client = createKinesisClient(mockCredentials);
			const region = await client.config.region();

			expect(region).toBe('ru-central1');
		});

		it('should configure credentials correctly', async () => {
			const client = createKinesisClient(mockCredentials);
			const credentials = await client.config.credentials();

			expect(credentials.accessKeyId).toBe('test-access-key');
			expect(credentials.secretAccessKey).toBe('test-secret-key');
		});
	});

	describe('createSQSClient', () => {
		it('should create SQSClient with correct configuration', () => {
			const client = createSQSClient(mockCredentials);

			expect(client).toBeInstanceOf(SQSClient);
			expect(client.config.region).toBeDefined();
		});

		it('should configure client with Yandex Message Queue endpoint', async () => {
			const client = createSQSClient(mockCredentials);
			const endpoint = await client.config.endpoint?.();

			expect(endpoint?.hostname).toBe('message-queue.api.cloud.yandex.net');
		});

		it('should use ru-central1 region', async () => {
			const client = createSQSClient(mockCredentials);
			const region = await client.config.region();

			expect(region).toBe('ru-central1');
		});

		it('should configure credentials correctly', async () => {
			const client = createSQSClient(mockCredentials);
			const credentials = await client.config.credentials();

			expect(credentials.accessKeyId).toBe('test-access-key');
			expect(credentials.secretAccessKey).toBe('test-secret-key');
		});
	});

	describe('createAwsClient', () => {
		it('should create custom client with specified endpoint', async () => {
			const customEndpoint = 'https://custom.api.cloud.yandex.net';
			const client = createAwsClient(S3Client, customEndpoint, mockCredentials);

			expect(client).toBeInstanceOf(S3Client);

			const endpoint = await client.config.endpoint?.();
			expect(endpoint?.hostname).toBe('custom.api.cloud.yandex.net');
		});

		it('should use ru-central1 region for custom client', async () => {
			const client = createAwsClient(
				S3Client,
				'https://custom.api.cloud.yandex.net',
				mockCredentials,
			);

			const region = await client.config.region();
			expect(region).toBe('ru-central1');
		});

		it('should apply additional configuration', async () => {
			const additionalConfig = {
				forcePathStyle: true,
			};

			const client = createAwsClient(
				S3Client,
				'https://storage.yandexcloud.net',
				mockCredentials,
				additionalConfig,
			);

			expect(client).toBeInstanceOf(S3Client);
		});

		it('should configure credentials correctly for custom client', async () => {
			const client = createAwsClient(
				S3Client,
				'https://custom.api.cloud.yandex.net',
				mockCredentials,
			);

			const credentials = await client.config.credentials();
			expect(credentials.accessKeyId).toBe('test-access-key');
			expect(credentials.secretAccessKey).toBe('test-secret-key');
		});
	});

	describe('Credentials handling', () => {
		it('should handle different credential formats', () => {
			const credentials1 = { accessKeyId: 'key1', secretAccessKey: 'secret1' };
			const credentials2 = { accessKeyId: 'key2', secretAccessKey: 'secret2' };

			const client1 = createS3Client(credentials1);
			const client2 = createS3Client(credentials2);

			expect(client1).toBeInstanceOf(S3Client);
			expect(client2).toBeInstanceOf(S3Client);
			expect(client1).not.toBe(client2);
		});
	});
});
