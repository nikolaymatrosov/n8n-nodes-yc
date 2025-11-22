import type { INodeProperties } from 'n8n-workflow';
import { RESOURCES, BUCKET_OPERATIONS } from '../types';

/**
 * Properties for bucket operations
 */
export const bucketProperties: INodeProperties[] = [
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
];
