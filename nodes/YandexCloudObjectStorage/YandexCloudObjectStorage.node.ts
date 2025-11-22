import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import { createS3Client, loadBuckets, loadObjects } from './GenericFunctions';
import {
	bucketProperties,
	executeBucketOperation,
	objectProperties,
	executeObjectOperation,
} from './resources';
import { RESOURCES } from './types';

export class YandexCloudObjectStorage implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Yandex Object Storage',
		name: 'yandexCloudObjectStorage',
		icon: 'file:ObjectStorage.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Yandex Object Storage (S3-compatible)',
		defaults: {
			name: 'Yandex Object Storage',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'yandexCloudStaticApi',
				required: true,
			},
		],
		properties: [
			// Resource
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				default: 'object',
				options: [
					{
						name: 'Bucket',
						value: RESOURCES.BUCKET,
					},
					{
						name: 'Object',
						value: RESOURCES.OBJECT,
					},
				],
			},

			// Bucket properties
			...bucketProperties,

			// Object properties
			...objectProperties,
		],
	};

	methods = {
		listSearch: {
			loadBuckets,
			loadObjects,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		// Get credentials
		const credentials = await this.getCredentials('yandexCloudStaticApi');

		// Create S3 client
		const client = createS3Client({
			accessKeyId: credentials.accessKeyId as string,
			secretAccessKey: credentials.secretAccessKey as string,
		});

		// =====================================
		// Bucket Operations
		// =====================================
		if (resource === 'bucket') {
			// List Buckets - special case: returns immediately
			if (operation === 'list') {
				try {
					const results = await executeBucketOperation(
						{ executeFunctions: this, client, itemIndex: 0 },
						operation,
					);
					return [results as INodeExecutionData[]];
				} catch (error) {
					throw error;
				}
			}

			// Other bucket operations (per item)
			for (let i = 0; i < items.length; i++) {
				try {
					const result = await executeBucketOperation(
						{ executeFunctions: this, client, itemIndex: i },
						operation,
					);
					returnData.push(result as INodeExecutionData);
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
		}

		// =====================================
		// Object Operations
		// =====================================
		if (resource === 'object') {
			for (let i = 0; i < items.length; i++) {
				try {
					const result = await executeObjectOperation(
						{ executeFunctions: this, client, itemIndex: i },
						operation,
					);

					// Handle operations that return arrays (like 'list')
					if (Array.isArray(result)) {
						returnData.push(...result);
					} else {
						returnData.push(result);
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
		}

		return [returnData];
	}
}
