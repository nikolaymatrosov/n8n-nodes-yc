import type {
	IPollFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError, jsonParse } from 'n8n-workflow';

import {
	DescribeStreamCommand,
	GetShardIteratorCommand,
	GetRecordsCommand,
	ShardIteratorType,
} from '@aws-sdk/client-kinesis';

import { createKinesisClient, loadStreams } from './GenericFunctions';
import type { ShardIterators, TriggerRecordOutput } from './types';

export class YandexCloudDataStreamsTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Yandex Cloud Data Streams Trigger',
		name: 'yandexCloudDataStreamsTrigger',
		icon: 'file:YDS.svg',
		group: ['trigger'],
		version: 1,
		polling: true,
		description: 'Polls Yandex Cloud Data Streams for new records',
		defaults: {
			name: 'Yandex Cloud Data Streams Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'yandexCloudStaticApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Stream',
				name: 'streamName',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				description: 'The stream to listen to',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'loadStreams',
							searchable: true,
						},
					},
					{
						displayName: 'By Name',
						name: 'name',
						type: 'string',
						placeholder: '/ru-central1/b1gi1kuj2dht********/cc8028jgtuab********/example-stream',
					},
				],
			},
			{
				displayName: 'Polling Options',
				name: 'pollingOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
			options: [
				{
					displayName: 'Iterator Type',
					name: 'iteratorType',
					type: 'options',
					options: [
						{
							name: 'Latest',
							value: 'LATEST',
							description: 'Start reading from the latest records',
						},
						{
							name: 'Trim Horizon',
							value: 'TRIM_HORIZON',
							description: 'Start reading from the oldest available records',
						},
						{
							name: 'At Timestamp',
							value: 'AT_TIMESTAMP',
							description: 'Start reading from a specific timestamp',
						},
					],
					default: 'LATEST',
					description: 'Where to start reading records from',
				},
				{
					displayName: 'Max Records Per Poll',
					name: 'maxRecordsPerPoll',
					type: 'number',
					typeOptions: {
						minValue: 1,
						maxValue: 10000,
					},
					default: 100,
					description: 'Maximum records to fetch per shard in one poll',
				},
				{
					displayName: 'Shard ID',
					name: 'shardId',
					type: 'string',
					displayOptions: {
						show: {
							shardIterationStrategy: ['specificShard'],
						},
					},
					default: '',
					placeholder: 'shard-000000',
					description: 'Specific shard ID to poll (only for Specific Shard strategy)',
				},
				{
					displayName: 'Shard Iteration Strategy',
					name: 'shardIterationStrategy',
					type: 'options',
					options: [
						{
							name: 'Round Robin',
							value: 'roundRobin',
							description: 'Cycle through shards one at a time',
						},
						{
							name: 'All Shards',
							value: 'allShards',
							description: 'Poll all shards each time',
						},
						{
							name: 'Specific Shard',
							value: 'specificShard',
							description: 'Poll only one specific shard',
						},
					],
					default: 'allShards',
					description: 'How to iterate through shards',
				},
				{
					displayName: 'Timestamp',
					name: 'timestamp',
					type: 'dateTime',
					displayOptions: {
						show: {
							iteratorType: ['AT_TIMESTAMP'],
						},
					},
					default: '',
					description: 'Timestamp to start reading from (only for AT_TIMESTAMP iterator type)',
				},
			],
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Parse JSON Data',
						name: 'parseJsonData',
						type: 'boolean',
						default: true,
						description: 'Whether to automatically parse JSON data in records',
					},
					{
						displayName: 'Include Metadata',
						name: 'includeMetadata',
						type: 'boolean',
						default: false,
						description: 'Whether to include shard ID, sequence number in output',
					},
				],
			},
		],
	};

	methods = {
		listSearch: {
			loadStreams,
		},
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const credentials = await this.getCredentials('yandexCloudStaticApi');
		const streamName = this.getNodeParameter('streamName', '', { extractValue: true }) as string;
		const pollingOptions = this.getNodeParameter('pollingOptions', {}) as {
			iteratorType?: ShardIteratorType;
			timestamp?: string;
			maxRecordsPerPoll?: number;
			shardIterationStrategy?: string;
			shardId?: string;
		};
		const options = this.getNodeParameter('options', {}) as {
			parseJsonData?: boolean;
			includeMetadata?: boolean;
		};

		if (!streamName) {
			throw new NodeOperationError(this.getNode(), 'Stream name is required!');
		}

		// Set default values
		const iteratorType = pollingOptions.iteratorType || ShardIteratorType.LATEST;
		const maxRecordsPerPoll = pollingOptions.maxRecordsPerPoll || 100;
		const shardIterationStrategy = pollingOptions.shardIterationStrategy || 'allShards';
		const parseJsonData = options.parseJsonData !== false; // Default true
		const includeMetadata = options.includeMetadata === true; // Default false

		// Create Kinesis client
		const client = createKinesisClient({
			accessKeyId: credentials.accessKeyId as string,
			secretAccessKey: credentials.secretAccessKey as string,
		});

		// Get or initialize context
		const context = this.getWorkflowStaticData('node');
		let shardIterators: ShardIterators = (context.shardIterators as ShardIterators) || {};
		let currentShardIndex: number = (context.currentShardIndex as number) || 0;
		let lastRefreshTime: number = (context.lastRefreshTime as number) || 0;

		// Refresh shard list every 5 minutes or if empty
		const now = Date.now();
		const shouldRefresh =
			Object.keys(shardIterators).length === 0 || now - lastRefreshTime > 5 * 60 * 1000;

		if (shouldRefresh) {
			try {
				// Describe stream to get shards
				const describeResponse = await client.send(
					new DescribeStreamCommand({
						StreamName: streamName,
					}),
				);

				const shards = describeResponse.StreamDescription?.Shards || [];
				if (shards.length === 0) {
					throw new NodeOperationError(this.getNode(), 'No shards found in stream');
				}

				// Initialize iterators for new or missing shards
				const newShardIterators: ShardIterators = {};

				for (const shard of shards) {
					const shardId = shard.ShardId!;

					// If we already have an iterator for this shard, keep it
					if (shardIterators[shardId]) {
						newShardIterators[shardId] = shardIterators[shardId];
					} else {
						// Create new iterator for this shard
						const iteratorParams: any = {
							StreamName: streamName,
							ShardId: shardId,
							ShardIteratorType: iteratorType,
						};

						if (iteratorType === ShardIteratorType.AT_TIMESTAMP && pollingOptions.timestamp) {
							iteratorParams.Timestamp = new Date(pollingOptions.timestamp);
						}

						const iteratorResponse = await client.send(
							new GetShardIteratorCommand(iteratorParams),
						);

						if (iteratorResponse.ShardIterator) {
							newShardIterators[shardId] = iteratorResponse.ShardIterator;
						}
					}
				}

				shardIterators = newShardIterators;
				context.lastRefreshTime = now;
			} catch (error) {
				throw new NodeOperationError(
					this.getNode(),
					`Failed to initialize shard iterators: ${error.message}`,
				);
			}
		}

		// Determine which shards to poll
		let shardsToPoll: string[] = [];
		const allShardIds = Object.keys(shardIterators);

		if (shardIterationStrategy === 'specificShard') {
			const specificShardId = pollingOptions.shardId;
			if (!specificShardId) {
				throw new NodeOperationError(
					this.getNode(),
					'Shard ID is required for Specific Shard strategy',
				);
			}
			if (!shardIterators[specificShardId]) {
				throw new NodeOperationError(this.getNode(), `Shard ${specificShardId} not found`);
			}
			shardsToPoll = [specificShardId];
		} else if (shardIterationStrategy === 'roundRobin') {
			// Poll one shard in round-robin fashion
			if (allShardIds.length > 0) {
				const shardId = allShardIds[currentShardIndex % allShardIds.length];
				shardsToPoll = [shardId];
				context.currentShardIndex = (currentShardIndex + 1) % allShardIds.length;
			}
		} else {
			// allShards - poll all shards
			shardsToPoll = allShardIds;
		}

		// Poll selected shards
		const returnData: INodeExecutionData[] = [];

		for (const shardId of shardsToPoll) {
			let shardIterator = shardIterators[shardId];

			if (!shardIterator) {
				continue;
			}

			try {
				const response = await client.send(
					new GetRecordsCommand({
						ShardIterator: shardIterator,
						Limit: maxRecordsPerPoll,
					}),
				);

				// Update iterator for next poll
				if (response.NextShardIterator) {
					shardIterators[shardId] = response.NextShardIterator;
				} else {
					// Iterator expired or shard closed - remove it
					delete shardIterators[shardId];
				}

				// Process records
				if (response.Records && response.Records.length > 0) {
					for (const record of response.Records) {
						// Decode data
						let data: any = Buffer.from(record.Data!).toString('utf-8');

						// Parse JSON if requested
						if (parseJsonData) {
							try {
								data = jsonParse(data);
							} catch (error) {
								// If JSON parsing fails, keep the original string
							}
						}

						// Build output
						const output: TriggerRecordOutput = {
							data,
						};

						if (includeMetadata) {
							output.metadata = {
								sequenceNumber: record.SequenceNumber!,
								approximateArrivalTimestamp: record.ApproximateArrivalTimestamp!,
								partitionKey: record.PartitionKey!,
								shardId,
							};
						}

						// If metadata is included, use nested structure, otherwise just return data
						returnData.push({
							json: includeMetadata ? output : data,
						});
					}
				}
			} catch (error) {
				// If iterator expired, try to get a new one
				if (
					error.message.includes('expired') ||
					error.message.includes('InvalidArgumentException')
				) {
					try {
						const iteratorParams: any = {
							StreamName: streamName,
							ShardId: shardId,
							ShardIteratorType: ShardIteratorType.LATEST,
						};

						const iteratorResponse = await client.send(
							new GetShardIteratorCommand(iteratorParams),
						);

						if (iteratorResponse.ShardIterator) {
							shardIterators[shardId] = iteratorResponse.ShardIterator;
						} else {
							delete shardIterators[shardId];
						}
					} catch (refreshError) {
						// If we can't refresh, just remove this shard
						delete shardIterators[shardId];
					}
				} else {
					// For other errors, log but continue
					console.error(`Error polling shard ${shardId}:`, error.message);
				}
			}
		}

		// Save updated context
		context.shardIterators = shardIterators;

		// Return null if no records to continue polling
		if (returnData.length === 0) {
			return null;
		}

		return [returnData];
	}
}

