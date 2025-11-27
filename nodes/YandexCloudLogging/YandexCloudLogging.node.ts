import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import {
	formatTimestamp,
	loadLogGroups,
	parseJsonPayload,
	parseLogLevel,
	validateServiceAccountJson,
	parseServiceAccountJson,
	createSession,
	humanReadableLogLevel,
} from './GenericFunctions';
import { YandexCloudSdkError, withSdkErrorHandling } from '@utils/sdkErrorHandling';
import {
	logIngestionService,
	logReadingService,
} from '@yandex-cloud/nodejs-sdk/dist/clients/logging-v1/index';
import {
	LogEntry,
	LogEntryDefaults,
} from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/logging/v1/log_entry';
import { LogEntryResource } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/logging/v1/log_resource';

export class YandexCloudLogging implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Yandex Cloud Logging',
		name: 'yandexCloudLogging',
		icon: 'file:YandexCloudLogging.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Yandex Cloud Logging service',
		defaults: {
			name: 'Yandex Cloud Logging',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'yandexCloudAuthorizedApi',
				required: true,
			},
		],
		properties: [
			// Resource selector
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Log Entry',
						value: 'logEntry',
					},
				],
				default: 'logEntry',
			},

			// Log Entry Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['logEntry'],
					},
				},
				options: [
					{
						name: 'Write',
						value: 'write',
						action: 'Write log entries',
						description: 'Write log entries to a log group',
					},
					{
						name: 'Read',
						value: 'read',
						action: 'Read log entries',
						description: 'Read log entries from a log group',
					},
				],
				default: 'write',
			},

			// Write Operation Parameters
			{
				displayName: 'Log Group',
				name: 'logGroupId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				displayOptions: {
					show: {
						resource: ['logEntry'],
						operation: ['write'],
					},
				},
				description: 'The log group to write entries to',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'loadLogGroups',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g., abcd1234efgh5678ijkl',
					},
				],
			},
			{
				displayName: 'Entries',
				name: 'entries',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				required: true,
				displayOptions: {
					show: {
						resource: ['logEntry'],
						operation: ['write'],
					},
				},
				description: 'Log entries to write',
				options: [
					{
						displayName: 'Entry',
						name: 'entry',
						values: [
							{
								displayName: 'JSON Payload',
								name: 'jsonPayload',
								type: 'json',
								default: '',
								description: 'Additional structured data as JSON',
							},
							{
								displayName: 'Level',
								name: 'level',
								type: 'options',
								// eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
								options: [
									{
										name: 'Trace',
										value: 'TRACE',
									},
									{
										name: 'Debug',
										value: 'DEBUG',
									},
									{
										name: 'Info',
										value: 'INFO',
									},
									{
										name: 'Warn',
										value: 'WARN',
									},
									{
										name: 'Error',
										value: 'ERROR',
									},
									{
										name: 'Fatal',
										value: 'FATAL',
									},
								],
								default: 'INFO',
								description: 'Log level',
							},
							{
								displayName: 'Message',
								name: 'message',
								type: 'string',
								default: '',
								required: true,
								description: 'Log message text',
							},
							{
								displayName: 'Stream Name',
								name: 'streamName',
								type: 'string',
								default: '',
								description: 'Stream name for the log entry',
							},
							{
								displayName: 'Timestamp',
								name: 'timestamp',
								type: 'string',
								default: '',
								description: 'Log entry timestamp (ISO 8601 format). Leave empty for current time.',
								placeholder: 'e.g., 2024-01-01T12:00:00Z',
							},
						],
					},
				],
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: ['logEntry'],
						operation: ['write'],
					},
				},
				options: [
					{
						displayName: 'Default JSON Payload',
						name: 'defaultJsonPayload',
						type: 'json',
						default: '',
						description: 'Default JSON payload merged with entry payloads',
					},
					{
						displayName: 'Default Level',
						name: 'defaultLevel',
						type: 'options',
						options: [
							{ name: 'Debug', value: 'DEBUG' },
							{ name: 'Error', value: 'ERROR' },
							{ name: 'Fatal', value: 'FATAL' },
							{ name: 'Info', value: 'INFO' },
							{ name: 'Trace', value: 'TRACE' },
							{ name: 'Warn', value: 'WARN' },
						],
						default: 'INFO',
						description: 'Default log level for entries without a specified level',
					},
					{
						displayName: 'Default Stream Name',
						name: 'defaultStreamName',
						type: 'string',
						default: '',
						description: 'Default stream name for entries without a specified stream',
					},
					{
						displayName: 'Resource ID',
						name: 'resourceId',
						type: 'string',
						default: '',
						description: 'Resource ID producing the logs',
					},
					{
						displayName: 'Resource Type',
						name: 'resourceType',
						type: 'string',
						default: '',
						description: 'Resource type producing the logs (e.g., serverless.function)',
					},
				],
			},

			// Read Operation Parameters
			{
				displayName: 'Log Group',
				name: 'logGroupId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				displayOptions: {
					show: {
						resource: ['logEntry'],
						operation: ['read'],
					},
				},
				description: 'The log group to read entries from',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'loadLogGroups',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g., abcd1234efgh5678ijkl',
					},
				],
			},
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						resource: ['logEntry'],
						operation: ['read'],
					},
				},
				description: 'Whether to return all results or only up to a given limit',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 50,
				displayOptions: {
					show: {
						resource: ['logEntry'],
						operation: ['read'],
						returnAll: [false],
					},
				},
				typeOptions: {
					minValue: 1,
				},
				description: 'Max number of results to return',
			},
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: {
					show: {
						resource: ['logEntry'],
						operation: ['read'],
					},
				},
				options: [
					{
						displayName: 'Filter Expression',
						name: 'filter',
						type: 'string',
						default: '',
						description: 'Filter expression for advanced filtering',
						placeholder: 'e.g., message: "error"',
					},
					{
						displayName: 'Levels',
						name: 'levels',
						type: 'multiOptions',
						// eslint-disable-next-line n8n-nodes-base/node-param-multi-options-type-unsorted-items
						options: [
							{ name: 'Trace', value: 'TRACE' },
							{ name: 'Debug', value: 'DEBUG' },
							{ name: 'Info', value: 'INFO' },
							{ name: 'Warn', value: 'WARN' },
							{ name: 'Error', value: 'ERROR' },
							{ name: 'Fatal', value: 'FATAL' },
						],
						default: [],
						description: 'Filter by log levels',
					},
					{
						displayName: 'Resource IDs',
						name: 'resourceIds',
						type: 'string',
						default: '',
						description: 'Comma-separated list of resource IDs to filter by',
					},
					{
						displayName: 'Resource Types',
						name: 'resourceTypes',
						type: 'string',
						default: '',
						description: 'Comma-separated list of resource types to filter by',
						placeholder: 'e.g., serverless.function,compute.instance',
					},
					{
						displayName: 'Since',
						name: 'since',
						type: 'string',
						default: '',
						description: 'Lower bound of log entry timestamps (ISO 8601 format)',
						placeholder: 'e.g., 2024-01-01T00:00:00Z',
					},
					{
						displayName: 'Stream Names',
						name: 'streamNames',
						type: 'string',
						default: '',
						description: 'Comma-separated list of stream names to filter by',
					},
					{
						displayName: 'Until',
						name: 'until',
						type: 'string',
						default: '',
						description: 'Upper bound of log entry timestamps (ISO 8601 format)',
						placeholder: 'e.g., 2024-01-01T23:59:59Z',
					},
				],
			},

			// List Operation Parameters
			{
				displayName: 'Folder ID',
				name: 'folderId',
				type: 'string',
				default: '={{$credentials.folderId}}',
				displayOptions: {
					show: {
						resource: ['logGroup'],
						operation: ['list'],
					},
				},
				description: 'Folder ID to list log groups from. Defaults to folder ID from credentials.',
			},
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						resource: ['logGroup'],
						operation: ['list'],
					},
				},
				description: 'Whether to return all results or only up to a given limit',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 50,
				displayOptions: {
					show: {
						resource: ['logGroup'],
						operation: ['list'],
						returnAll: [false],
					},
				},
				typeOptions: {
					minValue: 1,
				},
				description: 'Max number of results to return',
			},
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: {
					show: {
						resource: ['logGroup'],
						operation: ['list'],
					},
				},
				options: [
					{
						displayName: 'Name Filter',
						name: 'filter',
						type: 'string',
						default: '',
						description: 'Filter log groups by name',
						placeholder: 'e.g., name=my-log-group',
					},
				],
			},
		],
	};

	methods = {
		listSearch: {
			loadLogGroups,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		// Get credentials
		const credentials = await this.getCredentials('yandexCloudAuthorizedApi');

		// Parse and validate service account JSON
		const serviceAccountJson = parseServiceAccountJson(credentials.serviceAccountJson as string);
		validateServiceAccountJson(serviceAccountJson, this.getNode());

		// Create session
		const session = createSession(serviceAccountJson);

		// Get resource and operation
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		// Process based on resource and operation
		if (resource === 'logEntry') {
			if (operation === 'write') {
				// Import write service
				const client = session.client(logIngestionService.LogIngestionServiceClient);

				// Process each item
				for (let i = 0; i < items.length; i++) {
					try {
						// Get parameters
						const logGroupId = this.getNodeParameter('logGroupId', i, '', {
							extractValue: true,
						}) as string;

						if (!logGroupId) {
							throw new NodeOperationError(this.getNode(), 'Log Group ID is required', {
								itemIndex: i,
							});
						}

						const entriesData = this.getNodeParameter('entries.entry', i, []) as any[];

						if (!entriesData || entriesData.length === 0) {
							throw new NodeOperationError(this.getNode(), 'At least one log entry is required', {
								itemIndex: i,
							});
						}

						const additionalFields = this.getNodeParameter('additionalFields', i, {}) as any;

						// Build entries
						const entries = entriesData.map((entry) => {
							const logEntry = LogEntry.fromJSON({
								message: entry.message,
							});

							if (entry.level) {
								logEntry.level = parseLogLevel(entry.level);
							}

							if (entry.timestamp) {
								logEntry.timestamp = formatTimestamp(entry.timestamp);
							} else {
								logEntry.timestamp = new Date();
							}

							if (entry.jsonPayload) {
								logEntry.jsonPayload = parseJsonPayload(entry.jsonPayload);
							}

							if (entry.streamName) {
								logEntry.streamName = entry.streamName;
							}

							return logEntry;
						});

						// Build request
						const request: logIngestionService.WriteRequest = {
							destination: {
								logGroupId,
								folderId: undefined,
							},
							entries,
						};

						// Add resource if specified
						if (additionalFields.resourceType || additionalFields.resourceId) {
							request.resource = LogEntryResource.fromJSON({});
							if (additionalFields.resourceType) {
								request.resource.type = additionalFields.resourceType;
							}
							if (additionalFields.resourceId) {
								request.resource.id = additionalFields.resourceId;
							}
						}

						// Add defaults if specified
						const defaults = LogEntryDefaults.fromJSON({});
						if (additionalFields.defaultLevel) {
							defaults.level = parseLogLevel(additionalFields.defaultLevel);
						}
						if (additionalFields.defaultJsonPayload) {
							defaults.jsonPayload = parseJsonPayload(additionalFields.defaultJsonPayload);
						}
						if (additionalFields.defaultStreamName) {
							defaults.streamName = additionalFields.defaultStreamName;
						}
						if (Object.keys(defaults).length > 0) {
							request.defaults = defaults;
						}

						// Write log entries
						const response = await withSdkErrorHandling(
							this.getNode(),
							() => client.write(request),
							'write log entries',
							i,
						);

						returnData.push({
							json: {
								success: true,
								entriesWritten: entries.length,
								logGroupId,
								errors: response.errors || {},
							},
							pairedItem: { item: i },
						});
					} catch (error) {
						if (this.continueOnFail()) {
							returnData.push({
								json: {
									error: (error as Error).message,
									success: false,
								},
								pairedItem: { item: i },
							});
							continue;
						}
						// Re-throw if it's already our custom error type
						if (error instanceof YandexCloudSdkError || error instanceof NodeOperationError) {
							throw error;
						}
						// Otherwise wrap in YandexCloudSdkError
						throw new YandexCloudSdkError(this.getNode(), error as Error, {
							operation: 'write',
							itemIndex: i,
						});
					}
				}
			} else if (operation === 'read') {
				// Import read service
				const client = session.client(logReadingService.LogReadingServiceClient);

				// Process each item
				for (let i = 0; i < items.length; i++) {
					try {
						// Get parameters
						const logGroupId = this.getNodeParameter('logGroupId', i, '', {
							extractValue: true,
						}) as string;

						if (!logGroupId) {
							throw new NodeOperationError(this.getNode(), 'Log Group ID is required', {
								itemIndex: i,
							});
						}

						const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
						const filters = this.getNodeParameter('filters', i, {}) as any;

						// Build criteria
						const criteria: Partial<logReadingService.Criteria> = {
							logGroupId,
						};

						if (filters.since) {
							criteria.since = formatTimestamp(filters.since);
						}

						if (filters.until) {
							criteria.until = formatTimestamp(filters.until);
						}

						if (filters.levels && filters.levels.length > 0) {
							criteria.levels = filters.levels.map((level: string) => parseLogLevel(level));
						}

						if (filters.resourceTypes) {
							criteria.resourceTypes = filters.resourceTypes
								.split(',')
								.map((s: string) => s.trim());
						}

						if (filters.resourceIds) {
							criteria.resourceIds = filters.resourceIds.split(',').map((s: string) => s.trim());
						}

						if (filters.streamNames) {
							criteria.streamNames = filters.streamNames.split(',').map((s: string) => s.trim());
						}

						if (filters.filter) {
							criteria.filter = filters.filter;
						}

						if (!returnAll) {
							const limit = this.getNodeParameter('limit', i, 100) as number;
							criteria.pageSize = limit;
						} else {
							criteria.pageSize = 1000;
						}

						// Read log entries
						let allEntries: any[] = [];
						let pageToken: string | undefined;

						do {
							const request: logReadingService.ReadRequest = pageToken
								? logReadingService.ReadRequest.fromJSON({ pageToken })
								: logReadingService.ReadRequest.fromJSON({ criteria });

							const response = await withSdkErrorHandling(
								this.getNode(),
								() => client.read(request),
								'read log entries',
								i,
							);

							if (response.entries && response.entries.length > 0) {
								allEntries = allEntries.concat(response.entries);
							}

							pageToken = returnAll ? response.nextPageToken : undefined;

							// Break if we have enough entries when not returning all
							if (!returnAll && allEntries.length >= criteria.pageSize) {
								allEntries = allEntries.slice(0, criteria.pageSize);
								break;
							}
						} while (pageToken);

						// Return entries as separate items
						for (const entry of allEntries) {
							returnData.push({
								json: humanReadableLogLevel(entry),
								pairedItem: { item: i },
							});
						}

						// If no entries found, return empty result
						if (allEntries.length === 0) {
							returnData.push({
								json: {
									message: 'No log entries found',
									logGroupId,
								},
								pairedItem: { item: i },
							});
						}
					} catch (error) {
						if (this.continueOnFail()) {
							returnData.push({
								json: {
									error: (error as Error).message,
									success: false,
								},
								pairedItem: { item: i },
							});
							continue;
						}
						// Re-throw if it's already our custom error type
						if (error instanceof YandexCloudSdkError || error instanceof NodeOperationError) {
							throw error;
						}
						// Otherwise wrap in YandexCloudSdkError
						throw new YandexCloudSdkError(this.getNode(), error as Error, {
							operation: 'read',
							itemIndex: i,
						});
					}
				}
			}
		}
		return [returnData];
	}
}
