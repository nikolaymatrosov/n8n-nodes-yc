import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ILoadOptionsFunctions,
	INodePropertyOptions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { Session } from '@yandex-cloud/nodejs-sdk';
import { IamTokenService } from '@yandex-cloud/nodejs-sdk/dist/token-service/iam-token-service';
import { functionService, function as functionType } from '@yandex-cloud/nodejs-sdk/dist/clients/serverless-functions-v1/index';
import { mapKeys, camelCase } from 'lodash';

interface IIAmCredentials {
	serviceAccountId: string;
	accessKeyId: string;
	privateKey: string;
}

/**
 * Converts a Yandex Cloud service account key JSON to IIAmCredentials format
 */
function parseServiceAccountJson(jsonString: string): IIAmCredentials {
	const parsed = JSON.parse(jsonString);

	// Convert all keys to camelCase
	const camelCased = mapKeys(parsed, (_value, key) => camelCase(key));

	// Map the Yandex Cloud format to the expected format
	return {
		serviceAccountId: camelCased.serviceAccountId || '',
		accessKeyId: camelCased.id || camelCased.accessKeyId || '',
		privateKey: camelCased.privateKey || '',
	};
}

export class YandexCloudFunctions implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Yandex Cloud Functions',
		name: 'yandexCloudFunctions',
		icon: 'file:Function.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Interact with Yandex Cloud Functions',
		defaults: {
			name: 'Yandex Cloud Functions',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'yandexCloudAuthorized',
				required: true,
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
						name: 'Function',
						value: 'function',
					},
				],
				default: 'function',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['function'],
					},
				},
				options: [
					{
						name: 'Invoke',
						value: 'invoke',
						description: 'Execute a function',
						action: 'Invoke a function',
					},
				],
				default: 'invoke',
			},
		{
			displayName: 'Folder ID',
			name: 'folderId',
			type: 'string',
			displayOptions: {
				show: {
					resource: ['function'],
					operation: ['invoke'],
				},
			},
			default: '={{$credentials.folderId}}',
			description: 'Folder ID to list functions from. Defaults to the folder ID from credentials.',
		},
			{
				displayName: 'Function',
				name: 'functionId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'loadFunctions',
					loadOptionsDependsOn: ['folderId'],
				},
				required: true,
				displayOptions: {
					show: {
						resource: ['function'],
						operation: ['invoke'],
					},
				},
				default: '',
				description: 'The function to invoke',
			},
			{
				displayName: 'HTTP Method',
				name: 'httpMethod',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['function'],
						operation: ['invoke'],
					},
				},
				options: [
					{
						name: 'GET',
						value: 'GET',
					},
					{
						name: 'POST',
						value: 'POST',
					},
				],
				default: 'POST',
				description: 'The HTTP method to use for invocation',
			},
			{
				displayName: 'Request Body',
				name: 'body',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['function'],
						operation: ['invoke'],
						httpMethod: ['POST'],
					},
				},
				typeOptions: {
					rows: 5,
				},
				default: '{}',
				description: 'JSON body to send with the request',
			},
			{
				displayName: 'Additional Options',
				name: 'additionalOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						resource: ['function'],
						operation: ['invoke'],
					},
				},
				options: [
					{
						displayName: 'Query Parameters',
						name: 'queryParameters',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						placeholder: 'Add Parameter',
						description: 'Query parameters to add to the request',
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
										description: 'Parameter name',
									},
									{
										displayName: 'Value',
										name: 'value',
										type: 'string',
										default: '',
										description: 'Parameter value',
									},
								],
							},
						],
					},
					{
						displayName: 'Headers',
						name: 'headers',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						placeholder: 'Add Header',
						description: 'Additional headers to add to the request',
						options: [
							{
								name: 'header',
								displayName: 'Header',
								values: [
									{
										displayName: 'Name',
										name: 'name',
										type: 'string',
										default: '',
										description: 'Header name',
									},
									{
										displayName: 'Value',
										name: 'value',
										type: 'string',
										default: '',
										description: 'Header value',
									},
								],
							},
						],
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
	async loadFunctions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		const credentials = await this.getCredentials('yandexCloudAuthorized');

				// Parse service account JSON
				let serviceAccountJson: IIAmCredentials;
				try {
					serviceAccountJson = parseServiceAccountJson(credentials.serviceAccountJson as string);

					// Validate required fields
					if (!serviceAccountJson.serviceAccountId) {
						throw new Error('service_account_id or serviceAccountId is required');
					}
					if (!serviceAccountJson.accessKeyId) {
						throw new Error('id or accessKeyId is required');
					}
					if (!serviceAccountJson.privateKey) {
						throw new Error('private_key or privateKey is required');
					}
				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						`Invalid service account JSON credentials: ${error.message}`,
					);
				}

				// Get folder ID from node parameter or credentials
				const folderIdOverride = this.getNodeParameter('folderId', '') as string;
				const folderId = folderIdOverride || (credentials.folderId as string);

				if (!folderId || typeof folderId !== 'string') {
					throw new NodeOperationError(
						this.getNode(),
						'Folder ID is required either in credentials or as node parameter to list functions',
					);
				}

				try {
					// Create session with service account
					const session = new Session({ serviceAccountJson });
					const client = session.client(functionService.FunctionServiceClient);

					// List functions
					const response = await client.list(
						functionService.ListFunctionsRequest.fromPartial({ folderId }),
					);

					// Return function options
					return response.functions.map((func: functionType.Function) => ({
						name: `${func.name} (${func.id})`,
						value: func.id,
						description: func.httpInvokeUrl || func.id,
					}));
				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						`Failed to list functions: ${error.message}`,
					);
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		// Get credentials
		const credentials = await this.getCredentials('yandexCloudAuthorized');

		// Parse service account JSON
		let serviceAccountJson: IIAmCredentials;
		try {
			serviceAccountJson = parseServiceAccountJson(credentials.serviceAccountJson as string);

			// Validate required fields
			if (!serviceAccountJson.serviceAccountId) {
				throw new Error('service_account_id or serviceAccountId is required');
			}
			if (!serviceAccountJson.accessKeyId) {
				throw new Error('id or accessKeyId is required');
			}
			if (!serviceAccountJson.privateKey) {
				throw new Error('private_key or privateKey is required');
			}
		} catch (error) {
			throw new NodeOperationError(
				this.getNode(),
				`Invalid service account JSON credentials: ${error.message}`,
			);
		}

		// Create IAM token service
		const iamTokenService = new IamTokenService(serviceAccountJson);

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'function' && operation === 'invoke') {
					const functionId = this.getNodeParameter('functionId', i) as string;
					const httpMethod = this.getNodeParameter('httpMethod', i) as string;
					const folderIdOverride = this.getNodeParameter('folderId', i) as string;
					const additionalOptions = this.getNodeParameter('additionalOptions', i, {}) as {
						queryParameters?: { parameter: Array<{ name: string; value: string }> };
						headers?: { header: Array<{ name: string; value: string }> };
					};

					// Get folder ID (use override or from credentials)
					const folderId = folderIdOverride || (credentials.folderId as string);
					if (!folderId) {
						throw new NodeOperationError(
							this.getNode(),
							'Folder ID is required either in credentials or as node parameter',
						);
					}

					// Get IAM token
					const token = await iamTokenService.getToken();

					// Build function invoke URL
					const invokeUrl = `https://functions.yandexcloud.net/${functionId}`;

					// Build query parameters
					const queryParams = new URLSearchParams();
					if (additionalOptions.queryParameters?.parameter) {
						for (const param of additionalOptions.queryParameters.parameter) {
							if (param.name) {
								queryParams.append(param.name, param.value);
							}
						}
					}

					const url = queryParams.toString()
						? `${invokeUrl}?${queryParams.toString()}`
						: invokeUrl;

					// Build headers
					const headers: Record<string, string> = {
						'Authorization': `Bearer ${token}`,
					};

					// Add custom headers
					if (additionalOptions.headers?.header) {
						for (const header of additionalOptions.headers.header) {
							if (header.name) {
								headers[header.name] = header.value;
							}
						}
					}

					// Prepare request options
					const requestOptions: RequestInit = {
						method: httpMethod,
						headers,
					};

					// Add body for POST requests
					if (httpMethod === 'POST') {
						const body = this.getNodeParameter('body', i) as string;
						try {
							// Validate JSON
							JSON.parse(body);
							requestOptions.body = body;
							headers['Content-Type'] = 'application/json';
						} catch (error) {
							throw new NodeOperationError(
								this.getNode(),
								`Invalid JSON in request body: ${error.message}`,
							);
						}
					}

					// Make request
					const response = await fetch(url, requestOptions);
					const responseText = await response.text();

					// Try to parse response as JSON
					let responseData: any;
					try {
						responseData = JSON.parse(responseText);
					} catch {
						responseData = responseText;
					}

					// Convert headers to object
					const responseHeaders: Record<string, string> = {};
					response.headers.forEach((value, key) => {
						responseHeaders[key] = value;
					});

					returnData.push({
						json: {
							statusCode: response.status,
							headers: responseHeaders,
							body: responseData,
						},
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

		return [returnData];
	}
}

