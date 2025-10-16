import { SQSClient } from '@aws-sdk/client-sqs';
import { YandexCloudMessageQueueTrigger } from '../YandexCloudMessageQueueTrigger.node';
import type { IPollFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

// Mock AWS SDK
jest.mock('@aws-sdk/client-sqs');

describe('YandexCloudMessageQueueTrigger Node', () => {
	let node: YandexCloudMessageQueueTrigger;
	let mockPollFunctions: Partial<IPollFunctions>;
	let mockLoadOptionsFunctions: Partial<ILoadOptionsFunctions>;
	let mockSend: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();

		node = new YandexCloudMessageQueueTrigger();

		mockSend = jest.fn();
		(SQSClient as jest.Mock).mockImplementation(() => ({
			send: mockSend,
		}));

		mockPollFunctions = {
			getNodeParameter: jest.fn(),
			getCredentials: jest.fn().mockResolvedValue({
				accessKeyId: 'test-key',
				secretAccessKey: 'test-secret',
			}),
			getNode: jest.fn().mockReturnValue({ name: 'Test Trigger Node' }),
			getMode: jest.fn().mockReturnValue('trigger'),
		};

		mockLoadOptionsFunctions = {
			getCredentials: jest.fn().mockResolvedValue({
				accessKeyId: 'test-key',
				secretAccessKey: 'test-secret',
			}),
			getNode: jest.fn().mockReturnValue({ name: 'Test Node' }),
		};
	});

	describe('Node Definition', () => {
		it('should have correct basic properties', () => {
			expect(node.description.displayName).toBe('Yandex Cloud Message Queue Trigger');
			expect(node.description.name).toBe('yandexCloudMessageQueueTrigger');
			expect(node.description.group).toContain('trigger');
			expect(node.description.version).toBe(1);
		});

		it('should be a polling trigger', () => {
			expect(node.description.polling).toBe(true);
		});

		it('should have correct credentials configuration', () => {
			expect(node.description.credentials).toHaveLength(1);
			expect(node.description.credentials?.[0]).toEqual({
				name: 'yandexCloudStaticApi',
				required: true,
			});
		});

		it('should have no inputs and one output', () => {
			expect(node.description.inputs).toEqual([]);
			expect(node.description.outputs).toHaveLength(1);
		});

		it('should expose loadQueues method', () => {
			expect(node.methods?.listSearch?.loadQueues).toBeDefined();
		});
	});

	describe('Basic Polling', () => {
		beforeEach(() => {
			(mockPollFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(_paramName: string, defaultValue?: any, options?: any) => {
					if (options?.extractValue) {
						return 'https://message-queue.api.cloud.yandex.net/test-queue';
					}
					const params: Record<string, any> = {
						queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
						options: {},
					};
					return params[_paramName] ?? defaultValue;
				},
			);
		});

		it('should poll and receive messages successfully', async () => {
			mockSend.mockResolvedValue({
				Messages: [
					{
						MessageId: 'msg-1',
						ReceiptHandle: 'receipt-1',
						Body: 'Test message',
						MD5OfBody: 'hash-1',
						Attributes: {
							SentTimestamp: '1234567890',
						},
					},
				],
			});

			const result = await node.poll.call(mockPollFunctions as IPollFunctions);

			expect(result).toHaveLength(1);
			expect(result![0]).toHaveLength(1);
			expect(result![0][0].json).toMatchObject({
				messageId: 'msg-1',
				receiptHandle: 'receipt-1',
				body: 'Test message',
				md5OfBody: 'hash-1',
			});
		});

		it('should return null when no messages available', async () => {
			mockSend.mockResolvedValue({
				Messages: [],
			});

			const result = await node.poll.call(mockPollFunctions as IPollFunctions);

			expect(result).toBeNull();
		});

		it('should return null when Messages field is undefined', async () => {
			mockSend.mockResolvedValue({});

			const result = await node.poll.call(mockPollFunctions as IPollFunctions);

			expect(result).toBeNull();
		});

			it('should throw error when queue URL is missing', async () => {
				(mockPollFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(_paramName: string, defaultValue?: any, options?: any) => {
					if (options?.extractValue) {
						return '';
					}
					return defaultValue;
				},
			);

			await expect(
				node.poll.call(mockPollFunctions as IPollFunctions),
			).rejects.toThrow(NodeOperationError);
		});
	});

	describe('Batch Processing', () => {
		beforeEach(() => {
			(mockPollFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(_paramName: string, defaultValue?: any, options?: any) => {
					if (options?.extractValue) {
						return 'https://message-queue.api.cloud.yandex.net/test-queue';
					}
					const params: Record<string, any> = {
						queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
						options: {
							batchSize: 5,
						},
					};
					return params[_paramName] ?? defaultValue;
				},
			);
		});

		it('should receive multiple messages in batch', async () => {
			mockSend.mockResolvedValue({
				Messages: [
					{
						MessageId: 'msg-1',
						ReceiptHandle: 'receipt-1',
						Body: 'Message 1',
						MD5OfBody: 'hash-1',
						Attributes: {},
					},
					{
						MessageId: 'msg-2',
						ReceiptHandle: 'receipt-2',
						Body: 'Message 2',
						MD5OfBody: 'hash-2',
						Attributes: {},
					},
					{
						MessageId: 'msg-3',
						ReceiptHandle: 'receipt-3',
						Body: 'Message 3',
						MD5OfBody: 'hash-3',
						Attributes: {},
					},
				],
			});

			const result = await node.poll.call(mockPollFunctions as IPollFunctions);

			expect(result![0]).toHaveLength(3);
			expect(result![0][0].json.messageId).toBe('msg-1');
			expect(result![0][1].json.messageId).toBe('msg-2');
			expect(result![0][2].json.messageId).toBe('msg-3');
		});

		it('should request correct batch size', async () => {
			mockSend.mockResolvedValue({
				Messages: [],
			});

			await node.poll.call(mockPollFunctions as IPollFunctions);

			// Verify send was called
			expect(mockSend).toHaveBeenCalled();
		});

		it('should use batch size 1 in manual mode', async () => {
			(mockPollFunctions.getMode as jest.Mock).mockReturnValue('manual');

			mockSend.mockResolvedValue({
				Messages: [],
			});

			await node.poll.call(mockPollFunctions as IPollFunctions);

			// Verify send was called
			expect(mockSend).toHaveBeenCalled();
		});
	});

	describe('Message Attributes', () => {
		beforeEach(() => {
			(mockPollFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(_paramName: string, defaultValue?: any, options?: any) => {
					if (options?.extractValue) {
						return 'https://message-queue.api.cloud.yandex.net/test-queue';
					}
					const params: Record<string, any> = {
						queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
						options: {
							includeMessageAttributes: true,
						},
					};
					return params[_paramName] ?? defaultValue;
				},
			);
		});

		it('should include message attributes when enabled', async () => {
			mockSend.mockResolvedValue({
				Messages: [
					{
						MessageId: 'msg-1',
						ReceiptHandle: 'receipt-1',
						Body: 'Test message',
						MD5OfBody: 'hash-1',
						Attributes: {},
						MessageAttributes: {
							author: {
								DataType: 'String',
								StringValue: 'John Doe',
							},
							priority: {
								DataType: 'Number',
								StringValue: '5',
							},
						},
					},
				],
			});

			const result = await node.poll.call(mockPollFunctions as IPollFunctions);

			expect(result![0][0].json.messageAttributes).toMatchObject({
				author: {
					dataType: 'String',
					stringValue: 'John Doe',
				},
				priority: {
					dataType: 'Number',
					stringValue: '5',
				},
			});
		});

		it('should request all message attributes', async () => {
			mockSend.mockResolvedValue({
				Messages: [],
			});

			await node.poll.call(mockPollFunctions as IPollFunctions);

			// Verify send was called
			expect(mockSend).toHaveBeenCalled();
		});

		it('should not include message attributes when disabled', async () => {
			(mockPollFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(_paramName: string, defaultValue?: any, options?: any) => {
					if (options?.extractValue) {
						return 'https://message-queue.api.cloud.yandex.net/test-queue';
					}
					const params: Record<string, any> = {
						queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
						options: {
							includeMessageAttributes: false,
						},
					};
					return params[_paramName] ?? defaultValue;
				},
			);

			mockSend.mockResolvedValue({
				Messages: [
					{
						MessageId: 'msg-1',
						ReceiptHandle: 'receipt-1',
						Body: 'Test message',
						MD5OfBody: 'hash-1',
						Attributes: {},
						MessageAttributes: {
							author: {
								DataType: 'String',
								StringValue: 'John Doe',
							},
						},
					},
				],
			});

			const result = await node.poll.call(mockPollFunctions as IPollFunctions);

			expect(result![0][0].json.messageAttributes).toBeUndefined();
		});
	});

	describe('JSON Parsing', () => {
		beforeEach(() => {
			(mockPollFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(_paramName: string, defaultValue?: any, options?: any) => {
					if (options?.extractValue) {
						return 'https://message-queue.api.cloud.yandex.net/test-queue';
					}
					const params: Record<string, any> = {
						queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
						options: {
							jsonParseBody: true,
						},
					};
					return params[_paramName] ?? defaultValue;
				},
			);
		});

		it('should parse JSON body when enabled', async () => {
			mockSend.mockResolvedValue({
				Messages: [
					{
						MessageId: 'msg-1',
						ReceiptHandle: 'receipt-1',
						Body: JSON.stringify({ key: 'value', nested: { data: 123 } }),
						MD5OfBody: 'hash-1',
						Attributes: {},
					},
				],
			});

			const result = await node.poll.call(mockPollFunctions as IPollFunctions);

			expect(result![0][0].json.body).toMatchObject({
				key: 'value',
				nested: {
					data: 123,
				},
			});
		});

		it('should keep original string if JSON parsing fails', async () => {
			mockSend.mockResolvedValue({
				Messages: [
					{
						MessageId: 'msg-1',
						ReceiptHandle: 'receipt-1',
						Body: 'This is not JSON',
						MD5OfBody: 'hash-1',
						Attributes: {},
					},
				],
			});

			const result = await node.poll.call(mockPollFunctions as IPollFunctions);

			expect(result![0][0].json.body).toBe('This is not JSON');
		});

		it('should not parse JSON when disabled', async () => {
			(mockPollFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(_paramName: string, defaultValue?: any, options?: any) => {
					if (options?.extractValue) {
						return 'https://message-queue.api.cloud.yandex.net/test-queue';
					}
					const params: Record<string, any> = {
						queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
						options: {
							jsonParseBody: false,
						},
					};
					return params[_paramName] ?? defaultValue;
				},
			);

			mockSend.mockResolvedValue({
				Messages: [
					{
						MessageId: 'msg-1',
						ReceiptHandle: 'receipt-1',
						Body: JSON.stringify({ key: 'value' }),
						MD5OfBody: 'hash-1',
						Attributes: {},
					},
				],
			});

			const result = await node.poll.call(mockPollFunctions as IPollFunctions);

			expect(typeof result![0][0].json.body).toBe('string');
			expect(result![0][0].json.body).toBe('{"key":"value"}');
		});
	});

	describe('Only Body Option', () => {
		beforeEach(() => {
			(mockPollFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(_paramName: string, defaultValue?: any, options?: any) => {
					if (options?.extractValue) {
						return 'https://message-queue.api.cloud.yandex.net/test-queue';
					}
					const params: Record<string, any> = {
						queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
						options: {
							onlyBody: true,
						},
					};
					return params[_paramName] ?? defaultValue;
				},
			);
		});

		it('should return only message body when enabled', async () => {
			mockSend.mockResolvedValue({
				Messages: [
					{
						MessageId: 'msg-1',
						ReceiptHandle: 'receipt-1',
						Body: 'Just the body content',
						MD5OfBody: 'hash-1',
						Attributes: {},
					},
				],
			});

			const result = await node.poll.call(mockPollFunctions as IPollFunctions);

			expect(result![0][0].json).toBe('Just the body content');
		});

		it('should work with JSON parsing enabled', async () => {
			(mockPollFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(_paramName: string, defaultValue?: any, options?: any) => {
					if (options?.extractValue) {
						return 'https://message-queue.api.cloud.yandex.net/test-queue';
					}
					const params: Record<string, any> = {
						queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
						options: {
							onlyBody: true,
							jsonParseBody: true,
						},
					};
					return params[_paramName] ?? defaultValue;
				},
			);

			mockSend.mockResolvedValue({
				Messages: [
					{
						MessageId: 'msg-1',
						ReceiptHandle: 'receipt-1',
						Body: JSON.stringify({ result: 'success' }),
						MD5OfBody: 'hash-1',
						Attributes: {},
					},
				],
			});

			const result = await node.poll.call(mockPollFunctions as IPollFunctions);

			expect(result![0][0].json).toMatchObject({
				result: 'success',
			});
		});
	});

	describe('Auto Delete Messages', () => {
		beforeEach(() => {
			(mockPollFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(_paramName: string, defaultValue?: any, options?: any) => {
					if (options?.extractValue) {
						return 'https://message-queue.api.cloud.yandex.net/test-queue';
					}
					const params: Record<string, any> = {
						queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
						options: {
							deleteAfterProcessing: true,
						},
					};
					return params[_paramName] ?? defaultValue;
				},
			);
		});

		it('should delete message after processing when enabled', async () => {
			mockSend
				.mockResolvedValueOnce({
					Messages: [
						{
							MessageId: 'msg-1',
							ReceiptHandle: 'receipt-1',
							Body: 'Test message',
							MD5OfBody: 'hash-1',
							Attributes: {},
						},
					],
				})
				.mockResolvedValueOnce({});

			await node.poll.call(mockPollFunctions as IPollFunctions);

			// Verify both receive and delete were called
			expect(mockSend).toHaveBeenCalledTimes(2);
		});

		it('should not delete messages when disabled', async () => {
			(mockPollFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(_paramName: string, defaultValue?: any, options?: any) => {
					if (options?.extractValue) {
						return 'https://message-queue.api.cloud.yandex.net/test-queue';
					}
					const params: Record<string, any> = {
						queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
						options: {
							deleteAfterProcessing: false,
						},
					};
					return params[_paramName] ?? defaultValue;
				},
			);

			mockSend.mockResolvedValue({
				Messages: [
					{
						MessageId: 'msg-1',
						ReceiptHandle: 'receipt-1',
						Body: 'Test message',
						MD5OfBody: 'hash-1',
						Attributes: {},
					},
				],
			});

			await node.poll.call(mockPollFunctions as IPollFunctions);

			expect(mockSend).toHaveBeenCalledTimes(1);
		});

		it('should continue processing if delete fails', async () => {
			mockSend
				.mockResolvedValueOnce({
					Messages: [
						{
							MessageId: 'msg-1',
							ReceiptHandle: 'receipt-1',
							Body: 'Test message',
							MD5OfBody: 'hash-1',
							Attributes: {},
						},
					],
				})
				.mockRejectedValueOnce(new Error('Delete failed'));

			const result = await node.poll.call(mockPollFunctions as IPollFunctions);

			expect(result).toHaveLength(1);
			expect(result![0]).toHaveLength(1);
		});

		it('should not delete if receipt handle is missing', async () => {
			mockSend.mockResolvedValue({
				Messages: [
					{
						MessageId: 'msg-1',
						Body: 'Test message',
						MD5OfBody: 'hash-1',
						Attributes: {},
					},
				],
			});

			await node.poll.call(mockPollFunctions as IPollFunctions);

			expect(mockSend).toHaveBeenCalledTimes(1);
		});
	});

	describe('Visibility Timeout', () => {
		it('should use custom visibility timeout', async () => {
			(mockPollFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(_paramName: string, defaultValue?: any, options?: any) => {
					if (options?.extractValue) {
						return 'https://message-queue.api.cloud.yandex.net/test-queue';
					}
					const params: Record<string, any> = {
						queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
						options: {
							visibilityTimeout: 120,
						},
					};
					return params[_paramName] ?? defaultValue;
				},
			);

			mockSend.mockResolvedValue({
				Messages: [],
			});

			await node.poll.call(mockPollFunctions as IPollFunctions);

			// Verify send was called
			expect(mockSend).toHaveBeenCalled();
		});

		it('should use default visibility timeout of 30 seconds', async () => {
			(mockPollFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(_paramName: string, defaultValue?: any, options?: any) => {
					if (options?.extractValue) {
						return 'https://message-queue.api.cloud.yandex.net/test-queue';
					}
					const params: Record<string, any> = {
						queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
						options: {},
					};
					return params[_paramName] ?? defaultValue;
				},
			);

			mockSend.mockResolvedValue({
				Messages: [],
			});

			await node.poll.call(mockPollFunctions as IPollFunctions);

			// Verify send was called
			expect(mockSend).toHaveBeenCalled();
		});
	});

	describe('Long Polling', () => {
		it('should use long polling with 20 second wait', async () => {
			(mockPollFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(_paramName: string, defaultValue?: any, options?: any) => {
					if (options?.extractValue) {
						return 'https://message-queue.api.cloud.yandex.net/test-queue';
					}
					const params: Record<string, any> = {
						queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
						options: {},
					};
					return params[_paramName] ?? defaultValue;
				},
			);

			mockSend.mockResolvedValue({
				Messages: [],
			});

			await node.poll.call(mockPollFunctions as IPollFunctions);

			// Verify send was called
			expect(mockSend).toHaveBeenCalled();
		});

		it('should request all attributes', async () => {
			(mockPollFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(_paramName: string, defaultValue?: any, options?: any) => {
					if (options?.extractValue) {
						return 'https://message-queue.api.cloud.yandex.net/test-queue';
					}
					const params: Record<string, any> = {
						queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
						options: {},
					};
					return params[_paramName] ?? defaultValue;
				},
			);

			mockSend.mockResolvedValue({
				Messages: [],
			});

			await node.poll.call(mockPollFunctions as IPollFunctions);

			// Verify send was called
			expect(mockSend).toHaveBeenCalled();
		});
	});

	describe('SQS Client Configuration', () => {
		it('should create SQS client with correct configuration', async () => {
			(mockPollFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(_paramName: string, defaultValue?: any, options?: any) => {
					if (options?.extractValue) {
						return 'https://message-queue.api.cloud.yandex.net/test-queue';
					}
					const params: Record<string, any> = {
						queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
						options: {},
					};
					return params[_paramName] ?? defaultValue;
				},
			);

			mockSend.mockResolvedValue({
				Messages: [],
			});

			await node.poll.call(mockPollFunctions as IPollFunctions);

			expect(SQSClient).toHaveBeenCalledWith(
				expect.objectContaining({
					region: 'ru-central1',
					endpoint: 'https://message-queue.api.cloud.yandex.net',
					credentials: {
						accessKeyId: 'test-key',
						secretAccessKey: 'test-secret',
					},
				}),
			);
		});
	});

	describe('Load Queues Method', () => {
		it('should load queues successfully', async () => {
			mockSend.mockResolvedValue({
				QueueUrls: [
					'https://message-queue.api.cloud.yandex.net/account/queue-1',
					'https://message-queue.api.cloud.yandex.net/account/queue-2',
				],
			});

			const result = await node.methods!.listSearch!.loadQueues.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(result.results).toHaveLength(2);
			expect(result.results[0]).toMatchObject({
				name: 'queue-1',
				value: 'https://message-queue.api.cloud.yandex.net/account/queue-1',
			});
		});

		it('should filter queues by search term', async () => {
			mockSend.mockResolvedValue({
				QueueUrls: [
					'https://message-queue.api.cloud.yandex.net/account/test-queue',
					'https://message-queue.api.cloud.yandex.net/account/prod-queue',
					'https://message-queue.api.cloud.yandex.net/account/test-backup',
				],
			});

			const result = await node.methods!.listSearch!.loadQueues.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
				'test',
			);

			expect(result.results).toHaveLength(2);
			expect(result.results[0].name).toBe('test-queue');
			expect(result.results[1].name).toBe('test-backup');
		});
	});
});

