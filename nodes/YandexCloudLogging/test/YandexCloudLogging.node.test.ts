import type { IExecuteFunctions } from 'n8n-workflow';
import { YandexCloudLogging } from '../YandexCloudLogging.node';
import * as GenericFunctions from '../GenericFunctions';

// Mock dependencies
jest.mock('@yandex-cloud/nodejs-sdk');
jest.mock('@yandex-cloud/nodejs-sdk/dist/clients/logging-v1/index', () => ({
	logIngestionService: {
		LogIngestionServiceClient: class MockLogIngestionServiceClient {},
	},
	logReadingService: {
		LogReadingServiceClient: class MockLogReadingServiceClient {},
		ReadRequest: {
			fromJSON: jest.fn((obj) => obj),
		},
		Criteria: {},
	},
}));
jest.mock('@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/logging/v1/log_entry', () => ({
	LogEntry: {
		fromJSON: jest.fn((obj) => obj),
	},
	LogEntryDefaults: {
		fromJSON: jest.fn((obj) => obj),
	},
	LogLevel_Level: {
		LEVEL_UNSPECIFIED: 0,
		TRACE: 1,
		DEBUG: 2,
		INFO: 3,
		WARN: 4,
		ERROR: 5,
		FATAL: 6,
		0: 'LEVEL_UNSPECIFIED',
		1: 'TRACE',
		2: 'DEBUG',
		3: 'INFO',
		4: 'WARN',
		5: 'ERROR',
		6: 'FATAL',
	},
}));
jest.mock('@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/logging/v1/log_resource', () => ({
	LogEntryResource: {
		fromJSON: jest.fn((obj) => obj),
	},
}));
jest.mock('../GenericFunctions', () => {
	const actual = jest.requireActual('../GenericFunctions');
	return {
		...actual,
		createSession: jest.fn(),
	};
});

