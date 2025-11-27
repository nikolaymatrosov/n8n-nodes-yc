/* eslint-disable n8n-nodes-base/node-param-description-lowercase-first-char */
/* eslint-disable n8n-nodes-base/node-param-display-name-miscased */
// n8n-specific linting rules are disabled for test files as they check node parameter definitions, not test code

import { YandexCloudContainers } from '../YandexCloudContainers.node';
import type { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

// Mock Yandex Cloud SDK
jest.mock('@yandex-cloud/nodejs-sdk');
jest.mock('@yandex-cloud/nodejs-sdk/dist/token-service/iam-token-service');

// Mock global fetch
global.fetch = jest.fn();

describe('YandexCloudContainers Node', () => {
	let node: YandexCloudContainers;
	let mockExecuteFunctions: Partial<IExecuteFunctions>;
	let mockLoadOptionsFunctions: Partial<ILoadOptionsFunctions>;
	let mockIamTokenService: any;
	let mockSession: any;
	let mockContainerServiceClient: any;

	beforeEach(() => {
		jest.clearAllMocks();

		node = new YandexCloudContainers();

		// Mock IAM Token Service
		mockIamTokenService = {
			getToken: jest.fn().mockResolvedValue('test-iam-token'),
		};

		const { IamTokenService } = require('@yandex-cloud/nodejs-sdk/dist/token-service/iam-token-service');
		IamTokenService.mockImplementation(() => mockIamTokenService);

		// Mock Container Service Client
		mockContainerServiceClient = {
			list: jest.fn(),
			get: jest.fn(),
		};

		// Mock Session
		mockSession = {
			client: jest.fn().mockReturnValue(mockContainerServiceClient),
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
			expect(node.description.displayName).toBe('Yandex Cloud Containers');
			expect(node.description.name).toBe('yandexCloudContainers');
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

		it('should expose loadContainers method', () => {
			expect(node.methods?.loadOptions?.loadContainers).toBeDefined();
		});
	});

	describe('Load Containers Method', () => {
		it('should load containers successfully', async () => {
			(mockLoadOptionsFunctions.getNodeParameter as jest.Mock).mockReturnValue('');

			mockContainerServiceClient.list.mockResolvedValue({
				containers: [
					{
						id: 'container-1',
						name: 'TestContainer1',
						url: 'https://container1.containers.yandexcloud.net',
					},
					{
						id: 'container-2',
						name: 'TestContainer2',
						url: 'https://container2.containers.yandexcloud.net',
					},
				],
			});

			const result = await node.methods!.loadOptions!.loadContainers.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(result).toHaveLength(2);
			expect(result[0]).toMatchObject({
				name: 'TestContainer1 (container-1)',
				value: 'container-1',
				description: 'https://container1.containers.yandexcloud.net',
			});
			expect(result[1]).toMatchObject({
				name: 'TestContainer2 (container-2)',
				value: 'container-2',
				description: 'https://container2.containers.yandexcloud.net',
			});
		});

		it('should use folder ID from node parameter if provided', async () => {
			(mockLoadOptionsFunctions.getNodeParameter as jest.Mock).mockReturnValue('override-folder-id');

			mockContainerServiceClient.list.mockResolvedValue({
				containers: [],
			});

			await node.methods!.loadOptions!.loadContainers.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(mockContainerServiceClient.list).toHaveBeenCalledWith(
				expect.objectContaining({
					folderId: 'override-folder-id',
				}),
			);
		});

		it('should use folder ID from credentials if node parameter is empty', async () => {
			(mockLoadOptionsFunctions.getNodeParameter as jest.Mock).mockReturnValue('');

			mockContainerServiceClient.list.mockResolvedValue({
				containers: [],
			});

			await node.methods!.loadOptions!.loadContainers.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(mockContainerServiceClient.list).toHaveBeenCalledWith(
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
				node.methods!.loadOptions!.loadContainers.call(
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
				node.methods!.loadOptions!.loadContainers.call(
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
				node.methods!.loadOptions!.loadContainers.call(
					mockLoadOptionsFunctions as ILoadOptionsFunctions,
				),
			).rejects.toThrow('Folder ID is required');
		});

		it('should handle API errors when listing containers', async () => {
			(mockLoadOptionsFunctions.getNodeParameter as jest.Mock).mockReturnValue('');

			mockContainerServiceClient.list.mockRejectedValue(new Error('API Error'));

			await expect(
				node.methods!.loadOptions!.loadContainers.call(
					mockLoadOptionsFunctions as ILoadOptionsFunctions,
				),
			).rejects.toThrow('Yandex Cloud SDK error in list containers');
		});

		it('should handle containers without URL', async () => {
			(mockLoadOptionsFunctions.getNodeParameter as jest.Mock).mockReturnValue('');

			mockContainerServiceClient.list.mockResolvedValue({
				containers: [
					{
						id: 'container-1',
						name: 'TestContainer1',
						url: null,
					},
				],
			});

			const result = await node.methods!.loadOptions!.loadContainers.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(result[0].description).toBe('container-1');
		});
	});

	describe('Container Invoke Operation', () => {
		describe('POST Requests', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'container',
							operation: 'invoke',
							containerId: 'test-container-id',
							httpMethod: 'POST',
							body: '{"key":"value"}',
							folderId: '',
							additionalOptions: {},
						};
						return params[paramName];
					},
				);

				mockContainerServiceClient.get.mockResolvedValue({
					id: 'test-container-id',
					name: 'TestContainer',
					url: 'https://test.containers.yandexcloud.net',
				});
			});

			it('should invoke container with POST request successfully', async () => {
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

			it('should get container URL before invoking', async () => {
				(global.fetch as jest.Mock).mockResolvedValue({
					status: 200,
					text: jest.fn().mockResolvedValue('{}'),
					headers: new Map(),
				});

				await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(mockContainerServiceClient.get).toHaveBeenCalledWith(
					expect.objectContaining({
						containerId: 'test-container-id',
					}),
				);
			});

			it('should send correct POST request with Authorization header', async () => {
				(global.fetch as jest.Mock).mockResolvedValue({
					status: 200,
					text: jest.fn().mockResolvedValue('{"result":"success"}'),
					headers: new Map(),
				});

				await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(global.fetch).toHaveBeenCalledWith(
					'https://test.containers.yandexcloud.net',
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

			it('should throw error if container has no URL', async () => {
				mockContainerServiceClient.get.mockResolvedValue({
					id: 'test-container-id',
					name: 'TestContainer',
					url: null,
				});

				await expect(
					node.execute.call(mockExecuteFunctions as IExecuteFunctions),
				).rejects.toThrow('Container test-container-id does not have a URL');
			});

			it('should throw error for invalid JSON body', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'container',
							operation: 'invoke',
							containerId: 'test-container-id',
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
							resource: 'container',
							operation: 'invoke',
							containerId: 'test-container-id',
							httpMethod: 'GET',
							folderId: '',
							additionalOptions: {},
						};
						return params[paramName];
					},
				);

				mockContainerServiceClient.get.mockResolvedValue({
					id: 'test-container-id',
					url: 'https://test.containers.yandexcloud.net',
				});
			});

			it('should invoke container with GET request', async () => {
				(global.fetch as jest.Mock).mockResolvedValue({
					status: 200,
					text: jest.fn().mockResolvedValue('{"data":"test"}'),
					headers: new Map(),
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(global.fetch).toHaveBeenCalledWith(
					'https://test.containers.yandexcloud.net',
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
			beforeEach(() => {
				mockContainerServiceClient.get.mockResolvedValue({
					id: 'test-container-id',
					url: 'https://test.containers.yandexcloud.net',
				});
			});

			it('should add query parameters to URL', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'container',
							operation: 'invoke',
							containerId: 'test-container-id',
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
					'https://test.containers.yandexcloud.net?param1=value1&param2=value2',
					expect.any(Object),
				);
			});

			it('should skip query parameters with empty names', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'container',
							operation: 'invoke',
							containerId: 'test-container-id',
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
					'https://test.containers.yandexcloud.net?param2=value2',
					expect.any(Object),
				);
			});
		});

		describe('Custom Headers', () => {
			beforeEach(() => {
				mockContainerServiceClient.get.mockResolvedValue({
					id: 'test-container-id',
					url: 'https://test.containers.yandexcloud.net',
				});
			});

			it('should add custom headers to request', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'container',
							operation: 'invoke',
							containerId: 'test-container-id',
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
								resource: 'container',
								operation: 'invoke',
								containerId: 'container-1',
								httpMethod: 'GET',
								folderId: '',
								additionalOptions: {},
							},
							{
								resource: 'container',
								operation: 'invoke',
								containerId: 'container-2',
								httpMethod: 'GET',
								folderId: '',
								additionalOptions: {},
							},
						];
						return configs[itemIndex][paramName as keyof typeof configs[0]];
					},
				);

				mockContainerServiceClient.get
					.mockResolvedValueOnce({
						id: 'container-1',
						url: 'https://container1.yandexcloud.net',
					})
					.mockResolvedValueOnce({
						id: 'container-2',
						url: 'https://container2.yandexcloud.net',
					});

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
	});

	describe('Error Handling', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						resource: 'container',
						operation: 'invoke',
						containerId: 'test-container-id',
						httpMethod: 'GET',
						folderId: '',
						additionalOptions: {},
					};
					return params[paramName];
				},
			);

			mockContainerServiceClient.get.mockResolvedValue({
				id: 'test-container-id',
				url: 'https://test.containers.yandexcloud.net',
			});
		});

		it('should throw error when continueOnFail is false', async () => {
			(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('Yandex Cloud SDK error in invoke container');
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

		it('should throw error if folder ID is missing', async () => {
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
						resource: 'container',
						operation: 'invoke',
						containerId: 'test-container-id',
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

