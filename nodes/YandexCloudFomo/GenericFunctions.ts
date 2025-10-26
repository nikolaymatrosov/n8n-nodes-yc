import type {
	IExecuteSingleFunctions,
	IN8nHttpFullResponse,
	INodeExecutionData,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export async function sendErrorPostReceive(
	this: IExecuteSingleFunctions,
	data: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	if (String(response.statusCode).startsWith('4') || String(response.statusCode).startsWith('5')) {
		// Extract error details from the response
		const errorBody = response.body as any;
		let errorMessage = `HTTP ${response.statusCode} error`;

		// Try to extract a more specific error message from the response body
		if (errorBody) {
			if (typeof errorBody === 'string') {
				errorMessage = errorBody;
			} else if (errorBody.error) {
				// Yandex Cloud API often returns errors in this format
				errorMessage = typeof errorBody.error === 'string'
					? errorBody.error
					: errorBody.error.message || JSON.stringify(errorBody.error);
			} else if (errorBody.message) {
				errorMessage = errorBody.message;
			} else if (errorBody.details) {
				errorMessage = errorBody.details;
			}
		}

		// Add context about the request
		const url = (response as any).request?.url || 'unknown endpoint';
		const method = (response as any).request?.method || 'unknown method';

		throw new NodeApiError(this.getNode(), response as unknown as JsonObject, {
			message: `${errorMessage} (${method} ${url})`,
			description: `Status Code: ${response.statusCode}. ${typeof errorBody === 'object' ? JSON.stringify(errorBody, null, 2) : errorBody || 'No error details available'}`,
		});
	}
	return data;
}

