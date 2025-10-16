import { YandexCloudCompute } from '../YandexCloudCompute.node';
import type { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

// Mock Yandex Cloud SDK
jest.mock('@yandex-cloud/nodejs-sdk');

describe('YandexCloudCompute Node', () => {
	let node: YandexCloudCompute;
	let mockExecuteFunctions: Partial<IExecuteFunctions>;
	let mockLoadOptionsFunctions: Partial<ILoadOptionsFunctions>;
	let mockSession: any;
	let mockInstanceServiceClient: any;

	beforeEach(() => {
		jest.clearAllMocks();

		node = new YandexCloudCompute();

		// Mock Instance Service Client
		mockInstanceServiceClient = {
			list: jest.fn(),
			start: jest.fn(),
			stop: jest.fn(),
		};

		// Mock Session
		mockSession = {
			client: jest.fn().mockReturnValue(mockInstanceServiceClient),
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
			expect(node.description.displayName).toBe('Yandex Cloud Compute');
			expect(node.description.name).toBe('yandexCloudCompute');
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

		it('should expose loadInstances method', () => {
			expect(node.methods?.loadOptions?.loadInstances).toBeDefined();
		});
	});

	describe('Load Instances Method', () => {
		it('should load instances successfully', async () => {
			(mockLoadOptionsFunctions.getNodeParameter as jest.Mock).mockReturnValue('');

			mockInstanceServiceClient.list.mockResolvedValue({
				instances: [
					{
						id: 'instance-1',
						name: 'TestInstance1',
						status: 2, // RUNNING
					},
					{
						id: 'instance-2',
						name: 'TestInstance2',
						status: 4, // STOPPED
					},
				],
			});

			const result = await node.methods!.loadOptions!.loadInstances.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(result).toHaveLength(2);
			expect(result[0]).toMatchObject({
				name: 'TestInstance1 (instance-1)',
				value: 'instance-1',
			});
			expect(result[1]).toMatchObject({
				name: 'TestInstance2 (instance-2)',
				value: 'instance-2',
			});
		});

		it('should use folder ID from node parameter if provided', async () => {
			(mockLoadOptionsFunctions.getNodeParameter as jest.Mock).mockReturnValue('override-folder-id');

			mockInstanceServiceClient.list.mockResolvedValue({
				instances: [],
			});

			await node.methods!.loadOptions!.loadInstances.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(mockInstanceServiceClient.list).toHaveBeenCalledWith(
				expect.objectContaining({
					folderId: 'override-folder-id',
				}),
			);
		});

		it('should use folder ID from credentials if node parameter is empty', async () => {
			(mockLoadOptionsFunctions.getNodeParameter as jest.Mock).mockReturnValue('');

			mockInstanceServiceClient.list.mockResolvedValue({
				instances: [],
			});

			await node.methods!.loadOptions!.loadInstances.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(mockInstanceServiceClient.list).toHaveBeenCalledWith(
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
				node.methods!.loadOptions!.loadInstances.call(
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
				node.methods!.loadOptions!.loadInstances.call(
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
				node.methods!.loadOptions!.loadInstances.call(
					mockLoadOptionsFunctions as ILoadOptionsFunctions,
				),
			).rejects.toThrow('Folder ID is required');
		});

		it('should handle API errors when listing instances', async () => {
			(mockLoadOptionsFunctions.getNodeParameter as jest.Mock).mockReturnValue('');

			mockInstanceServiceClient.list.mockRejectedValue(new Error('API Error'));

			await expect(
				node.methods!.loadOptions!.loadInstances.call(
					mockLoadOptionsFunctions as ILoadOptionsFunctions,
				),
			).rejects.toThrow('Failed to list instances: API Error');
		});

		it('should handle instances without status', async () => {
			(mockLoadOptionsFunctions.getNodeParameter as jest.Mock).mockReturnValue('');

			mockInstanceServiceClient.list.mockResolvedValue({
				instances: [
					{
						id: 'instance-1',
						name: 'TestInstance1',
						status: null,
					},
				],
			});

			const result = await node.methods!.loadOptions!.loadInstances.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(result[0].description).toBe('instance-1');
		});
	});

	describe('Instance Start Operation', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						resource: 'instance',
						operation: 'start',
						instanceId: 'test-instance-id',
						folderId: '',
					};
					return params[paramName];
				},
			);
		});

		it('should start instance successfully', async () => {
			mockInstanceServiceClient.start.mockResolvedValue({
				id: 'operation-id-123',
				done: false,
				metadata: { instanceId: 'test-instance-id' },
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result).toHaveLength(1);
			expect(result[0]).toHaveLength(1);
			expect(result[0][0].json).toMatchObject({
				success: true,
				operation: 'start',
				instanceId: 'test-instance-id',
				operationId: 'operation-id-123',
				done: false,
			});
		});

		it('should call start with correct parameters', async () => {
			mockInstanceServiceClient.start.mockResolvedValue({
				id: 'operation-id-123',
				done: false,
			});

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(mockInstanceServiceClient.start).toHaveBeenCalledWith(
				expect.objectContaining({
					instanceId: 'test-instance-id',
				}),
			);
		});

		it('should include operation metadata in response', async () => {
			mockInstanceServiceClient.start.mockResolvedValue({
				id: 'operation-id-123',
				done: true,
				metadata: {
					instanceId: 'test-instance-id',
					createdAt: '2024-01-01T00:00:00Z',
				},
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json.metadata).toMatchObject({
				instanceId: 'test-instance-id',
				createdAt: '2024-01-01T00:00:00Z',
			});
		});

		it('should include pairedItem metadata', async () => {
			mockInstanceServiceClient.start.mockResolvedValue({
				id: 'operation-id-123',
				done: false,
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].pairedItem).toEqual({ item: 0 });
		});
	});

	describe('Instance Stop Operation', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						resource: 'instance',
						operation: 'stop',
						instanceId: 'test-instance-id',
						folderId: '',
					};
					return params[paramName];
				},
			);
		});

		it('should stop instance successfully', async () => {
			mockInstanceServiceClient.stop.mockResolvedValue({
				id: 'operation-id-456',
				done: false,
				metadata: { instanceId: 'test-instance-id' },
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result).toHaveLength(1);
			expect(result[0]).toHaveLength(1);
			expect(result[0][0].json).toMatchObject({
				success: true,
				operation: 'stop',
				instanceId: 'test-instance-id',
				operationId: 'operation-id-456',
				done: false,
			});
		});

		it('should call stop with correct parameters', async () => {
			mockInstanceServiceClient.stop.mockResolvedValue({
				id: 'operation-id-456',
				done: false,
			});

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(mockInstanceServiceClient.stop).toHaveBeenCalledWith(
				expect.objectContaining({
					instanceId: 'test-instance-id',
				}),
			);
		});
	});

	describe('Multiple Items Processing', () => {
		it('should process multiple start operations', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
				{ json: {} },
			]);

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, itemIndex: number) => {
					const configs = [
						{
							resource: 'instance',
							operation: 'start',
							instanceId: 'instance-1',
							folderId: '',
						},
						{
							resource: 'instance',
							operation: 'start',
							instanceId: 'instance-2',
							folderId: '',
						},
					];
					return configs[itemIndex][paramName as keyof typeof configs[0]];
				},
			);

			mockInstanceServiceClient.start
				.mockResolvedValueOnce({
					id: 'op-1',
					done: false,
				})
				.mockResolvedValueOnce({
					id: 'op-2',
					done: false,
				});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0]).toHaveLength(2);
			expect(result[0][0].json).toMatchObject({
				operation: 'start',
				instanceId: 'instance-1',
				operationId: 'op-1',
			});
			expect(result[0][1].json).toMatchObject({
				operation: 'start',
				instanceId: 'instance-2',
				operationId: 'op-2',
			});
		});

		it('should process multiple stop operations', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
				{ json: {} },
			]);

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, itemIndex: number) => {
					const configs = [
						{
							resource: 'instance',
							operation: 'stop',
							instanceId: 'instance-1',
							folderId: '',
						},
						{
							resource: 'instance',
							operation: 'stop',
							instanceId: 'instance-2',
							folderId: '',
						},
					];
					return configs[itemIndex][paramName as keyof typeof configs[0]];
				},
			);

			mockInstanceServiceClient.stop
				.mockResolvedValueOnce({
					id: 'op-stop-1',
					done: false,
				})
				.mockResolvedValueOnce({
					id: 'op-stop-2',
					done: false,
				});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0]).toHaveLength(2);
			expect(result[0][0].json.operation).toBe('stop');
			expect(result[0][0].json.instanceId).toBe('instance-1');
			expect(result[0][1].json.operation).toBe('stop');
			expect(result[0][1].json.instanceId).toBe('instance-2');
		});
	});

	describe('Folder ID Handling', () => {
		beforeEach(() => {
			mockInstanceServiceClient.start.mockResolvedValue({
				id: 'op-id',
				done: false,
			});
		});

		it('should use folder ID from node parameter when provided', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						resource: 'instance',
						operation: 'start',
						instanceId: 'test-instance-id',
						folderId: 'override-folder-id',
					};
					return params[paramName];
				},
			);

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			// Verify execution completed without error
			expect(mockInstanceServiceClient.start).toHaveBeenCalled();
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
						resource: 'instance',
						operation: 'start',
						instanceId: 'test-instance-id',
						folderId: '',
					};
					return params[paramName];
				},
			);

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('Folder ID is required');
		});
	});

	describe('Error Handling', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						resource: 'instance',
						operation: 'start',
						instanceId: 'test-instance-id',
						folderId: '',
					};
					return params[paramName];
				},
			);
		});

		it('should throw error when continueOnFail is false', async () => {
			mockInstanceServiceClient.start.mockRejectedValue(new Error('Start failed'));

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('Start failed');
		});

		it('should return error object when continueOnFail is true', async () => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			mockInstanceServiceClient.start.mockRejectedValue(new Error('Start failed'));

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toMatchObject({
				error: 'Start failed',
				success: false,
			});
		});

		it('should continue processing other items after error with continueOnFail', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
				{ json: {} },
			]);
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

			mockInstanceServiceClient.start
				.mockRejectedValueOnce(new Error('First start failed'))
				.mockResolvedValueOnce({
					id: 'op-2',
					done: false,
				});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0]).toHaveLength(2);
			expect(result[0][0].json).toMatchObject({
				error: 'First start failed',
				success: false,
			});
			expect(result[0][1].json).toMatchObject({
				success: true,
				operationId: 'op-2',
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

