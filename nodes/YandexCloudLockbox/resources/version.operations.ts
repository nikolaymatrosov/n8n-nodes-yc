import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { withSdkErrorHandling } from '@utils/sdkErrorHandling';
import type { IOperationContext, OperationResult, IPayloadEntry } from '../types';
import { VERSION_OPERATIONS, PARAMS } from '../types';
import { parsePayloadEntries, formatVersionStatus } from '../GenericFunctions';

/**
 * Execute a version operation based on the operation type
 */
export async function executeVersionOperation(
	context: IOperationContext,
	operation: string,
): Promise<OperationResult> {
	const { executeFunctions, secretClient, itemIndex } = context;

	switch (operation) {
		case VERSION_OPERATIONS.LIST:
			return await listVersions(executeFunctions, secretClient, itemIndex);
		case VERSION_OPERATIONS.ADD:
			return await addVersion(executeFunctions, secretClient, itemIndex);
		case VERSION_OPERATIONS.SCHEDULE_DESTRUCTION:
			return await scheduleVersionDestruction(executeFunctions, secretClient, itemIndex);
		case VERSION_OPERATIONS.CANCEL_DESTRUCTION:
			return await cancelVersionDestruction(executeFunctions, secretClient, itemIndex);
		default:
			throw new NodeOperationError(
				executeFunctions.getNode(),
				`Unknown version operation: ${operation}`,
			);
	}
}

/**
 * List all versions of a secret
 */
async function listVersions(
	executeFunctions: IExecuteFunctions,
	client: any,
	i: number,
): Promise<INodeExecutionData[]> {
	const secretId = executeFunctions.getNodeParameter(PARAMS.SECRET_ID, i, '', {
		extractValue: true,
	}) as string;

	if (!secretId) {
		throw new NodeOperationError(executeFunctions.getNode(), 'Secret ID is required', {
			itemIndex: i,
		});
	}

	const returnAll = executeFunctions.getNodeParameter(PARAMS.RETURN_ALL, i, false) as boolean;
	const limit = returnAll ? 0 : (executeFunctions.getNodeParameter(PARAMS.LIMIT, i, 50) as number);

	let allVersions: any[] = [];
	let pageToken: string | undefined;

	do {
		const request: any = {
			secretId,
			pageSize: 1000,
			pageToken: pageToken || '',
		};

		const response = await withSdkErrorHandling(
			executeFunctions.getNode(),
			() => client.listVersions(request),
			'list versions',
			i,
		) as any;

		if (response.versions && response.versions.length > 0) {
			allVersions = allVersions.concat(response.versions);
		}

		pageToken = returnAll ? response.nextPageToken : undefined;

		// Break if we have enough entries when not returning all
		if (!returnAll && allVersions.length >= limit) {
			allVersions = allVersions.slice(0, limit);
			break;
		}
	} while (pageToken);

	// Return as separate items
	return allVersions.map((version) => ({
		json: {
			...version,
			status: formatVersionStatus(version.status),
		},
		pairedItem: { item: i },
	}));
}

/**
 * Add a new version to an existing secret
 */
async function addVersion(
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

	const description = executeFunctions.getNodeParameter(
		PARAMS.VERSION_DESCRIPTION,
		i,
		'',
	) as string;

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
		baseVersionId?: string;
	};

	const request: any = {
		secretId,
		description,
		payloadEntries: parsePayloadEntries(payloadEntries),
	};

	// Add base version ID if provided
	if (additionalFields.baseVersionId) {
		request.baseVersionId = additionalFields.baseVersionId;
	}

	const response = await withSdkErrorHandling(
		executeFunctions.getNode(),
		() => client.addVersion(request),
		'add version',
		i,
	) as any;

	return {
		json: {
			success: true,
			operation: 'addVersion',
			secretId,
			versionId: response?.metadata?.versionId,
			operationId: response?.id,
			done: response?.done,
		},
		pairedItem: { item: i },
	};
}

/**
 * Schedule a version for destruction
 */
async function scheduleVersionDestruction(
	executeFunctions: IExecuteFunctions,
	client: any,
	i: number,
): Promise<INodeExecutionData> {
	const secretId = executeFunctions.getNodeParameter(PARAMS.SECRET_ID, i, '', {
		extractValue: true,
	}) as string;
	const versionId = executeFunctions.getNodeParameter(PARAMS.VERSION_ID, i, '', {
		extractValue: true,
	}) as string;

	if (!secretId) {
		throw new NodeOperationError(executeFunctions.getNode(), 'Secret ID is required', {
			itemIndex: i,
		});
	}

	if (!versionId) {
		throw new NodeOperationError(executeFunctions.getNode(), 'Version ID is required', {
			itemIndex: i,
		});
	}

	// Get additional fields
	const additionalFields = executeFunctions.getNodeParameter(PARAMS.ADDITIONAL_FIELDS, i, {}) as {
		pendingPeriod?: string;
	};

	const request: any = {
		secretId,
		versionId,
	};

	// Add pending period if provided (e.g., "604800s" for 7 days)
	if (additionalFields.pendingPeriod) {
		request.pendingPeriod = additionalFields.pendingPeriod;
	}

	const response = await withSdkErrorHandling(
		executeFunctions.getNode(),
		() => client.scheduleVersionDestruction(request),
		'schedule version destruction',
		i,
	) as any;

	return {
		json: {
			success: true,
			operation: 'scheduleVersionDestruction',
			secretId,
			versionId,
			operationId: response?.id,
			done: response?.done,
		},
		pairedItem: { item: i },
	};
}

/**
 * Cancel scheduled version destruction
 */
async function cancelVersionDestruction(
	executeFunctions: IExecuteFunctions,
	client: any,
	i: number,
): Promise<INodeExecutionData> {
	const secretId = executeFunctions.getNodeParameter(PARAMS.SECRET_ID, i, '', {
		extractValue: true,
	}) as string;
	const versionId = executeFunctions.getNodeParameter(PARAMS.VERSION_ID, i, '', {
		extractValue: true,
	}) as string;

	if (!secretId) {
		throw new NodeOperationError(executeFunctions.getNode(), 'Secret ID is required', {
			itemIndex: i,
		});
	}

	if (!versionId) {
		throw new NodeOperationError(executeFunctions.getNode(), 'Version ID is required', {
			itemIndex: i,
		});
	}

	const request = {
		secretId,
		versionId,
	};

	const response = await withSdkErrorHandling(
		executeFunctions.getNode(),
		() => client.cancelVersionDestruction(request),
		'cancel version destruction',
		i,
	) as any;

	return {
		json: {
			success: true,
			operation: 'cancelVersionDestruction',
			secretId,
			versionId,
			operationId: response?.id,
			done: response?.done,
		},
		pairedItem: { item: i },
	};
}
