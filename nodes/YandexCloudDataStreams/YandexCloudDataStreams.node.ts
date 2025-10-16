import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	PutRecordCommand,
	PutRecordsCommand,
	DescribeStreamCommand,
	ListStreamsCommand,
} from '@aws-sdk/client-kinesis';

import { createKinesisClient, loadStreams } from './GenericFunctions';
import type { PutRecordsResult, PutRecordsRecordResult } from './types';

export class YandexCloudDataStreams implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Yandex Cloud Data Streams',
		name: 'yandexCloudDataStreams',
		icon: 'file:YDS.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Send and manage data in Yandex Cloud Data Streams',
		defaults: {
			name: 'Yandex Cloud Data Streams',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'yandexCloudStaticApi',
				required: true,
			},
		],
		properties: [
			// Resource
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Record',
						value: 'record',
					},
					{
						name: 'Stream',
						value: 'stream',
					},
				],
				default: 'record',
			},

			// =====================================
			// Record Operations
			// =====================================
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['record'],
					},
				},
				options: [
					{
						name: 'Put',
						value: 'put',
						description: 'Send a single record to stream',
						action: 'Put a record',
					},
					{
						name: 'Put Multiple',
						value: 'putMultiple',
						description: 'Send multiple records to stream in batch',
						action: 'Put multiple records',
					},
				],
				default: 'put',
			},

			// =====================================
			// Stream Operations
			// =====================================
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['stream'],
					},
				},
				options: [
					{
						name: 'Describe',
						value: 'describe',
						description: 'Get stream information',
						action: 'Describe a stream',
					},
					{
						name: 'List',
						value: 'list',
						description: 'List all streams',
						action: 'List streams',
					},
				],
				default: 'describe',
			},

			// =====================================
			// Common: Stream Name
			// =====================================
			{
				displayName: 'Stream',
				name: 'streamName',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				displayOptions: {
					show: {
						resource: ['record', 'stream'],
						operation: ['put', 'putMultiple', 'describe'],
					},
				},
				description: 'The stream to operate on',
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

			// =====================================
			// Record: Put
			// =====================================
			{
				displayName: 'Data Type',
				name: 'dataType',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['record'],
						operation: ['put'],
					},
				},
				options: [
					{
						name: 'String',
						value: 'string',
					},
					{
						name: 'JSON',
						value: 'json',
					},
				],
				default: 'string',
				description: 'Type of data to send',
			},
			{
				displayName: 'Data',
				name: 'data',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['record'],
						operation: ['put'],
						dataType: ['string'],
					},
				},
				typeOptions: {
					rows: 5,
				},
				default: '',
				placeholder: 'Data to send to stream',
				description: 'The data to send to the stream',
			},
			{
				displayName: 'Data',
				name: 'data',
				type: 'json',
				required: true,
				displayOptions: {
					show: {
						resource: ['record'],
						operation: ['put'],
						dataType: ['json'],
					},
				},
				typeOptions: {
					rows: 5,
				},
				default: '{}',
				description: 'The JSON data to send to the stream (will be stringified)',
			},
			{
				displayName: 'Partition Key',
				name: 'partitionKey',
				type: 'string',
				typeOptions: { password: true },
				required: true,
				displayOptions: {
					show: {
						resource: ['record'],
						operation: ['put'],
					},
				},
				default: '',
				placeholder: 'user_id',
				description: 'Key to determine which shard to send data to',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: ['record'],
						operation: ['put'],
					},
				},
				options: [
					{
						displayName: 'Explicit Hash Key',
						name: 'explicitHashKey',
						type: 'string',
						typeOptions: { password: true },
						default: '',
						description: 'Hash value for shard routing',
					},
					{
						displayName: 'Sequence Number For Ordering',
						name: 'sequenceNumberForOrdering',
						type: 'string',
						default: '',
						description: 'Sequence number for ordering records',
					},
				],
			},

			// =====================================
			// Record: Put Multiple
			// =====================================
			{
				displayName: 'Input Mode',
				name: 'inputMode',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['record'],
						operation: ['putMultiple'],
					},
				},
				options: [
					{
						name: 'Define Records',
						value: 'define',
						description: 'Define records manually',
					},
					{
						name: 'Use Input Data',
						value: 'useInput',
						description: 'Use each input item as a record',
					},
				],
				default: 'define',
				description: 'How to provide the records',
			},
			{
				displayName: 'Records',
				name: 'records',
				placeholder: 'Add Record',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				displayOptions: {
					show: {
						resource: ['record'],
						operation: ['putMultiple'],
						inputMode: ['define'],
					},
				},
				default: {},
				options: [
					{
						name: 'record',
						displayName: 'Record',
						values: [
							{
								displayName: 'Data',
								name: 'data',
								type: 'string',
								default: '',
								description: 'The data to send',
							},
							{
								displayName: 'Partition Key',
								name: 'partitionKey',
								type: 'string',
								typeOptions: { password: true },
								default: '',
								description: 'Key to determine which shard to send data to',
							},
							{
								displayName: 'Explicit Hash Key',
								name: 'explicitHashKey',
								type: 'string',
								typeOptions: { password: true },
								default: '',
								description: 'Hash value for shard routing (optional)',
							},
						],
					},
				],
			},
			{
				displayName: 'Data Field',
				name: 'dataField',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['record'],
						operation: ['putMultiple'],
						inputMode: ['useInput'],
					},
				},
				default: 'data',
				placeholder: 'data',
				description: 'Field name containing the data to send. Leave empty to use the entire item.',
			},
			{
				displayName: 'Partition Key Field',
				name: 'partitionKeyField',
				type: 'string',
				typeOptions: { password: true },
				required: true,
				displayOptions: {
					show: {
						resource: ['record'],
						operation: ['putMultiple'],
						inputMode: ['useInput'],
					},
				},
				default: 'partitionKey',
				placeholder: 'partitionKey',
				description: 'Field name containing the partition key',
			},
			{
				displayName: 'Explicit Hash Key Field',
				name: 'explicitHashKeyField',
				type: 'string',
				typeOptions: { password: true },
				displayOptions: {
					show: {
						resource: ['record'],
						operation: ['putMultiple'],
						inputMode: ['useInput'],
					},
				},
				default: '',
				placeholder: 'hashKey',
				description: 'Field name containing the explicit hash key (optional)',
			},

			// =====================================
			// Stream: List - Options
			// =====================================
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						resource: ['stream'],
						operation: ['list'],
					},
				},
				options: [
					{
						displayName: 'Limit',
						name: 'limit',
						type: 'number',
						typeOptions: {
							minValue: 1,
						},
						default: 50,
						description: 'Max number of results to return',
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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		// Get credentials
		const credentials = await this.getCredentials('yandexCloudStaticApi');

		// Create Kinesis client
		const client = createKinesisClient({
			accessKeyId: credentials.accessKeyId as string,
			secretAccessKey: credentials.secretAccessKey as string,
		});

		// =====================================
		// Stream Operations
		// =====================================
		if (resource === 'stream') {
			if (operation === 'list') {
				try {
					const options = this.getNodeParameter('options', 0) as {
						limit?: number;
					};

					const params: any = {};
					if (options.limit) {
						params.Limit = options.limit;
					}

					const response = await client.send(new ListStreamsCommand(params));

					const streams = (response.StreamNames || []).map((streamName: string) => ({
						json: {
							streamName,
							displayName: streamName.split('/').pop() || streamName,
						},
						pairedItem: { item: 0 },
					}));

					return [streams];
				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						`Failed to list streams: ${error.message}`,
					);
				}
			}

			// Describe stream
			for (let i = 0; i < items.length; i++) {
				try {
					if (operation === 'describe') {
						const streamName = this.getNodeParameter('streamName', i, '', {
							extractValue: true,
						}) as string;

						const response = await client.send(
							new DescribeStreamCommand({
								StreamName: streamName,
							}),
						);

						const streamDescription = response.StreamDescription;

						returnData.push({
							json: {
								success: true,
								streamName: streamDescription?.StreamName,
								status: streamDescription?.StreamStatus,
								streamARN: streamDescription?.StreamARN,
								retentionPeriodHours: streamDescription?.RetentionPeriodHours,
								enhancedMonitoring: streamDescription?.EnhancedMonitoring,
								encryptionType: streamDescription?.EncryptionType,
								keyId: streamDescription?.KeyId,
								streamCreationTimestamp: streamDescription?.StreamCreationTimestamp,
								shards: streamDescription?.Shards?.map((shard: any) => ({
									shardId: shard.ShardId,
									parentShardId: shard.ParentShardId,
									adjacentParentShardId: shard.AdjacentParentShardId,
									hashKeyRange: shard.HashKeyRange,
									sequenceNumberRange: shard.SequenceNumberRange,
								})),
							},
							pairedItem: { item: i },
						});
					}
				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({
							json: {
								error: error.message,
								success: false,
							},
							pairedItem: { item: i },
						});
						continue;
					}
					throw error;
				}
			}
		}

		// =====================================
		// Record Operations
		// =====================================
		if (resource === 'record') {
			for (let i = 0; i < items.length; i++) {
				try {
					const streamName = this.getNodeParameter('streamName', i, '', {
						extractValue: true,
					}) as string;

					if (operation === 'put') {
						const dataType = this.getNodeParameter('dataType', i) as string;
						let data = this.getNodeParameter('data', i) as string | object;
						const partitionKey = this.getNodeParameter('partitionKey', i) as string;
						const additionalFields = this.getNodeParameter('additionalFields', i) as {
							explicitHashKey?: string;
							sequenceNumberForOrdering?: string;
						};

						// Convert JSON to string if needed
						if (dataType === 'json') {
							data = JSON.stringify(data);
						}

						// Build command parameters
						const params: any = {
							StreamName: streamName,
							Data: Buffer.from(data as string, 'utf-8'),
							PartitionKey: partitionKey,
						};

						if (additionalFields.explicitHashKey) {
							params.ExplicitHashKey = additionalFields.explicitHashKey;
						}

						if (additionalFields.sequenceNumberForOrdering) {
							params.SequenceNumberForOrdering = additionalFields.sequenceNumberForOrdering;
						}

						const response = await client.send(new PutRecordCommand(params));

						returnData.push({
							json: {
								success: true,
								shardId: response.ShardId,
								sequenceNumber: response.SequenceNumber,
								encryptionType: response.EncryptionType || 'NONE',
							},
							pairedItem: { item: i },
						});
					} else if (operation === 'putMultiple') {
						const inputMode = this.getNodeParameter('inputMode', i) as string;
						let recordsToSend: Array<{
							data: string;
							partitionKey: string;
							explicitHashKey?: string;
						}> = [];

						if (inputMode === 'define') {
							const records = this.getNodeParameter('records', i) as {
								record?: Array<{
									data: string;
									partitionKey: string;
									explicitHashKey?: string;
								}>;
							};

							if (records.record && records.record.length > 0) {
								recordsToSend = records.record;
							}
						} else {
							// useInput mode - process all input items
							const dataField = this.getNodeParameter('dataField', i) as string;
							const partitionKeyField = this.getNodeParameter('partitionKeyField', i) as string;
							const explicitHashKeyField = this.getNodeParameter(
								'explicitHashKeyField',
								i,
							) as string;

							for (const item of items) {
								let data: string;
								if (dataField) {
									const fieldValue = item.json[dataField];
									data =
										typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue);
								} else {
									// Use entire item
									data = JSON.stringify(item.json);
								}

								const partitionKey = item.json[partitionKeyField] as string;
								if (!partitionKey) {
									throw new NodeOperationError(
										this.getNode(),
										`Partition key field '${partitionKeyField}' not found in item`,
									);
								}

								const record: any = {
									data,
									partitionKey,
								};

								if (explicitHashKeyField && item.json[explicitHashKeyField]) {
									record.explicitHashKey = item.json[explicitHashKeyField] as string;
								}

								recordsToSend.push(record);
							}
						}

						if (recordsToSend.length === 0) {
							throw new NodeOperationError(this.getNode(), 'No records to send');
						}

						// Prepare records for Kinesis
						const kinesisRecords = recordsToSend.map((record) => {
							const kinesisRecord: any = {
								Data: Buffer.from(record.data, 'utf-8'),
								PartitionKey: record.partitionKey,
							};

							if (record.explicitHashKey) {
								kinesisRecord.ExplicitHashKey = record.explicitHashKey;
							}

							return kinesisRecord;
						});

						const response = await client.send(
							new PutRecordsCommand({
								StreamName: streamName,
								Records: kinesisRecords,
							}),
						);

						// Process results
						const results: PutRecordsRecordResult[] = [];
						let successCount = 0;
						let failedCount = 0;

						if (response.Records) {
							for (const record of response.Records) {
								if (record.ErrorCode) {
									failedCount++;
									results.push({
										success: false,
										errorCode: record.ErrorCode,
										errorMessage: record.ErrorMessage,
									});
								} else {
									successCount++;
									results.push({
										success: true,
										shardId: record.ShardId,
										sequenceNumber: record.SequenceNumber,
									});
								}
							}
						}

						const result: PutRecordsResult = {
							success: failedCount === 0,
							successCount,
							failedCount,
							records: results,
						};

						returnData.push({
							json: result as any,
							pairedItem: { item: i },
						});
					}
				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({
							json: {
								error: error.message,
								success: false,
							},
							pairedItem: { item: i },
						});
						continue;
					}
					throw error;
				}
			}
		}

		return [returnData];
	}
}

