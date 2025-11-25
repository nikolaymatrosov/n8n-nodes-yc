/**
 * Unit tests for YandexCloudArt node
 */

// Mock authUtils BEFORE importing anything
jest.mock('@utils/authUtils', () => ({
	parseServiceAccountJson: jest.fn((json: string) => JSON.parse(json)),
	validateServiceAccountCredentials: jest.fn(),
	createYandexSession: jest.fn(),
}));

// Mock GenericFunctions to avoid importing SDK modules
jest.mock('../GenericFunctions', () => ({
	createImageGenerationClient: jest.fn().mockReturnValue({
		generate: jest.fn().mockResolvedValue({ id: 'test-op-id', done: false }),
	}),
	createOperationClient: jest.fn().mockReturnValue({
		get: jest.fn(),
	}),
	pollOperationUntilDone: jest.fn(),
	extractImageResponse: jest.fn(),
	buildModelUri: jest.fn((folderId: string) => `art://${folderId}/yandex-art/latest`),
	getFileExtensionFromMimeType: jest.fn((mimeType: string) => {
		const map: Record<string, string> = {
			'image/jpeg': 'jpeg',
			'image/png': 'png',
		};
		return map[mimeType] || 'bin';
	}),
	truncatePrompt: jest.fn((text: string, maxLength: number = 500) => {
		if (text.length <= maxLength) return text;
		const truncated = text.substring(0, maxLength);
		const lastSpaceIndex = truncated.lastIndexOf(' ');
		return lastSpaceIndex === -1 ? truncated : truncated.substring(0, lastSpaceIndex);
	}),
}));

// Mock ImageGenerationRequest
jest.mock('@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/ai/foundation_models/v1/image_generation/image_generation_service', () => ({
	ImageGenerationRequest: {
		fromJSON: jest.fn((obj: any) => obj),
	},
}));

import { YandexArt } from '../YandexArt.node';
import type { IExecuteFunctions } from 'n8n-workflow';
import * as GenericFunctions from '../GenericFunctions';

