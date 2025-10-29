import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import type { Driver } from '@ydbjs/core';
import type { YDBQueryParams } from './types';
import {
	parseServiceAccountJson,
	createYDBDriver,
	executeYQLQuery,
	closeYDBDriver,
} from './GenericFunctions';

export class YandexCloudYDB implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Yandex Cloud YDB',
		name: 'yandexCloudYdb',
		icon: 'file:YDB.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Interact with Yandex Cloud YDB (Yandex Database)',
		defaults: {
			name: 'Yandex Cloud YDB',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'yandexCloudYdbApi',
				required: false,
			},
			{
				name: 'yandexCloudAuthorizedApi',
				required: false,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Query',
						value: 'query',
					},
				],
				default: 'query',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['query'],
					},
				},
				options: [
					{
						name: 'Execute',
						value: 'execute',
						description: 'Execute a YQL query',
						action: 'Execute a YQL query',
					},
					{
						name: 'Execute with Parameters',
						value: 'executeWithParams',
						description: 'Execute a parameterized YQL query',
						action: 'Execute a parameterized YQL query',
					},
				],
				default: 'execute',
			},
			{
				displayName: 'Endpoint',
				name: 'endpoint',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['query'],
					},
				},
				default: 'grpcs://ydb.serverless.yandexcloud.net:2135',
				description: 'YDB endpoint URL. Only needed if using yandexCloudAuthorizedApi credentials (when using yandexCloudYdbApi, endpoint is taken from credentials).',
				placeholder: 'grpcs://ydb.serverless.yandexcloud.net:2135',
			},
			{
				displayName: 'Database',
				name: 'database',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['query'],
					},
				},
				default: '',
				description: 'YDB database path. Only needed if using yandexCloudAuthorizedApi credentials (when using yandexCloudYdbApi, database is taken from credentials).',
				placeholder: '/ru-central1/b1g.../etn...',
			},
			{
				displayName: 'YQL Query',
				name: 'yqlQuery',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['query'],
						operation: ['execute', 'executeWithParams'],
					},
				},
				typeOptions: {
					rows: 10,
				},
				default: 'SELECT 1 AS result',
				description: 'YQL query to execute',
				placeholder: 'SELECT * FROM users WHERE id = $id',
			},
			{
				displayName: 'Query Parameters',
				name: 'queryParameters',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				displayOptions: {
					show: {
						resource: ['query'],
						operation: ['executeWithParams'],
					},
				},
				default: {},
				placeholder: 'Add Parameter',
				options: [
					{
						name: 'parameter',
						displayName: 'Parameter',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
								description: 'Parameter name (without $ prefix)',
								placeholder: 'userId',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'Parameter value (will be automatically converted to appropriate YDB type)',
								placeholder: '123',
							},
						],
					},
				],
				description: 'Query parameters for parameterized queries',
			},
			{
				displayName: 'Return Mode',
				name: 'returnMode',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['query'],
					},
				},
				options: [
					{
						name: 'All Result Sets',
						value: 'allResultSets',
						description: 'Return all result sets (YDB supports multiple result sets per query)',
					},
					{
						name: 'First Result Set',
						value: 'firstResultSet',
						description: 'Return only the first result set',
					},
					{
						name: 'First Row Only',
						value: 'firstRow',
						description: 'Return only the first row of the first result set',
					},
				],
				default: 'firstResultSet',
				description: 'How to return query results',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		// Try to get credentials - support both types
		const ydbCredentials = await this.getCredentials('yandexCloudYdbApi').catch(() => undefined);
		const authorizedCredentials = await this.getCredentials('yandexCloudAuthorizedApi').catch(() => undefined);

		// Validate that at least one credential type is provided
		if (!ydbCredentials && !authorizedCredentials) {
			throw new NodeOperationError(
				this.getNode(),
				'Either yandexCloudYdbApi or yandexCloudAuthorizedApi credentials must be provided',
			);
		}

		let endpoint: string = '';
		let database: string = '';
		let serviceAccountJson;

		// Determine which credential type is being used and extract values
		if (ydbCredentials) {
			// New YDB-specific credentials with endpoint and database included
			endpoint = ydbCredentials.endpoint as string;
			database = ydbCredentials.database as string;

			try {
				serviceAccountJson = parseServiceAccountJson(ydbCredentials.serviceAccountJson as string);
			} catch (error) {
				throw new NodeOperationError(
					this.getNode(),
					`Invalid service account JSON in yandexCloudYdbApi credentials: ${error.message}`,
				);
			}
		} else if (authorizedCredentials) {
			// Legacy authorized credentials - get endpoint/database from node parameters
			endpoint = this.getNodeParameter('endpoint', 0, '') as string;
			database = this.getNodeParameter('database', 0, '') as string;

			try {
				serviceAccountJson = parseServiceAccountJson(authorizedCredentials.serviceAccountJson as string);
			} catch (error) {
				throw new NodeOperationError(
					this.getNode(),
					`Invalid service account JSON in yandexCloudAuthorizedApi credentials: ${error.message}`,
				);
			}
		}

		// Validate that serviceAccountJson was successfully parsed
		if (!serviceAccountJson) {
			throw new NodeOperationError(
				this.getNode(),
				'Failed to parse service account JSON from credentials',
			);
		}

		// Validate service account JSON fields
		if (!serviceAccountJson.serviceAccountId) {
			throw new NodeOperationError(
				this.getNode(),
				'service_account_id or serviceAccountId is required in credentials',
			);
		}
		if (!serviceAccountJson.accessKeyId) {
			throw new NodeOperationError(
				this.getNode(),
				'id or accessKeyId is required in credentials',
			);
		}
		if (!serviceAccountJson.privateKey) {
			throw new NodeOperationError(
				this.getNode(),
				'private_key or privateKey is required in credentials',
			);
		}

		// Validate endpoint and database are provided
		if (!endpoint || !database) {
			throw new NodeOperationError(
				this.getNode(),
				'Both endpoint and database are required. When using yandexCloudAuthorizedApi, provide them as node parameters. When using yandexCloudYdbApi, they are included in the credentials.',
			);
		}

		// Create YDB driver
		let driver: Driver | null = null;

		try {
			driver = await createYDBDriver(serviceAccountJson, endpoint, database);

			// Process each item
			for (let i = 0; i < items.length; i++) {
				try {
					if (resource === 'query') {
						const yqlQuery = this.getNodeParameter('yqlQuery', i) as string;
						const returnMode = this.getNodeParameter('returnMode', i) as string;

						let queryParams: YDBQueryParams | undefined;

						// Get query parameters if using parameterized query
						if (operation === 'executeWithParams') {
							const parametersCollection = this.getNodeParameter('queryParameters', i, {}) as any;

							if (parametersCollection.parameter && Array.isArray(parametersCollection.parameter)) {
								queryParams = {};
								for (const param of parametersCollection.parameter) {
									if (param.name && param.value !== undefined) {
										// Try to parse value as JSON, otherwise use as string
										try {
											queryParams[param.name] = JSON.parse(param.value);
										} catch {
											queryParams[param.name] = param.value;
										}
									}
								}
							}
						}

						// Execute query
						const resultSets = await executeYQLQuery(driver, yqlQuery, queryParams);

						// Process results based on return mode
						let resultData: any;

						if (returnMode === 'allResultSets') {
							resultData = {
								resultSets,
								resultSetCount: resultSets.length,
								totalRows: resultSets.reduce((sum, rs) => sum + rs.length, 0),
							};
						} else if (returnMode === 'firstResultSet') {
							resultData = {
								rows: resultSets[0] || [],
								rowCount: (resultSets[0] || []).length,
							};
						} else if (returnMode === 'firstRow') {
							const firstResultSet = resultSets[0] || [];
							resultData = firstResultSet[0] || null;
						}

						returnData.push({
							json: resultData,
							pairedItem: { item: i },
						});
					}
				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({
							json: {
								error: error.message,
								success: false,
							},
							pairedItem: { item: i },
						});
						continue;
					}
					throw error;
				}
			}
		} finally {
			// Always close the driver
			if (driver) {
				await closeYDBDriver(driver);
			}
		}

		return [returnData];
	}
}
