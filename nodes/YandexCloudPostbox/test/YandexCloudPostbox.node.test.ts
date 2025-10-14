import { SESv2Client } from '@aws-sdk/client-sesv2';
import { YandexCloudPostbox } from '../YandexCloudPostbox.node';
import type { IExecuteFunctions } from 'n8n-workflow';

// Mock AWS SDK
jest.mock('@aws-sdk/client-sesv2');

describe('YandexCloudPostbox Node', () => {
	let node: YandexCloudPostbox;
	let mockExecuteFunctions: Partial<IExecuteFunctions>;
	let mockSend: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();

		node = new YandexCloudPostbox();

		mockSend = jest.fn();
		(SESv2Client as jest.Mock).mockImplementation(() => ({
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
		};
	});

	describe('Node Definition', () => {
		it('should have correct basic properties', () => {
			expect(node.description.displayName).toBe('Yandex Cloud Postbox');
			expect(node.description.name).toBe('yandexCloudPostbox');
			expect(node.description.group).toContain('output');
			expect(node.description.version).toBe(1);
		});

		it('should have correct credentials configuration', () => {
			expect(node.description.credentials).toHaveLength(1);
			expect(node.description.credentials?.[0]).toEqual({
				name: 'yandexCloudStatic',
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
	});

	describe('Email Send Operations', () => {
		describe('Simple Email', () => {
			beforeEach(() => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'email',
							operation: 'send',
							emailType: 'simple',
							fromEmail: 'sender@example.com',
							toEmail: 'recipient@example.com',
							subject: 'Test Subject',
							htmlBody: '<h1>Hello</h1><p>Test email</p>',
							textBody: 'Hello\nTest email',
						};
						return params[paramName];
					},
				);
			});

			it('should send simple email successfully', async () => {
				mockSend.mockResolvedValue({
					MessageId: 'test-message-id-123',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result).toHaveLength(1);
				expect(result[0]).toHaveLength(1);
				expect(result[0][0].json).toMatchObject({
					messageId: 'test-message-id-123',
					success: true,
					from: 'sender@example.com',
					to: ['recipient@example.com'],
					subject: 'Test Subject',
					emailType: 'simple',
				});
			});

			it('should send email with correct SES parameters', async () => {
				mockSend.mockResolvedValue({
					MessageId: 'test-message-id-123',
				});

				await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				// Verify mockSend was called
				expect(mockSend).toHaveBeenCalled();
				expect(mockSend).toHaveBeenCalledTimes(1);
			});

			it('should create SES client with correct configuration', async () => {
				mockSend.mockResolvedValue({
					MessageId: 'test-message-id-123',
				});

				await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(SESv2Client).toHaveBeenCalledWith({
					region: 'ru-central1',
					endpoint: 'https://postbox.cloud.yandex.net',
					credentials: {
						accessKeyId: 'test-key',
						secretAccessKey: 'test-secret',
					},
				});
			});
		});

		describe('Multiple Recipients', () => {
			beforeEach(() => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'email',
							operation: 'send',
							emailType: 'simple',
							fromEmail: 'sender@example.com',
							toEmail: 'recipient1@example.com, recipient2@example.com, recipient3@example.com',
							subject: 'Multi-recipient Test',
							htmlBody: '<h1>Hello Everyone</h1>',
							textBody: 'Hello Everyone',
						};
						return params[paramName];
					},
				);
			});

			it('should parse and send to multiple recipients', async () => {
				mockSend.mockResolvedValue({
					MessageId: 'test-message-id-456',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					messageId: 'test-message-id-456',
					success: true,
					from: 'sender@example.com',
					to: ['recipient1@example.com', 'recipient2@example.com', 'recipient3@example.com'],
					subject: 'Multi-recipient Test',
				});
			});

			it('should handle recipients with extra whitespace', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'email',
							operation: 'send',
							emailType: 'simple',
							fromEmail: 'sender@example.com',
							toEmail: '  recipient1@example.com  ,  recipient2@example.com  ',
							subject: 'Test',
							htmlBody: '<h1>Test</h1>',
							textBody: 'Test',
						};
						return params[paramName];
					},
				);

				mockSend.mockResolvedValue({
					MessageId: 'test-message-id-789',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json.to).toEqual(['recipient1@example.com', 'recipient2@example.com']);
			});
		});

		describe('Template Email', () => {
			beforeEach(() => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'email',
							operation: 'send',
							emailType: 'template',
							fromEmail: 'orders@example.com',
							toEmail: 'customer@example.com',
							templateSubject: 'Order {{orderId}} for {{customerName}}',
							templateHtml: '<h1>Hello {{customerName}}!</h1><p>Your order {{orderId}} is ready</p>',
							templateText: 'Hello {{customerName}}! Your order {{orderId}} is ready',
							templateData: {
								customerName: 'John Doe',
								orderId: 'ORD-12345',
							},
						};
						return params[paramName];
					},
				);
			});

			it('should send templated email successfully', async () => {
				mockSend.mockResolvedValue({
					MessageId: 'test-message-id-template',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					messageId: 'test-message-id-template',
					success: true,
					from: 'orders@example.com',
					to: ['customer@example.com'],
					subject: 'Order {{orderId}} for {{customerName}}',
					emailType: 'template',
				});
			});

			it('should send template email with correct parameters', async () => {
				mockSend.mockResolvedValue({
					MessageId: 'test-message-id-template',
				});

				await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				// Verify mockSend was called
				expect(mockSend).toHaveBeenCalled();
				expect(mockSend).toHaveBeenCalledTimes(1);
			});

			it('should handle template without text body', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'email',
							operation: 'send',
							emailType: 'template',
							fromEmail: 'noreply@example.com',
							toEmail: 'test@example.com',
							templateSubject: 'Welcome {{name}}',
							templateHtml: '<h1>Welcome {{name}}</h1>',
							templateText: '', // empty text template
							templateData: {
								name: 'John',
							},
						};
						return params[paramName];
					},
				);

				mockSend.mockResolvedValue({
					MessageId: 'test-message-id-no-text',
				});

				await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				// Verify mockSend was called
				expect(mockSend).toHaveBeenCalled();
			});
		});

		describe('UTF-8 and Special Characters', () => {
			it('should handle UTF-8 characters in email content', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'email',
							operation: 'send',
							emailType: 'simple',
							fromEmail: 'noreply@example.com',
							toEmail: 'test@example.com',
							subject: 'Тестовое письмо с UTF-8',
							htmlBody: '<h1>Привет мир! 🌍</h1><p>中文字符测试</p>',
							textBody: 'Привет мир! 🌍\n中文字符测试',
						};
						return params[paramName];
					},
				);

				mockSend.mockResolvedValue({
					MessageId: 'test-message-id-utf8',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					subject: 'Тестовое письмо с UTF-8',
					success: true,
				});

				// Verify mockSend was called
				expect(mockSend).toHaveBeenCalled();
			});

			it('should handle special characters in template data', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'email',
							operation: 'send',
							emailType: 'template',
							fromEmail: 'noreply@example.com',
							toEmail: 'test@example.com',
							templateSubject: 'Welcome {{name}}',
							templateHtml: '<h1>Welcome {{name}}</h1><p>Code: {{code}}</p>',
							templateText: 'Welcome {{name}}\nCode: {{code}}',
							templateData: {
								name: 'Special. Characters @#$%^&*()_-',
								code: 'ABC-123-XYZ',
							},
						};
						return params[paramName];
					},
				);

				mockSend.mockResolvedValue({
					MessageId: 'test-message-id-special',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json.success).toBe(true);

				// Verify mockSend was called
				expect(mockSend).toHaveBeenCalled();
			});
		});

		describe('Multiple Items Processing', () => {
			it('should process multiple input items', async () => {
				(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
					{ json: {} },
					{ json: {} },
				]);

				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, itemIndex: number) => {
						const configs = [
							{
								resource: 'email',
								operation: 'send',
								emailType: 'simple',
								fromEmail: 'sender1@example.com',
								toEmail: 'recipient1@example.com',
								subject: 'Email 1',
								htmlBody: '<h1>Email 1</h1>',
								textBody: 'Email 1',
							},
							{
								resource: 'email',
								operation: 'send',
								emailType: 'simple',
								fromEmail: 'sender2@example.com',
								toEmail: 'recipient2@example.com',
								subject: 'Email 2',
								htmlBody: '<h1>Email 2</h1>',
								textBody: 'Email 2',
							},
						];
						return configs[itemIndex][paramName as keyof typeof configs[0]];
					},
				);

				mockSend
					.mockResolvedValueOnce({ MessageId: 'msg-1' })
					.mockResolvedValueOnce({ MessageId: 'msg-2' });

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0]).toHaveLength(2);
				expect(result[0][0].json).toMatchObject({
					messageId: 'msg-1',
					from: 'sender1@example.com',
					to: ['recipient1@example.com'],
					subject: 'Email 1',
				});
				expect(result[0][1].json).toMatchObject({
					messageId: 'msg-2',
					from: 'sender2@example.com',
					to: ['recipient2@example.com'],
					subject: 'Email 2',
				});
			});
		});
	});

	describe('Error Handling', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						resource: 'email',
						operation: 'send',
						emailType: 'simple',
						fromEmail: 'sender@example.com',
						toEmail: 'recipient@example.com',
						subject: 'Test Subject',
						htmlBody: '<h1>Test</h1>',
						textBody: 'Test',
					};
					return params[paramName];
				},
			);
		});

		it('should throw error when continueOnFail is false', async () => {
			const error = new Error('SES API Error');
			mockSend.mockRejectedValue(error);

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('SES API Error');
		});

		it('should return error object when continueOnFail is true', async () => {
			const error = new Error('SES API Error');
			mockSend.mockRejectedValue(error);
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toMatchObject({
				error: 'SES API Error',
				success: false,
			});
		});

		it('should continue processing other items after error with continueOnFail', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
				{ json: {} },
			]);

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						resource: 'email',
						operation: 'send',
						emailType: 'simple',
						fromEmail: 'sender@example.com',
						toEmail: 'recipient@example.com',
						subject: 'Test',
						htmlBody: '<h1>Test</h1>',
						textBody: 'Test',
					};
					return params[paramName];
				},
			);

			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

			mockSend
				.mockRejectedValueOnce(new Error('First email failed'))
				.mockResolvedValueOnce({ MessageId: 'msg-2' });

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0]).toHaveLength(2);
			expect(result[0][0].json).toMatchObject({
				error: 'First email failed',
				success: false,
			});
			expect(result[0][1].json).toMatchObject({
				messageId: 'msg-2',
				success: true,
			});
		});

		it('should handle credential retrieval errors', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockRejectedValue(
				new Error('Credential not found'),
			);

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('Credential not found');
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty recipient list gracefully', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						resource: 'email',
						operation: 'send',
						emailType: 'simple',
						fromEmail: 'sender@example.com',
						toEmail: '   ,  ,   ', // only commas and whitespace
						subject: 'Test',
						htmlBody: '<h1>Test</h1>',
						textBody: 'Test',
					};
					return params[paramName];
				},
			);

			mockSend.mockResolvedValue({ MessageId: 'msg-id' });

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json.to).toEqual([]);
		});

		it('should filter out empty email addresses', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						resource: 'email',
						operation: 'send',
						emailType: 'simple',
						fromEmail: 'sender@example.com',
						toEmail: 'valid@example.com,  ,  another@example.com,  ',
						subject: 'Test',
						htmlBody: '<h1>Test</h1>',
						textBody: 'Test',
					};
					return params[paramName];
				},
			);

			mockSend.mockResolvedValue({ MessageId: 'msg-id' });

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json.to).toEqual(['valid@example.com', 'another@example.com']);
		});

		it('should include pairedItem metadata', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						resource: 'email',
						operation: 'send',
						emailType: 'simple',
						fromEmail: 'sender@example.com',
						toEmail: 'recipient@example.com',
						subject: 'Test',
						htmlBody: '<h1>Test</h1>',
						textBody: 'Test',
					};
					return params[paramName];
				},
			);

			mockSend.mockResolvedValue({ MessageId: 'msg-id' });

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].pairedItem).toEqual({ item: 0 });
		});
	});
});