describe('YandexArt', () => {
	let node: YandexArt;
	let mockExecuteFunctions: Partial<IExecuteFunctions>;

	beforeEach(() => {
		jest.clearAllMocks();

		node = new YandexArt();

		// Mock IExecuteFunctions
		mockExecuteFunctions = {
			getInputData: jest.fn().mockReturnValue([{ json: {} }]),
			getNodeParameter: jest.fn(),
			getCredentials: jest.fn().mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					service_account_id: 'test-account-id',
					access_key_id: 'test-key-id',
					private_key: 'test-private-key',
				}),
				folderId: 'test-folder-id',
			}),
			continueOnFail: jest.fn().mockReturnValue(false),
			getNode: jest.fn().mockReturnValue({ name: 'Test Node' }),
			helpers: {
				prepareBinaryData: jest
					.fn()
					.mockResolvedValue({ data: 'base64data', mimeType: 'image/jpeg' }),
			} as any,
		};
	});

	describe('Node Definition', () => {
		it('should have correct basic properties', () => {
			expect(node.description.displayName).toBe('Yandex Art');
			expect(node.description.name).toBe('yandexArt');
			expect(node.description.version).toBe(1);
			expect(node.description.group).toContain('transform');
		});

		it('should have correct credential configuration', () => {
			expect(node.description.credentials).toHaveLength(1);
			expect(node.description.credentials?.[0].name).toBe('yandexCloudAuthorizedApi');
			expect(node.description.credentials?.[0].required).toBe(true);
		});

		it('should have correct inputs and outputs', () => {
			expect(node.description.inputs).toEqual(['main']);
			expect(node.description.outputs).toEqual(['main']);
		});

		it('should have image resource', () => {
			const resourceProperty = node.description.properties.find((p) => p.name === 'resource');
			expect(resourceProperty).toBeDefined();
			expect(resourceProperty?.type).toBe('options');
			expect(resourceProperty?.options).toHaveLength(1);
			expect((resourceProperty?.options as any)[0].value).toBe('image');
		});

		it('should have generate operation', () => {
			const operationProperty = node.description.properties.find(
				(p) => p.name === 'operation',
			);
			expect(operationProperty).toBeDefined();
			expect(operationProperty?.type).toBe('options');
			expect((operationProperty?.options as any)[0].value).toBe('generate');
		});

		it('should have required prompt field', () => {
			const promptProperty = node.description.properties.find((p) => p.name === 'prompt');
			expect(promptProperty).toBeDefined();
			expect(promptProperty?.required).toBe(true);
			expect(promptProperty?.type).toBe('string');
		});
	});

	describe('Generate Operation', () => {
		describe('With Wait for Completion', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'image',
							operation: 'generate',
							prompt: 'A beautiful sunset over mountains',
							additionalOptions: {
								mimeType: 'image/jpeg',
								aspectRatio: 'SQUARE',
							},
							advancedOptions: {
								waitForCompletion: true,
								pollInterval: 1,
								maxWaitTime: 5,
							},
						};
						return params[paramName];
					},
				);
			});

			it('should generate image successfully', async () => {
				// Mock pollOperationUntilDone to return completed operation
				const mockPollOperation = GenericFunctions.pollOperationUntilDone as jest.Mock;
				mockPollOperation.mockResolvedValue({
					id: 'test-operation-123',
					done: true,
					response: { value: Buffer.from('encoded-response') },
				});

				// Mock extractImageResponse to return image data
				const mockExtractImage = GenericFunctions.extractImageResponse as jest.Mock;
				mockExtractImage.mockReturnValue({
					image: Buffer.from('fake-image-data'),
					modelVersion: 'v1.0',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result).toHaveLength(1);
				expect(result[0]).toHaveLength(1);
				expect(result[0][0].json).toMatchObject({
					success: true,
					modelVersion: 'v1.0',
					prompt: 'A beautiful sunset over mountains',
				});
				expect(result[0][0].binary?.data).toBeDefined();
				expect(mockPollOperation).toHaveBeenCalled();
				expect(mockExtractImage).toHaveBeenCalled();
			});

			it('should handle errors when continueOnFail is false', async () => {
				const mockPollOperation = GenericFunctions.pollOperationUntilDone as jest.Mock;
				mockPollOperation.mockRejectedValue(new Error('API error'));

				await expect(
					node.execute.call(mockExecuteFunctions as IExecuteFunctions),
				).rejects.toThrow();
			});

			it('should handle errors when continueOnFail is true', async () => {
				(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

				const mockPollOperation = GenericFunctions.pollOperationUntilDone as jest.Mock;
				mockPollOperation.mockRejectedValue(new Error('Service unavailable'));

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: false,
					error: 'Service unavailable',
				});
			});
		});

		describe('Without Wait for Completion', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'image',
							operation: 'generate',
							prompt: 'Quick generation test',
							additionalOptions: {},
							advancedOptions: {
								waitForCompletion: false,
							},
						};
						return params[paramName];
					},
				);
			});

			it('should return operation ID without waiting', async () => {
				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result).toHaveLength(1);
				expect(result[0]).toHaveLength(1);
				expect(result[0][0].json).toMatchObject({
					success: true,
					done: false,
					message: expect.stringContaining('Image generation started'),
				});

				// Should not call polling functions
				expect(GenericFunctions.pollOperationUntilDone).not.toHaveBeenCalled();
				expect(GenericFunctions.extractImageResponse).not.toHaveBeenCalled();
			});
		});

		describe('Error Handling', () => {
			it('should handle empty prompt', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'image',
							operation: 'generate',
							prompt: '',
							additionalOptions: {},
							advancedOptions: {},
						};
						return params[paramName];
					},
				);

				await expect(
					node.execute.call(mockExecuteFunctions as IExecuteFunctions),
				).rejects.toThrow('Prompt cannot be empty');
			});
		});

		describe('Parameter Validation', () => {
			it('should use default values when options not provided', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'image',
							operation: 'generate',
							prompt: 'Test prompt',
							additionalOptions: {},
							advancedOptions: {},
						};
						return params[paramName];
					},
				);

				const mockPollOperation = GenericFunctions.pollOperationUntilDone as jest.Mock;
				mockPollOperation.mockResolvedValue({
					id: 'op-123',
					done: true,
					response: { value: Buffer.from('encoded-response') },
				});

				const mockExtractImage = GenericFunctions.extractImageResponse as jest.Mock;
				mockExtractImage.mockReturnValue({
					image: Buffer.from('test'),
					modelVersion: 'v1.0',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					aspectRatio: 'SQUARE',
					mimeType: 'image/jpeg',
					seed: 'auto',
				});
			});
		});

		describe('Prompt Truncation', () => {
			it('should truncate prompt when enabled (default)', async () => {
				// Create a long prompt > 500 characters
				const longPrompt = 'A'.repeat(450) + ' beautiful sunset over mountains ' + 'B'.repeat(100);

				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'image',
							operation: 'generate',
							prompt: longPrompt,
							additionalOptions: {},
							advancedOptions: {
								truncatePrompt: true, // Explicitly enabled
								waitForCompletion: false,
							},
						};
						return params[paramName];
					},
				);

				const mockTruncate = GenericFunctions.truncatePrompt as jest.Mock;
				await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				// Verify truncatePrompt was called with the trimmed prompt
				expect(mockTruncate).toHaveBeenCalledWith(longPrompt.trim(), 500);
			});

			it('should not truncate prompt when disabled', async () => {
				const longPrompt = 'A'.repeat(600); // Over 500 characters

				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'image',
							operation: 'generate',
							prompt: longPrompt,
							additionalOptions: {},
							advancedOptions: {
								truncatePrompt: false, // Disabled
								waitForCompletion: false,
							},
						};
						return params[paramName];
					},
				);

				const mockTruncate = GenericFunctions.truncatePrompt as jest.Mock;
				mockTruncate.mockClear();

				await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				// Verify truncatePrompt was NOT called
				expect(mockTruncate).not.toHaveBeenCalled();
			});

			it('should truncate negative prompt when enabled', async () => {
				const longNegativePrompt = 'blurry, low quality, ' + 'bad '.repeat(200);

				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'image',
							operation: 'generate',
							prompt: 'Test prompt',
							additionalOptions: {
								negativePrompt: longNegativePrompt,
							},
							advancedOptions: {
								truncatePrompt: true,
								waitForCompletion: false,
							},
						};
						return params[paramName];
					},
				);

				const mockTruncate = GenericFunctions.truncatePrompt as jest.Mock;
				await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				// Should be called twice: once for prompt, once for negative prompt
				expect(mockTruncate).toHaveBeenCalledTimes(2);
				expect(mockTruncate).toHaveBeenCalledWith('Test prompt', 500);
				expect(mockTruncate).toHaveBeenCalledWith(longNegativePrompt.trim(), 500);
			});

			it('should handle short prompts without truncation', async () => {
				const shortPrompt = 'A beautiful sunset';

				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'image',
							operation: 'generate',
							prompt: shortPrompt,
							additionalOptions: {},
							advancedOptions: {
								truncatePrompt: true,
								waitForCompletion: false,
							},
						};
						return params[paramName];
					},
				);

				const mockTruncate = GenericFunctions.truncatePrompt as jest.Mock;
				// The mock returns the same text if under 500 chars
				mockTruncate.mockReturnValue(shortPrompt);

				await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(mockTruncate).toHaveBeenCalledWith(shortPrompt, 500);
			});
		});
	});
});
