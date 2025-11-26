import type { INode } from 'n8n-workflow';
import type { Metadata } from 'nice-grpc';
import {
	YandexCloudSdkError,
	isSdkApiError,
	isOperationError,
	extractSdkErrorInfo,
	handleOperationError,
	withSdkErrorHandling,
	type ISdkApiError,
} from '../sdkErrorHandling';

describe('sdkErrorHandling', () => {
	let mockNode: INode;

	beforeEach(() => {
		mockNode = {
			id: 'test-node-id',
			name: 'Test Node',
			type: 'n8n-nodes-yc.yandexCloudTest',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		};
	});

	describe('Type Guards', () => {
		describe('isSdkApiError', () => {
			it('should return true for SDK ApiError with metadata', () => {
				const mockMetadata = {
					get: jest.fn(),
				} as unknown as Metadata;

				const error: ISdkApiError = Object.assign(new Error('SDK error'), {
					metadata: mockMetadata,
				});

				expect(isSdkApiError(error)).toBe(true);
			});

			it('should return false for standard Error', () => {
				const error = new Error('Standard error');
				expect(isSdkApiError(error)).toBe(false);
			});

			it('should return false for null', () => {
				expect(isSdkApiError(null)).toBe(false);
			});

			it('should return false for undefined', () => {
				expect(isSdkApiError(undefined)).toBe(false);
			});

			it('should return false for object without metadata', () => {
				const error = { message: 'Error' };
				expect(isSdkApiError(error)).toBe(false);
			});

			it('should return false for Error with null metadata', () => {
				const error = Object.assign(new Error('Error'), { metadata: null });
				expect(isSdkApiError(error)).toBe(false);
			});
		});

		describe('isOperationError', () => {
			it('should return true for object with code', () => {
				expect(isOperationError({ code: 13 })).toBe(true);
			});

			it('should return true for object with message', () => {
				expect(isOperationError({ message: 'Error' })).toBe(true);
			});

			it('should return true for object with details', () => {
				expect(isOperationError({ details: { info: 'test' } })).toBe(true);
			});

			it('should return true for complete operation error', () => {
				expect(
					isOperationError({
						code: 13,
						message: 'Internal error',
						details: {},
					}),
				).toBe(true);
			});

			it('should return false for null', () => {
				expect(isOperationError(null)).toBe(false);
			});

			it('should return false for empty object', () => {
				expect(isOperationError({})).toBe(false);
			});
		});
	});

	describe('extractSdkErrorInfo', () => {
		it('should extract info from SDK ApiError with metadata', () => {
			const mockMetadata = {
				get: jest.fn((key: string) => {
					const metadata: Record<string, string> = {
						'x-request-id': 'req-123',
						'x-server-trace-id': 'trace-456',
						'grpc-status': '13',
					};
					return metadata[key];
				}),
			} as unknown as Metadata;

			const error: ISdkApiError = Object.assign(new Error('Internal error'), {
				metadata: mockMetadata,
			});

			const info = extractSdkErrorInfo(error);

			expect(info.message).toBe('Internal error');
			expect(info.requestId).toBe('req-123');
			expect(info.serverTraceId).toBe('trace-456');
			expect(info.code).toBe('13');
		});

		it('should extract info from SDK ApiError without trace IDs', () => {
			const mockMetadata = {
				get: jest.fn(() => undefined),
			} as unknown as Metadata;

			const error: ISdkApiError = Object.assign(new Error('Permission denied'), {
				metadata: mockMetadata,
			});

			const info = extractSdkErrorInfo(error);

			expect(info.message).toBe('Permission denied');
			expect(info.requestId).toBeUndefined();
			expect(info.serverTraceId).toBeUndefined();
		});

		it('should extract info from standard Error', () => {
			const error = new Error('Standard error message');

			const info = extractSdkErrorInfo(error);

			expect(info.message).toBe('Standard error message');
			expect(info.requestId).toBeUndefined();
			expect(info.serverTraceId).toBeUndefined();
		});

		it('should extract info from Error with code property', () => {
			const error = Object.assign(new Error('Error with code'), {
				code: 'ECONNREFUSED',
			});

			const info = extractSdkErrorInfo(error);

			expect(info.message).toBe('Error with code');
			expect(info.code).toBe('ECONNREFUSED');
		});

		it('should extract info from plain object with message', () => {
			const error = {
				message: 'Plain object error',
				code: 5,
			};

			const info = extractSdkErrorInfo(error);

			expect(info.message).toBe('Plain object error');
			expect(info.code).toBe('5');
		});

		it('should extract info from nested error object', () => {
			const error = {
				error: {
					message: 'Nested error message',
					code: 7,
				},
			};

			const info = extractSdkErrorInfo(error);

			expect(info.message).toBe('Nested error message');
			expect(info.code).toBe('7');
		});

		it('should handle error with details', () => {
			const error = {
				message: 'Error with details',
				details: { additionalInfo: 'test' },
			};

			const info = extractSdkErrorInfo(error);

			expect(info.message).toBe('Error with details');
			expect(info.details).toEqual({ additionalInfo: 'test' });
		});

		it('should return unknown error for invalid input', () => {
			const info = extractSdkErrorInfo(null);

			expect(info.message).toBe('Unknown SDK error');
		});

		it('should search multiple message keys', () => {
			const error = {
				error_message: 'Found in error_message key',
			};

			const info = extractSdkErrorInfo(error);

			expect(info.message).toBe('Found in error_message key');
		});
	});

	describe('YandexCloudSdkError', () => {
		it('should create error with SDK ApiError', () => {
			const mockMetadata = {
				get: jest.fn((key: string) => {
					const metadata: Record<string, string> = {
						'x-request-id': 'req-789',
						'x-server-trace-id': 'trace-012',
						'grpc-status': '16',
					};
					return metadata[key];
				}),
			} as unknown as Metadata;

			const sdkError: ISdkApiError = Object.assign(new Error('Authentication failed'), {
				metadata: mockMetadata,
			});

			const error = new YandexCloudSdkError(mockNode, sdkError, {
				operation: 'list buckets',
			});

			expect(error.message).toBe('Yandex Cloud SDK error in list buckets');
			expect(error.description).toContain('Authentication failed');
			expect(error.description).toContain('Request ID: req-789');
			expect(error.description).toContain('Trace ID: trace-012');
			expect(error.requestId).toBe('req-789');
			expect(error.serverTraceId).toBe('trace-012');
			expect(error.grpcCode).toBe('16');
		});

		it('should create error with standard Error', () => {
			const stdError = new Error('Connection timeout');

			const error = new YandexCloudSdkError(mockNode, stdError, {
				operation: 'create log group',
				itemIndex: 5,
			});

			expect(error.message).toBe('Yandex Cloud SDK error in create log group');
			expect(error.description).toContain('Connection timeout');
			expect(error.context?.itemIndex).toBe(5);
		});

		it('should map gRPC status code to user-friendly message', () => {
			const error = {
				message: 'gRPC error',
				code: 7,
			};

			const sdkError = new YandexCloudSdkError(mockNode, error, {
				operation: 'update resource',
			});

			expect(sdkError.description).toContain('Permission denied');
			expect(sdkError.description).toContain('Details: gRPC error');
		});

		it('should handle custom message and description', () => {
			const error = new Error('Original error');

			const sdkError = new YandexCloudSdkError(mockNode, error, {
				message: 'Custom message',
				description: 'Custom description',
				operation: 'test operation',
			});

			expect(sdkError.message).toBe('Custom message in test operation');
			expect(sdkError.description).toContain('Custom description');
		});

		it('should handle error without operation name', () => {
			const error = new Error('Generic error');

			const sdkError = new YandexCloudSdkError(mockNode, error);

			expect(sdkError.message).toBe('Yandex Cloud SDK error');
		});

		it('should return same error if already YandexCloudSdkError', () => {
			const originalError = new YandexCloudSdkError(mockNode, new Error('Original'), {
				operation: 'test',
			});

			const returnedError = new YandexCloudSdkError(mockNode, originalError);

			expect(returnedError).toBe(originalError);
		});

		it('should include HTTP code if provided', () => {
			const error = new Error('HTTP error');

			const sdkError = new YandexCloudSdkError(mockNode, error, {
				httpCode: '503',
			});

			expect(sdkError.context?.httpCode).toBe('503');
		});

		it('should include runIndex if provided', () => {
			const error = new Error('Run error');

			const sdkError = new YandexCloudSdkError(mockNode, error, {
				runIndex: 3,
			});

			expect(sdkError.context?.runIndex).toBe(3);
		});

		it('should handle error with details in context', () => {
			const error = {
				message: 'Error with details',
				details: { key: 'value' },
			};

			const sdkError = new YandexCloudSdkError(mockNode, error);

			expect(sdkError.context?.sdkDetails).toEqual({ key: 'value' });
		});

		it('should handle all gRPC status codes', () => {
			const testCases = [
				{ code: '1', expectedText: 'Operation was cancelled' },
				{ code: '3', expectedText: 'Invalid argument provided' },
				{ code: '5', expectedText: 'Resource not found' },
				{ code: '7', expectedText: 'Permission denied' },
				{ code: '8', expectedText: 'Resource exhausted' },
				{ code: '13', expectedText: 'Internal error' },
				{ code: '14', expectedText: 'Service is currently unavailable' },
				{ code: '16', expectedText: 'Authentication failed' },
			];

			testCases.forEach(({ code, expectedText }) => {
				const error = { code: parseInt(code), message: 'Details' };
				const sdkError = new YandexCloudSdkError(mockNode, error);
				expect(sdkError.description).toContain(expectedText);
			});
		});
	});

	describe('handleOperationError', () => {
		it('should throw YandexCloudSdkError when operation has error', () => {
			const operation = {
				error: {
					code: 13,
					message: 'Operation failed internally',
				},
			};

			expect(() => {
				handleOperationError(mockNode, operation, 'image generation');
			}).toThrow(YandexCloudSdkError);

			try {
				handleOperationError(mockNode, operation, 'image generation');
			} catch (error) {
				expect(error).toBeInstanceOf(YandexCloudSdkError);
				const sdkError = error as YandexCloudSdkError;
				expect(sdkError.message).toContain('image generation failed');
				expect(sdkError.description).toContain('Operation failed internally');
				expect(sdkError.description).toContain('code: 13');
			}
		});

		it('should not throw when operation has no error', () => {
			const operation = {};

			expect(() => {
				handleOperationError(mockNode, operation, 'successful operation');
			}).not.toThrow();
		});

		it('should not throw when operation error is null', () => {
			const operation = { error: null };

			expect(() => {
				handleOperationError(mockNode, operation, 'successful operation');
			}).not.toThrow();
		});

		it('should handle operation error without code', () => {
			const operation = {
				error: {
					message: 'Error without code',
				},
			};

			try {
				handleOperationError(mockNode, operation, 'test operation');
			} catch (error) {
				const sdkError = error as YandexCloudSdkError;
				expect(sdkError.description).toContain('Error without code');
				expect(sdkError.description).not.toContain('code:');
			}
		});

		it('should handle operation error without message', () => {
			const operation = {
				error: {
					code: 5,
				},
			};

			try {
				handleOperationError(mockNode, operation, 'test operation');
			} catch (error) {
				const sdkError = error as YandexCloudSdkError;
				expect(sdkError.description).toContain('Unknown error');
				expect(sdkError.description).toContain('code: 5');
			}
		});
	});

	describe('withSdkErrorHandling', () => {
		it('should return function result on success', async () => {
			const mockFn = jest.fn().mockResolvedValue({ data: 'success' });

			const result = await withSdkErrorHandling(mockNode, mockFn, 'test operation');

			expect(result).toEqual({ data: 'success' });
			expect(mockFn).toHaveBeenCalledTimes(1);
		});

		it('should wrap errors in YandexCloudSdkError', async () => {
			const originalError = new Error('Original error');
			const mockFn = jest.fn().mockRejectedValue(originalError);

			await expect(
				withSdkErrorHandling(mockNode, mockFn, 'test operation', 2),
			).rejects.toThrow(YandexCloudSdkError);

			try {
				await withSdkErrorHandling(mockNode, mockFn, 'test operation', 2);
			} catch (error) {
				expect(error).toBeInstanceOf(YandexCloudSdkError);
				const sdkError = error as YandexCloudSdkError;
				expect(sdkError.message).toContain('test operation');
				expect(sdkError.description).toContain('Original error');
				expect(sdkError.context?.itemIndex).toBe(2);
			}
		});

		it('should wrap SDK ApiError with metadata', async () => {
			const mockMetadata = {
				get: jest.fn((key: string) => {
					const metadata: Record<string, string> = {
						'x-request-id': 'req-999',
						'grpc-status': '7',
					};
					return metadata[key];
				}),
			} as unknown as Metadata;

			const apiError: ISdkApiError = Object.assign(new Error('Permission denied by SDK'), {
				metadata: mockMetadata,
			});

			const mockFn = jest.fn().mockRejectedValue(apiError);

			try {
				await withSdkErrorHandling(mockNode, mockFn, 'list resources');
			} catch (error) {
				const sdkError = error as YandexCloudSdkError;
				expect(sdkError.requestId).toBe('req-999');
				expect(sdkError.grpcCode).toBe('7');
				expect(sdkError.description).toContain('Request ID: req-999');
			}
		});

		it('should handle errors without itemIndex', async () => {
			const mockFn = jest.fn().mockRejectedValue(new Error('Error'));

			try {
				await withSdkErrorHandling(mockNode, mockFn, 'test operation');
			} catch (error) {
				const sdkError = error as YandexCloudSdkError;
				expect(sdkError.context?.itemIndex).toBeUndefined();
			}
		});
	});

	describe('Error Message Extraction', () => {
		it('should prioritize error message keys correctly', () => {
			const error = {
				cause: 'Cause message',
				error: 'Error message',
				message: 'Message field',
			};

			const info = extractSdkErrorInfo(error);

			// 'cause' should have highest priority
			expect(info.message).toBe('Cause message');
		});

		it('should fall through message keys if earlier ones missing', () => {
			const error = {
				msg: 'Msg field',
				description: 'Description field',
			};

			const info = extractSdkErrorInfo(error);

			// 'msg' appears before 'description' in priority list
			expect(info.message).toBe('Msg field');
		});

		it('should handle deeply nested error structures', () => {
			const error = {
				response: {
					data: {
						error: {
							message: 'Deeply nested message',
							code: 42,
						},
					},
				},
			};

			const info = extractSdkErrorInfo(error);

			expect(info.message).toBe('Deeply nested message');
			expect(info.code).toBe('42');
		});
	});
});
