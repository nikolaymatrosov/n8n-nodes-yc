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
import { workflowService, executionService, workflow as workflowType } from '@yandex-cloud/nodejs-sdk/dist/clients/serverless-workflows-v1/index';
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

export class YandexCloudWorkflows implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Yandex Cloud Workflows',
		name: 'yandexCloudWorkflows',
		icon: 'file:Workflow.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Interact with Yandex Cloud Workflows',
		defaults: {
			name: 'Yandex Cloud Workflows',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'yandexCloudApi',
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
						name: 'Workflow',
						value: 'workflow',
					},
				],
				default: 'workflow',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['workflow'],
					},
				},
				options: [
					{
						name: 'Start Execution',
						value: 'startExecution',
						description: 'Start a workflow execution',
						action: 'Start execution of a workflow',
					},
				],
				default: 'startExecution',
			},
		{
			displayName: 'Folder ID',
			name: 'folderId',
			type: 'string',
			displayOptions: {
				show: {
					resource: ['workflow'],
					operation: ['startExecution'],
				},
			},
			default: '={{$credentials.folderId}}',
			description: 'Folder ID to list workflows from. Defaults to the folder ID from credentials.',
		},
			{
				displayName: 'Workflow',
				name: 'workflowId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'loadWorkflows',
					loadOptionsDependsOn: ['folderId'],
				},
				required: true,
				displayOptions: {
					show: {
						resource: ['workflow'],
						operation: ['startExecution'],
					},
				},
				default: '',
				description: 'The workflow to execute',
			},
			{
				displayName: 'Input Data',
				name: 'inputData',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['workflow'],
						operation: ['startExecution'],
					},
				},
				typeOptions: {
					rows: 5,
				},
				default: '{}',
				description: 'JSON input data for the workflow execution',
			},
		],
	};

	methods = {
		loadOptions: {
			async loadWorkflows(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('yandexCloudApi');

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
						'Folder ID is required either in credentials or as node parameter to list workflows',
					);
				}

				try {
					// Create session with service account
					const session = new Session({ serviceAccountJson });
					const client = session.client(workflowService.WorkflowServiceClient);

					// List workflows
					const response = await client.list(
						workflowService.ListWorkflowsRequest.fromPartial({ folderId }),
					);

					// Return workflow options
					return response.workflows.map((wf: workflowType.WorkflowPreview) => ({
						name: `${wf.name} (${wf.id})`,
						value: wf.id,
						description: wf.description || wf.id,
					}));
				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						`Failed to list workflows: ${error.message}`,
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
		const credentials = await this.getCredentials('yandexCloudApi');

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

		// Create session for SDK calls
		const session = new Session({ serviceAccountJson });

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'workflow' && operation === 'startExecution') {
					const workflowId = this.getNodeParameter('workflowId', i) as string;
					const inputData = this.getNodeParameter('inputData', i) as string;
					const folderIdOverride = this.getNodeParameter('folderId', i) as string;

					// Get folder ID (use override or from credentials)
					const folderId = folderIdOverride || (credentials.folderId as string);
					if (!folderId) {
						throw new NodeOperationError(
							this.getNode(),
							'Folder ID is required either in credentials or as node parameter',
						);
					}

					// Validate input data is valid JSON
					try {
						JSON.parse(inputData);
					} catch (error) {
						throw new NodeOperationError(
							this.getNode(),
							`Invalid JSON in input data: ${error.message}`,
						);
					}

					// Start workflow execution
					const client = session.client(executionService.ExecutionServiceClient);
					const response = await client.start(
						executionService.StartExecutionRequest.fromPartial({
							workflowId,
							input: {
								inputJson: inputData,
							},
						}),
					);

					returnData.push({
						json: {
							executionId: response.executionId,
							workflowId,
							success: true,
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
