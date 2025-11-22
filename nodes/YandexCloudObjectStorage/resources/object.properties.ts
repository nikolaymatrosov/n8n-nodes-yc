import type { INodeProperties } from 'n8n-workflow';
import { RESOURCES, OBJECT_OPERATIONS } from '../types';

/**
 * Properties for object operations
 */
export const objectProperties: INodeProperties[] = [
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
];
