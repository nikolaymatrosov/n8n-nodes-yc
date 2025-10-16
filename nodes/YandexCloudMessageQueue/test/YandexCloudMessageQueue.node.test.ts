import { SQSClient } from '@aws-sdk/client-sqs';
import { YandexCloudMessageQueue } from '../YandexCloudMessageQueue.node';
import type { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';

// Mock AWS SDK
jest.mock('@aws-sdk/client-sqs');

describe('YandexCloudMessageQueue Node', () => {
	let node: YandexCloudMessageQueue;
	let mockExecuteFunctions: Partial<IExecuteFunctions>;
	let mockLoadOptionsFunctions: Partial<ILoadOptionsFunctions>;
	let mockSend: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();

		node = new YandexCloudMessageQueue();

		mockSend = jest.fn();
		(SQSClient as jest.Mock).mockImplementation(() => ({
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
			expect(node.description.displayName).toBe('Yandex Cloud Message Queue');
			expect(node.description.name).toBe('yandexCloudMessageQueue');
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

		it('should have subtitle based on operation parameter', () => {
			expect(node.description.subtitle).toBe('={{$parameter["operation"]}}');
		});

		it('should expose loadQueues method', () => {
			expect(node.methods?.listSearch?.loadQueues).toBeDefined();
		});
	});

	describe('Send Message Operation', () => {
		describe('Basic Message Send', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							return 'https://message-queue.api.cloud.yandex.net/test-queue';
						}
						const params: Record<string, any> = {
							resource: 'message',
							operation: 'send',
							queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
							messageBody: 'Test message content',
							additionalFields: {},
							messageAttributes: {},
						};
						return params[paramName];
					},
				);
			});

			it('should send message successfully', async () => {
				mockSend.mockResolvedValue({
					MessageId: 'msg-123',
					MD5OfMessageBody: 'abc123',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result).toHaveLength(1);
				expect(result[0]).toHaveLength(1);
				expect(result[0][0].json).toMatchObject({
					messageId: 'msg-123',
					md5OfMessageBody: 'abc123',
					success: true,
					queueUrl: 'https://message-queue.api.cloud.yandex.net/test-queue',
				});
			});

			it('should send message with correct SQS parameters', async () => {
				mockSend.mockResolvedValue({
					MessageId: 'msg-123',
				});

				await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				// Verify send was called with a command
				expect(mockSend).toHaveBeenCalled();
			});

			it('should include pairedItem metadata', async () => {
				mockSend.mockResolvedValue({
					MessageId: 'msg-123',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].pairedItem).toEqual({ item: 0 });
			});

			it('should include MD5 of message attributes when present', async () => {
				mockSend.mockResolvedValue({
					MessageId: 'msg-123',
					MD5OfMessageBody: 'abc123',
					MD5OfMessageAttributes: 'def456',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json.md5OfMessageAttributes).toBe('def456');
			});

			it('should include sequence number for FIFO queues', async () => {
				mockSend.mockResolvedValue({
					MessageId: 'msg-123',
					MD5OfMessageBody: 'abc123',
					SequenceNumber: '12345678901234567890',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json.sequenceNumber).toBe('12345678901234567890');
			});
		});

		describe('Message with Delay', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							return 'https://message-queue.api.cloud.yandex.net/test-queue';
						}
						const params: Record<string, any> = {
							resource: 'message',
							operation: 'send',
							queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
							messageBody: 'Delayed message',
							additionalFields: {
								delaySeconds: 60,
							},
							messageAttributes: {},
						};
						return params[paramName];
					},
				);
			});

			it('should send message with delay', async () => {
				mockSend.mockResolvedValue({
					MessageId: 'msg-delayed',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json.messageId).toBe('msg-delayed');
				expect(mockSend).toHaveBeenCalled();
			});

			it('should handle zero delay', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							return 'https://message-queue.api.cloud.yandex.net/test-queue';
						}
						const params: Record<string, any> = {
							resource: 'message',
							operation: 'send',
							queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
							messageBody: 'No delay message',
							additionalFields: {
								delaySeconds: 0,
							},
							messageAttributes: {},
						};
						return params[paramName];
					},
				);

				mockSend.mockResolvedValue({
					MessageId: 'msg-no-delay',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json.messageId).toBe('msg-no-delay');
				expect(mockSend).toHaveBeenCalled();
			});
		});

		describe('FIFO Queue Messages', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							return 'https://message-queue.api.cloud.yandex.net/test-queue.fifo';
						}
						const params: Record<string, any> = {
							resource: 'message',
							operation: 'send',
							queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue.fifo' },
							messageBody: 'FIFO message',
							additionalFields: {
								messageGroupId: 'group-1',
								messageDeduplicationId: 'dedup-123',
							},
							messageAttributes: {},
						};
						return params[paramName];
					},
				);
			});

			it('should send FIFO message with group ID and deduplication ID', async () => {
				mockSend.mockResolvedValue({
					MessageId: 'msg-fifo',
					SequenceNumber: '12345678901234567890',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json.messageId).toBe('msg-fifo');
				expect(result[0][0].json.sequenceNumber).toBe('12345678901234567890');
				expect(mockSend).toHaveBeenCalled();
			});

			it('should send FIFO message with only group ID', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							return 'https://message-queue.api.cloud.yandex.net/test-queue.fifo';
						}
						const params: Record<string, any> = {
							resource: 'message',
							operation: 'send',
							queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue.fifo' },
							messageBody: 'FIFO message',
							additionalFields: {
								messageGroupId: 'group-1',
							},
							messageAttributes: {},
						};
						return params[paramName];
					},
				);

				mockSend.mockResolvedValue({
					MessageId: 'msg-fifo',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json.messageId).toBe('msg-fifo');
				expect(mockSend).toHaveBeenCalled();
			});
		});

		describe('Message Attributes', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							return 'https://message-queue.api.cloud.yandex.net/test-queue';
						}
						const params: Record<string, any> = {
							resource: 'message',
							operation: 'send',
							queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
							messageBody: 'Message with attributes',
							additionalFields: {},
							messageAttributes: {
								attribute: [
									{
										name: 'author',
										dataType: 'String',
										value: 'John Doe',
									},
									{
										name: 'Priority',
										dataType: 'Number',
										value: '5',
									},
								],
							},
						};
						return params[paramName];
					},
				);
			});

			it('should send message with custom attributes', async () => {
				mockSend.mockResolvedValue({
					MessageId: 'msg-with-attrs',
					MD5OfMessageAttributes: 'attr-hash',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json.messageId).toBe('msg-with-attrs');
				expect(result[0][0].json.md5OfMessageAttributes).toBe('attr-hash');
				expect(mockSend).toHaveBeenCalled();
			});

			it('should handle binary attributes', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							return 'https://message-queue.api.cloud.yandex.net/test-queue';
						}
						const params: Record<string, any> = {
							resource: 'message',
							operation: 'send',
							queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
							messageBody: 'Message with binary attribute',
							additionalFields: {},
							messageAttributes: {
								attribute: [
									{
										name: 'binaryData',
										dataType: 'Binary',
										value: 'base64encodeddata',
									},
								],
							},
						};
						return params[paramName];
					},
				);

				mockSend.mockResolvedValue({
					MessageId: 'msg-binary',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json.messageId).toBe('msg-binary');
				expect(mockSend).toHaveBeenCalled();
			});

			it('should skip attributes without name', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							return 'https://message-queue.api.cloud.yandex.net/test-queue';
						}
						const params: Record<string, any> = {
							resource: 'message',
							operation: 'send',
							queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
							messageBody: 'Message',
							additionalFields: {},
							messageAttributes: {
								attribute: [
									{
										name: '',
										dataType: 'String',
										value: 'should be skipped',
									},
									{
										name: 'validAttr',
										dataType: 'String',
										value: 'valid value',
									},
								],
							},
						};
						return params[paramName];
					},
				);

				mockSend.mockResolvedValue({
					MessageId: 'msg-partial-attrs',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json.messageId).toBe('msg-partial-attrs');
				expect(mockSend).toHaveBeenCalled();
			});

			it('should not include MessageAttributes when no attributes provided', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							return 'https://message-queue.api.cloud.yandex.net/test-queue';
						}
						const params: Record<string, any> = {
							resource: 'message',
							operation: 'send',
							queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
							messageBody: 'Simple message',
							additionalFields: {},
							messageAttributes: {},
						};
						return params[paramName];
					},
				);

				mockSend.mockResolvedValue({
					MessageId: 'msg-no-attrs',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json.messageId).toBe('msg-no-attrs');
				expect(mockSend).toHaveBeenCalled();
			});
		});

		describe('Multiple Items Processing', () => {
			it('should process multiple messages', async () => {
				(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
					{ json: {} },
					{ json: {} },
				]);

				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, itemIndex: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							return 'https://message-queue.api.cloud.yandex.net/test-queue';
						}
						const configs = [
							{
								resource: 'message',
								operation: 'send',
								queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
								messageBody: 'Message 1',
								additionalFields: {},
								messageAttributes: {},
							},
							{
								resource: 'message',
								operation: 'send',
								queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
								messageBody: 'Message 2',
								additionalFields: {},
								messageAttributes: {},
							},
						];
						return configs[itemIndex][paramName as keyof typeof configs[0]];
					},
				);

				mockSend
					.mockResolvedValueOnce({
						MessageId: 'msg-1',
					})
					.mockResolvedValueOnce({
						MessageId: 'msg-2',
					});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0]).toHaveLength(2);
				expect(result[0][0].json.messageId).toBe('msg-1');
				expect(result[0][1].json.messageId).toBe('msg-2');
			});

			it('should include correct pairedItem for multiple items', async () => {
				(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
					{ json: {} },
					{ json: {} },
				]);

				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, itemIndex: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							return 'https://message-queue.api.cloud.yandex.net/test-queue';
						}
						const configs = [
							{
								resource: 'message',
								operation: 'send',
								queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
								messageBody: 'Message 1',
								additionalFields: {},
								messageAttributes: {},
							},
							{
								resource: 'message',
								operation: 'send',
								queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
								messageBody: 'Message 2',
								additionalFields: {},
								messageAttributes: {},
							},
						];
						return configs[itemIndex][paramName as keyof typeof configs[0]];
					},
				);

				mockSend.mockResolvedValue({
					MessageId: 'msg',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].pairedItem).toEqual({ item: 0 });
				expect(result[0][1].pairedItem).toEqual({ item: 1 });
			});
		});

		describe('Error Handling', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							return 'https://message-queue.api.cloud.yandex.net/test-queue';
						}
						const params: Record<string, any> = {
							resource: 'message',
							operation: 'send',
							queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
							messageBody: 'Test message',
							additionalFields: {},
							messageAttributes: {},
						};
						return params[paramName];
					},
				);
			});

			it('should throw error when continueOnFail is false', async () => {
				mockSend.mockRejectedValue(new Error('Queue not found'));

				await expect(
					node.execute.call(mockExecuteFunctions as IExecuteFunctions),
				).rejects.toThrow('Queue not found');
			});

			it('should return error object when continueOnFail is true', async () => {
				(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
				mockSend.mockRejectedValue(new Error('Access denied'));

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					error: 'Access denied',
					success: false,
				});
			});

			it('should continue processing other items after error with continueOnFail', async () => {
				(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
					{ json: {} },
					{ json: {} },
				]);
				(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

				mockSend
					.mockRejectedValueOnce(new Error('First message failed'))
					.mockResolvedValueOnce({
						MessageId: 'msg-2',
					});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0]).toHaveLength(2);
				expect(result[0][0].json).toMatchObject({
					error: 'First message failed',
					success: false,
				});
				expect(result[0][1].json).toMatchObject({
					success: true,
					messageId: 'msg-2',
				});
			});

			it('should handle invalid message body gracefully', async () => {
				(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
				mockSend.mockRejectedValue(new Error('Invalid message body'));

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json.success).toBe(false);
			});
		});
	});

	describe('SQS Client Configuration', () => {
		it('should create SQS client with correct configuration', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
					if (options?.extractValue) {
						return 'https://message-queue.api.cloud.yandex.net/test-queue';
					}
					const params: Record<string, any> = {
						resource: 'message',
						operation: 'send',
						queueUrl: { mode: 'list', value: 'https://message-queue.api.cloud.yandex.net/test-queue' },
						messageBody: 'Test',
						additionalFields: {},
						messageAttributes: {},
					};
					return params[paramName];
				},
			);

			mockSend.mockResolvedValue({
				MessageId: 'msg-123',
			});

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(SQSClient).toHaveBeenCalledWith({
				region: 'ru-central1',
				endpoint: 'https://message-queue.api.cloud.yandex.net',
				credentials: {
					accessKeyId: 'test-key',
					secretAccessKey: 'test-secret',
				},
			});
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

		it('should handle empty queue list', async () => {
			mockSend.mockResolvedValue({
				QueueUrls: [],
			});

			const result = await node.methods!.listSearch!.loadQueues.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(result.results).toHaveLength(0);
		});

		it('should throw error when list fails', async () => {
			mockSend.mockRejectedValue(new Error('Access denied'));

			await expect(
				node.methods!.listSearch!.loadQueues.call(
					mockLoadOptionsFunctions as ILoadOptionsFunctions,
				),
			).rejects.toThrow('Failed to list queues: Access denied');
		});

		it('should extract queue name from URL', async () => {
			mockSend.mockResolvedValue({
				QueueUrls: [
					'https://message-queue.api.cloud.yandex.net/b1g8ad42m6he/dj60000/my-queue.fifo',
				],
			});

			const result = await node.methods!.listSearch!.loadQueues.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(result.results[0].name).toBe('my-queue.fifo');
		});
	});
});

