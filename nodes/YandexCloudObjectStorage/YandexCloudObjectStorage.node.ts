import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	CopyObjectCommand,
	CreateBucketCommand,
	DeleteBucketCommand,
	DeleteObjectCommand,
	GetBucketLocationCommand,
	GetObjectCommand,
	HeadBucketCommand,
	HeadObjectCommand,
	ListBucketsCommand,
	ListObjectsV2Command,
	PutBucketAclCommand,
	PutBucketVersioningCommand,
	PutObjectAclCommand,
	PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

import { createS3Client, getObjectUrl, loadBuckets, loadObjects, streamToBuffer } from './GenericFunctions';

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
				options: [
					{
						name: 'Bucket',
						value: 'bucket',
					},
					{
						name: 'Object',
						value: 'object',
					},
				],
				default: 'object',
			},

			// =====================================
			// Bucket Operations
			// =====================================
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['bucket'],
					},
				},
				options: [
					{
						name: 'Create',
						value: 'create',
						description: 'Create a new bucket',
						action: 'Create a bucket',
					},
					{
						name: 'Delete',
						value: 'delete',
						description: 'Delete a bucket',
						action: 'Delete a bucket',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get bucket information',
						action: 'Get a bucket',
					},
					{
						name: 'List',
						value: 'list',
						description: 'List all buckets',
						action: 'List buckets',
					},
					{
						name: 'Set ACL',
						value: 'setAcl',
						description: 'Set bucket access control list',
						action: 'Set bucket ACL',
					},
					{
						name: 'Set Versioning',
						value: 'setVersioning',
						description: 'Enable or disable versioning',
						action: 'Set bucket versioning',
					},
				],
				default: 'list',
			},

			// =====================================
			// Object Operations
			// =====================================
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['object'],
					},
				},
				options: [
					{
						name: 'Copy',
						value: 'copy',
						description: 'Copy an object',
						action: 'Copy an object',
					},
					{
						name: 'Delete',
						value: 'delete',
						description: 'Delete an object',
						action: 'Delete an object',
					},
					{
						name: 'Download',
						value: 'download',
						description: 'Download an object',
						action: 'Download an object',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get object metadata',
						action: 'Get object metadata',
					},
					{
						name: 'Get Presigned URL',
						value: 'getPresignedUrl',
						description: 'Generate a presigned URL for temporary access',
						action: 'Get presigned URL',
					},
					{
						name: 'List',
						value: 'list',
						description: 'List objects in a bucket',
						action: 'List objects',
					},
					{
						name: 'Move',
						value: 'move',
						description: 'Move an object',
						action: 'Move an object',
					},
					{
						name: 'Set ACL',
						value: 'setAcl',
						description: 'Set object access control list',
						action: 'Set object ACL',
					},
					{
						name: 'Upload',
						value: 'upload',
						description: 'Upload an object',
						action: 'Upload an object',
					},
				],
				default: 'upload',
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
						resource: ['bucket'],
						operation: ['create'],
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
						resource: ['bucket'],
						operation: ['create'],
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
						resource: ['bucket'],
						operation: ['delete', 'get', 'setAcl', 'setVersioning'],
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
						resource: ['bucket'],
						operation: ['setAcl'],
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
						resource: ['bucket'],
						operation: ['setVersioning'],
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
						resource: ['object'],
						operation: ['upload'],
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
						resource: ['object'],
						operation: ['upload'],
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
						resource: ['object'],
						operation: ['upload'],
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
						resource: ['object'],
						operation: ['upload'],
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
						resource: ['object'],
						operation: ['upload'],
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
						resource: ['object'],
						operation: ['upload'],
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
						resource: ['object'],
						operation: ['upload'],
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
						resource: ['object'],
						operation: ['download', 'delete', 'get', 'setAcl', 'getPresignedUrl'],
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
						resource: ['object'],
						operation: ['download', 'delete', 'get', 'setAcl', 'getPresignedUrl'],
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
						resource: ['object'],
						operation: ['setAcl'],
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
						resource: ['object'],
						operation: ['getPresignedUrl'],
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
						resource: ['object'],
						operation: ['list'],
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
						resource: ['object'],
						operation: ['list'],
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
						resource: ['object'],
						operation: ['copy', 'move'],
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
						resource: ['object'],
						operation: ['copy', 'move'],
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
						resource: ['object'],
						operation: ['copy', 'move'],
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
						resource: ['object'],
						operation: ['copy', 'move'],
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
			// List Buckets
			if (operation === 'list') {
				try {
					const response = await client.send(new ListBucketsCommand({}));

					const buckets = (response.Buckets || []).map((bucket) => ({
						json: {
							name: bucket.Name,
							creationDate: bucket.CreationDate,
						},
						pairedItem: { item: 0 },
					}));

					return [buckets];
				} catch (error) {
					throw new NodeOperationError(this.getNode(), `Failed to list buckets: ${error.message}`);
				}
			}

			// Other bucket operations (per item)
			for (let i = 0; i < items.length; i++) {
				try {
					let bucketName: string;

					if (operation === 'create') {
						bucketName = this.getNodeParameter('bucketName', i) as string;
						const additionalFields = this.getNodeParameter('additionalFields', i) as {
							acl?: string;
						};

						const params: any = {
							Bucket: bucketName,
						};

						if (additionalFields.acl) {
							params.ACL = additionalFields.acl;
						}

						await client.send(new CreateBucketCommand(params));

						returnData.push({
							json: {
								success: true,
								bucket: bucketName,
								message: 'Bucket created successfully',
							},
							pairedItem: { item: i },
						});
					} else {
						bucketName = this.getNodeParameter('bucketName', i, '', {
							extractValue: true,
						}) as string;

						if (operation === 'delete') {
							await client.send(new DeleteBucketCommand({ Bucket: bucketName }));

							returnData.push({
								json: {
									success: true,
									bucket: bucketName,
									message: 'Bucket deleted successfully',
								},
								pairedItem: { item: i },
							});
						} else if (operation === 'get') {
							const headResponse = await client.send(new HeadBucketCommand({ Bucket: bucketName }));

							let location;
							try {
								const locationResponse = await client.send(
									new GetBucketLocationCommand({ Bucket: bucketName }),
								);
								location = locationResponse.LocationConstraint;
							} catch (error) {
								// Ignore location errors
							}

							returnData.push({
								json: {
									success: true,
									bucket: bucketName,
									location,
									metadata: headResponse.$metadata,
								},
								pairedItem: { item: i },
							});
						} else if (operation === 'setAcl') {
							const acl = this.getNodeParameter('acl', i) as string;

							await client.send(
								new PutBucketAclCommand({
									Bucket: bucketName,
									ACL: acl as any,
								}),
							);

							returnData.push({
								json: {
									success: true,
									bucket: bucketName,
									acl,
									message: 'Bucket ACL set successfully',
								},
								pairedItem: { item: i },
							});
						} else if (operation === 'setVersioning') {
							const versioningStatus = this.getNodeParameter('versioningStatus', i) as string;

							await client.send(
								new PutBucketVersioningCommand({
									Bucket: bucketName,
									VersioningConfiguration: {
										Status: versioningStatus as any,
									},
								}),
							);

							returnData.push({
								json: {
									success: true,
									bucket: bucketName,
									versioningStatus,
									message: 'Bucket versioning set successfully',
								},
								pairedItem: { item: i },
							});
						}
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

		// =====================================
		// Object Operations
		// =====================================
		if (resource === 'object') {
			for (let i = 0; i < items.length; i++) {
				try {
					const bucketName = this.getNodeParameter('bucketName', i, '', {
						extractValue: true,
					}) as string;

					if (operation === 'upload') {
						const objectKey = this.getNodeParameter('objectKey', i) as string;
						const inputDataType = this.getNodeParameter('inputDataType', i) as string;
						const additionalFields = this.getNodeParameter('additionalFields', i) as {
							acl?: string;
							contentType?: string;
							storageClass?: string;
							metadata?: {
								metadataItem?: Array<{
									key: string;
									value: string;
								}>;
							};
						};

						let body: Buffer;
						let contentType = additionalFields.contentType;

						if (inputDataType === 'binary') {
							const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;
							const binaryData = await this.helpers.getBinaryDataBuffer(i, binaryProperty);
							body = binaryData;

							// Try to get content type from binary data if not specified
							if (!contentType) {
								const itemBinaryData = items[i].binary?.[binaryProperty];
								if (itemBinaryData?.mimeType) {
									contentType = itemBinaryData.mimeType;
								}
							}
						} else if (inputDataType === 'text') {
							const textContent = this.getNodeParameter('textContent', i) as string;
							body = Buffer.from(textContent, 'utf-8');
							if (!contentType) {
								contentType = 'text/plain';
							}
						} else if (inputDataType === 'json') {
							const jsonContent = this.getNodeParameter('jsonContent', i);
							body = Buffer.from(JSON.stringify(jsonContent), 'utf-8');
							if (!contentType) {
								contentType = 'application/json';
							}
						} else {
							throw new NodeOperationError(
								this.getNode(),
								`Unknown input data type: ${inputDataType}`,
							);
						}

						const params: any = {
							Bucket: bucketName,
							Key: objectKey,
							Body: body,
						};

						if (contentType) {
							params.ContentType = contentType;
						}

						if (additionalFields.acl) {
							params.ACL = additionalFields.acl;
						}

						if (additionalFields.storageClass) {
							params.StorageClass = additionalFields.storageClass;
						}

						if (additionalFields.metadata?.metadataItem) {
							const metadata: Record<string, string> = {};
							for (const item of additionalFields.metadata.metadataItem) {
								if (item.key) {
									metadata[item.key] = item.value;
								}
							}
							params.Metadata = metadata;
						}

					const response = await client.send(new PutObjectCommand(params));

					returnData.push({
						json: {
							success: true,
							bucket: bucketName,
							key: objectKey,
							objectUrl: getObjectUrl(bucketName, objectKey),
							etag: response.ETag,
							versionId: response.VersionId,
						},
						pairedItem: { item: i },
					});
					} else if (operation === 'download') {
						const objectKey = this.getNodeParameter('objectKey', i) as string;

						const response = await client.send(
							new GetObjectCommand({
								Bucket: bucketName,
								Key: objectKey,
							}),
						);

						const bodyBuffer = await streamToBuffer(response.Body as Readable);

						const binaryData = await this.helpers.prepareBinaryData(
							bodyBuffer,
							objectKey.split('/').pop() || 'file',
							response.ContentType,
						);

						returnData.push({
							json: {
								success: true,
								bucket: bucketName,
								key: objectKey,
								size: response.ContentLength,
								contentType: response.ContentType,
								lastModified: response.LastModified,
								etag: response.ETag,
							},
							binary: {
								data: binaryData,
							},
							pairedItem: { item: i },
						});
					} else if (operation === 'delete') {
						const objectKey = this.getNodeParameter('objectKey', i) as string;

						await client.send(
							new DeleteObjectCommand({
								Bucket: bucketName,
								Key: objectKey,
							}),
						);

						returnData.push({
							json: {
								success: true,
								bucket: bucketName,
								key: objectKey,
								message: 'Object deleted successfully',
							},
							pairedItem: { item: i },
						});
					} else if (operation === 'list') {
						const additionalFields = this.getNodeParameter('additionalFields', i) as {
							prefix?: string;
							maxKeys?: number;
							startAfter?: string;
						};

						const params: any = {
							Bucket: bucketName,
						};

						if (additionalFields.prefix) {
							params.Prefix = additionalFields.prefix;
						}

						if (additionalFields.maxKeys) {
							params.MaxKeys = additionalFields.maxKeys;
						}

						if (additionalFields.startAfter) {
							params.StartAfter = additionalFields.startAfter;
						}

						const response = await client.send(new ListObjectsV2Command(params));

						const objects = (response.Contents || []).map((object) => ({
							json: {
								key: object.Key,
								size: object.Size,
								lastModified: object.LastModified,
								etag: object.ETag,
								storageClass: object.StorageClass,
							},
							pairedItem: { item: i },
						}));

						returnData.push(...objects);
					} else if (operation === 'get') {
						const objectKey = this.getNodeParameter('objectKey', i) as string;

						const response = await client.send(
							new HeadObjectCommand({
								Bucket: bucketName,
								Key: objectKey,
							}),
						);

						returnData.push({
							json: {
								success: true,
								bucket: bucketName,
								key: objectKey,
								size: response.ContentLength,
								contentType: response.ContentType,
								lastModified: response.LastModified,
								etag: response.ETag,
								versionId: response.VersionId,
								storageClass: response.StorageClass,
								metadata: response.Metadata,
							},
							pairedItem: { item: i },
						});
					} else if (operation === 'copy') {
						const sourceBucket = this.getNodeParameter('sourceBucket', i, '', {
							extractValue: true,
						}) as string;
						const sourceObjectKey = this.getNodeParameter('sourceObjectKey', i) as string;
						const destinationBucket = this.getNodeParameter('destinationBucket', i, '', {
							extractValue: true,
						}) as string;
						const destinationObjectKey = this.getNodeParameter('destinationObjectKey', i) as string;

						const copySource = `${sourceBucket}/${sourceObjectKey}`;

					const response = await client.send(
						new CopyObjectCommand({
							Bucket: destinationBucket,
							Key: destinationObjectKey,
							CopySource: copySource,
						}),
					);

					returnData.push({
						json: {
							success: true,
							sourceBucket,
							sourceKey: sourceObjectKey,
							destinationBucket,
							destinationKey: destinationObjectKey,
							objectUrl: getObjectUrl(destinationBucket, destinationObjectKey),
							etag: response.CopyObjectResult?.ETag,
							lastModified: response.CopyObjectResult?.LastModified,
						},
						pairedItem: { item: i },
					});
					} else if (operation === 'move') {
						const sourceBucket = this.getNodeParameter('sourceBucket', i, '', {
							extractValue: true,
						}) as string;
						const sourceObjectKey = this.getNodeParameter('sourceObjectKey', i) as string;
						const destinationBucket = this.getNodeParameter('destinationBucket', i, '', {
							extractValue: true,
						}) as string;
						const destinationObjectKey = this.getNodeParameter('destinationObjectKey', i) as string;

						const copySource = `${sourceBucket}/${sourceObjectKey}`;

						// Copy object
						const copyResponse = await client.send(
							new CopyObjectCommand({
								Bucket: destinationBucket,
								Key: destinationObjectKey,
								CopySource: copySource,
							}),
						);

					// Delete source object
					await client.send(
						new DeleteObjectCommand({
							Bucket: sourceBucket,
							Key: sourceObjectKey,
						}),
					);

					returnData.push({
						json: {
							success: true,
							sourceBucket,
							sourceKey: sourceObjectKey,
							destinationBucket,
							destinationKey: destinationObjectKey,
							objectUrl: getObjectUrl(destinationBucket, destinationObjectKey),
							etag: copyResponse.CopyObjectResult?.ETag,
							lastModified: copyResponse.CopyObjectResult?.LastModified,
						},
						pairedItem: { item: i },
					});
					} else if (operation === 'setAcl') {
						const objectKey = this.getNodeParameter('objectKey', i) as string;
						const acl = this.getNodeParameter('acl', i) as string;

						await client.send(
							new PutObjectAclCommand({
								Bucket: bucketName,
								Key: objectKey,
								ACL: acl as any,
							}),
						);

						returnData.push({
							json: {
								success: true,
								bucket: bucketName,
								key: objectKey,
								acl,
								message: 'Object ACL set successfully',
							},
							pairedItem: { item: i },
						});
					} else if (operation === 'getPresignedUrl') {
						const objectKey = this.getNodeParameter('objectKey', i) as string;
						const expiresIn = this.getNodeParameter('expiresIn', i) as number;

						const command = new GetObjectCommand({
							Bucket: bucketName,
							Key: objectKey,
						});

						const presignedUrl = await getSignedUrl(client, command, {
							expiresIn,
						});

						returnData.push({
							json: {
								success: true,
								bucket: bucketName,
								key: objectKey,
								presignedUrl,
								expiresIn,
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
		}

		return [returnData];
	}
}
