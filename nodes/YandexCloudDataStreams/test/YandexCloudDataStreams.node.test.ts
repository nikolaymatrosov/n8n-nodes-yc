import { KinesisClient } from '@aws-sdk/client-kinesis';
import { YandexCloudDataStreams } from '../YandexCloudDataStreams.node';
import type { IExecuteFunctions } from 'n8n-workflow';

// Mock AWS SDK
jest.mock('@aws-sdk/client-kinesis');

describe('YandexCloudDataStreams Node', () => {
	let node: YandexCloudDataStreams;
	let mockExecuteFunctions: Partial<IExecuteFunctions>;
	let mockSend: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();

		node = new YandexCloudDataStreams();

		mockSend = jest.fn();
		(KinesisClient as jest.Mock).mockImplementation(() => ({
			send: mockSend,
		}));

		mockExecuteFunctions = {
			getInputData: jest.fn().mockReturnValue([{ json: {} }]),
			getNodeParameter: jest.fn(),
			getCredentials: jest.fn().mockResolvedValue({
				accessKeyId: 'test-key',
				secretAccessKey: 'test-secret',
			}),
			continueOnFail: jest.fn().mockReturnValue(false),
			getNode: jest.fn().mockReturnValue({ name: 'Test Node' }),
		};
	});

	describe('Node Definition', () => {
		it('should have correct basic properties', () => {
			expect(node.description.displayName).toBe('Yandex Cloud Data Streams');
			expect(node.description.name).toBe('yandexCloudDataStreams');
			expect(node.description.group).toContain('transform');
			expect(node.description.version).toBe(1);
		});

		it('should have correct credentials configuration', () => {
			expect(node.description.credentials).toHaveLength(1);
			expect(node.description.credentials?.[0]).toEqual({
				name: 'yandexCloudStaticApi',
				required: true,
			});
		});

		it('should have correct input/output configuration', () => {
			expect(node.description.inputs).toEqual(['main']);
			expect(node.description.outputs).toEqual(['main']);
		});

		it('should expose loadStreams method', () => {
			expect(node.methods?.listSearch?.loadStreams).toBeDefined();
		});
	});

	describe('Stream Operations', () => {
		describe('List Streams', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock)
					.mockReturnValueOnce('stream') // resource
					.mockReturnValueOnce('list') // operation
					.mockReturnValueOnce({}); // options
			});

			it('should list streams successfully', async () => {
				mockSend.mockResolvedValue({
					StreamNames: [
						'/ru-central1/cloud1/db1/stream1',
						'/ru-central1/cloud1/db1/stream2',
					],
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result).toHaveLength(1);
				expect(result[0]).toHaveLength(2);
				expect(result[0][0].json).toMatchObject({
					streamName: '/ru-central1/cloud1/db1/stream1',
					displayName: 'stream1',
				});
			});

			it('should apply limit option', async () => {
				(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([{ json: {} }]);
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'stream',
							operation: 'list',
							options: { limit: 50 },
						};
						return params[paramName];
					},
				);

				mockSend.mockResolvedValue({ StreamNames: ['stream1', 'stream2'] });

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0]).toHaveLength(2);
				expect(result[0][0].json.streamName).toBe('stream1');
			});

			it('should handle empty stream list', async () => {
				mockSend.mockResolvedValue({ StreamNames: [] });

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result).toEqual([[]]);
			});
		});

		describe('Describe Stream', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([{ json: {} }]);
				(mockExecuteFunctions.getNodeParameter as jest.Mock)
					.mockReturnValueOnce('stream') // resource
					.mockReturnValueOnce('describe'); // operation
			});

			it('should describe stream successfully', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce(
					'/ru-central1/cloud1/db1/test-stream',
				);

				mockSend.mockResolvedValue({
					StreamDescription: {
						StreamName: '/ru-central1/cloud1/db1/test-stream',
						StreamStatus: 'ACTIVE',
						StreamARN: 'arn:aws:kinesis:ru-central1:account:stream/test-stream',
						RetentionPeriodHours: 24,
						Shards: [
							{
								ShardId: 'shard-000000',
								HashKeyRange: {
									StartingHashKey: '0',
									EndingHashKey: '340282366920938463463374607431768211455',
								},
							},
						],
					},
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: true,
					streamName: '/ru-central1/cloud1/db1/test-stream',
					status: 'ACTIVE',
					retentionPeriodHours: 24,
				});
				expect(result[0][0].json.shards).toHaveLength(1);
			});

			it('should handle continueOnFail on error', async () => {
				(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce('test-stream');

				mockSend.mockRejectedValue(new Error('Stream not found'));

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					error: 'Stream not found',
					success: false,
				});
			});
		});
	});

	describe('Record Operations', () => {
		describe('Put Record', () => {
			it('should put string record successfully', async () => {
				(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([{ json: {} }]);
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'record',
							operation: 'put',
							streamName: '/ru-central1/cloud1/db1/test-stream',
							dataType: 'string',
							data: 'test data',
							partitionKey: 'partition-key-1',
							additionalFields: {},
						};
						return params[paramName];
					},
				);

				mockSend.mockResolvedValue({
					ShardId: 'shard-000000',
					SequenceNumber: '12345',
					EncryptionType: 'NONE',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: true,
					shardId: 'shard-000000',
					sequenceNumber: '12345',
					encryptionType: 'NONE',
				});

				expect(mockSend).toHaveBeenCalled();
			});

			it('should put JSON record successfully', async () => {
				(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([{ json: {} }]);
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'record',
							operation: 'put',
							streamName: '/ru-central1/cloud1/db1/test-stream',
							dataType: 'json',
							data: { userId: 123, action: 'login' },
							partitionKey: 'user-123',
							additionalFields: {},
						};
						return params[paramName];
					},
				);

				mockSend.mockResolvedValue({
					ShardId: 'shard-000001',
					SequenceNumber: '67890',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: true,
					shardId: 'shard-000001',
					sequenceNumber: '67890',
				});
			});

			it('should include additional fields', async () => {
				(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([{ json: {} }]);
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'record',
							operation: 'put',
							streamName: '/ru-central1/cloud1/db1/test-stream',
							dataType: 'string',
							data: 'test data',
							partitionKey: 'partition-key',
							additionalFields: {
								explicitHashKey: '12345',
								sequenceNumberForOrdering: '67890',
							},
						};
						return params[paramName];
					},
				);

				mockSend.mockResolvedValue({
					ShardId: 'shard-000000',
					SequenceNumber: '12345',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: true,
				});
			});
		});

		describe('Put Multiple Records', () => {
			it('should put multiple records in define mode', async () => {
				(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([{ json: {} }]);
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'record',
							operation: 'putMultiple',
							streamName: '/ru-central1/cloud1/db1/test-stream',
							inputMode: 'define',
							records: {
								record: [
									{ data: 'data1', partitionKey: 'key1' },
									{ data: 'data2', partitionKey: 'key2' },
								],
							},
						};
						return params[paramName];
					},
				);

				mockSend.mockResolvedValue({
					Records: [
						{ ShardId: 'shard-000000', SequenceNumber: '1' },
						{ ShardId: 'shard-000001', SequenceNumber: '2' },
					],
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: true,
					successCount: 2,
					failedCount: 0,
				});
				expect(result[0][0].json.records).toHaveLength(2);
			});

			it('should use input data mode', async () => {
				(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
					{ json: { message: 'msg1', userId: 'user1' } },
					{ json: { message: 'msg2', userId: 'user2' } },
				]);

				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'record',
							operation: 'putMultiple',
							streamName: '/ru-central1/cloud1/db1/test-stream',
							inputMode: 'useInput',
							dataField: 'message',
							partitionKeyField: 'userId',
							explicitHashKeyField: '',
						};
						return params[paramName];
					},
				);

				mockSend.mockResolvedValue({
					Records: [
						{ ShardId: 'shard-000000', SequenceNumber: '1' },
						{ ShardId: 'shard-000000', SequenceNumber: '2' },
					],
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json.successCount).toBe(2);
			});

			it('should handle partial failures', async () => {
				(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([{ json: {} }]);
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'record',
							operation: 'putMultiple',
							streamName: '/ru-central1/cloud1/db1/test-stream',
							inputMode: 'define',
							records: {
								record: [
									{ data: 'data1', partitionKey: 'key1' },
									{ data: 'data2', partitionKey: 'key2' },
								],
							},
						};
						return params[paramName];
					},
				);

				mockSend.mockResolvedValue({
					Records: [
						{ ShardId: 'shard-000000', SequenceNumber: '1' },
						{ ErrorCode: 'ProvisionedThroughputExceededException', ErrorMessage: 'Rate exceeded' },
					],
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json.successCount).toBe(1);
				expect(result[0][0].json.failedCount).toBe(1);

				const records = result[0][0].json.records as any[];
				expect(records[1]).toMatchObject({
					success: false,
					errorCode: 'ProvisionedThroughputExceededException',
				});
			});

			it('should handle empty data field by using entire item', async () => {
				(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
					{ json: { userId: 'user1', data: 'some data' } },
				]);

				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'record',
							operation: 'putMultiple',
							streamName: '/ru-central1/cloud1/db1/test-stream',
							inputMode: 'useInput',
							dataField: '',
							partitionKeyField: 'userId',
							explicitHashKeyField: '',
						};
						return params[paramName];
					},
				);

				mockSend.mockResolvedValue({
					Records: [{ ShardId: 'shard-000000', SequenceNumber: '1' }],
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json.successCount).toBe(1);
			});
		});
	});

	describe('Error Handling', () => {
		it('should throw error when continueOnFail is false', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([{ json: {} }]);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						resource: 'record',
						operation: 'put',
						streamName: '/stream',
						dataType: 'string',
						data: 'test',
						partitionKey: 'key',
						additionalFields: {},
					};
					return params[paramName];
				},
			);

			mockSend.mockRejectedValue(new Error('API Error'));

			await expect(node.execute.call(mockExecuteFunctions as IExecuteFunctions)).rejects.toThrow(
				'API Error',
			);
		});

		it('should return error object when continueOnFail is true', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([{ json: {} }]);
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						resource: 'record',
						operation: 'put',
						streamName: '/stream',
						dataType: 'string',
						data: 'data',
						partitionKey: 'key',
						additionalFields: {},
					};
					return params[paramName];
				},
			);

			mockSend.mockRejectedValue(new Error('Kinesis Error'));

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toMatchObject({
				error: 'Kinesis Error',
				success: false,
			});
		});
	});

	describe('Multiple Items Processing', () => {
		it('should process multiple input items', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
				{ json: {} },
				{ json: {} },
			]);

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						resource: 'record',
						operation: 'put',
						streamName: '/stream',
						dataType: 'string',
						data: 'test',
						partitionKey: 'key',
						additionalFields: {},
					};
					return params[paramName];
				},
			);

			mockSend.mockResolvedValue({
				ShardId: 'shard-000000',
				SequenceNumber: '1',
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0]).toHaveLength(3);
			expect(mockSend).toHaveBeenCalledTimes(3);
		});
	});
});

