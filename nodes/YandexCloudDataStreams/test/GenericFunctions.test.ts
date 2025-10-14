import { KinesisClient, ListStreamsCommand } from '@aws-sdk/client-kinesis';
import { createKinesisClient, formatStreamName, loadStreams } from '../GenericFunctions';
import type { ILoadOptionsFunctions } from 'n8n-workflow';

// Mock AWS SDK
jest.mock('@aws-sdk/client-kinesis');

describe('YandexCloudDataStreams - GenericFunctions', () => {
	describe('createKinesisClient', () => {
		it('should create a Kinesis client with correct configuration', () => {
			const credentials = {
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			};

			const client = createKinesisClient(credentials);

			expect(client).toBeInstanceOf(KinesisClient);
			expect(KinesisClient).toHaveBeenCalledWith({
				region: 'ru-central1',
				endpoint: 'https://yds.serverless.yandexcloud.net',
				credentials: {
					accessKeyId: 'test-access-key',
					secretAccessKey: 'test-secret-key',
				},
			});
		});

		it('should create client with different credentials', () => {
			const credentials = {
				accessKeyId: 'another-key',
				secretAccessKey: 'another-secret',
			};

			createKinesisClient(credentials);

			expect(KinesisClient).toHaveBeenCalledWith(
				expect.objectContaining({
					credentials: {
						accessKeyId: 'another-key',
						secretAccessKey: 'another-secret',
					},
				}),
			);
		});
	});

	describe('formatStreamName', () => {
		it('should return full path unchanged if it starts with /', () => {
			const fullPath = '/ru-central1/b1gi1kuj2dht12345678/cc8028jgtuab87654321/test-stream';
			const result = formatStreamName(fullPath);

			expect(result).toBe(fullPath);
		});

		it('should construct full path when cloudId and databaseId are provided', () => {
			const streamName = 'test-stream';
			const cloudId = 'b1gi1kuj2dht12345678';
			const databaseId = 'cc8028jgtuab87654321';

			const result = formatStreamName(streamName, cloudId, databaseId);

			expect(result).toBe('/ru-central1/b1gi1kuj2dht12345678/cc8028jgtuab87654321/test-stream');
		});

		it('should return stream name as-is when cloudId and databaseId are not provided', () => {
			const streamName = 'test-stream';
			const result = formatStreamName(streamName);

			expect(result).toBe('test-stream');
		});

		it('should return stream name as-is when only cloudId is provided', () => {
			const streamName = 'test-stream';
			const cloudId = 'b1gi1kuj2dht12345678';

			const result = formatStreamName(streamName, cloudId);

			expect(result).toBe('test-stream');
		});

		it('should return stream name as-is when only databaseId is provided', () => {
			const streamName = 'test-stream';
			const databaseId = 'cc8028jgtuab87654321';

			const result = formatStreamName(streamName, undefined, databaseId);

			expect(result).toBe('test-stream');
		});

		it('should handle empty stream name', () => {
			const result = formatStreamName('', 'cloudId', 'databaseId');

			expect(result).toBe('/ru-central1/cloudId/databaseId/');
		});
	});

	describe('loadStreams', () => {
		let mockContext: Partial<ILoadOptionsFunctions>;
		let mockSend: jest.Mock;

		beforeEach(() => {
			jest.clearAllMocks();

			mockSend = jest.fn();
			(KinesisClient as jest.Mock).mockImplementation(() => ({
				send: mockSend,
			}));

			mockContext = {
				getCredentials: jest.fn().mockResolvedValue({
					accessKeyId: 'test-key',
					secretAccessKey: 'test-secret',
				}),
				getNode: jest.fn().mockReturnValue({ name: 'Test Node' }),
			};
		});

		it('should load and return streams', async () => {
			mockSend.mockResolvedValue({
				StreamNames: [
					'/ru-central1/cloud1/db1/stream1',
					'/ru-central1/cloud1/db1/stream2',
					'/ru-central1/cloud2/db2/stream3',
				],
			});

			const result = await loadStreams.call(mockContext as ILoadOptionsFunctions);

			expect(result).toEqual({
				results: [
					{ name: 'stream1', value: '/ru-central1/cloud1/db1/stream1' },
					{ name: 'stream2', value: '/ru-central1/cloud1/db1/stream2' },
					{ name: 'stream3', value: '/ru-central1/cloud2/db2/stream3' },
				],
			});
		});

		it('should filter streams based on search term', async () => {
			mockSend.mockResolvedValue({
				StreamNames: [
					'/ru-central1/cloud1/db1/production-stream',
					'/ru-central1/cloud1/db1/test-stream',
					'/ru-central1/cloud2/db2/staging-stream',
				],
			});

			const result = await loadStreams.call(mockContext as ILoadOptionsFunctions, 'test');

			expect(result).toEqual({
				results: [{ name: 'test-stream', value: '/ru-central1/cloud1/db1/test-stream' }],
			});
		});

		it('should perform case-insensitive filtering', async () => {
			mockSend.mockResolvedValue({
				StreamNames: [
					'/ru-central1/cloud1/db1/Production-Stream',
					'/ru-central1/cloud1/db1/TEST-stream',
				],
			});

			const result = await loadStreams.call(mockContext as ILoadOptionsFunctions, 'PROD');

			expect(result).toEqual({
				results: [
					{ name: 'Production-Stream', value: '/ru-central1/cloud1/db1/Production-Stream' },
				],
			});
		});

		it('should filter by full path', async () => {
			mockSend.mockResolvedValue({
				StreamNames: [
					'/ru-central1/cloud1/db1/stream1',
					'/ru-central1/cloud2/db2/stream2',
				],
			});

			const result = await loadStreams.call(mockContext as ILoadOptionsFunctions, 'cloud2');

			expect(result).toEqual({
				results: [{ name: 'stream2', value: '/ru-central1/cloud2/db2/stream2' }],
			});
		});

		it('should return empty array when no streams exist', async () => {
			mockSend.mockResolvedValue({
				StreamNames: [],
			});

			const result = await loadStreams.call(mockContext as ILoadOptionsFunctions);

			expect(result).toEqual({ results: [] });
		});

		it('should return empty array when StreamNames is undefined', async () => {
			mockSend.mockResolvedValue({});

			const result = await loadStreams.call(mockContext as ILoadOptionsFunctions);

			expect(result).toEqual({ results: [] });
		});

		it('should handle streams without full path format', async () => {
			mockSend.mockResolvedValue({
				StreamNames: ['simple-stream', 'another-stream'],
			});

			const result = await loadStreams.call(mockContext as ILoadOptionsFunctions);

			expect(result).toEqual({
				results: [
					{ name: 'simple-stream', value: 'simple-stream' },
					{ name: 'another-stream', value: 'another-stream' },
				],
			});
		});

		it('should throw NodeOperationError on API failure', async () => {
			mockSend.mockRejectedValue(new Error('API Error'));

			await expect(
				loadStreams.call(mockContext as ILoadOptionsFunctions),
			).rejects.toThrow('Failed to list streams: API Error');
		});

		it('should call ListStreamsCommand', async () => {
			mockSend.mockResolvedValue({
				StreamNames: ['/ru-central1/cloud1/db1/stream1'],
			});

			await loadStreams.call(mockContext as ILoadOptionsFunctions);

			expect(mockSend).toHaveBeenCalledWith(expect.any(ListStreamsCommand));
		});

		it('should use correct credentials from context', async () => {
			mockSend.mockResolvedValue({ StreamNames: [] });

			await loadStreams.call(mockContext as ILoadOptionsFunctions);

			expect(mockContext.getCredentials).toHaveBeenCalledWith('yandexCloudStatic');
		});
	});
});

