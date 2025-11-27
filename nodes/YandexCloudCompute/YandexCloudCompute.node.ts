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
import { instanceService, instance as instanceType } from '@yandex-cloud/nodejs-sdk/dist/clients/compute-v1/index';
import { mapKeys, camelCase } from 'lodash';
import { YandexCloudSdkError, withSdkErrorHandling } from '@utils/sdkErrorHandling';

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

export class YandexCloudCompute implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Yandex Cloud Compute',
		name: 'yandexCloudCompute',
		icon: 'file:Compute.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Interact with Yandex Cloud Compute instances',
		defaults: {
			name: 'Yandex Cloud Compute',
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
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Instance',
						value: 'instance',
					},
				],
				default: 'instance',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['instance'],
					},
				},
				options: [
					{
						name: 'Start',
						value: 'start',
						description: 'Start a stopped instance',
						action: 'Start an instance',
					},
					{
						name: 'Stop',
						value: 'stop',
						description: 'Stop a running instance',
						action: 'Stop an instance',
					},
				],
				default: 'start',
			},
			{
				displayName: 'Folder ID',
				name: 'folderId',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['instance'],
					},
				},
				default: '={{$credentials.folderId}}',
				description: 'Folder ID to list instances from. Defaults to the folder ID from credentials.',
			},
			{
				displayName: 'Instance Name or ID',
				name: 'instanceId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'loadInstances',
					loadOptionsDependsOn: ['folderId'],
				},
				required: true,
				displayOptions: {
					show: {
						resource: ['instance'],
					},
				},
				default: '',
				description: 'The instance to start or stop. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
		],
	};

	methods = {
		loadOptions: {
			async loadInstances(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('yandexCloudAuthorizedApi');

				// Parse service account JSON
				let serviceAccountJson: IIAmCredentials;
				try {
					serviceAccountJson = parseServiceAccountJson(credentials.serviceAccountJson as string);

					// Validate required fields
					if (!serviceAccountJson.serviceAccountId) {
						throw new NodeOperationError(
							this.getNode(),
							'service_account_id or serviceAccountId is required',
						);
					}
					if (!serviceAccountJson.accessKeyId) {
						throw new NodeOperationError(
							this.getNode(),
							'id or accessKeyId is required',
						);
					}
					if (!serviceAccountJson.privateKey) {
						throw new NodeOperationError(
							this.getNode(),
							'private_key or privateKey is required',
						);
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
						'Folder ID is required either in credentials or as node parameter to list instances',
					);
				}

				try {
					// Create session with service account
					const session = new Session({ serviceAccountJson });
					const client = session.client(instanceService.InstanceServiceClient);

					// List instances
					const response = await withSdkErrorHandling(
						this.getNode(),
						() => client.list(instanceService.ListInstancesRequest.fromPartial({ folderId })),
						'list instances',
					);

					// Return instance options
					return response.instances.map((inst: instanceType.Instance) => ({
						name: `${inst.name} (${inst.id})`,
						value: inst.id,
						description: inst.status ? `Status: ${instanceType.Instance_Status[inst.status]}` : inst.id,
					}));
				} catch (error) {
					// Re-throw SDK errors as-is
					if (error instanceof YandexCloudSdkError) {
						throw error;
					}
					// Wrap other errors in NodeOperationError for backward compatibility
					throw new NodeOperationError(
						this.getNode(),
						`Failed to list instances: ${error.message}`,
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
		const credentials = await this.getCredentials('yandexCloudAuthorizedApi');

		// Parse service account JSON
		let serviceAccountJson: IIAmCredentials;
		try {
			serviceAccountJson = parseServiceAccountJson(credentials.serviceAccountJson as string);

			// Validate required fields
			if (!serviceAccountJson.serviceAccountId) {
				throw new NodeOperationError(
					this.getNode(),
					'service_account_id or serviceAccountId is required',
				);
			}
			if (!serviceAccountJson.accessKeyId) {
				throw new NodeOperationError(
					this.getNode(),
					'id or accessKeyId is required',
				);
			}
			if (!serviceAccountJson.privateKey) {
				throw new NodeOperationError(
					this.getNode(),
					'private_key or privateKey is required',
				);
			}
		} catch (error) {
			throw new NodeOperationError(
				this.getNode(),
				`Invalid service account JSON credentials: ${error.message}`,
			);
		}

		// Create session for SDK calls
		const session = new Session({ serviceAccountJson });

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'instance') {
					const instanceId = this.getNodeParameter('instanceId', i) as string;
					const folderIdOverride = this.getNodeParameter('folderId', i) as string;

					// Get folder ID (use override or from credentials)
					const folderId = folderIdOverride || (credentials.folderId as string);
					if (!folderId) {
						throw new NodeOperationError(
							this.getNode(),
							'Folder ID is required either in credentials or as node parameter',
						);
					}

					const client = session.client(instanceService.InstanceServiceClient);

					if (operation === 'start') {
						// Start the instance
						const operationResult = await withSdkErrorHandling(
							this.getNode(),
							() => client.start(instanceService.StartInstanceRequest.fromPartial({ instanceId })),
							'start instance',
							i,
						);

						returnData.push({
							json: {
								success: true,
								operation: 'start',
								instanceId,
								operationId: operationResult.id,
								done: operationResult.done,
								metadata: operationResult.metadata,
							},
							pairedItem: { item: i },
						});
					} else if (operation === 'stop') {
						// Stop the instance
						const operationResult = await withSdkErrorHandling(
							this.getNode(),
							() => client.stop(instanceService.StopInstanceRequest.fromPartial({ instanceId })),
							'stop instance',
							i,
						);

						returnData.push({
							json: {
								success: true,
								operation: 'stop',
								instanceId,
								operationId: operationResult.id,
								done: operationResult.done,
								metadata: operationResult.metadata,
							},
							pairedItem: { item: i },
						});
					}
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
				// If it's already one of our custom errors, re-throw as-is
				if (error instanceof YandexCloudSdkError || error instanceof NodeOperationError) {
					throw error;
				}
				// Otherwise wrap in YandexCloudSdkError
				throw new YandexCloudSdkError(this.getNode(), error as Error, {
					operation: operation as string,
					itemIndex: i,
				});
			}
		}

		return [returnData];
	}
}

