import type {
	IPollFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError, jsonParse } from 'n8n-workflow';

import {
	SQSClient,
	ReceiveMessageCommand,
	DeleteMessageCommand,
} from '@aws-sdk/client-sqs';

import { loadQueues } from './GenericFunctions';

export class YandexCloudMessageQueueTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Yandex Cloud Message Queue Trigger',
		name: 'yandexCloudMessageQueueTrigger',
		icon: 'file:YMQ.svg',
		group: ['trigger'],
		version: 1,
		polling: true,
		description: 'Polls Yandex Cloud Message Queue for new messages',
		defaults: {
			name: 'Yandex Cloud Message Queue Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'yandexCloudStatic',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Queue',
				name: 'queueUrl',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				description: 'The queue to listen to',
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
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Batch Size',
						name: 'batchSize',
						type: 'number',
						typeOptions: {
							minValue: 1,
							maxValue: 10,
						},
						default: 1,
						description: 'Maximum number of messages to receive in a single poll (1-10)',
					},
					{
						displayName: 'Delete After Processing',
						name: 'deleteAfterProcessing',
						type: 'boolean',
						default: true,
						description: 'Whether to automatically delete messages after they are successfully processed',
					},
					{
						displayName: 'Include Message Attributes',
						name: 'includeMessageAttributes',
						type: 'boolean',
						default: true,
						description: 'Whether to include message attributes in the output',
					},
					{
						displayName: 'JSON Parse Body',
						name: 'jsonParseBody',
						type: 'boolean',
						default: false,
						description: 'Whether to parse the message body as JSON',
					},
					{
						displayName: 'Only Body',
						name: 'onlyBody',
						type: 'boolean',
						default: false,
						description: 'Whether to return only the message body property',
					},
					{
						displayName: 'Visibility Timeout',
						name: 'visibilityTimeout',
						type: 'number',
						typeOptions: {
							minValue: 0,
							maxValue: 43200,
						},
						default: 30,
						description: 'Duration (in seconds) that the received messages are hidden from subsequent retrieve requests (0-43200)',
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

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const credentials = await this.getCredentials('yandexCloudStatic');
		const queueUrl = this.getNodeParameter('queueUrl', '', { extractValue: true }) as string;
		const options = this.getNodeParameter('options', {}) as {
			batchSize?: number;
			deleteAfterProcessing?: boolean;
			includeMessageAttributes?: boolean;
			jsonParseBody?: boolean;
			onlyBody?: boolean;
			visibilityTimeout?: number;
		};

		if (!queueUrl) {
			throw new NodeOperationError(this.getNode(), 'Queue URL is required!');
		}

		// Set default values
		const batchSize = options.batchSize ?? 1;
		const deleteAfterProcessing = options.deleteAfterProcessing ?? true;
		const includeMessageAttributes = options.includeMessageAttributes ?? true;
		const jsonParseBody = options.jsonParseBody ?? false;
		const onlyBody = options.onlyBody ?? false;
		const visibilityTimeout = options.visibilityTimeout ?? 30;

		// Create SQS client
		const client = new SQSClient({
			region: 'ru-central1',
			endpoint: 'https://message-queue.api.cloud.yandex.net',
			credentials: {
				accessKeyId: credentials.accessKeyId as string,
				secretAccessKey: credentials.secretAccessKey as string,
			},
		});

		// Receive messages from queue
		const response = await client.send(
			new ReceiveMessageCommand({
				QueueUrl: queueUrl,
				MaxNumberOfMessages: this.getMode() === 'manual' ? 1 : batchSize,
				WaitTimeSeconds: 20, // Long polling
				VisibilityTimeout: visibilityTimeout,
				MessageAttributeNames: includeMessageAttributes ? ['All'] : undefined,
				AttributeNames: ['All'],
			}),
		);

		// No messages available
		if (!response.Messages || response.Messages.length === 0) {
			return null;
		}

		// Process messages
		const returnData: INodeExecutionData[] = [];

		for (const message of response.Messages) {
			let messageData: any = {
				messageId: message.MessageId,
				receiptHandle: message.ReceiptHandle,
				body: message.Body,
				md5OfBody: message.MD5OfBody,
				attributes: message.Attributes || {},
			};

			// Include message attributes if requested
			if (includeMessageAttributes && message.MessageAttributes) {
				messageData.messageAttributes = {};
				for (const [key, value] of Object.entries(message.MessageAttributes)) {
					messageData.messageAttributes[key] = {
						dataType: value.DataType,
						stringValue: value.StringValue,
						binaryValue: value.BinaryValue,
					};
				}
			}

			// Parse JSON body if requested
			if (jsonParseBody && messageData.body) {
				try {
					messageData.body = jsonParse(messageData.body);
				} catch (error) {
					// If JSON parsing fails, keep the original string
				}
			}

			// Return only body if requested
			if (onlyBody) {
				messageData = messageData.body;
			}

			returnData.push({
				json: messageData,
			});

			// Delete message if processing was successful and auto-delete is enabled
			if (deleteAfterProcessing && message.ReceiptHandle) {
				try {
					await client.send(
						new DeleteMessageCommand({
							QueueUrl: queueUrl,
							ReceiptHandle: message.ReceiptHandle,
						}),
					);
				} catch (error) {
					// Log error but don't fail the entire poll
					// Message will return to queue after visibility timeout
				}
			}
		}

		return [returnData];
	}
}
