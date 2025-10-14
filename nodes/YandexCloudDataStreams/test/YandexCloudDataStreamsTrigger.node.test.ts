import {
	KinesisClient,
	DescribeStreamCommand,
	ShardIteratorType,
} from '@aws-sdk/client-kinesis';
import { YandexCloudDataStreamsTrigger } from '../YandexCloudDataStreamsTrigger.node';
import type { IPollFunctions } from 'n8n-workflow';

// Mock AWS SDK
jest.mock('@aws-sdk/client-kinesis');

describe('YandexCloudDataStreamsTrigger Node', () => {
	let node: YandexCloudDataStreamsTrigger;
	let mockPollFunctions: Partial<IPollFunctions>;
	let mockSend: jest.Mock;
	let mockContext: Record<string, any>;

	beforeEach(() => {
		jest.clearAllMocks();

		node = new YandexCloudDataStreamsTrigger();
		mockContext = {};

		mockSend = jest.fn();
		(KinesisClient as jest.Mock).mockImplementation(() => ({
			send: mockSend,
		}));

		mockPollFunctions = {
			getNodeParameter: jest.fn(),
			getCredentials: jest.fn().mockResolvedValue({
				accessKeyId: 'test-key',
				secretAccessKey: 'test-secret',
			}),
			getWorkflowStaticData: jest.fn().mockReturnValue(mockContext),
			getNode: jest.fn().mockReturnValue({ name: 'Test Trigger' }),
		};
	});

	describe('Node Definition', () => {
		it('should have correct basic properties', () => {
			expect(node.description.displayName).toBe('Yandex Cloud Data Streams Trigger');
			expect(node.description.name).toBe('yandexCloudDataStreamsTrigger');
			expect(node.description.group).toContain('trigger');
			expect(node.description.version).toBe(1);
			expect(node.description.polling).toBe(true);
		});

		it('should have no inputs and one output', () => {
			expect(node.description.inputs).toEqual([]);
			expect(node.description.outputs).toHaveLength(1);
		});

		it('should require yandexCloudStatic credentials', () => {
			expect(node.description.credentials).toHaveLength(1);
			expect(node.description.credentials?.[0]).toEqual({
				name: 'yandexCloudStatic',
				required: true,
			});
		});
	});

	describe('Polling Mechanism', () => {
		describe('Initial Poll - Shard Iterator Initialization', () => {
			beforeEach(() => {
				(mockPollFunctions.getNodeParameter as jest.Mock)
					.mockReturnValueOnce('/ru-central1/cloud1/db1/test-stream') // streamName
					.mockReturnValueOnce({}) // pollingOptions
					.mockReturnValueOnce({}); // options
			});

			it('should initialize shard iterators on first poll', async () => {
				mockSend
					// DescribeStreamCommand
					.mockResolvedValueOnce({
						StreamDescription: {
							Shards: [
								{ ShardId: 'shard-000000' },
								{ ShardId: 'shard-000001' },
							],
						},
					})
					// GetShardIteratorCommand for shard-000000
					.mockResolvedValueOnce({
						ShardIterator: 'iterator-0',
					})
					// GetShardIteratorCommand for shard-000001
					.mockResolvedValueOnce({
						ShardIterator: 'iterator-1',
					})
					// GetRecordsCommand for shard-000000
					.mockResolvedValueOnce({
						Records: [],
						NextShardIterator: 'next-iterator-0',
					})
					// GetRecordsCommand for shard-000001
					.mockResolvedValueOnce({
						Records: [],
						NextShardIterator: 'next-iterator-1',
					});

			const result = await node.poll.call(mockPollFunctions as IPollFunctions);

			expect(mockSend).toHaveBeenCalled();
			expect(mockContext.shardIterators).toBeDefined();
			expect(result).toBeNull(); // No records
		});

			it('should use TRIM_HORIZON iterator type', async () => {
				(mockPollFunctions.getNodeParameter as jest.Mock)
					.mockReturnValueOnce('/ru-central1/cloud1/db1/test-stream')
					.mockReturnValueOnce({
						iteratorType: ShardIteratorType.TRIM_HORIZON,
					})
					.mockReturnValueOnce({});

				mockSend
					.mockResolvedValueOnce({
						StreamDescription: { Shards: [{ ShardId: 'shard-000000' }] },
					})
					.mockResolvedValueOnce({
						ShardIterator: 'iterator-0',
					})
					.mockResolvedValueOnce({
						Records: [],
						NextShardIterator: 'next-iterator-0',
					});

			const result = await node.poll.call(mockPollFunctions as IPollFunctions);

			expect(mockSend).toHaveBeenCalled();
			expect(result).toBeNull();
		});

			it('should use AT_TIMESTAMP with timestamp', async () => {
				const timestamp = '2025-10-14T10:00:00Z';

				(mockPollFunctions.getNodeParameter as jest.Mock)
					.mockReturnValueOnce('/ru-central1/cloud1/db1/test-stream')
					.mockReturnValueOnce({
						iteratorType: ShardIteratorType.AT_TIMESTAMP,
						timestamp,
					})
					.mockReturnValueOnce({});

				mockSend
					.mockResolvedValueOnce({
						StreamDescription: { Shards: [{ ShardId: 'shard-000000' }] },
					})
					.mockResolvedValueOnce({
						ShardIterator: 'iterator-0',
					})
					.mockResolvedValueOnce({
						Records: [],
					});

			const result = await node.poll.call(mockPollFunctions as IPollFunctions);

			expect(mockSend).toHaveBeenCalled();
			expect(result).toBeNull();
		});
		});

		describe('Subsequent Polls', () => {
			beforeEach(() => {
				mockContext.shardIterators = {
					'shard-000000': 'existing-iterator-0',
					'shard-000001': 'existing-iterator-1',
				};
				mockContext.lastRefreshTime = Date.now();

				(mockPollFunctions.getNodeParameter as jest.Mock)
					.mockReturnValueOnce('/ru-central1/cloud1/db1/test-stream')
					.mockReturnValueOnce({})
					.mockReturnValueOnce({});
			});

			it('should use existing iterators without refresh', async () => {
				mockSend
					.mockResolvedValueOnce({
						Records: [],
						NextShardIterator: 'next-iterator-0',
					})
					.mockResolvedValueOnce({
						Records: [],
						NextShardIterator: 'next-iterator-1',
					});

				await node.poll.call(mockPollFunctions as IPollFunctions);

				// Should NOT call DescribeStreamCommand
				expect(mockSend).not.toHaveBeenCalledWith(expect.any(DescribeStreamCommand));
				// Should call GetRecordsCommand twice
				expect(mockSend).toHaveBeenCalledTimes(2);
			});

			it('should update iterators after successful poll', async () => {
				mockSend
					.mockResolvedValueOnce({
						Records: [],
						NextShardIterator: 'updated-iterator-0',
					})
					.mockResolvedValueOnce({
						Records: [],
						NextShardIterator: 'updated-iterator-1',
					});

				await node.poll.call(mockPollFunctions as IPollFunctions);

				expect(mockContext.shardIterators['shard-000000']).toBe('updated-iterator-0');
				expect(mockContext.shardIterators['shard-000001']).toBe('updated-iterator-1');
			});

			it('should remove shard when NextShardIterator is null', async () => {
				mockSend
					.mockResolvedValueOnce({
						Records: [],
						NextShardIterator: null, // Shard closed
					})
					.mockResolvedValueOnce({
						Records: [],
						NextShardIterator: 'next-iterator-1',
					});

				await node.poll.call(mockPollFunctions as IPollFunctions);

				expect(mockContext.shardIterators['shard-000000']).toBeUndefined();
				expect(mockContext.shardIterators['shard-000001']).toBe('next-iterator-1');
			});
		});

		describe('Record Processing', () => {
			beforeEach(() => {
				mockContext.shardIterators = { 'shard-000000': 'iterator-0' };
				mockContext.lastRefreshTime = Date.now();

				(mockPollFunctions.getNodeParameter as jest.Mock)
					.mockReturnValueOnce('/ru-central1/cloud1/db1/test-stream')
					.mockReturnValueOnce({})
					.mockReturnValueOnce({});
			});

			it('should process and return records', async () => {
				mockSend.mockResolvedValueOnce({
					Records: [
						{
							Data: Buffer.from('test record 1'),
							SequenceNumber: '1',
							ApproximateArrivalTimestamp: new Date('2025-10-14T10:00:00Z'),
							PartitionKey: 'key1',
						},
						{
							Data: Buffer.from('test record 2'),
							SequenceNumber: '2',
							ApproximateArrivalTimestamp: new Date('2025-10-14T10:00:01Z'),
							PartitionKey: 'key2',
						},
					],
					NextShardIterator: 'next-iterator',
				});

				const result = await node.poll.call(mockPollFunctions as IPollFunctions);

				expect(result).toHaveLength(1);
				expect(result![0]).toHaveLength(2);
				expect(result![0][0].json).toBe('test record 1');
				expect(result![0][1].json).toBe('test record 2');
			});

			it('should parse JSON data when parseJsonData is true', async () => {
				(mockPollFunctions.getNodeParameter as jest.Mock)
					.mockReturnValueOnce('/ru-central1/cloud1/db1/test-stream')
					.mockReturnValueOnce({})
					.mockReturnValueOnce({ parseJsonData: true });

				mockSend.mockResolvedValueOnce({
					Records: [
						{
							Data: Buffer.from('{"userId": 123, "action": "login"}'),
							SequenceNumber: '1',
							ApproximateArrivalTimestamp: new Date(),
							PartitionKey: 'user-123',
						},
					],
					NextShardIterator: 'next-iterator',
				});

				const result = await node.poll.call(mockPollFunctions as IPollFunctions);

				expect(result![0][0].json).toEqual({ userId: 123, action: 'login' });
			});

			it('should keep string if JSON parsing fails', async () => {
				(mockPollFunctions.getNodeParameter as jest.Mock)
					.mockReturnValueOnce('/ru-central1/cloud1/db1/test-stream')
					.mockReturnValueOnce({})
					.mockReturnValueOnce({ parseJsonData: true });

				mockSend.mockResolvedValueOnce({
					Records: [
						{
							Data: Buffer.from('not valid json{'),
							SequenceNumber: '1',
							ApproximateArrivalTimestamp: new Date(),
							PartitionKey: 'key1',
						},
					],
					NextShardIterator: 'next-iterator',
				});

				const result = await node.poll.call(mockPollFunctions as IPollFunctions);

				expect(result![0][0].json).toBe('not valid json{');
			});

		it('should include metadata when requested', async () => {
			// Reset the mock completely from beforeEach
			(mockPollFunctions.getNodeParameter as jest.Mock).mockReset();
			(mockPollFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('/ru-central1/cloud1/db1/test-stream')
				.mockReturnValueOnce({})
				.mockReturnValueOnce({ includeMetadata: true, parseJsonData: false });

			const timestamp = new Date('2025-10-14T10:00:00Z');

			mockSend.mockResolvedValueOnce({
				Records: [
					{
						Data: Buffer.from('test data'),
						SequenceNumber: '12345',
						ApproximateArrivalTimestamp: timestamp,
						PartitionKey: 'key1',
					},
				],
				NextShardIterator: 'next-iterator',
			});

			const result = await node.poll.call(mockPollFunctions as IPollFunctions);

			expect(result).not.toBeNull();
			expect(result![0]).toHaveLength(1);
			expect(result![0][0].json).toMatchObject({
				data: 'test data',
				metadata: {
					sequenceNumber: '12345',
					approximateArrivalTimestamp: timestamp,
					partitionKey: 'key1',
					shardId: 'shard-000000',
				},
			});
		});

			it('should return null when no records received', async () => {
				mockSend.mockResolvedValueOnce({
					Records: [],
					NextShardIterator: 'next-iterator',
				});

				const result = await node.poll.call(mockPollFunctions as IPollFunctions);

				expect(result).toBeNull();
			});
		});

		describe('Shard Iteration Strategies', () => {
			beforeEach(() => {
				mockContext.shardIterators = {
					'shard-000000': 'iterator-0',
					'shard-000001': 'iterator-1',
					'shard-000002': 'iterator-2',
				};
				mockContext.lastRefreshTime = Date.now();
			});

			it('should poll all shards with allShards strategy', async () => {
				(mockPollFunctions.getNodeParameter as jest.Mock)
					.mockReturnValueOnce('/ru-central1/cloud1/db1/test-stream')
					.mockReturnValueOnce({ shardIterationStrategy: 'allShards' })
					.mockReturnValueOnce({});

				mockSend
					.mockResolvedValueOnce({ Records: [], NextShardIterator: 'next-0' })
					.mockResolvedValueOnce({ Records: [], NextShardIterator: 'next-1' })
					.mockResolvedValueOnce({ Records: [], NextShardIterator: 'next-2' });

				await node.poll.call(mockPollFunctions as IPollFunctions);

				expect(mockSend).toHaveBeenCalledTimes(3);
			});

			it('should poll one shard with roundRobin strategy', async () => {
				mockContext.currentShardIndex = 1;

				(mockPollFunctions.getNodeParameter as jest.Mock)
					.mockReturnValueOnce('/ru-central1/cloud1/db1/test-stream')
					.mockReturnValueOnce({ shardIterationStrategy: 'roundRobin' })
					.mockReturnValueOnce({});

				mockSend.mockResolvedValueOnce({ Records: [], NextShardIterator: 'next-1' });

				await node.poll.call(mockPollFunctions as IPollFunctions);

				expect(mockSend).toHaveBeenCalledTimes(1);
				expect(mockContext.currentShardIndex).toBe(2);
			});

			it('should wrap around in roundRobin strategy', async () => {
				mockContext.currentShardIndex = 2;

				(mockPollFunctions.getNodeParameter as jest.Mock)
					.mockReturnValueOnce('/ru-central1/cloud1/db1/test-stream')
					.mockReturnValueOnce({ shardIterationStrategy: 'roundRobin' })
					.mockReturnValueOnce({});

				mockSend.mockResolvedValueOnce({ Records: [], NextShardIterator: 'next-2' });

				await node.poll.call(mockPollFunctions as IPollFunctions);

				expect(mockContext.currentShardIndex).toBe(0);
			});

		it('should poll specific shard with specificShard strategy', async () => {
			(mockPollFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						streamName: '/ru-central1/cloud1/db1/test-stream',
						pollingOptions: {
							shardIterationStrategy: 'specificShard',
							shardId: 'shard-000001',
						},
						options: {},
					};
					return params[paramName];
				},
			);

			mockSend.mockResolvedValueOnce({ Records: [], NextShardIterator: 'next-1' });

			const result = await node.poll.call(mockPollFunctions as IPollFunctions);

			expect(mockSend).toHaveBeenCalledTimes(1);
			expect(result).toBeNull();
		});
		});

		describe('Error Handling', () => {
			beforeEach(() => {
				mockContext.shardIterators = { 'shard-000000': 'expired-iterator' };
				mockContext.lastRefreshTime = Date.now();

				(mockPollFunctions.getNodeParameter as jest.Mock)
					.mockReturnValueOnce('/ru-central1/cloud1/db1/test-stream')
					.mockReturnValueOnce({})
					.mockReturnValueOnce({});
			});

			it('should refresh iterator on expiration', async () => {
				mockSend
					// First GetRecordsCommand fails
					.mockRejectedValueOnce(new Error('Iterator expired'))
					// GetShardIteratorCommand to get new iterator
					.mockResolvedValueOnce({
						ShardIterator: 'new-iterator',
					});

				const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

				const result = await node.poll.call(mockPollFunctions as IPollFunctions);

				expect(mockContext.shardIterators['shard-000000']).toBe('new-iterator');
				expect(result).toBeNull();

				consoleSpy.mockRestore();
			});

			it('should remove shard if refresh fails', async () => {
				mockSend
					.mockRejectedValueOnce(new Error('Iterator expired'))
					.mockRejectedValueOnce(new Error('Cannot refresh'));

				const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

				await node.poll.call(mockPollFunctions as IPollFunctions);

				expect(mockContext.shardIterators['shard-000000']).toBeUndefined();

				consoleSpy.mockRestore();
			});

		it('should throw error if stream name is missing', async () => {
			// Reset the mock completely from beforeEach
			(mockPollFunctions.getNodeParameter as jest.Mock).mockReset();
			(mockPollFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('') // empty streamName
				.mockReturnValueOnce({}) // pollingOptions
				.mockReturnValueOnce({}); // options

			await expect(node.poll.call(mockPollFunctions as IPollFunctions)).rejects.toThrow(
				'Stream name is required',
			);
		});

		it('should throw error for specificShard without shardId', async () => {
			// Reset the mock completely from beforeEach
			(mockPollFunctions.getNodeParameter as jest.Mock).mockReset();
			(mockPollFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('/ru-central1/cloud1/db1/test-stream') // streamName
				.mockReturnValueOnce({ // pollingOptions
					shardIterationStrategy: 'specificShard',
					shardId: '', // empty shardId
				})
				.mockReturnValueOnce({}); // options

			await expect(node.poll.call(mockPollFunctions as IPollFunctions)).rejects.toThrow(
				'Shard ID is required',
			);
		});
		});

		describe('Shard Refresh', () => {
			it('should refresh shards after 5 minutes', async () => {
				mockContext.shardIterators = { 'shard-000000': 'old-iterator' };
				mockContext.lastRefreshTime = Date.now() - 6 * 60 * 1000; // 6 minutes ago

				(mockPollFunctions.getNodeParameter as jest.Mock)
					.mockReturnValueOnce('/ru-central1/cloud1/db1/test-stream')
					.mockReturnValueOnce({})
					.mockReturnValueOnce({});

				mockSend
					// DescribeStreamCommand
					.mockResolvedValueOnce({
						StreamDescription: {
							Shards: [
								{ ShardId: 'shard-000000' },
								{ ShardId: 'shard-000001' }, // New shard
							],
						},
					})
					// GetShardIteratorCommand for new shard
					.mockResolvedValueOnce({
						ShardIterator: 'new-shard-iterator',
					})
					// GetRecordsCommand for shard-000000 (keeps old iterator)
					.mockResolvedValueOnce({
						Records: [],
						NextShardIterator: 'updated-old-iterator',
					})
					// GetRecordsCommand for shard-000001
					.mockResolvedValueOnce({
						Records: [],
						NextShardIterator: 'next-new-iterator',
					});

				await node.poll.call(mockPollFunctions as IPollFunctions);

				expect(mockSend).toHaveBeenCalledWith(expect.any(DescribeStreamCommand));
				expect(mockContext.shardIterators).toHaveProperty('shard-000000');
				expect(mockContext.shardIterators).toHaveProperty('shard-000001');
			});
		});
	});
});

