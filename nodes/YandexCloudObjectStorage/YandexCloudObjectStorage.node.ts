import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import { createS3Client, loadBuckets, loadObjects } from './GenericFunctions';
import { executeBucketOperation, executeObjectOperation } from './resources';
import { RESOURCES, BUCKET_OPERATIONS, OBJECT_OPERATIONS } from './types';

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

			// =====================================
			// Bucket Operations
			// =====================================
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'list',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: [RESOURCES.BUCKET],
					},
				},
				options: [
					{
						name: 'Create',
						value: BUCKET_OPERATIONS.CREATE,
						description: 'Create a new bucket',
						action: 'Create a bucket',
					},
					{
						name: 'Delete',
						value: BUCKET_OPERATIONS.DELETE,
						description: 'Delete a bucket',
						action: 'Delete a bucket',
					},
					{
						name: 'Get',
						value: BUCKET_OPERATIONS.GET,
						description: 'Get bucket information',
						action: 'Get a bucket',
					},
					{
						name: 'List',
						value: BUCKET_OPERATIONS.LIST,
						description: 'List all buckets',
						action: 'List buckets',
					},
					{
						name: 'Set ACL',
						value: BUCKET_OPERATIONS.SET_ACL,
						description: 'Set bucket access control list',
						action: 'Set bucket ACL',
					},
					{
						name: 'Set Versioning',
						value: BUCKET_OPERATIONS.SET_VERSIONING,
						description: 'Enable or disable versioning',
						action: 'Set bucket versioning',
					},
				],
			},

			// =====================================
			// Object Operations
			// =====================================
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'upload',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: [RESOURCES.OBJECT],
					},
				},
				options: [
					{
						name: 'Copy',
						value: OBJECT_OPERATIONS.COPY,
						description: 'Copy an object',
						action: 'Copy an object',
					},
					{
						name: 'Delete',
						value: OBJECT_OPERATIONS.DELETE,
						description: 'Delete an object',
						action: 'Delete an object',
					},
					{
						name: 'Download',
						value: OBJECT_OPERATIONS.DOWNLOAD,
						description: 'Download an object',
						action: 'Download an object',
					},
					{
						name: 'Get',
						value: OBJECT_OPERATIONS.GET,
						description: 'Get object metadata',
						action: 'Get object metadata',
					},
					{
						name: 'Get Presigned URL',
						value: OBJECT_OPERATIONS.GET_PRESIGNED_URL,
						description: 'Generate a presigned URL for temporary access',
						action: 'Get presigned URL',
					},
					{
						name: 'List',
						value: OBJECT_OPERATIONS.LIST,
						description: 'List objects in a bucket',
						action: 'List objects',
					},
					{
						name: 'Move',
						value: OBJECT_OPERATIONS.MOVE,
						description: 'Move an object',
						action: 'Move an object',
					},
					{
						name: 'Set ACL',
						value: OBJECT_OPERATIONS.SET_ACL,
						description: 'Set object access control list',
						action: 'Set object ACL',
					},
					{
						name: 'Upload',
						value: OBJECT_OPERATIONS.UPLOAD,
						description: 'Upload an object',
						action: 'Upload an object',
					},
				],
			},

			// =====================================
			// Bucket: Create
			// =====================================
			{
				displayName: 'Bucket Name',
				name: 'bucketName',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: [RESOURCES.BUCKET],
						operation: [BUCKET_OPERATIONS.CREATE],
					},
				},
				default: '',
				placeholder: 'my-bucket',
				description: 'The name of the bucket to create',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: [RESOURCES.BUCKET],
						operation: [BUCKET_OPERATIONS.CREATE],
					},
				},
				options: [
					{
						displayName: 'ACL',
						name: 'acl',
						type: 'options',
						options: [
							{ name: 'Private', value: 'private' },
							{ name: 'Public Read', value: 'public-read' },
							{ name: 'Public Read Write', value: 'public-read-write' },
							{ name: 'Authenticated Read', value: 'authenticated-read' },
						],
						default: 'private',
						description: 'Access control list for the bucket',
					},
				],
			},

			// =====================================
			// Bucket: Delete, Get, Set ACL, Set Versioning
			// =====================================
			{
				displayName: 'Bucket',
				name: 'bucketName',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				displayOptions: {
					show: {
						resource: [RESOURCES.BUCKET],
						operation: [BUCKET_OPERATIONS.DELETE, BUCKET_OPERATIONS.GET, BUCKET_OPERATIONS.SET_ACL, BUCKET_OPERATIONS.SET_VERSIONING],
					},
				},
				description: 'The bucket to operate on',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'loadBuckets',
							searchable: true,
						},
					},
					{
						displayName: 'By Name',
						name: 'name',
						type: 'string',
						placeholder: 'my-bucket',
					},
				],
			},

			// Bucket: Set ACL - ACL parameter
			{
				displayName: 'ACL',
				name: 'acl',
				type: 'options',
				required: true,
				displayOptions: {
					show: {
						resource: [RESOURCES.BUCKET],
						operation: [BUCKET_OPERATIONS.SET_ACL],
					},
				},
				options: [
					{ name: 'Private', value: 'private' },
					{ name: 'Public Read', value: 'public-read' },
					{ name: 'Public Read Write', value: 'public-read-write' },
					{ name: 'Authenticated Read', value: 'authenticated-read' },
				],
				default: 'private',
				description: 'Access control list to set',
			},

			// Bucket: Set Versioning - Status parameter
			{
				displayName: 'Versioning Status',
				name: 'versioningStatus',
				type: 'options',
				required: true,
				displayOptions: {
					show: {
						resource: [RESOURCES.BUCKET],
						operation: [BUCKET_OPERATIONS.SET_VERSIONING],
					},
				},
				options: [
					{ name: 'Enabled', value: 'Enabled' },
					{ name: 'Suspended', value: 'Suspended' },
				],
				default: 'Enabled',
				description: 'Whether to enable or suspend versioning',
			},

			// =====================================
			// Object: Upload
			// =====================================
			{
				displayName: 'Bucket',
				name: 'bucketName',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				displayOptions: {
					show: {
						resource: [RESOURCES.OBJECT],
						operation: [OBJECT_OPERATIONS.UPLOAD],
					},
				},
				description: 'The bucket to upload to',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'loadBuckets',
							searchable: true,
						},
					},
					{
						displayName: 'By Name',
						name: 'name',
						type: 'string',
						placeholder: 'my-bucket',
					},
				],
			},
			{
				displayName: 'Object Key',
				name: 'objectKey',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: [RESOURCES.OBJECT],
						operation: [OBJECT_OPERATIONS.UPLOAD],
					},
				},
				default: '',
				placeholder: 'path/to/file.txt',
				description: 'The key (path) of the object in the bucket',
			},
			{
				displayName: 'Input Data Type',
				name: 'inputDataType',
				type: 'options',
				displayOptions: {
					show: {
						resource: [RESOURCES.OBJECT],
						operation: [OBJECT_OPERATIONS.UPLOAD],
					},
				},
				options: [
					{
						name: 'Binary Data',
						value: 'binary',
						description: 'Upload binary data from previous node',
					},
					{
						name: 'Text',
						value: 'text',
						description: 'Upload text content',
					},
					{
						name: 'JSON',
						value: 'json',
						description: 'Upload JSON data',
					},
				],
				default: 'binary',
			},
			{
				displayName: 'Binary Property',
				name: 'binaryProperty',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: {
					show: {
						resource: [RESOURCES.OBJECT],
						operation: [OBJECT_OPERATIONS.UPLOAD],
						inputDataType: ['binary'],
					},
				},
				description: 'Name of the binary property containing the data to upload',
			},
			{
				displayName: 'Text Content',
				name: 'textContent',
				type: 'string',
				typeOptions: {
					rows: 5,
				},
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: [RESOURCES.OBJECT],
						operation: [OBJECT_OPERATIONS.UPLOAD],
						inputDataType: ['text'],
					},
				},
				description: 'The text content to upload',
			},
			{
				displayName: 'JSON Content',
				name: 'jsonContent',
				type: 'json',
				typeOptions: {
					rows: 5,
				},
				default: '{}',
				required: true,
				displayOptions: {
					show: {
						resource: [RESOURCES.OBJECT],
						operation: [OBJECT_OPERATIONS.UPLOAD],
						inputDataType: ['json'],
					},
				},
				description: 'The JSON content to upload',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: [RESOURCES.OBJECT],
						operation: [OBJECT_OPERATIONS.UPLOAD],
					},
				},
				options: [
					{
						displayName: 'ACL',
						name: 'acl',
						type: 'options',
						options: [
							{ name: 'Private', value: 'private' },
							{ name: 'Public Read', value: 'public-read' },
							{ name: 'Public Read Write', value: 'public-read-write' },
							{ name: 'Authenticated Read', value: 'authenticated-read' },
						],
						default: 'private',
						description: 'Access control list for the object',
					},
					{
						displayName: 'Content Type',
						name: 'contentType',
						type: 'string',
						default: '',
						placeholder: 'text/plain',
						description: 'MIME type of the object',
					},
					{
						displayName: 'Storage Class',
						name: 'storageClass',
						type: 'options',
						options: [
							{ name: 'Standard', value: 'STANDARD' },
							{ name: 'Cold', value: 'COLD' },
							{ name: 'Ice', value: 'ICE' },
						],
						default: 'STANDARD',
						description: 'Storage class for the object',
					},
					{
						displayName: 'Metadata',
						name: 'metadata',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						placeholder: 'Add Metadata',
						options: [
							{
								name: 'metadataItem',
								displayName: 'Metadata Item',
								values: [
									{
										displayName: 'Key',
										name: 'key',
										type: 'string',
										default: '',
										description: 'Metadata key',
									},
									{
										displayName: 'Value',
										name: 'value',
										type: 'string',
										default: '',
										description: 'Metadata value',
									},
								],
							},
						],
						description: 'Custom metadata for the object',
					},
				],
			},

			// =====================================
			// Object: Download, Delete, Get, Set ACL
			// =====================================
			{
				displayName: 'Bucket',
				name: 'bucketName',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				displayOptions: {
					show: {
						resource: [RESOURCES.OBJECT],
						operation: [OBJECT_OPERATIONS.DOWNLOAD, OBJECT_OPERATIONS.DELETE, OBJECT_OPERATIONS.GET, OBJECT_OPERATIONS.SET_ACL, OBJECT_OPERATIONS.GET_PRESIGNED_URL],
					},
				},
				description: 'The bucket containing the object',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'loadBuckets',
							searchable: true,
						},
					},
					{
						displayName: 'By Name',
						name: 'name',
						type: 'string',
						placeholder: 'my-bucket',
					},
				],
			},
			{
				displayName: 'Object Key',
				name: 'objectKey',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: [RESOURCES.OBJECT],
						operation: [OBJECT_OPERATIONS.DOWNLOAD, OBJECT_OPERATIONS.DELETE, OBJECT_OPERATIONS.GET, OBJECT_OPERATIONS.SET_ACL, OBJECT_OPERATIONS.GET_PRESIGNED_URL],
					},
				},
				default: '',
				placeholder: 'path/to/file.txt',
				description: 'The key (path) of the object',
			},

			// Object: Set ACL - ACL parameter
			{
				displayName: 'ACL',
				name: 'acl',
				type: 'options',
				required: true,
				displayOptions: {
					show: {
						resource: [RESOURCES.OBJECT],
						operation: [OBJECT_OPERATIONS.SET_ACL],
					},
				},
				options: [
					{ name: 'Private', value: 'private' },
					{ name: 'Public Read', value: 'public-read' },
					{ name: 'Public Read Write', value: 'public-read-write' },
					{ name: 'Authenticated Read', value: 'authenticated-read' },
				],
				default: 'private',
				description: 'Access control list to set',
			},

			// Object: Get Presigned URL - Expiration
			{
				displayName: 'Expires In',
				name: 'expiresIn',
				type: 'number',
				displayOptions: {
					show: {
						resource: [RESOURCES.OBJECT],
						operation: [OBJECT_OPERATIONS.GET_PRESIGNED_URL],
					},
				},
				default: 3600,
				description: 'Number of seconds until the presigned URL expires',
			},

			// =====================================
			// Object: List
			// =====================================
			{
				displayName: 'Bucket',
				name: 'bucketName',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				displayOptions: {
					show: {
						resource: [RESOURCES.OBJECT],
						operation: [OBJECT_OPERATIONS.LIST],
					},
				},
				description: 'The bucket to list objects from',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'loadBuckets',
							searchable: true,
						},
					},
					{
						displayName: 'By Name',
						name: 'name',
						type: 'string',
						placeholder: 'my-bucket',
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
						resource: [RESOURCES.OBJECT],
						operation: [OBJECT_OPERATIONS.LIST],
					},
				},
				options: [
					{
						displayName: 'Prefix',
						name: 'prefix',
						type: 'string',
						default: '',
						placeholder: 'folder/',
						description: 'Limit results to keys that begin with the specified prefix',
					},
					{
						displayName: 'Max Keys',
						name: 'maxKeys',
						type: 'number',
						default: 1000,
						typeOptions: {
							minValue: 1,
							maxValue: 1000,
						},
						description: 'Maximum number of keys to return',
					},
					{
						displayName: 'Start After',
						name: 'startAfter',
						type: 'string',
						default: '',
						description: 'Start listing after this key',
					},
				],
			},

			// =====================================
			// Object: Copy
			// =====================================
			{
				displayName: 'Source Bucket',
				name: 'sourceBucket',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				displayOptions: {
					show: {
						resource: [RESOURCES.OBJECT],
						operation: [OBJECT_OPERATIONS.COPY, OBJECT_OPERATIONS.MOVE],
					},
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'loadBuckets',
							searchable: true,
						},
					},
					{
						displayName: 'By Name',
						name: 'name',
						type: 'string',
						placeholder: 'my-bucket',
					},
				],
			},
			{
				displayName: 'Source Object Key',
				name: 'sourceObjectKey',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: [RESOURCES.OBJECT],
						operation: [OBJECT_OPERATIONS.COPY, OBJECT_OPERATIONS.MOVE],
					},
				},
				default: '',
				placeholder: 'path/to/source.txt',
				description: 'The key of the source object',
			},
			{
				displayName: 'Destination Bucket',
				name: 'destinationBucket',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				displayOptions: {
					show: {
						resource: [RESOURCES.OBJECT],
						operation: [OBJECT_OPERATIONS.COPY, OBJECT_OPERATIONS.MOVE],
					},
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'loadBuckets',
							searchable: true,
						},
					},
					{
						displayName: 'By Name',
						name: 'name',
						type: 'string',
						placeholder: 'my-bucket',
					},
				],
			},
			{
				displayName: 'Destination Object Key',
				name: 'destinationObjectKey',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: [RESOURCES.OBJECT],
						operation: [OBJECT_OPERATIONS.COPY, OBJECT_OPERATIONS.MOVE],
					},
				},
				default: '',
				placeholder: 'path/to/destination.txt',
				description: 'The key of the destination object',
			},
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
