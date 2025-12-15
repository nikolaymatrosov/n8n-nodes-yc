import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import { createLockboxClients, loadSecrets, loadVersions } from './GenericFunctions';
import {
	executeSecretOperation,
	executeVersionOperation,
	executePayloadOperation,
} from './resources';
import {
	RESOURCES,
	SECRET_OPERATIONS,
	VERSION_OPERATIONS,
	PAYLOAD_OPERATIONS,
	PARAMS,
} from './types';

export class YandexCloudLockbox implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Yandex Cloud Lockbox',
		name: 'yandexCloudLockbox',
		icon: 'file:Lockbox.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Manage secrets and retrieve payloads from Yandex Cloud Lockbox',
		defaults: {
			name: 'Yandex Cloud Lockbox',
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
				name: PARAMS.RESOURCE,
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Secret',
						value: RESOURCES.SECRET,
					},
					{
						name: 'Version',
						value: RESOURCES.VERSION,
					},
					{
						name: 'Payload',
						value: RESOURCES.PAYLOAD,
					},
				],
				default: 'secret',
			},

			// ==========================================
			// SECRET OPERATIONS
			// ==========================================
			{
				displayName: 'Operation',
				name: PARAMS.OPERATION,
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: [RESOURCES.SECRET],
					},
				},
				options: [
					{
						name: 'List',
						value: SECRET_OPERATIONS.LIST,
						description: 'List all secrets in a folder',
						action: 'List secrets',
					},
					{
						name: 'Get',
						value: SECRET_OPERATIONS.GET,
						description: 'Get secret metadata by ID',
						action: 'Get a secret',
					},
					{
						name: 'Create',
						value: SECRET_OPERATIONS.CREATE,
						description: 'Create a new secret with initial version',
						action: 'Create a secret',
					},
					{
						name: 'Update',
						value: SECRET_OPERATIONS.UPDATE,
						description: 'Update secret metadata',
						action: 'Update a secret',
					},
					{
						name: 'Delete',
						value: SECRET_OPERATIONS.DELETE,
						description: 'Delete a secret permanently',
						action: 'Delete a secret',
					},
					{
						name: 'Activate',
						value: SECRET_OPERATIONS.ACTIVATE,
						description: 'Activate a secret (INACTIVE → ACTIVE)',
						action: 'Activate a secret',
					},
					{
						name: 'Deactivate',
						value: SECRET_OPERATIONS.DEACTIVATE,
						description: 'Deactivate a secret (ACTIVE → INACTIVE)',
						action: 'Deactivate a secret',
					},
				],
				default: 'list',
			},

			// ==========================================
			// VERSION OPERATIONS
			// ==========================================
			{
				displayName: 'Operation',
				name: PARAMS.OPERATION,
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: [RESOURCES.VERSION],
					},
				},
				options: [
					{
						name: 'List',
						value: VERSION_OPERATIONS.LIST,
						description: 'List all versions of a secret',
						action: 'List versions',
					},
					{
						name: 'Add',
						value: VERSION_OPERATIONS.ADD,
						description: 'Add a new version to an existing secret',
						action: 'Add a version',
					},
					{
						name: 'Schedule Destruction',
						value: VERSION_OPERATIONS.SCHEDULE_DESTRUCTION,
						description: 'Schedule a version for deletion',
						action: 'Schedule version destruction',
					},
					{
						name: 'Cancel Destruction',
						value: VERSION_OPERATIONS.CANCEL_DESTRUCTION,
						description: 'Cancel scheduled version deletion',
						action: 'Cancel version destruction',
					},
				],
				default: 'list',
			},

			// ==========================================
			// PAYLOAD OPERATIONS
			// ==========================================
			{
				displayName: 'Operation',
				name: PARAMS.OPERATION,
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: [RESOURCES.PAYLOAD],
					},
				},
				options: [
					{
						name: 'Get',
						value: PAYLOAD_OPERATIONS.GET,
						description: 'Retrieve secret payload by ID',
						action: 'Get payload',
					},
					{
						name: 'Get by Name',
						value: PAYLOAD_OPERATIONS.GET_BY_NAME,
						description: 'Retrieve payload using folder ID + secret name',
						action: 'Get payload by name',
					},
				],
				default: 'get',
			},

			// ==========================================
			// COMMON PARAMETERS
			// ==========================================

			// Folder ID
			{
				displayName: 'Folder ID',
				name: PARAMS.FOLDER_ID,
				type: 'string',
				default: '',
				placeholder: 'b1gXXXXXXXXXXXXXXXXX',
				description:
					'The ID of the folder. If not specified, the folder ID from credentials will be used.',
				displayOptions: {
					show: {
						resource: [RESOURCES.SECRET],
						operation: [SECRET_OPERATIONS.LIST, SECRET_OPERATIONS.CREATE],
					},
				},
			},

			// ==========================================
			// SECRET PARAMETERS
			// ==========================================

			// Secret ID (Resource Locator)
			{
				displayName: 'Secret',
				name: PARAMS.SECRET_ID,
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'loadSecrets',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'e6qXXXXXXXXXXXXXXXXX',
					},
					{
						displayName: 'By Name',
						name: 'name',
						type: 'string',
						placeholder: 'my-secret',
					},
				],
				displayOptions: {
					show: {
						resource: [RESOURCES.SECRET, RESOURCES.VERSION],
						operation: [
							SECRET_OPERATIONS.GET,
							SECRET_OPERATIONS.UPDATE,
							SECRET_OPERATIONS.DELETE,
							SECRET_OPERATIONS.ACTIVATE,
							SECRET_OPERATIONS.DEACTIVATE,
							VERSION_OPERATIONS.LIST,
							VERSION_OPERATIONS.ADD,
							VERSION_OPERATIONS.SCHEDULE_DESTRUCTION,
							VERSION_OPERATIONS.CANCEL_DESTRUCTION,
						],
					},
				},
			},

			// Secret ID for Payload operations
			{
				displayName: 'Secret',
				name: PARAMS.SECRET_ID,
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'loadSecrets',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'e6qXXXXXXXXXXXXXXXXX',
					},
				],
				displayOptions: {
					show: {
						resource: [RESOURCES.PAYLOAD],
						operation: [PAYLOAD_OPERATIONS.GET],
					},
				},
			},

			// Secret Name (for create and getByName)
			{
				displayName: 'Secret Name',
				name: PARAMS.SECRET_NAME,
				type: 'string',
				default: '',
				required: true,
				placeholder: 'my-secret',
				description: 'The name of the secret',
				displayOptions: {
					show: {
						resource: [RESOURCES.SECRET],
						operation: [SECRET_OPERATIONS.CREATE],
					},
				},
			},

			// Secret Name for payload getByName
			{
				displayName: 'Secret Name',
				name: PARAMS.SECRET_NAME,
				type: 'string',
				default: '',
				required: true,
				placeholder: 'my-secret',
				description: 'The name of the secret',
				displayOptions: {
					show: {
						resource: [RESOURCES.PAYLOAD],
						operation: [PAYLOAD_OPERATIONS.GET_BY_NAME],
					},
				},
			},

			// Folder ID for payload getByName
			{
				displayName: 'Folder ID',
				name: PARAMS.FOLDER_ID,
				type: 'string',
				default: '',
				placeholder: 'b1gXXXXXXXXXXXXXXXXX',
				description:
					'The ID of the folder. If not specified, the folder ID from credentials will be used.',
				displayOptions: {
					show: {
						resource: [RESOURCES.PAYLOAD],
						operation: [PAYLOAD_OPERATIONS.GET_BY_NAME],
					},
				},
			},

			// Description
			{
				displayName: 'Description',
				name: PARAMS.DESCRIPTION,
				type: 'string',
				default: '',
				placeholder: 'My secret description',
				description: 'The description of the secret',
				displayOptions: {
					show: {
						resource: [RESOURCES.SECRET],
						operation: [SECRET_OPERATIONS.CREATE],
					},
				},
			},

			// Deletion Protection
			{
				displayName: 'Deletion Protection',
				name: PARAMS.DELETION_PROTECTION,
				type: 'boolean',
				default: false,
				description: 'Whether to enable deletion protection for the secret',
				displayOptions: {
					show: {
						resource: [RESOURCES.SECRET],
						operation: [SECRET_OPERATIONS.CREATE],
					},
				},
			},

			// Payload Entries (for create)
			{
				displayName: 'Payload Entries',
				name: PARAMS.PAYLOAD_ENTRIES,
				placeholder: 'Add Entry',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				options: [
					{
						name: 'entries',
						displayName: 'Entry',
						values: [
							{
								displayName: 'Key',
								name: 'key',
								type: 'string',
								default: '',
								required: true,
								placeholder: 'api_key',
								description: 'The key name for the payload entry',
							},
							{
								displayName: 'Value Type',
								name: 'valueType',
								type: 'options',
								options: [
									{
										name: 'Text',
										value: 'text',
									},
									{
										name: 'Binary',
										value: 'binary',
									},
								],
								default: 'text',
								description: 'Whether the value is text or binary',
							},
							{
								displayName: 'Text Value',
								name: 'textValue',
								type: 'string',
								default: '',
								displayOptions: {
									show: {
										valueType: ['text'],
									},
								},
								placeholder: 'my-secret-value',
								description: 'The text value for the payload entry',
							},
							{
								displayName: 'Binary Value (Base64)',
								name: 'binaryValue',
								type: 'string',
								default: '',
								displayOptions: {
									show: {
										valueType: ['binary'],
									},
								},
								placeholder: 'SGVsbG8gV29ybGQ=',
								description: 'The binary value as base64 string',
							},
						],
					},
				],
				displayOptions: {
					show: {
						resource: [RESOURCES.SECRET],
						operation: [SECRET_OPERATIONS.CREATE],
					},
				},
			},

			// Update Fields
			{
				displayName: 'Update Fields',
				name: 'updateFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: [RESOURCES.SECRET],
						operation: [SECRET_OPERATIONS.UPDATE],
					},
				},
				options: [
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
						placeholder: 'my-secret',
						description: 'The new name for the secret',
					},
					{
						displayName: 'Description',
						name: 'description',
						type: 'string',
						default: '',
						placeholder: 'Updated description',
						description: 'The new description for the secret',
					},
					{
						displayName: 'Deletion Protection',
						name: 'deletionProtection',
						type: 'boolean',
						default: false,
						description: 'Whether to enable deletion protection',
					},
					{
						displayName: 'Labels',
						name: 'labels',
						placeholder: 'Add Label',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						options: [
							{
								name: 'labels',
								displayName: 'Label',
								values: [
									{
										displayName: 'Key',
										name: 'key',
										type: 'string',
										default: '',
										required: true,
									},
									{
										displayName: 'Value',
										name: 'value',
										type: 'string',
										default: '',
										required: true,
									},
								],
							},
						],
					},
				],
			},

			// Additional Fields (for create)
			{
				displayName: 'Additional Fields',
				name: PARAMS.ADDITIONAL_FIELDS,
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: [RESOURCES.SECRET],
						operation: [SECRET_OPERATIONS.CREATE],
					},
				},
				options: [
					{
						displayName: 'Labels',
						name: 'labels',
						placeholder: 'Add Label',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						options: [
							{
								name: 'labels',
								displayName: 'Label',
								values: [
									{
										displayName: 'Key',
										name: 'key',
										type: 'string',
										default: '',
										required: true,
									},
									{
										displayName: 'Value',
										name: 'value',
										type: 'string',
										default: '',
										required: true,
									},
								],
							},
						],
					},
					{
						displayName: 'KMS Key ID',
						name: 'kmsKeyId',
						type: 'string',
						default: '',
						placeholder: 'abjXXXXXXXXXXXXXXXXX',
						description: 'The KMS key ID for encrypting the secret',
					},
					{
						displayName: 'Version Description',
						name: 'versionDescription',
						type: 'string',
						default: '',
						placeholder: 'Initial version',
						description: 'The description for the initial version',
					},
				],
			},

			// Pagination
			{
				displayName: 'Return All',
				name: PARAMS.RETURN_ALL,
				type: 'boolean',
				default: false,
				description: 'Whether to return all results or only up to a given limit',
				displayOptions: {
					show: {
						resource: [RESOURCES.SECRET, RESOURCES.VERSION],
						operation: [SECRET_OPERATIONS.LIST, VERSION_OPERATIONS.LIST],
					},
				},
			},
			{
				displayName: 'Limit',
				name: PARAMS.LIMIT,
				type: 'number',
				default: 50,
				description: 'Max number of results to return',
				typeOptions: {
					minValue: 1,
				},
				displayOptions: {
					show: {
						resource: [RESOURCES.SECRET, RESOURCES.VERSION],
						operation: [SECRET_OPERATIONS.LIST, VERSION_OPERATIONS.LIST],
						returnAll: [false],
					},
				},
			},

			// ==========================================
			// VERSION PARAMETERS
			// ==========================================

			// Version ID (Resource Locator)
			{
				displayName: 'Version',
				name: PARAMS.VERSION_ID,
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'loadVersions',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'e6qXXXXXXXXXXXXXXXXX',
					},
				],
				displayOptions: {
					show: {
						resource: [RESOURCES.VERSION],
						operation: [
							VERSION_OPERATIONS.SCHEDULE_DESTRUCTION,
							VERSION_OPERATIONS.CANCEL_DESTRUCTION,
						],
					},
				},
			},

			// Version ID (optional for payload)
			{
				displayName: 'Version',
				name: PARAMS.VERSION_ID,
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'loadVersions',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'e6qXXXXXXXXXXXXXXXXX',
					},
				],
				displayOptions: {
					show: {
						resource: [RESOURCES.PAYLOAD],
						operation: [PAYLOAD_OPERATIONS.GET, PAYLOAD_OPERATIONS.GET_BY_NAME],
					},
				},
				description: 'The version ID. If not specified, the current version will be used.',
			},

			// Version Description
			{
				displayName: 'Version Description',
				name: PARAMS.VERSION_DESCRIPTION,
				type: 'string',
				default: '',
				placeholder: 'New version',
				description: 'The description for the new version',
				displayOptions: {
					show: {
						resource: [RESOURCES.VERSION],
						operation: [VERSION_OPERATIONS.ADD],
					},
				},
			},

			// Payload Entries (for add version)
			{
				displayName: 'Payload Entries',
				name: PARAMS.PAYLOAD_ENTRIES,
				placeholder: 'Add Entry',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				options: [
					{
						name: 'entries',
						displayName: 'Entry',
						values: [
							{
								displayName: 'Key',
								name: 'key',
								type: 'string',
								default: '',
								required: true,
								placeholder: 'api_key',
								description: 'The key name for the payload entry',
							},
							{
								displayName: 'Value Type',
								name: 'valueType',
								type: 'options',
								options: [
									{
										name: 'Text',
										value: 'text',
									},
									{
										name: 'Binary',
										value: 'binary',
									},
								],
								default: 'text',
								description: 'Whether the value is text or binary',
							},
							{
								displayName: 'Text Value',
								name: 'textValue',
								type: 'string',
								default: '',
								displayOptions: {
									show: {
										valueType: ['text'],
									},
								},
								placeholder: 'my-secret-value',
								description: 'The text value for the payload entry',
							},
							{
								displayName: 'Binary Value (Base64)',
								name: 'binaryValue',
								type: 'string',
								default: '',
								displayOptions: {
									show: {
										valueType: ['binary'],
									},
								},
								placeholder: 'SGVsbG8gV29ybGQ=',
								description: 'The binary value as base64 string',
							},
						],
					},
				],
				displayOptions: {
					show: {
						resource: [RESOURCES.VERSION],
						operation: [VERSION_OPERATIONS.ADD],
					},
				},
			},

			// Additional Fields (for add version)
			{
				displayName: 'Additional Fields',
				name: PARAMS.ADDITIONAL_FIELDS,
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: [RESOURCES.VERSION],
						operation: [VERSION_OPERATIONS.ADD],
					},
				},
				options: [
					{
						displayName: 'Base Version ID',
						name: 'baseVersionId',
						type: 'string',
						default: '',
						placeholder: 'e6qXXXXXXXXXXXXXXXXX',
						description: 'The base version ID. If not specified, the current version will be used.',
					},
				],
			},

			// Additional Fields (for schedule destruction)
			{
				displayName: 'Additional Fields',
				name: PARAMS.ADDITIONAL_FIELDS,
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: [RESOURCES.VERSION],
						operation: [VERSION_OPERATIONS.SCHEDULE_DESTRUCTION],
					},
				},
				options: [
					{
						displayName: 'Pending Period',
						name: 'pendingPeriod',
						type: 'string',
						default: '604800s',
						placeholder: '604800s',
						description: 'The pending period before destruction (e.g., "604800s" for 7 days)',
					},
				],
			},
		],
	};

	methods = {
		listSearch: {
			loadSecrets,
			loadVersions,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter(PARAMS.RESOURCE, 0) as string;
		const operation = this.getNodeParameter(PARAMS.OPERATION, 0) as string;

		// Get credentials and create clients once
		const credentials = await this.getCredentials('yandexCloudAuthorizedApi');
		const { secretClient, payloadClient } = createLockboxClients(credentials);

		// ==========================================
		// SECRET OPERATIONS
		// ==========================================
		if (resource === RESOURCES.SECRET) {
			// Handle list operation (returns immediately with all results)
			if (operation === SECRET_OPERATIONS.LIST) {
				const results = await executeSecretOperation(
					{ executeFunctions: this, secretClient, payloadClient, itemIndex: 0 },
					operation,
				);
				return [results as INodeExecutionData[]];
			}

			// Per-item operations
			for (let i = 0; i < items.length; i++) {
				try {
					const result = await executeSecretOperation(
						{ executeFunctions: this, secretClient, payloadClient, itemIndex: i },
						operation,
					);
					returnData.push(result as INodeExecutionData);
				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({
							json: { error: (error as Error).message, success: false },
							pairedItem: { item: i },
						});
						continue;
					}
					throw error;
				}
			}
		}

		// ==========================================
		// VERSION OPERATIONS
		// ==========================================
		if (resource === RESOURCES.VERSION) {
			// Handle list operation (returns immediately with all results)
			if (operation === VERSION_OPERATIONS.LIST) {
				const results = await executeVersionOperation(
					{ executeFunctions: this, secretClient, payloadClient, itemIndex: 0 },
					operation,
				);
				return [results as INodeExecutionData[]];
			}

			// Per-item operations
			for (let i = 0; i < items.length; i++) {
				try {
					const result = await executeVersionOperation(
						{ executeFunctions: this, secretClient, payloadClient, itemIndex: i },
						operation,
					);
					returnData.push(result as INodeExecutionData);
				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({
							json: { error: (error as Error).message, success: false },
							pairedItem: { item: i },
						});
						continue;
					}
					throw error;
				}
			}
		}

		// ==========================================
		// PAYLOAD OPERATIONS
		// ==========================================
		if (resource === RESOURCES.PAYLOAD) {
			// All payload operations are per-item
			for (let i = 0; i < items.length; i++) {
				try {
					const result = await executePayloadOperation(
						{ executeFunctions: this, secretClient, payloadClient, itemIndex: i },
						operation,
					);
					returnData.push(result as INodeExecutionData);
				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({
							json: { error: (error as Error).message, success: false },
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
