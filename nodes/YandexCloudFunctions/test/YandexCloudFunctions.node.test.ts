/* eslint-disable n8n-nodes-base/node-param-description-lowercase-first-char */
/* eslint-disable n8n-nodes-base/node-param-display-name-miscased */
// n8n-specific linting rules are disabled for test files as they check node parameter definitions, not test code

import { YandexCloudFunctions } from '../YandexCloudFunctions.node';
import type { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

// Mock Yandex Cloud SDK
jest.mock('@yandex-cloud/nodejs-sdk');
jest.mock('@yandex-cloud/nodejs-sdk/dist/token-service/iam-token-service');

// Mock global fetch
global.fetch = jest.fn();

describe('YandexCloudFunctions Node', () => {
	let node: YandexCloudFunctions;
	let mockExecuteFunctions: Partial<IExecuteFunctions>;
	let mockLoadOptionsFunctions: Partial<ILoadOptionsFunctions>;
	let mockIamTokenService: any;
	let mockSession: any;
	let mockFunctionServiceClient: any;

	beforeEach(() => {
		jest.clearAllMocks();

		node = new YandexCloudFunctions();

		// Mock IAM Token Service
		mockIamTokenService = {
			getToken: jest.fn().mockResolvedValue('test-iam-token'),
		};

		const { IamTokenService } = require('@yandex-cloud/nodejs-sdk/dist/token-service/iam-token-service');
		IamTokenService.mockImplementation(() => mockIamTokenService);

		// Mock Function Service Client
		mockFunctionServiceClient = {
			list: jest.fn(),
		};

		// Mock Session
		mockSession = {
			client: jest.fn().mockReturnValue(mockFunctionServiceClient),
		};

		const { Session } = require('@yandex-cloud/nodejs-sdk');
		Session.mockImplementation(() => mockSession);

		// Mock Execute Functions
		mockExecuteFunctions = {
			getInputData: jest.fn().mockReturnValue([{ json: {} }]),
			getNodeParameter: jest.fn(),
			getCredentials: jest.fn().mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					service_account_id: 'sa-test-id',
					id: 'key-test-id',
					private_key: 'test-private-key',
				}),
				folderId: 'folder-test-id',
			}),
			continueOnFail: jest.fn().mockReturnValue(false),
			getNode: jest.fn().mockReturnValue({ name: 'Test Node' }),
		};

		// Mock Load Options Functions
		mockLoadOptionsFunctions = {
			getCredentials: jest.fn().mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					service_account_id: 'sa-test-id',
					id: 'key-test-id',
					private_key: 'test-private-key',
				}),
				folderId: 'folder-test-id',
			}),
			getNodeParameter: jest.fn(),
			getNode: jest.fn().mockReturnValue({ name: 'Test Node' }),
		};
	});

	describe('Node Definition', () => {
		it('should have correct basic properties', () => {
			expect(node.description.displayName).toBe('Yandex Cloud Functions');
			expect(node.description.name).toBe('yandexCloudFunctions');
			expect(node.description.group).toContain('transform');
			expect(node.description.version).toBe(1);
		});

		it('should have correct credentials configuration', () => {
			expect(node.description.credentials).toHaveLength(1);
			expect(node.description.credentials?.[0]).toEqual({
				name: 'yandexCloudAuthorizedApi',
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

		it('should expose loadFunctions method', () => {
			expect(node.methods?.loadOptions?.loadFunctions).toBeDefined();
		});
	});

	describe('Load Functions Method', () => {
		it('should load functions successfully', async () => {
			(mockLoadOptionsFunctions.getNodeParameter as jest.Mock).mockReturnValue('');

			mockFunctionServiceClient.list.mockResolvedValue({
				functions: [
					{
						id: 'func-1',
						name: 'TestFunction1',
						httpInvokeUrl: 'https://functions.yandexcloud.net/func-1',
					},
					{
						id: 'func-2',
						name: 'TestFunction2',
						httpInvokeUrl: 'https://functions.yandexcloud.net/func-2',
					},
				],
			});

			const result = await node.methods!.loadOptions!.loadFunctions.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(result).toHaveLength(2);
			expect(result[0]).toMatchObject({
				name: 'TestFunction1 (func-1)',
				value: 'func-1',
				description: 'https://functions.yandexcloud.net/func-1',
			});
			expect(result[1]).toMatchObject({
				name: 'TestFunction2 (func-2)',
				value: 'func-2',
				description: 'https://functions.yandexcloud.net/func-2',
			});
		});

		it('should use folder ID from node parameter if provided', async () => {
			(mockLoadOptionsFunctions.getNodeParameter as jest.Mock).mockReturnValue('override-folder-id');

			mockFunctionServiceClient.list.mockResolvedValue({
				functions: [],
			});

			await node.methods!.loadOptions!.loadFunctions.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(mockFunctionServiceClient.list).toHaveBeenCalledWith(
				expect.objectContaining({
					folderId: 'override-folder-id',
				}),
			);
		});

		it('should use folder ID from credentials if node parameter is empty', async () => {
			(mockLoadOptionsFunctions.getNodeParameter as jest.Mock).mockReturnValue('');

			mockFunctionServiceClient.list.mockResolvedValue({
				functions: [],
			});

			await node.methods!.loadOptions!.loadFunctions.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(mockFunctionServiceClient.list).toHaveBeenCalledWith(
				expect.objectContaining({
					folderId: 'folder-test-id',
				}),
			);
		});

		it('should throw error for invalid service account JSON', async () => {
			(mockLoadOptionsFunctions.getCredentials as jest.Mock).mockResolvedValue({
				serviceAccountJson: 'invalid-json',
				folderId: 'folder-test-id',
			});

			await expect(
				node.methods!.loadOptions!.loadFunctions.call(
					mockLoadOptionsFunctions as ILoadOptionsFunctions,
				),
			).rejects.toThrow(NodeOperationError);
		});

		it('should throw error if service_account_id is missing', async () => {
			(mockLoadOptionsFunctions.getCredentials as jest.Mock).mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					id: 'key-test-id',
					private_key: 'test-private-key',
				}),
				folderId: 'folder-test-id',
			});

			await expect(
				node.methods!.loadOptions!.loadFunctions.call(
					mockLoadOptionsFunctions as ILoadOptionsFunctions,
				),
			).rejects.toThrow('service_account_id or serviceAccountId is required');
		});

		it('should throw error if folder ID is not provided', async () => {
			(mockLoadOptionsFunctions.getCredentials as jest.Mock).mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					service_account_id: 'sa-test-id',
					id: 'key-test-id',
					private_key: 'test-private-key',
				}),
				folderId: '',
			});
			(mockLoadOptionsFunctions.getNodeParameter as jest.Mock).mockReturnValue('');

			await expect(
				node.methods!.loadOptions!.loadFunctions.call(
					mockLoadOptionsFunctions as ILoadOptionsFunctions,
				),
			).rejects.toThrow('Folder ID is required');
		});

		it('should handle API errors when listing functions', async () => {
			(mockLoadOptionsFunctions.getNodeParameter as jest.Mock).mockReturnValue('');

			mockFunctionServiceClient.list.mockRejectedValue(new Error('API Error'));

			await expect(
				node.methods!.loadOptions!.loadFunctions.call(
					mockLoadOptionsFunctions as ILoadOptionsFunctions,
				),
			).rejects.toThrow('Yandex Cloud SDK error in list functions');
		});

		it('should handle camelCase credentials format', async () => {
			(mockLoadOptionsFunctions.getCredentials as jest.Mock).mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					serviceAccountId: 'sa-test-id',
					accessKeyId: 'key-test-id',
					privateKey: 'test-private-key',
				}),
				folderId: 'folder-test-id',
			});
			(mockLoadOptionsFunctions.getNodeParameter as jest.Mock).mockReturnValue('');

			mockFunctionServiceClient.list.mockResolvedValue({
				functions: [],
			});

			await expect(
				node.methods!.loadOptions!.loadFunctions.call(
					mockLoadOptionsFunctions as ILoadOptionsFunctions,
				),
			).resolves.toEqual([]);
		});
	});

	describe('Function Invoke Operation', () => {
		describe('POST Requests', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'function',
							operation: 'invoke',
							functionId: 'test-func-id',
							httpMethod: 'POST',
							body: '{"key":"value"}',
							folderId: '',
							additionalOptions: {},
						};
						return params[paramName];
					},
				);
			});

			it('should invoke function with POST request successfully', async () => {
				(global.fetch as jest.Mock).mockResolvedValue({
					status: 200,
					text: jest.fn().mockResolvedValue('{"result":"success"}'),
					headers: new Map([['content-type', 'application/json']]),
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result).toHaveLength(1);
				expect(result[0]).toHaveLength(1);
				expect(result[0][0].json).toMatchObject({
					statusCode: 200,
					body: { result: 'success' },
				});
			});

			it('should send correct POST request with Authorization header', async () => {
				(global.fetch as jest.Mock).mockResolvedValue({
					status: 200,
					text: jest.fn().mockResolvedValue('{"result":"success"}'),
					headers: new Map(),
				});

				await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(global.fetch).toHaveBeenCalledWith(
					'https://functions.yandexcloud.net/test-func-id',
					expect.objectContaining({
						method: 'POST',
						headers: expect.objectContaining({
							Authorization: 'Bearer test-iam-token',
							'Content-Type': 'application/json',
						}),
						body: '{"key":"value"}',
					}),
				);
			});

			it('should handle non-JSON response', async () => {
				(global.fetch as jest.Mock).mockResolvedValue({
					status: 200,
					text: jest.fn().mockResolvedValue('plain text response'),
					headers: new Map([['content-type', 'text/plain']]),
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					statusCode: 200,
					body: 'plain text response',
				});
			});

			it('should throw error for invalid JSON body', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'function',
							operation: 'invoke',
							functionId: 'test-func-id',
							httpMethod: 'POST',
							body: 'invalid-json{',
							folderId: '',
							additionalOptions: {},
						};
						return params[paramName];
					},
				);

				await expect(
					node.execute.call(mockExecuteFunctions as IExecuteFunctions),
				).rejects.toThrow('Invalid JSON in request body');
			});
		});

		describe('GET Requests', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'function',
							operation: 'invoke',
							functionId: 'test-func-id',
							httpMethod: 'GET',
							folderId: '',
							additionalOptions: {},
						};
						return params[paramName];
					},
				);
			});

			it('should invoke function with GET request', async () => {
				(global.fetch as jest.Mock).mockResolvedValue({
					status: 200,
					text: jest.fn().mockResolvedValue('{"data":"test"}'),
					headers: new Map(),
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(global.fetch).toHaveBeenCalledWith(
					'https://functions.yandexcloud.net/test-func-id',
					expect.objectContaining({
						method: 'GET',
					}),
				);
				expect(result[0][0].json.statusCode).toBe(200);
			});

			it('should not include body in GET request', async () => {
				(global.fetch as jest.Mock).mockResolvedValue({
					status: 200,
					text: jest.fn().mockResolvedValue('{}'),
					headers: new Map(),
				});

				await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
				expect(fetchCall[1].body).toBeUndefined();
			});
		});

		describe('Query Parameters', () => {
			it('should add query parameters to URL', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'function',
							operation: 'invoke',
							functionId: 'test-func-id',
							httpMethod: 'GET',
							folderId: '',
							additionalOptions: {
								queryParameters: {
									parameter: [
										{ name: 'param1', value: 'value1' },
										{ name: 'param2', value: 'value2' },
									],
								},
							},
						};
						return params[paramName];
					},
				);

				(global.fetch as jest.Mock).mockResolvedValue({
					status: 200,
					text: jest.fn().mockResolvedValue('{}'),
					headers: new Map(),
				});

				await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(global.fetch).toHaveBeenCalledWith(
					'https://functions.yandexcloud.net/test-func-id?param1=value1&param2=value2',
					expect.any(Object),
				);
			});

			it('should skip query parameters with empty names', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'function',
							operation: 'invoke',
							functionId: 'test-func-id',
							httpMethod: 'GET',
							folderId: '',
							additionalOptions: {
								queryParameters: {
									parameter: [
										{ name: '', value: 'value1' },
										{ name: 'param2', value: 'value2' },
									],
								},
							},
						};
						return params[paramName];
					},
				);

				(global.fetch as jest.Mock).mockResolvedValue({
					status: 200,
					text: jest.fn().mockResolvedValue('{}'),
					headers: new Map(),
				});

				await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(global.fetch).toHaveBeenCalledWith(
					'https://functions.yandexcloud.net/test-func-id?param2=value2',
					expect.any(Object),
				);
			});
		});

		describe('Custom Headers', () => {
			it('should add custom headers to request', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'function',
							operation: 'invoke',
							functionId: 'test-func-id',
							httpMethod: 'GET',
							folderId: '',
							additionalOptions: {
								headers: {
									header: [
										{ name: 'X-Custom-Header', value: 'custom-value' },
										{ name: 'X-Another-Header', value: 'another-value' },
									],
								},
							},
						};
						return params[paramName];
					},
				);

				(global.fetch as jest.Mock).mockResolvedValue({
					status: 200,
					text: jest.fn().mockResolvedValue('{}'),
					headers: new Map(),
				});

				await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(global.fetch).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						headers: expect.objectContaining({
							'X-Custom-Header': 'custom-value',
							'X-Another-Header': 'another-value',
							Authorization: 'Bearer test-iam-token',
						}),
					}),
				);
			});

			it('should skip headers with empty names', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'function',
							operation: 'invoke',
							functionId: 'test-func-id',
							httpMethod: 'GET',
							folderId: '',
							additionalOptions: {
								headers: {
									header: [
										{ name: '', value: 'ignored' },
										{ name: 'X-Valid-Header', value: 'valid-value' },
									],
								},
							},
						};
						return params[paramName];
					},
				);

				(global.fetch as jest.Mock).mockResolvedValue({
					status: 200,
					text: jest.fn().mockResolvedValue('{}'),
					headers: new Map(),
				});

				await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
				expect(fetchCall[1].headers['X-Valid-Header']).toBe('valid-value');
				expect(fetchCall[1].headers['']).toBeUndefined();
			});
		});

		describe('Response Handling', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'function',
							operation: 'invoke',
							functionId: 'test-func-id',
							httpMethod: 'GET',
							folderId: '',
							additionalOptions: {},
						};
						return params[paramName];
					},
				);
			});

			it('should include response headers in output', async () => {
				const mockHeaders = new Map([
					['content-type', 'application/json'],
					['x-request-id', 'test-request-id'],
				]);

				(global.fetch as jest.Mock).mockResolvedValue({
					status: 200,
					text: jest.fn().mockResolvedValue('{}'),
					headers: mockHeaders,
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json.headers).toMatchObject({
					'content-type': 'application/json',
					'x-request-id': 'test-request-id',
				});
			});

			it('should handle error status codes', async () => {
				(global.fetch as jest.Mock).mockResolvedValue({
					status: 500,
					text: jest.fn().mockResolvedValue('{"error":"Internal Server Error"}'),
					headers: new Map(),
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					statusCode: 500,
					body: { error: 'Internal Server Error' },
				});
			});

			it('should include pairedItem metadata', async () => {
				(global.fetch as jest.Mock).mockResolvedValue({
					status: 200,
					text: jest.fn().mockResolvedValue('{}'),
					headers: new Map(),
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].pairedItem).toEqual({ item: 0 });
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
								resource: 'function',
								operation: 'invoke',
								functionId: 'func-1',
								httpMethod: 'GET',
								folderId: '',
								additionalOptions: {},
							},
							{
								resource: 'function',
								operation: 'invoke',
								functionId: 'func-2',
								httpMethod: 'GET',
								folderId: '',
								additionalOptions: {},
							},
						];
						return configs[itemIndex][paramName as keyof typeof configs[0]];
					},
				);

				(global.fetch as jest.Mock)
					.mockResolvedValueOnce({
						status: 200,
						text: jest.fn().mockResolvedValue('{"result":"first"}'),
						headers: new Map(),
					})
					.mockResolvedValueOnce({
						status: 200,
						text: jest.fn().mockResolvedValue('{"result":"second"}'),
						headers: new Map(),
					});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0]).toHaveLength(2);
				expect(result[0][0].json.body).toEqual({ result: 'first' });
				expect(result[0][1].json.body).toEqual({ result: 'second' });
			});
		});

		describe('Folder ID Handling', () => {
			it('should use folder ID from node parameter when provided', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'function',
							operation: 'invoke',
							functionId: 'test-func-id',
							httpMethod: 'GET',
							folderId: 'override-folder-id',
							additionalOptions: {},
						};
						return params[paramName];
					},
				);

				(global.fetch as jest.Mock).mockResolvedValue({
					status: 200,
					text: jest.fn().mockResolvedValue('{}'),
					headers: new Map(),
				});

				await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				// Verify execution completed without error
				expect(global.fetch).toHaveBeenCalled();
			});

			it('should throw error if folder ID is missing in both places', async () => {
				(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
					serviceAccountJson: JSON.stringify({
						service_account_id: 'sa-test-id',
						id: 'key-test-id',
						private_key: 'test-private-key',
					}),
					folderId: '',
				});

				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'function',
							operation: 'invoke',
							functionId: 'test-func-id',
							httpMethod: 'GET',
							folderId: '',
							additionalOptions: {},
						};
						return params[paramName];
					},
				);

				await expect(
					node.execute.call(mockExecuteFunctions as IExecuteFunctions),
				).rejects.toThrow('Folder ID is required');
			});
		});
	});

	describe('Error Handling', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						resource: 'function',
						operation: 'invoke',
						functionId: 'test-func-id',
						httpMethod: 'GET',
						folderId: '',
						additionalOptions: {},
					};
					return params[paramName];
				},
			);
		});

		it('should throw error when continueOnFail is false', async () => {
			(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('Yandex Cloud SDK error in invoke function');
		});

		it('should return error object when continueOnFail is true', async () => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toMatchObject({
				error: 'Network error',
				success: false,
			});
		});

		it('should continue processing other items after error with continueOnFail', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
				{ json: {} },
			]);
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

			(global.fetch as jest.Mock)
				.mockRejectedValueOnce(new Error('First request failed'))
				.mockResolvedValueOnce({
					status: 200,
					text: jest.fn().mockResolvedValue('{"result":"success"}'),
					headers: new Map(),
				});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0]).toHaveLength(2);
			expect(result[0][0].json).toMatchObject({
				error: 'First request failed',
				success: false,
			});
			expect(result[0][1].json).toMatchObject({
				statusCode: 200,
				body: { result: 'success' },
			});
		});

		it('should handle invalid credentials format', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				serviceAccountJson: 'not-valid-json',
				folderId: 'folder-test-id',
			});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow(NodeOperationError);
		});

		it('should handle missing service account ID', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					id: 'key-test-id',
					private_key: 'test-private-key',
				}),
				folderId: 'folder-test-id',
			});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('service_account_id or serviceAccountId is required');
		});

		it('should handle missing access key ID', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					service_account_id: 'sa-test-id',
					private_key: 'test-private-key',
				}),
				folderId: 'folder-test-id',
			});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('id or accessKeyId is required');
		});

		it('should handle missing private key', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					service_account_id: 'sa-test-id',
					id: 'key-test-id',
				}),
				folderId: 'folder-test-id',
			});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('private_key or privateKey is required');
		});
	});
});