describe('YandexCloudLogging Node', () => {
	let node: YandexCloudLogging;
	let mockExecuteFunctions: Partial<IExecuteFunctions>;
	let mockWriteClient: any;
	let mockReadClient: any;
	let mockSession: any;

	const mockCredentials = {
		serviceAccountJson: JSON.stringify({
			service_account_id: 'sa-test-id',
			id: 'key-test-id',
			private_key: 'test-private-key',
		}),
		folderId: 'folder-test-id',
	};

	beforeEach(() => {
		jest.clearAllMocks();
		node = new YandexCloudLogging();

		// Mock clients
		mockWriteClient = {
			write: jest.fn(),
		};

		mockReadClient = {
			read: jest.fn(),
		};

		mockSession = {
			client: jest.fn((serviceType: any) => {
				// The serviceType is now a class, check its name
				const serviceName = serviceType?.name || '';
				if (serviceName === 'MockLogIngestionServiceClient') {
					return mockWriteClient;
				} else if (serviceName === 'MockLogReadingServiceClient') {
					return mockReadClient;
				}
				return {};
			}),
		};

		(GenericFunctions.createSession as jest.Mock).mockReturnValue(mockSession);

		// Mock execute functions
		mockExecuteFunctions = {
			getInputData: jest.fn().mockReturnValue([{ json: {} }]),
			getNodeParameter: jest.fn(),
			getCredentials: jest.fn().mockResolvedValue(mockCredentials),
			continueOnFail: jest.fn().mockReturnValue(false),
			getNode: jest.fn().mockReturnValue({ name: 'Yandex Cloud Logging' }),
		};

	});

	describe('Node Definition', () => {
		it('should have correct basic properties', () => {
			expect(node.description.displayName).toBe('Yandex Cloud Logging');
			expect(node.description.name).toBe('yandexCloudLogging');
			expect(node.description.group).toContain('transform');
			expect(node.description.version).toBe(1);
		});

		it('should have correct credentials', () => {
			expect(node.description.credentials).toHaveLength(1);
			expect(node.description.credentials?.[0].name).toBe('yandexCloudAuthorizedApi');
			expect(node.description.credentials?.[0].required).toBe(true);
		});

		it('should have resource and operation properties', () => {
			const properties = node.description.properties;
			const resourceProp = properties.find((p) => p.name === 'resource');
			expect(resourceProp).toBeDefined();
			expect(resourceProp?.type).toBe('options');
		});
	});

	describe('Write Operation', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _index: number, fallback?: any, options?: any) => {
					const params: Record<string, any> = {
						resource: 'logEntry',
						operation: 'write',
						logGroupId: 'log-group-123',
						'entries.entry': [
							{
								message: 'Test log message',
								level: 'INFO',
								timestamp: '2024-01-01T12:00:00Z',
								jsonPayload: '{"key": "value"}',
								streamName: 'test-stream',
							},
						],
						additionalFields: {},
					};

					if (options?.extractValue && paramName === 'logGroupId') {
						return params.logGroupId;
					}

					return params[paramName] !== undefined ? params[paramName] : fallback;
				},
			);

			mockWriteClient.write.mockResolvedValue({
				errors: {},
			});
		});

		it('should write log entries successfully', async () => {
			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0]).toHaveLength(1);
			expect(result[0][0].json).toMatchObject({
				success: true,
				entriesWritten: 1,
				logGroupId: 'log-group-123',
			});
			expect(mockWriteClient.write).toHaveBeenCalledTimes(1);
		});

		it('should write multiple entries', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _index: number, fallback?: any, options?: any) => {
					if (paramName === 'entries.entry') {
						return [
							{ message: 'Log 1', level: 'INFO' },
							{ message: 'Log 2', level: 'ERROR' },
							{ message: 'Log 3', level: 'WARN' },
						];
					}
					if (options?.extractValue && paramName === 'logGroupId') {
						return 'log-group-123';
					}
					if (paramName === 'resource') return 'logEntry';
					if (paramName === 'operation') return 'write';
					if (paramName === 'additionalFields') return {};
					return fallback;
				},
			);

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toMatchObject({
				success: true,
				entriesWritten: 3,
			});
		});

		it('should include resource metadata when specified', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _index: number, fallback?: any, options?: any) => {
					if (paramName === 'additionalFields') {
						return {
							resourceType: 'serverless.function',
							resourceId: 'func-123',
						};
					}
					if (paramName === 'entries.entry') {
						return [{ message: 'Test log', level: 'INFO' }];
					}
					if (options?.extractValue && paramName === 'logGroupId') {
						return 'log-group-123';
					}
					if (paramName === 'resource') return 'logEntry';
					if (paramName === 'operation') return 'write';
					return fallback;
				},
			);

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			const writeCall = mockWriteClient.write.mock.calls[0][0];
			expect(writeCall.resource).toMatchObject({
				type: 'serverless.function',
				id: 'func-123',
			});
		});

		it('should include defaults when specified', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _index: number, fallback?: any, options?: any) => {
					if (paramName === 'additionalFields') {
						return {
							defaultLevel: 'WARN',
							defaultStreamName: 'default-stream',
							defaultJsonPayload: '{"default": true}',
						};
					}
					if (paramName === 'entries.entry') {
						return [{ message: 'Test log', level: 'INFO' }];
					}
					if (options?.extractValue && paramName === 'logGroupId') {
						return 'log-group-123';
					}
					if (paramName === 'resource') return 'logEntry';
					if (paramName === 'operation') return 'write';
					return fallback;
				},
			);

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			const writeCall = mockWriteClient.write.mock.calls[0][0];
			expect(writeCall.defaults).toBeDefined();
			expect(writeCall.defaults.streamName).toBe('default-stream');
		});

		it('should throw error when log group ID is missing', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _index: number, fallback?: any, options?: any) => {
					if (options?.extractValue && paramName === 'logGroupId') {
						return '';
					}
					if (paramName === 'resource') return 'logEntry';
					if (paramName === 'operation') return 'write';
					return fallback;
				},
			);

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('Log Group ID is required');
		});

		it('should throw error when entries are missing', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _index: number, fallback?: any, options?: any) => {
					if (paramName === 'entries.entry') {
						return [];
					}
					if (options?.extractValue && paramName === 'logGroupId') {
						return 'log-group-123';
					}
					if (paramName === 'resource') return 'logEntry';
					if (paramName === 'operation') return 'write';
					if (paramName === 'additionalFields') return {};
					return fallback;
				},
			);

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('At least one log entry is required');
		});

		it('should handle errors with continueOnFail true', async () => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			mockWriteClient.write.mockRejectedValue(new Error('API Error'));

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toMatchObject({
				error: 'API Error',
				success: false,
			});
		});

		it('should throw error with continueOnFail false', async () => {
			mockWriteClient.write.mockRejectedValue(new Error('API Error'));

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('API Error');
		});
	});

	describe('Read Operation', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _index: number, fallback?: any, options?: any) => {
					const params: Record<string, any> = {
						resource: 'logEntry',
						operation: 'read',
						logGroupId: 'log-group-123',
						returnAll: false,
						limit: 10,
						filters: {},
					};

					if (options?.extractValue && paramName === 'logGroupId') {
						return params.logGroupId;
					}

					return params[paramName] !== undefined ? params[paramName] : fallback;
				},
			);

			mockReadClient.read.mockResolvedValue({
				logGroupId: 'log-group-123',
				entries: [
					{
						uid: 'entry-1',
						message: 'Test log 1',
						level: 3, // INFO
						timestamp: '2024-01-01T12:00:00Z',
					},
					{
						uid: 'entry-2',
						message: 'Test log 2',
						level: 5, // ERROR
						timestamp: '2024-01-01T12:01:00Z',
					},
				],
				nextPageToken: undefined,
			});
		});

		it('should read log entries successfully', async () => {
			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0]).toHaveLength(2);
			expect(result[0][0].json).toMatchObject({
				uid: 'entry-1',
				message: 'Test log 1',
				level: 'INFO',
			});
			expect(result[0][1].json).toMatchObject({
				uid: 'entry-2',
				message: 'Test log 2',
				level: 'ERROR',
			});
			expect(mockReadClient.read).toHaveBeenCalledTimes(1);
		});

		it('should read all pages when returnAll is true', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _index: number, fallback?: any, options?: any) => {
					if (paramName === 'returnAll') return true;
					if (options?.extractValue && paramName === 'logGroupId') return 'log-group-123';
					if (paramName === 'resource') return 'logEntry';
					if (paramName === 'operation') return 'read';
					if (paramName === 'filters') return {};
					return fallback;
				},
			);

			mockReadClient.read
				.mockResolvedValueOnce({
					entries: [{ uid: 'entry-1', message: 'Log 1' }],
					nextPageToken: 'page-2',
				})
				.mockResolvedValueOnce({
					entries: [{ uid: 'entry-2', message: 'Log 2' }],
					nextPageToken: undefined,
				});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0]).toHaveLength(2);
			expect(mockReadClient.read).toHaveBeenCalledTimes(2);
		});

		it('should apply time range filters', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _index: number, fallback?: any, options?: any) => {
					if (paramName === 'filters') {
						return {
							since: '2024-01-01T00:00:00Z',
							until: '2024-01-01T23:59:59Z',
						};
					}
					if (options?.extractValue && paramName === 'logGroupId') return 'log-group-123';
					if (paramName === 'resource') return 'logEntry';
					if (paramName === 'operation') return 'read';
					if (paramName === 'returnAll') return false;
					if (paramName === 'limit') return 10;
					return fallback;
				},
			);

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			const readCall = mockReadClient.read.mock.calls[0][0];
			expect(readCall.criteria.since).toBeDefined();
			expect(readCall.criteria.until).toBeDefined();
		});

		it('should apply level filters', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _index: number, fallback?: any, options?: any) => {
					if (paramName === 'filters') {
						return {
							levels: ['ERROR', 'FATAL'],
						};
					}
					if (options?.extractValue && paramName === 'logGroupId') return 'log-group-123';
					if (paramName === 'resource') return 'logEntry';
					if (paramName === 'operation') return 'read';
					if (paramName === 'returnAll') return false;
					if (paramName === 'limit') return 10;
					return fallback;
				},
			);

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			const readCall = mockReadClient.read.mock.calls[0][0];
			expect(readCall.criteria.levels).toEqual([5, 6]); // ERROR, FATAL
		});

		it('should apply resource filters', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _index: number, fallback?: any, options?: any) => {
					if (paramName === 'filters') {
						return {
							resourceTypes: 'serverless.function,compute.instance',
							resourceIds: 'func-1,vm-2',
						};
					}
					if (options?.extractValue && paramName === 'logGroupId') return 'log-group-123';
					if (paramName === 'resource') return 'logEntry';
					if (paramName === 'operation') return 'read';
					if (paramName === 'returnAll') return false;
					if (paramName === 'limit') return 10;
					return fallback;
				},
			);

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			const readCall = mockReadClient.read.mock.calls[0][0];
			expect(readCall.criteria.resourceTypes).toEqual(['serverless.function', 'compute.instance']);
			expect(readCall.criteria.resourceIds).toEqual(['func-1', 'vm-2']);
		});

		it('should return message when no entries found', async () => {
			mockReadClient.read.mockResolvedValue({
				logGroupId: 'log-group-123',
				entries: [],
				nextPageToken: undefined,
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0]).toHaveLength(1);
			expect(result[0][0].json).toMatchObject({
				message: 'No log entries found',
				logGroupId: 'log-group-123',
			});
		});

		it('should throw error when log group ID is missing', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _index: number, fallback?: any, options?: any) => {
					if (options?.extractValue && paramName === 'logGroupId') return '';
					if (paramName === 'resource') return 'logEntry';
					if (paramName === 'operation') return 'read';
					return fallback;
				},
			);

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('Log Group ID is required');
		});

		it('should handle errors with continueOnFail true', async () => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			mockReadClient.read.mockRejectedValue(new Error('API Error'));

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toMatchObject({
				error: 'API Error',
				success: false,
			});
		});
	});

	describe('Process Multiple Items', () => {
		it('should process multiple input items', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
				{ json: {} },
			]);

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _index: number, fallback?: any, options?: any) => {
					if (paramName === 'entries.entry') {
						return [{ message: `Log from item ${_index}`, level: 'INFO' }];
					}
					if (options?.extractValue && paramName === 'logGroupId') return 'log-group-123';
					if (paramName === 'resource') return 'logEntry';
					if (paramName === 'operation') return 'write';
					if (paramName === 'additionalFields') return {};
					return fallback;
				},
			);

			mockWriteClient.write.mockResolvedValue({ errors: {} });

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0]).toHaveLength(2);
			expect(mockWriteClient.write).toHaveBeenCalledTimes(2);
		});
	});
});
