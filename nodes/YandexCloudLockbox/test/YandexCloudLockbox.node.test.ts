// Mock external dependencies BEFORE imports
jest.mock('@yandex-cloud/nodejs-sdk');
jest.mock('@yandex-cloud/nodejs-sdk/dist/token-service/iam-token-service');

// Mock the lockbox-v1 module with manual mock
jest.mock('@yandex-cloud/nodejs-sdk/dist/clients/lockbox-v1/index', () => {
	return {
		secretService: {
			SecretServiceClient: class MockSecretServiceClient {},
			SecretServiceService: {},
		},
		payloadService: {
			PayloadServiceClient: class MockPayloadServiceClient {},
			PayloadServiceService: {},
		},
	};
}, { virtual: true });

import { YandexCloudLockbox } from '../YandexCloudLockbox.node';
import type { IExecuteFunctions, ILoadOptionsFunctions, INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

describe('YandexCloudLockbox', () => {
	let node: YandexCloudLockbox;
	let mockExecuteFunctions: Partial<IExecuteFunctions>;
	let mockLoadOptionsFunctions: Partial<ILoadOptionsFunctions>;
	let mockSecretClient: any;
	let mockPayloadClient: any;
	let mockSession: any;
	let mockNode: INode;

	const mockCredentials = {
		serviceAccountJson: JSON.stringify({
			service_account_id: 'sa-test-id',
			id: 'key-test-id',
			private_key: 'test-private-key',
		}),
		folderId: 'folder-test-id',
	};

	let clientCallCount: number;

	beforeEach(() => {
		jest.clearAllMocks();
		clientCallCount = 0;

		node = new YandexCloudLockbox();

		mockNode = {
			id: 'test-node-id',
			name: 'Yandex Cloud Lockbox',
			type: 'n8n-nodes-yc.yandexCloudLockbox',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		};

		// Mock clients
		mockSecretClient = {
			list: jest.fn(),
			get: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			activate: jest.fn(),
			deactivate: jest.fn(),
			listVersions: jest.fn(),
			addVersion: jest.fn(),
			scheduleVersionDestruction: jest.fn(),
			cancelVersionDestruction: jest.fn(),
		};

		mockPayloadClient = {
			get: jest.fn(),
			getEx: jest.fn(),
		};

		// Mock session
		mockSession = {
			client: jest.fn((clientType: any) => {
				clientCallCount++;
				// First call is secretClient, second is payloadClient (from createLockboxClients)
				if (clientCallCount === 2) {
					return mockPayloadClient;
				}
				// Also check by name
				const clientName = String(clientType?.name || '');
				if (clientName.includes('Payload') || clientName.includes('payloadService')) {
					return mockPayloadClient;
				}
				return mockSecretClient;
			}),
		};

		// Mock Session constructor
		const { Session } = require('@yandex-cloud/nodejs-sdk');
		Session.mockImplementation(() => mockSession);

		// Setup execute functions mock
		mockExecuteFunctions = {
			getInputData: jest.fn().mockReturnValue([{ json: {} }]),
			getNodeParameter: jest.fn(),
			getCredentials: jest.fn().mockResolvedValue(mockCredentials),
			continueOnFail: jest.fn().mockReturnValue(false),
			getNode: jest.fn().mockReturnValue(mockNode),
		};

		// Setup load options mock
		mockLoadOptionsFunctions = {
			getCredentials: jest.fn().mockResolvedValue(mockCredentials),
			getNodeParameter: jest.fn(),
			getNode: jest.fn().mockReturnValue(mockNode),
		};
	});

	describe('Node Definition', () => {
		it('should have correct basic properties', () => {
			expect(node.description.displayName).toBe('Yandex Cloud Lockbox');
			expect(node.description.name).toBe('yandexCloudLockbox');
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

		it('should expose list search methods', () => {
			expect(node.methods?.listSearch?.loadSecrets).toBeDefined();
			expect(node.methods?.listSearch?.loadVersions).toBeDefined();
		});
	});

	describe('Resource Loaders', () => {
		describe('loadSecrets', () => {
			it('should load secrets successfully', async () => {
				mockSecretClient.list.mockResolvedValue({
					secrets: [
						{ id: 'secret-1', name: 'Production Secret' },
						{ id: 'secret-2', name: 'Development Secret' },
					],
					nextPageToken: '',
				});

				const result = await node.methods!.listSearch!.loadSecrets.call(
					mockLoadOptionsFunctions as ILoadOptionsFunctions,
				);

				expect(result.results).toHaveLength(2);
				expect(result.results[0]).toEqual({
					name: 'Production Secret (secret-1)',
					value: 'secret-1',
				});
			});

			it('should filter results by name', async () => {
				mockSecretClient.list.mockResolvedValue({
					secrets: [
						{ id: 'secret-1', name: 'Production Secret' },
						{ id: 'secret-2', name: 'Development Secret' },
					],
					nextPageToken: '',
				});

				const result = await node.methods!.listSearch!.loadSecrets.call(
					mockLoadOptionsFunctions as ILoadOptionsFunctions,
					'production',
				);

				expect(result.results).toHaveLength(1);
				expect(result.results[0].name).toContain('Production');
			});

			it('should throw error for invalid credentials', async () => {
				(mockLoadOptionsFunctions.getCredentials as jest.Mock).mockResolvedValue({
					serviceAccountJson: 'invalid-json',
					folderId: 'folder-test-id',
				});

				await expect(
					node.methods!.listSearch!.loadSecrets.call(
						mockLoadOptionsFunctions as ILoadOptionsFunctions,
					),
				).rejects.toThrow();
			});
		});

		describe('loadVersions', () => {
			it('should load versions successfully', async () => {
				(mockLoadOptionsFunctions.getNodeParameter as jest.Mock).mockReturnValue('secret-123');

				mockSecretClient.listVersions.mockResolvedValue({
					versions: [
						{ id: 'version-1', description: 'Initial version' },
						{ id: 'version-2', description: 'Updated version' },
					],
					nextPageToken: '',
				});

				const result = await node.methods!.listSearch!.loadVersions.call(
					mockLoadOptionsFunctions as ILoadOptionsFunctions,
				);

				expect(result.results).toHaveLength(2);
				expect(result.results[0]).toEqual({
					name: 'Initial version (version-1)',
					value: 'version-1',
				});
			});

			it('should throw error if secret ID is not provided', async () => {
				(mockLoadOptionsFunctions.getNodeParameter as jest.Mock).mockReturnValue('');

				await expect(
					node.methods!.listSearch!.loadVersions.call(
						mockLoadOptionsFunctions as ILoadOptionsFunctions,
					),
				).rejects.toThrow(NodeOperationError);
			});
		});
	});

	describe('Secret Operations', () => {
		describe('List Operation', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'secret',
							operation: 'secret.list',
							folderId: '',
							returnAll: false,
							limit: 50,
						};
						return params[paramName];
					},
				);
			});

			it('should list secrets successfully', async () => {
				mockSecretClient.list.mockResolvedValue({
					secrets: [
						{ id: 'secret-1', name: 'Test Secret', status: 2 },
					],
					nextPageToken: '',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0]).toHaveLength(1);
				expect(result[0][0].json).toMatchObject({
					id: 'secret-1',
					name: 'Test Secret',
					status: 'ACTIVE',
				});
			});

			it('should handle pagination with returnAll true', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						if (paramName === 'returnAll') return true;
						if (paramName === 'resource') return 'secret';
						if (paramName === 'operation') return 'secret.list';
						return '';
					},
				);

				mockSecretClient.list
					.mockResolvedValueOnce({
						secrets: [{ id: 'secret-1', status: 2 }],
						nextPageToken: 'page-2',
					})
					.mockResolvedValueOnce({
						secrets: [{ id: 'secret-2', status: 2 }],
						nextPageToken: '',
					});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0]).toHaveLength(2);
				expect(mockSecretClient.list).toHaveBeenCalledTimes(2);
			});
		});

		describe('Get Operation', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _fallback?: any, options?: any) => {
						const params: Record<string, any> = {
							resource: 'secret',
							operation: 'secret.get',
							secretId: 'secret-123',
						};

						if (options?.extractValue && paramName === 'secretId') {
							return params.secretId;
						}

						return params[paramName];
					},
				);
			});

			it('should get secret successfully', async () => {
				mockSecretClient.get.mockResolvedValue({
					id: 'secret-123',
					name: 'Test Secret',
					description: 'Test description',
					status: 2,
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					id: 'secret-123',
					name: 'Test Secret',
					status: 'ACTIVE',
				});
			});
		});

		describe('Create Operation', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'secret',
							operation: 'secret.create',
							folderId: '',
							secretName: 'my-secret',
							description: 'Test secret',
							deletionProtection: false,
							payloadEntries: {
								entries: [
									{
										key: 'api_key',
										valueType: 'text',
										textValue: 'secret-value',
									},
								],
							},
							additionalFields: {},
						};
						return params[paramName];
					},
				);
			});

			it('should create secret successfully', async () => {
				mockSecretClient.create.mockResolvedValue({
					id: 'operation-id-123',
					done: false,
					metadata: {
						secretId: 'secret-123',
						versionId: 'version-123',
					},
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: true,
					operation: 'create',
					secretId: 'secret-123',
					versionId: 'version-123',
				});
			});

			it('should include labels and KMS key if provided', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						if (paramName === 'additionalFields') {
							return {
								labels: {
									labels: [
										{ key: 'env', value: 'prod' },
									],
								},
								kmsKeyId: 'kms-key-123',
							};
						}
						const params: Record<string, any> = {
							resource: 'secret',
							operation: 'secret.create',
							secretName: 'my-secret',
							description: 'Test',
							deletionProtection: false,
							payloadEntries: { entries: [{ key: 'test', valueType: 'text', textValue: 'value' }] },
						};
						return params[paramName];
					},
				);

				mockSecretClient.create.mockResolvedValue({
					id: 'op-123',
					done: false,
					metadata: { secretId: 'secret-123' },
				});

				await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				const createCall = mockSecretClient.create.mock.calls[0][0];
				expect(createCall.labels).toEqual({ env: 'prod' });
				expect(createCall.kmsKeyId).toBe('kms-key-123');
			});
		});

		describe('Update Operation', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _fallback?: any, options?: any) => {
						const params: Record<string, any> = {
							resource: 'secret',
							operation: 'secret.update',
							secretId: 'secret-123',
							updateFields: {
								name: 'updated-name',
								description: 'updated description',
							},
						};

						if (options?.extractValue && paramName === 'secretId') {
							return params.secretId;
						}

						return params[paramName];
					},
				);
			});

			it('should update secret successfully', async () => {
				mockSecretClient.update.mockResolvedValue({
					id: 'operation-id-123',
					done: true,
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: true,
					operation: 'update',
					secretId: 'secret-123',
				});
			});
		});

		describe('Delete Operation', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _fallback?: any, options?: any) => {
						const params: Record<string, any> = {
							resource: 'secret',
							operation: 'secret.delete',
							secretId: 'secret-123',
						};

						if (options?.extractValue && paramName === 'secretId') {
							return params.secretId;
						}

						return params[paramName];
					},
				);
			});

			it('should delete secret successfully', async () => {
				mockSecretClient.delete.mockResolvedValue({
					id: 'operation-id-123',
					done: true,
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: true,
					operation: 'delete',
					secretId: 'secret-123',
				});
			});
		});

		describe('Activate Operation', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _fallback?: any, options?: any) => {
						const params: Record<string, any> = {
							resource: 'secret',
							operation: 'secret.activate',
							secretId: 'secret-123',
						};

						if (options?.extractValue && paramName === 'secretId') {
							return params.secretId;
						}

						return params[paramName];
					},
				);
			});

			it('should activate secret successfully', async () => {
				mockSecretClient.activate.mockResolvedValue({
					id: 'operation-id-123',
					done: true,
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: true,
					operation: 'activate',
					secretId: 'secret-123',
				});
			});
		});

		describe('Deactivate Operation', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _fallback?: any, options?: any) => {
						const params: Record<string, any> = {
							resource: 'secret',
							operation: 'secret.deactivate',
							secretId: 'secret-123',
						};

						if (options?.extractValue && paramName === 'secretId') {
							return params.secretId;
						}

						return params[paramName];
					},
				);
			});

			it('should deactivate secret successfully', async () => {
				mockSecretClient.deactivate.mockResolvedValue({
					id: 'operation-id-123',
					done: true,
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: true,
					operation: 'deactivate',
					secretId: 'secret-123',
				});
			});
		});
	});

	describe('Version Operations', () => {
		describe('List Operation', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _fallback?: any, options?: any) => {
						const params: Record<string, any> = {
							resource: 'version',
							operation: 'version.list',
							secretId: 'secret-123',
							returnAll: false,
							limit: 50,
						};

						if (options?.extractValue && paramName === 'secretId') {
							return params.secretId;
						}

						return params[paramName];
					},
				);
			});

			it('should list versions successfully', async () => {
				mockSecretClient.listVersions.mockResolvedValue({
					versions: [
						{ id: 'version-1', description: 'Initial', status: 1 },
						{ id: 'version-2', description: 'Updated', status: 1 },
					],
					nextPageToken: '',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0]).toHaveLength(2);
				expect(result[0][0].json).toMatchObject({
					id: 'version-1',
					status: 'ACTIVE',
				});
			});
		});

		describe('Add Operation', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _fallback?: any, options?: any) => {
						const params: Record<string, any> = {
							resource: 'version',
							operation: 'version.add',
							secretId: 'secret-123',
							versionDescription: 'New version',
							payloadEntries: {
								entries: [
									{
										key: 'api_key',
										valueType: 'text',
										textValue: 'new-value',
									},
								],
							},
							additionalFields: {},
						};

						if (options?.extractValue && paramName === 'secretId') {
							return params.secretId;
						}

						return params[paramName];
					},
				);
			});

			it('should add version successfully', async () => {
				mockSecretClient.addVersion.mockResolvedValue({
					id: 'operation-id-123',
					done: true,
					metadata: {
						versionId: 'version-123',
					},
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: true,
					operation: 'version.add',
					secretId: 'secret-123',
					versionId: 'version-123',
				});
			});
		});

		describe('Schedule Destruction Operation', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _fallback?: any, options?: any) => {
						const params: Record<string, any> = {
							resource: 'version',
							operation: 'version.scheduleDestruction',
							secretId: 'secret-123',
							versionId: 'version-123',
							additionalFields: {},
						};

						if (options?.extractValue && paramName === 'secretId') {
							return params.secretId;
						}
						if (options?.extractValue && paramName === 'versionId') {
							return params.versionId;
						}

						return params[paramName];
					},
				);
			});

			it('should schedule version destruction successfully', async () => {
				mockSecretClient.scheduleVersionDestruction.mockResolvedValue({
					id: 'operation-id-123',
					done: true,
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: true,
					operation: 'version.scheduleDestruction',
					secretId: 'secret-123',
					versionId: 'version-123',
				});
			});
		});

		describe('Cancel Destruction Operation', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _fallback?: any, options?: any) => {
						const params: Record<string, any> = {
							resource: 'version',
							operation: 'version.cancelDestruction',
							secretId: 'secret-123',
							versionId: 'version-123',
						};

						if (options?.extractValue && paramName === 'secretId') {
							return params.secretId;
						}
						if (options?.extractValue && paramName === 'versionId') {
							return params.versionId;
						}

						return params[paramName];
					},
				);
			});

			it('should cancel version destruction successfully', async () => {
				mockSecretClient.cancelVersionDestruction.mockResolvedValue({
					id: 'operation-id-123',
					done: true,
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: true,
					operation: 'version.cancelDestruction',
					secretId: 'secret-123',
					versionId: 'version-123',
				});
			});
		});
	});

	describe('Payload Operations', () => {
		describe('Get Operation', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _fallback?: any, options?: any) => {
						const params: Record<string, any> = {
							resource: 'payload',
							operation: 'payload.get',
							secretId: 'secret-123',
							versionId: '',
						};

						if (options?.extractValue && paramName === 'secretId') {
							return params.secretId;
						}
						if (options?.extractValue && paramName === 'versionId') {
							return params.versionId;
						}

						return params[paramName];
					},
				);
			});

			it('should get payload successfully', async () => {
				mockPayloadClient.get.mockResolvedValue({
					secretId: 'secret-123',
					versionId: 'version-123',
					entries: {
						api_key: 'secret-value',
						password: Buffer.from('binary-data'),
					},
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					secretId: 'secret-123',
					versionId: 'version-123',
				});
				expect(result[0][0].json.entries).toHaveProperty('api_key');
				expect(result[0][0].json.entries).toHaveProperty('password');
			});
		});

	});

	describe('Error Handling', () => {
		it('should throw error when continueOnFail is false', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _index: number, _fallback?: any, options?: any) => {
					const params: Record<string, any> = {
						resource: 'secret',
						operation: 'secret.get',
						secretId: 'secret-123',
					};

					if (options?.extractValue && paramName === 'secretId') {
						return params.secretId;
					}

					return params[paramName];
				},
			);

			mockSecretClient.get.mockRejectedValue(new Error('API Error'));

			await expect(node.execute.call(mockExecuteFunctions as IExecuteFunctions)).rejects.toThrow();
		});

		it('should return error object when continueOnFail is true', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _index: number, _fallback?: any, options?: any) => {
					const params: Record<string, any> = {
						resource: 'secret',
						operation: 'secret.get',
						secretId: 'secret-123',
					};

					if (options?.extractValue && paramName === 'secretId') {
						return params.secretId;
					}

					return params[paramName];
				},
			);

			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			mockSecretClient.get.mockRejectedValue(new Error('API Error'));

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toMatchObject({
				success: false,
			});
			expect(result[0][0].json.error).toContain('error');
		});
	});

	describe('Multiple Items Processing', () => {
		it('should process multiple input items', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
				{ json: {} },
			]);

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, itemIndex: number, _fallback?: any, options?: any) => {
					const configs = [
						{
							resource: 'secret',
							operation: 'secret.get',
							secretId: 'secret-1',
						},
						{
							resource: 'secret',
							operation: 'secret.get',
							secretId: 'secret-2',
						},
					];

					if (options?.extractValue && paramName === 'secretId') {
						return configs[itemIndex].secretId;
					}

					return configs[itemIndex][paramName as keyof (typeof configs)[0]];
				},
			);

			mockSecretClient.get
				.mockResolvedValueOnce({
					id: 'secret-1',
					name: 'Secret 1',
					status: 2,
				})
				.mockResolvedValueOnce({
					id: 'secret-2',
					name: 'Secret 2',
					status: 2,
				});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0]).toHaveLength(2);
			expect(result[0][0].json.id).toBe('secret-1');
			expect(result[0][1].json.id).toBe('secret-2');
		});
	});
});
