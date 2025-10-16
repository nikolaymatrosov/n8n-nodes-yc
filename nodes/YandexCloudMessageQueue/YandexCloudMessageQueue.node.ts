import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

import { loadQueues } from './GenericFunctions';

export class YandexCloudMessageQueue implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Yandex Cloud Message Queue',
		name: 'yandexCloudMessageQueue',
		icon: 'file:YMQ.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Send messages to Yandex Cloud Message Queue via AWS SQS SDK',
		defaults: {
			name: 'Yandex Cloud Message Queue',
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
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Message',
						value: 'message',
					},
				],
				default: 'message',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['message'],
					},
				},
				options: [
					{
						name: 'Send',
						value: 'send',
						description: 'Send a message to a queue',
						action: 'Send a message',
					},
				],
				default: 'send',
			},
			{
				displayName: 'Queue',
				name: 'queueUrl',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['send'],
					},
				},
				description: 'The queue to send the message to',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'loadQueues',
							searchable: true,
						},
					},
					{
						displayName: 'By URL',
						name: 'url',
						type: 'string',
						placeholder: 'https://message-queue.api.cloud.yandex.net/b1g8ad42m6he********/dj6000000000********/sample-queue',
					},
				],
			},
			{
				displayName: 'Message Body',
				name: 'messageBody',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['send'],
					},
				},
				typeOptions: {
					rows: 5,
				},
				default: '',
				placeholder: 'Message content',
				description: 'The message to send to the queue',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['send'],
					},
				},
				options: [
					{
						displayName: 'Delay Seconds',
						name: 'delaySeconds',
						type: 'number',
						typeOptions: {
							minValue: 0,
							maxValue: 900,
						},
						default: 0,
						description: 'The length of time, in seconds, for which to delay a specific message. Valid values: 0 to 900.',
					},
					{
						displayName: 'Message Deduplication ID',
						name: 'messageDeduplicationId',
						type: 'string',
						default: '',
						description: 'Token used for deduplication of sent messages. Required for FIFO queues.',
					},
					{
						displayName: 'Message Group ID',
						name: 'messageGroupId',
						type: 'string',
						default: '',
						description: 'Tag that specifies that a message belongs to a specific message group. Required for FIFO queues.',
					},
				],
			},
			{
				displayName: 'Message Attributes',
				name: 'messageAttributes',
				placeholder: 'Add Attribute',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['send'],
					},
				},
				default: {},
				options: [
					{
						name: 'attribute',
						displayName: 'Attribute',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
								description: 'Name of the attribute',
							},
							{
								displayName: 'Data Type',
								name: 'dataType',
								type: 'options',
								options: [
									{
										name: 'String',
										value: 'String',
									},
									{
										name: 'Number',
										value: 'Number',
									},
									{
										name: 'Binary',
										value: 'Binary',
									},
								],
								default: 'String',
								description: 'Data type of the attribute',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'Value of the attribute',
							},
						],
					},
				],
			},
		],
	};

	methods = {
		listSearch: {
			loadQueues,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		// Get credentials
		const credentials = await this.getCredentials('yandexCloudStaticApi');

		// Create SQS client
		const client = new SQSClient({
			region: 'ru-central1',
			endpoint: 'https://message-queue.api.cloud.yandex.net',
			credentials: {
				accessKeyId: credentials.accessKeyId as string,
				secretAccessKey: credentials.secretAccessKey as string,
			},
		});

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'message' && operation === 'send') {
					const queueUrl = this.getNodeParameter('queueUrl', i, '', { extractValue: true }) as string;
					const messageBody = this.getNodeParameter('messageBody', i) as string;
					const additionalFields = this.getNodeParameter('additionalFields', i) as {
						delaySeconds?: number;
						messageDeduplicationId?: string;
						messageGroupId?: string;
					};
					const messageAttributes = this.getNodeParameter('messageAttributes', i) as {
						attribute?: Array<{
							name: string;
							dataType: string;
							value: string;
						}>;
					};

					// Build message parameters
					const params: any = {
						QueueUrl: queueUrl,
						MessageBody: messageBody,
					};

					// Add optional fields
					if (additionalFields.delaySeconds !== undefined) {
						params.DelaySeconds = additionalFields.delaySeconds;
					}

					if (additionalFields.messageDeduplicationId) {
						params.MessageDeduplicationId = additionalFields.messageDeduplicationId;
					}

					if (additionalFields.messageGroupId) {
						params.MessageGroupId = additionalFields.messageGroupId;
					}

					// Add message attributes
					if (messageAttributes.attribute && messageAttributes.attribute.length > 0) {
						params.MessageAttributes = {};
						for (const attr of messageAttributes.attribute) {
							if (attr.name) {
								params.MessageAttributes[attr.name] = {
									DataType: attr.dataType,
									StringValue: attr.value,
								};
							}
						}
					}

					// Create and send command
					const command = new SendMessageCommand(params);
					const response = await client.send(command);

					returnData.push({
						json: {
							messageId: response.MessageId,
							md5OfMessageBody: response.MD5OfMessageBody,
							md5OfMessageAttributes: response.MD5OfMessageAttributes,
							sequenceNumber: response.SequenceNumber,
							success: true,
							queueUrl,
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

		return [returnData];
	}
}

