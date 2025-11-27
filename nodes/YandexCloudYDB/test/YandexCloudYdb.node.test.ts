import { YandexCloudYdb } from '../YandexCloudYdb.node';
import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

// Mock dependencies
jest.mock('@ydbjs/core');
jest.mock('@ydbjs/query');
jest.mock('@ydbjs/value');
jest.mock('@yandex-cloud/nodejs-sdk/dist/token-service/iam-token-service');

// Mock the GenericFunctions module
jest.mock('../GenericFunctions', () => ({
	parseServiceAccountJson: jest.fn((jsonString: string) => {
		const parsed = JSON.parse(jsonString);
		return {
			serviceAccountId: parsed.service_account_id || parsed.serviceAccountId,
			accessKeyId: parsed.id || parsed.accessKeyId,
			privateKey: parsed.private_key || parsed.privateKey,
		};
	}),
	createYDBDriver: jest.fn(),
	executeYQLQuery: jest.fn(),
	closeYDBDriver: jest.fn(),
}));

describe('YandexCloudYDB Node', () => {
	let node: YandexCloudYdb;
	let mockExecuteFunctions: Partial<IExecuteFunctions>;

	beforeEach(() => {
		jest.clearAllMocks();

		node = new YandexCloudYdb();

		// Setup mocked GenericFunctions
		const { createYDBDriver, executeYQLQuery, closeYDBDriver } = require('../GenericFunctions');

		createYDBDriver.mockResolvedValue({ /* mock driver */ });
		executeYQLQuery.mockResolvedValue([[{ result: 1 }]]);
		closeYDBDriver.mockResolvedValue(undefined);

		// Mock Execute Functions
		mockExecuteFunctions = {
			getInputData: jest.fn().mockReturnValue([{ json: {} }]),
			getNodeParameter: jest.fn(),
			getCredentials: jest.fn(),
			continueOnFail: jest.fn().mockReturnValue(false),
			getNode: jest.fn().mockReturnValue({ name: 'Test YDB Node' }),
		};
	});

	describe('Node Definition', () => {
		it('should have correct basic properties', () => {
			expect(node.description.displayName).toBe('Yandex Cloud YDB');
			expect(node.description.name).toBe('yandexCloudYdb');
			expect(node.description.group).toContain('transform');
			expect(node.description.version).toBe(1);
		});

		it('should support both credential types', () => {
			expect(node.description.credentials).toHaveLength(2);
			expect(node.description.credentials?.[0]).toMatchObject({
				name: 'yandexCloudAuthorizedApi',
				required: true,
			});
			expect(node.description.credentials?.[1]).toMatchObject({
				name: 'yandexCloudYdbApi',
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

		it('should have query resource', () => {
			const resourceProp = node.description.properties.find((p) => p.name === 'resource');
			expect(resourceProp).toBeDefined();
			expect(resourceProp?.options).toContainEqual({
				name: 'Query',
				value: 'query',
			});
		});

		it('should have execute and executeWithParams operations', () => {
			const operationProp = node.description.properties.find((p) => p.name === 'operation');
			expect(operationProp).toBeDefined();
			expect(operationProp?.options).toHaveLength(2);
			expect(operationProp?.options).toContainEqual(
				expect.objectContaining({ value: 'execute' }),
			);
			expect(operationProp?.options).toContainEqual(
				expect.objectContaining({ value: 'executeWithParams' }),
			);
		});

		it('should have return mode options', () => {
			const returnModeProp = node.description.properties.find((p) => p.name === 'returnMode');
			expect(returnModeProp).toBeDefined();
			expect(returnModeProp?.options).toHaveLength(3);
			expect(returnModeProp?.default).toBe('firstResultSet');
		});
	});

	describe('Execute Query with yandexCloudYdbApi Credentials', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getCredentials as jest.Mock)
				.mockImplementation((credType: string) => {
					if (credType === 'yandexCloudAuthorizedApi') {
						return Promise.resolve({
							serviceAccountJson: JSON.stringify({
								service_account_id: 'sa-test-id',
								id: 'key-test-id',
								private_key: 'test-private-key',
							}),
							folderId: 'test-folder-id',
						});
					}
					if (credType === 'yandexCloudYdbApi') {
						return Promise.resolve({
							endpoint: 'grpcs://test.ydb.net:2135',
							database: '/test/database',
						});
					}
					return Promise.reject(new Error('Credential not found'));
				});

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						resource: 'query',
						operation: 'execute',
						yqlQuery: 'SELECT 1 AS result',
						returnMode: 'firstResultSet',
					};
					return params[paramName];
				},
			);
		});

		it('should execute query successfully with yandexCloudYdbApi credentials', async () => {
			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result).toHaveLength(1);
			expect(result[0]).toHaveLength(1);
			expect(result[0][0].json).toHaveProperty('rows');
			expect(result[0][0].pairedItem).toEqual({ item: 0 });
		});

		it('should call createYDBDriver with correct parameters', async () => {
			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			const { createYDBDriver } = require('../GenericFunctions');
			expect(createYDBDriver).toHaveBeenCalledWith(
				expect.objectContaining({
					serviceAccountId: 'sa-test-id',
					accessKeyId: 'key-test-id',
					privateKey: 'test-private-key',
				}),
				'grpcs://test.ydb.net:2135',
				'/test/database',
				expect.objectContaining({ name: 'Test YDB Node' }),
			);
		});

		it('should close driver connection after execution', async () => {
			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			const { closeYDBDriver } = require('../GenericFunctions');
			expect(closeYDBDriver).toHaveBeenCalled();
		});
	});

	describe('Dual Credential Validation', () => {
		it('should use service account from yandexCloudAuthorizedApi', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock)
				.mockImplementation((credType: string) => {
					if (credType === 'yandexCloudAuthorizedApi') {
						return Promise.resolve({
							serviceAccountJson: JSON.stringify({
								service_account_id: 'sa-test-id',
								id: 'key-test-id',
								private_key: 'test-private-key',
							}),
							folderId: 'test-folder-id',
						});
					}
					if (credType === 'yandexCloudYdbApi') {
						return Promise.resolve({
							endpoint: 'grpcs://test.ydb.net:2135',
							database: '/test/database',
						});
					}
					return Promise.reject(new Error('Credential not found'));
				});

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						resource: 'query',
						operation: 'execute',
						yqlQuery: 'SELECT 1 AS result',
						returnMode: 'firstResultSet',
					};
					return params[paramName];
				},
			);

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			const { createYDBDriver } = require('../GenericFunctions');
			expect(createYDBDriver).toHaveBeenCalledWith(
				expect.objectContaining({
					serviceAccountId: 'sa-test-id',
					accessKeyId: 'key-test-id',
					privateKey: 'test-private-key',
				}),
				'grpcs://test.ydb.net:2135',
				'/test/database',
				expect.objectContaining({ name: 'Test YDB Node' }),
			);
		});
	});

	describe('Parameterized Queries', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getCredentials as jest.Mock)
				.mockImplementation((credType: string) => {
					if (credType === 'yandexCloudAuthorizedApi') {
						return Promise.resolve({
							serviceAccountJson: JSON.stringify({
								service_account_id: 'sa-test-id',
								id: 'key-test-id',
								private_key: 'test-private-key',
							}),
							folderId: 'test-folder-id',
						});
					}
					if (credType === 'yandexCloudYdbApi') {
						return Promise.resolve({
							endpoint: 'grpcs://test.ydb.net:2135',
							database: '/test/database',
						});
					}
					return Promise.reject(new Error('Credential not found'));
				});

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						resource: 'query',
						operation: 'executeWithParams',
						yqlQuery: 'SELECT * FROM users WHERE id = $userId',
						queryParameters: {
							parameter: [
								{ name: 'userId', value: '123' },
							],
						},
						returnMode: 'firstResultSet',
					};
					return params[paramName];
				},
			);
		});

		it('should execute parameterized query with parameters', async () => {
			const { executeYQLQuery } = require('../GenericFunctions');
			executeYQLQuery.mockResolvedValue([[{ id: 123, name: 'Test' }]]);

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toHaveProperty('rows');
			expect(executeYQLQuery).toHaveBeenCalledWith(
				expect.any(Object),
				'SELECT * FROM users WHERE id = $userId',
				expect.objectContaining({ userId: 123 }),
			);
		});

		it('should parse JSON parameter values', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						resource: 'query',
						operation: 'executeWithParams',
						yqlQuery: 'SELECT * FROM users WHERE data = $data',
						queryParameters: {
							parameter: [
								// eslint-disable-next-line n8n-nodes-base/node-param-display-name-miscased
								{ name: 'data', value: '{"key": "value"}' },
							],
						},
						returnMode: 'firstResultSet',
					};
					return params[paramName];
				},
			);

			const { executeYQLQuery } = require('../GenericFunctions');
			executeYQLQuery.mockResolvedValue([[{ result: 'ok' }]]);

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			// Verify execution completed successfully with parsed JSON
			expect(result[0]).toHaveLength(1);
			expect(executeYQLQuery).toHaveBeenCalledWith(
				expect.any(Object),
				expect.any(String),
				expect.objectContaining({ data: { key: 'value' } }),
			);
		});
	});

	describe('Return Modes', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getCredentials as jest.Mock)
				.mockImplementation((credType: string) => {
					if (credType === 'yandexCloudAuthorizedApi') {
						return Promise.resolve({
							serviceAccountJson: JSON.stringify({
								service_account_id: 'sa-test-id',
								id: 'key-test-id',
								private_key: 'test-private-key',
							}),
							folderId: 'test-folder-id',
						});
					}
					if (credType === 'yandexCloudYdbApi') {
						return Promise.resolve({
							endpoint: 'grpcs://test.ydb.net:2135',
							database: '/test/database',
						});
					}
					return Promise.reject(new Error('Credential not found'));
				});
		});

		it('should return all result sets when returnMode is allResultSets', async () => {
			const { executeYQLQuery } = require('../GenericFunctions');
			executeYQLQuery.mockResolvedValue([
				[{ count: 10 }],
				[{ total: 100 }],
			]);

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						resource: 'query',
						operation: 'execute',
						yqlQuery: 'SELECT COUNT(*) as count FROM users; SELECT SUM(amount) as total FROM orders;',
						returnMode: 'allResultSets',
					};
					return params[paramName];
				},
			);

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toHaveProperty('resultSets');
			expect(result[0][0].json).toHaveProperty('resultSetCount');
			expect(result[0][0].json).toHaveProperty('totalRows');
		});

		it('should return first result set when returnMode is firstResultSet', async () => {
			const { executeYQLQuery } = require('../GenericFunctions');
			executeYQLQuery.mockResolvedValue([
				[{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
				[{ total: 100 }],
			]);

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						resource: 'query',
						operation: 'execute',
						yqlQuery: 'SELECT * FROM users; SELECT SUM(amount) FROM orders;',
						returnMode: 'firstResultSet',
					};
					return params[paramName];
				},
			);

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toHaveProperty('rows');
			expect(result[0][0].json).toHaveProperty('rowCount');
			expect(result[0][0].json.rowCount).toBe(2);
		});

		it('should return first row only when returnMode is firstRow', async () => {
			const { executeYQLQuery } = require('../GenericFunctions');
			executeYQLQuery.mockResolvedValue([
				[{ count: 42 }],
			]);

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						resource: 'query',
						operation: 'execute',
						yqlQuery: 'SELECT COUNT(*) as count FROM users',
						returnMode: 'firstRow',
					};
					return params[paramName];
				},
			);

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toEqual({ count: 42 });
		});

		it('should return null for firstRow when result set is empty', async () => {
			const { executeYQLQuery } = require('../GenericFunctions');
			executeYQLQuery.mockResolvedValue([[]]);

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						resource: 'query',
						operation: 'execute',
						yqlQuery: 'SELECT * FROM users WHERE id = 999999',
						returnMode: 'firstRow',
					};
					return params[paramName];
				},
			);

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toBeNull();
		});
	});

	describe('Error Handling', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						resource: 'query',
						operation: 'execute',
						endpoint: 'grpcs://test.ydb.net:2135',
						database: '/test/database',
						yqlQuery: 'SELECT 1',
						returnMode: 'firstResultSet',
					};
					return params[paramName];
				},
			);
		});

		it('should throw error when yandexCloudAuthorizedApi credentials are not provided', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock)
				.mockRejectedValue(new Error('Credential not found'));

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow();
		});

		it('should throw error for invalid service account JSON', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock)
				.mockImplementation((credType: string) => {
					if (credType === 'yandexCloudAuthorizedApi') {
						return Promise.resolve({
							serviceAccountJson: 'invalid-json',
						});
					}
					if (credType === 'yandexCloudYdbApi') {
						return Promise.resolve({
							endpoint: 'grpcs://test.ydb.net:2135',
							database: '/test/database',
						});
					}
					return Promise.reject(new Error('Credential not found'));
				});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow(NodeOperationError);
		});

		it('should throw error when service_account_id is missing', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock)
				.mockImplementation((credType: string) => {
					if (credType === 'yandexCloudAuthorizedApi') {
						return Promise.resolve({
							serviceAccountJson: JSON.stringify({
								id: 'key-test-id',
								private_key: 'test-private-key',
							}),
						});
					}
					if (credType === 'yandexCloudYdbApi') {
						return Promise.resolve({
							endpoint: 'grpcs://test.ydb.net:2135',
							database: '/test/database',
						});
					}
					return Promise.reject(new Error('Credential not found'));
				});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('service_account_id or serviceAccountId is required');
		});

		it('should throw error when endpoint is missing', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock)
				.mockImplementation((credType: string) => {
					if (credType === 'yandexCloudAuthorizedApi') {
						return Promise.resolve({
							serviceAccountJson: JSON.stringify({
								service_account_id: 'sa-test-id',
								id: 'key-test-id',
								private_key: 'test-private-key',
							}),
						});
					}
					if (credType === 'yandexCloudYdbApi') {
						return Promise.resolve({
							endpoint: '',
							database: '/test/database',
						});
					}
					return Promise.reject(new Error('Credential not found'));
				});

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						resource: 'query',
						operation: 'execute',
						yqlQuery: 'SELECT 1',
						returnMode: 'firstResultSet',
					};
					return params[paramName] || '';
				},
			);

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('Both endpoint and database are required');
		});

		it('should return error object when continueOnFail is true', async () => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			(mockExecuteFunctions.getCredentials as jest.Mock)
				.mockImplementation((credType: string) => {
					if (credType === 'yandexCloudAuthorizedApi') {
						return Promise.resolve({
							serviceAccountJson: JSON.stringify({
								service_account_id: 'sa-test-id',
								id: 'key-test-id',
								private_key: 'test-private-key',
							}),
							folderId: 'test-folder-id',
						});
					}
					if (credType === 'yandexCloudYdbApi') {
						return Promise.resolve({
							endpoint: 'grpcs://test.ydb.net:2135',
							database: '/test/database',
						});
					}
					return Promise.reject(new Error('Credential not found'));
				});

			const { executeYQLQuery } = require('../GenericFunctions');
			executeYQLQuery.mockRejectedValue(new Error('Query failed'));

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toMatchObject({
				error: 'Query failed',
				success: false,
			});
			expect(result[0][0].pairedItem).toEqual({ item: 0 });
		});

		it('should close driver even when error occurs', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock)
				.mockImplementation((credType: string) => {
					if (credType === 'yandexCloudAuthorizedApi') {
						return Promise.resolve({
							serviceAccountJson: JSON.stringify({
								service_account_id: 'sa-test-id',
								id: 'key-test-id',
								private_key: 'test-private-key',
							}),
							folderId: 'test-folder-id',
						});
					}
					if (credType === 'yandexCloudYdbApi') {
						return Promise.resolve({
							endpoint: 'grpcs://test.ydb.net:2135',
							database: '/test/database',
						});
					}
					return Promise.reject(new Error('Credential not found'));
				});

			const { executeYQLQuery, closeYDBDriver } = require('../GenericFunctions');
			executeYQLQuery.mockRejectedValue(new Error('Query failed'));

			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(closeYDBDriver).toHaveBeenCalled();
		});
	});

	describe('Multiple Items Processing', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getCredentials as jest.Mock)
				.mockImplementation((credType: string) => {
					if (credType === 'yandexCloudAuthorizedApi') {
						return Promise.resolve({
							serviceAccountJson: JSON.stringify({
								service_account_id: 'sa-test-id',
								id: 'key-test-id',
								private_key: 'test-private-key',
							}),
							folderId: 'test-folder-id',
						});
					}
					if (credType === 'yandexCloudYdbApi') {
						return Promise.resolve({
							endpoint: 'grpcs://test.ydb.net:2135',
							database: '/test/database',
						});
					}
					return Promise.reject(new Error('Credential not found'));
				});
		});

		it('should process multiple queries', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
				{ json: {} },
			]);

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, itemIndex: number) => {
					const configs = [
						{
							resource: 'query',
							operation: 'execute',
							yqlQuery: 'SELECT 1 AS result',
							returnMode: 'firstRow',
						},
						{
							resource: 'query',
							operation: 'execute',
							yqlQuery: 'SELECT 2 AS result',
							returnMode: 'firstRow',
						},
					];
					return configs[itemIndex][paramName as keyof typeof configs[0]];
				},
			);

			const { executeYQLQuery } = require('../GenericFunctions');
			executeYQLQuery
				.mockResolvedValueOnce([[{ result: 1 }]])
				.mockResolvedValueOnce([[{ result: 2 }]]);

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0]).toHaveLength(2);
			expect(result[0][0].json).toEqual({ result: 1 });
			expect(result[0][1].json).toEqual({ result: 2 });
			expect(result[0][0].pairedItem).toEqual({ item: 0 });
			expect(result[0][1].pairedItem).toEqual({ item: 1 });
		});
	});
});
