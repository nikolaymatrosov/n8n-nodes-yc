import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { withSdkErrorHandling } from '@utils/sdkErrorHandling';
import type { IOperationContext, OperationResult, IPayloadEntry, ILabelEntry } from '../types';
import { SECRET_OPERATIONS, PARAMS } from '../types';
import { parsePayloadEntries, formatSecretStatus } from '../GenericFunctions';

/**
 * Execute a secret operation based on the operation type
 */
export async function executeSecretOperation(
	context: IOperationContext,
	operation: string,
): Promise<OperationResult> {
	const { executeFunctions, secretClient, itemIndex } = context;

	switch (operation) {
		case SECRET_OPERATIONS.LIST:
			return await listSecrets(executeFunctions, secretClient, itemIndex);
		case SECRET_OPERATIONS.GET:
			return await getSecret(executeFunctions, secretClient, itemIndex);
		case SECRET_OPERATIONS.CREATE:
			return await createSecret(executeFunctions, secretClient, itemIndex);
		case SECRET_OPERATIONS.UPDATE:
			return await updateSecret(executeFunctions, secretClient, itemIndex);
		case SECRET_OPERATIONS.DELETE:
			return await deleteSecret(executeFunctions, secretClient, itemIndex);
		case SECRET_OPERATIONS.ACTIVATE:
			return await activateSecret(executeFunctions, secretClient, itemIndex);
		case SECRET_OPERATIONS.DEACTIVATE:
			return await deactivateSecret(executeFunctions, secretClient, itemIndex);
		default:
			throw new NodeOperationError(
				executeFunctions.getNode(),
				`Unknown secret operation: ${operation}`,
			);
	}
}

/**
 * List all secrets in a folder
 */
async function listSecrets(
	executeFunctions: IExecuteFunctions,
	client: any,
	i: number,
): Promise<INodeExecutionData[]> {
	const credentials = await executeFunctions.getCredentials('yandexCloudAuthorizedApi', i);
	const folderId =
		(executeFunctions.getNodeParameter(PARAMS.FOLDER_ID, i, '') as string) ||
		(credentials.folderId as string);

	if (!folderId) {
		throw new NodeOperationError(executeFunctions.getNode(), 'Folder ID is required', {
			itemIndex: i,
		});
	}

	const returnAll = executeFunctions.getNodeParameter(PARAMS.RETURN_ALL, i, false) as boolean;
	const limit = returnAll ? 0 : (executeFunctions.getNodeParameter(PARAMS.LIMIT, i, 50) as number);

	let allSecrets: any[] = [];
	let pageToken: string | undefined;

	do {
		const request: any = {
			folderId,
			pageSize: 1000,
			pageToken: pageToken || '',
		};

		const response = await withSdkErrorHandling(
			executeFunctions.getNode(),
			() => client.list(request),
			'list secrets',
			i,
		) as any;

		if (response.secrets && response.secrets.length > 0) {
			allSecrets = allSecrets.concat(response.secrets);
		}

		pageToken = returnAll ? response.nextPageToken : undefined;

		// Break if we have enough entries when not returning all
		if (!returnAll && allSecrets.length >= limit) {
			allSecrets = allSecrets.slice(0, limit);
			break;
		}
	} while (pageToken);

	// Return as separate items
	return allSecrets.map((secret) => ({
		json: {
			...secret,
			status: formatSecretStatus(secret.status),
		},
		pairedItem: { item: i },
	}));
}

/**
 * Get secret metadata by ID
 */
async function getSecret(
	executeFunctions: IExecuteFunctions,
	client: any,
	i: number,
): Promise<INodeExecutionData> {
	const secretId = executeFunctions.getNodeParameter(PARAMS.SECRET_ID, i, '', {
		extractValue: true,
	}) as string;

	if (!secretId) {
		throw new NodeOperationError(executeFunctions.getNode(), 'Secret ID is required', {
			itemIndex: i,
		});
	}

	const response = await withSdkErrorHandling(
		executeFunctions.getNode(),
		() => client.get({ secretId }),
		'get secret',
		i,
	) as any;

	return {
		json: {
			...(response || {}),
			status: formatSecretStatus(response?.status || 0),
		},
		pairedItem: { item: i },
	};
}

/**
 * Create a new secret with initial version
 */
