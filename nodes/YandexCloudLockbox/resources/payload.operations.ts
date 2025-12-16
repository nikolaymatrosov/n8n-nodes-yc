import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { withSdkErrorHandling } from '@utils/sdkErrorHandling';
import type { IOperationContext, OperationResult, PayloadClientType } from '../types';
import { PAYLOAD_OPERATIONS, PARAMS } from '../types';
import { GetPayloadRequest } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/lockbox/v1/payload_service';

/**
 * Execute a payload operation based on the operation type
 */
export async function executePayloadOperation(
	context: IOperationContext,
	operation: string,
): Promise<OperationResult> {
	const { executeFunctions, payloadClient, itemIndex } = context;

	switch (operation) {
		case PAYLOAD_OPERATIONS.GET:
			return await getPayload(executeFunctions, payloadClient, itemIndex);
		default:
			throw new NodeOperationError(
				executeFunctions.getNode(),
				`Unknown payload operation: ${operation}`,
			);
	}
}

/**
 * Get payload for a secret/version
 */
async function getPayload(
	executeFunctions: IExecuteFunctions,
	client: PayloadClientType,
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

	// Get optional version ID
	const versionId = executeFunctions.getNodeParameter(PARAMS.VERSION_ID, i, '', {
		extractValue: true,
	}) as string;

	const requestData: any = {
		secretId,
	};

	// Add version ID if provided (otherwise uses current version)
	if (versionId) {
		requestData.versionId = versionId;
	}

	const request = GetPayloadRequest.fromJSON(requestData);

	const response = await withSdkErrorHandling(
		executeFunctions.getNode(),
		() => client.get(request),
		'get payload',
		i,
	) as any;

	// Convert entries to a more user-friendly format
	const entries: Record<string, string> = {};
	if (response?.entries) {
		for (const [key, value] of Object.entries(response.entries)) {
			// Check if value is a Buffer/Uint8Array
			if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
				// Convert binary to base64 string
				entries[key] = Buffer.from(value).toString('base64');
			} else {
				// Already a string
				entries[key] = value as string;
			}
		}
	}

	return {
		json: {
			secretId: response?.secretId,
			versionId: response?.versionId,
			entries,
		},
		pairedItem: { item: i },
	};
}