async function createSecret(
	executeFunctions: IExecuteFunctions,
	client: any,
	i: number,
): Promise<INodeExecutionData> {
	const credentials = await executeFunctions.getCredentials('yandexCloudAuthorizedApi', i);
	const folderId =
		(executeFunctions.getNodeParameter(PARAMS.FOLDER_ID, i, '') as string) ||
		(credentials.folderId as string);

	if (!folderId) {
		throw new NodeOperationError(executeFunctions.getNode(), 'Folder ID is required', {
			itemIndex: i,
		});
	}

	const name = executeFunctions.getNodeParameter(PARAMS.SECRET_NAME, i) as string;
	const description = executeFunctions.getNodeParameter(PARAMS.DESCRIPTION, i, '') as string;
	const deletionProtection = executeFunctions.getNodeParameter(
		PARAMS.DELETION_PROTECTION,
		i,
		false,
	) as boolean;

	// Get payload entries
	const payloadEntriesData = executeFunctions.getNodeParameter(PARAMS.PAYLOAD_ENTRIES, i, {
		entries: [],
	}) as { entries: IPayloadEntry[] };
	const payloadEntries = payloadEntriesData.entries || [];

	if (payloadEntries.length === 0) {
		throw new NodeOperationError(
			executeFunctions.getNode(),
			'At least one payload entry is required',
			{ itemIndex: i },
		);
	}

	// Get additional fields
	const additionalFields = executeFunctions.getNodeParameter(PARAMS.ADDITIONAL_FIELDS, i, {}) as {
		labels?: { labels: ILabelEntry[] };
		kmsKeyId?: string;
		versionDescription?: string;
	};

	const request: any = {
		folderId,
		name,
		description,
		deletionProtection,
		versionPayloadEntries: parsePayloadEntries(payloadEntries),
	};

	// Add labels if provided
	if (additionalFields.labels?.labels && additionalFields.labels.labels.length > 0) {
		request.labels = {};
		for (const label of additionalFields.labels.labels) {
			request.labels[label.key] = label.value;
		}
	}

	// Add KMS key ID if provided
	if (additionalFields.kmsKeyId) {
		request.kmsKeyId = additionalFields.kmsKeyId;
	}

	// Add version description if provided
	if (additionalFields.versionDescription) {
		request.versionDescription = additionalFields.versionDescription;
	}

	const response = await withSdkErrorHandling(
		executeFunctions.getNode(),
		() => client.create(request),
		'create secret',
		i,
	) as any;

	return {
		json: {
			success: true,
			operation: 'create',
			secretId: response?.metadata?.secretId,
			versionId: response?.metadata?.versionId,
			operationId: response?.id,
			done: response?.done,
		},
		pairedItem: { item: i },
	};
}

/**
 * Update secret metadata
 */
async function updateSecret(
	executeFunctions: IExecuteFunctions,
	client: any,
	i: number,
): Promise<INodeExecutionData> {
	const secretId = executeFunctions.getNodeParameter(PARAMS.SECRET_ID, i, '', {
		extractValue: true,
	}) as string;

	if (!secretId) {
		throw new NodeOperationError(executeFunctions.getNode(), 'Secret ID is required', {
			itemIndex: i,
		});
	}

	const updateFields = executeFunctions.getNodeParameter('updateFields', i, {}) as {
		name?: string;
		description?: string;
		deletionProtection?: boolean;
		labels?: { labels: ILabelEntry[] };
	};

	const request: any = {
		secretId,
	};

	// Add fields to update
	if (updateFields.name) {
		request.name = updateFields.name;
	}

	if (updateFields.description !== undefined) {
		request.description = updateFields.description;
	}

	if (updateFields.deletionProtection !== undefined) {
		request.deletionProtection = updateFields.deletionProtection;
	}

	if (updateFields.labels?.labels && updateFields.labels.labels.length > 0) {
		request.labels = {};
		for (const label of updateFields.labels.labels) {
			request.labels[label.key] = label.value;
		}
	}

	const response = await withSdkErrorHandling(
		executeFunctions.getNode(),
		() => client.update(request),
		'update secret',
		i,
	) as any;

	return {
		json: {
			success: true,
			operation: 'update',
			secretId,
			operationId: response?.id,
			done: response?.done,
		},
		pairedItem: { item: i },
	};
}

/**
 * Delete a secret permanently
 */
async function deleteSecret(
	executeFunctions: IExecuteFunctions,
	client: any,
	i: number,
): Promise<INodeExecutionData> {
	const secretId = executeFunctions.getNodeParameter(PARAMS.SECRET_ID, i, '', {
		extractValue: true,
	}) as string;

	if (!secretId) {
		throw new NodeOperationError(executeFunctions.getNode(), 'Secret ID is required', {
			itemIndex: i,
		});
	}

	const response = await withSdkErrorHandling(
		executeFunctions.getNode(),
		() => client.delete({ secretId }),
		'delete secret',
		i,
	) as any;

	return {
		json: {
			success: true,
			operation: 'delete',
			secretId,
			operationId: response?.id,
			done: response?.done,
		},
		pairedItem: { item: i },
	};
}

/**
 * Activate a secret (INACTIVE → ACTIVE)
 */
async function activateSecret(
	executeFunctions: IExecuteFunctions,
	client: any,
	i: number,
): Promise<INodeExecutionData> {
	const secretId = executeFunctions.getNodeParameter(PARAMS.SECRET_ID, i, '', {
		extractValue: true,
	}) as string;

	if (!secretId) {
		throw new NodeOperationError(executeFunctions.getNode(), 'Secret ID is required', {
			itemIndex: i,
		});
	}

	const response = await withSdkErrorHandling(
		executeFunctions.getNode(),
		() => client.activate({ secretId }),
		'activate secret',
		i,
	) as any;

	return {
		json: {
			success: true,
			operation: 'activate',
			secretId,
			operationId: response?.id,
			done: response?.done,
		},
		pairedItem: { item: i },
	};
}

/**
 * Deactivate a secret (ACTIVE → INACTIVE)
 */
async function deactivateSecret(
	executeFunctions: IExecuteFunctions,
	client: any,
	i: number,
): Promise<INodeExecutionData> {
	const secretId = executeFunctions.getNodeParameter(PARAMS.SECRET_ID, i, '', {
		extractValue: true,
	}) as string;

	if (!secretId) {
		throw new NodeOperationError(executeFunctions.getNode(), 'Secret ID is required', {
			itemIndex: i,
		});
	}

	const response = await withSdkErrorHandling(
		executeFunctions.getNode(),
		() => client.deactivate({ secretId }),
		'deactivate secret',
		i,
	) as any;

	return {
		json: {
			success: true,
			operation: 'deactivate',
			secretId,
			operationId: response?.id,
			done: response?.done,
		},
		pairedItem: { item: i },
	};
}
