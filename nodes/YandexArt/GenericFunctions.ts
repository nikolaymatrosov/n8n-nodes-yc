/**
 * Generic helper functions for YandexCloudYandexART node
 */

import { imageGenerationService } from '@yandex-cloud/nodejs-sdk/dist/clients/ai-foundation_models-v1/index';
import { operation, operationService } from '@yandex-cloud/nodejs-sdk/dist/clients/operation/index';
import { ImageGenerationResponse } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/ai/foundation_models/v1/image_generation/image_generation_service';
import { createYandexSession } from '@utils/authUtils';
import { YandexCloudSdkError } from '@utils/sdkErrorHandling';
import { withSdkErrorHandling } from '@utils/errorHandling';
import type { IIAmCredentials } from './types';
import { NodeOperationError } from 'n8n-workflow';
import type { INode } from 'n8n-workflow';

/**
 * Creates ImageGenerationAsyncService gRPC client
 */
export function createImageGenerationClient(credentials: IIAmCredentials) {
	const session = createYandexSession(credentials);

	// Create client for Foundation Models Image Generation API
	// Endpoint: llm.api.cloud.yandex.net:443
	const client = session.client(
		imageGenerationService.ImageGenerationAsyncServiceClient,
		'llm.api.cloud.yandex.net:443',
	);

	return client;
}

/**
 * Creates OperationService gRPC client for polling operation status
 */
export function createOperationClient(credentials: IIAmCredentials) {
	const session = createYandexSession(credentials);
	const client = session.client(operationService.OperationServiceClient);
	return client;
}

/**
 * Polls operation until completion or timeout
 * @param operationClient - OperationService client
 * @param operationId - ID of the operation to poll
 * @param pollInterval - Interval between polls in milliseconds (default: 2000)
 * @param maxWaitTime - Maximum time to wait in milliseconds (default: 300000)
 * @param node - Node instance for error reporting
 * @returns Completed operation object
 * @throws Error if operation fails or times out
 */
export async function pollOperationUntilDone(
	operationClient: ReturnType<typeof createOperationClient>,
	operationId: string,
	pollInterval: number = 2000,
	maxWaitTime: number = 300000,
	node: INode,
): Promise<operation.Operation> {
	const startTime = Date.now();
	let pollCount = 0;

	while (Date.now() - startTime < maxWaitTime) {
		pollCount++;

		try {
			const operation = await withSdkErrorHandling(
				node,
				() => operationClient.get({ operationId }),
				'poll operation status',
			);

			if (operation.done) {
				// Check if operation completed with error
				if (operation.error) {
					const errorMessage = operation.error.message || 'Unknown error';
					const errorCode = operation.error.code || 'UNKNOWN';
					throw new NodeOperationError(
						node,
						`Image generation failed: ${errorMessage} (code: ${errorCode})`,
					);
				}

				// Operation completed successfully
				return operation;
			}

			// Operation still in progress, wait before next poll
			await new Promise((resolve) => setTimeout(resolve, pollInterval));
		} catch (error) {
			// If it's already a custom error, rethrow it
			if (error instanceof YandexCloudSdkError || error instanceof NodeOperationError) {
				throw error;
			}

			// Otherwise, wrap the error
			throw new NodeOperationError(
				node,
				`Failed to poll operation status: ${(error as Error).message}`,
			);
		}
	}

	// Operation timed out
	const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
	throw new NodeOperationError(
		node,
		`Image generation timed out after ${elapsedSeconds} seconds (${pollCount} polls). Operation ID: ${operationId}. You can check the operation status manually using this ID.`,
	);
}

/**
 * Extracts ImageGenerationResponse from Operation.response
 * The response is packed as google.protobuf.Any and needs to be decoded
 * @param operation - Completed operation object
 * @param node - Node instance for error reporting
 * @returns Object containing image buffer and model version
 */
export function extractImageResponse(
	operation: operation.Operation,
	node: INode,
): { image: Buffer; modelVersion: string } {
	if (!operation.response) {
		throw new NodeOperationError(
			node,
			'Operation completed but no response data found. This may indicate an issue with the API response format.',
		);
	}

	try {
		// The response is packed as google.protobuf.Any with typeUrl and value
		// typeUrl: "type.googleapis.com/yandex.cloud.ai.foundation_models.v1.image_generation.ImageGenerationResponse"
		// value: Buffer containing the serialized ImageGenerationResponse

		// Decode the protobuf Any type to get ImageGenerationResponse
		if (!operation.response.value) {
			throw new NodeOperationError(
				node,
				'No value found in operation response. The image generation may have failed.',
			);
		}

		// Decode the value buffer using ImageGenerationResponse.decode()
		const imageResponse = ImageGenerationResponse.decode(operation.response.value);

		if (!imageResponse.image) {
			throw new NodeOperationError(
				node,
				'No image data found in operation response. The image generation may have failed.',
			);
		}

		// Convert to Buffer if it's a Uint8Array
		const imageBuffer =
			imageResponse.image instanceof Buffer
				? imageResponse.image
				: Buffer.from(imageResponse.image);

		return {
			image: imageBuffer,
			modelVersion: imageResponse.modelVersion || 'unknown',
		};
	} catch (error) {
		if (error instanceof NodeOperationError) {
			throw error;
		}

		throw new NodeOperationError(
			node,
			`Failed to extract image from operation response: ${error.message}`,
		);
	}
}

/**
 * Builds model URI from folder ID and model name
 * @param folderId - Yandex Cloud folder ID
 * @param modelName - Model name (default: "yandex-art/latest")
 * @returns Model URI in format "art://{folderId}/{modelName}"
 */
export function buildModelUri(folderId: string, modelName: string = 'yandex-art/latest'): string {
	return `art://${folderId}/${modelName}`;
}

/**
 * Gets file extension for a given MIME type
 * @param mimeType - MIME type (e.g., "image/jpeg")
 * @returns File extension without dot (e.g., "jpeg")
 */
export function getFileExtensionFromMimeType(mimeType: string): string {
	const mimeToExt: Record<string, string> = {
		'image/jpeg': 'jpeg',
		'image/jpg': 'jpg',
		'image/png': 'png',
	};

	return mimeToExt[mimeType.toLowerCase()] || 'bin';
}

/**
 * Truncates prompt text to maximum length without cutting words mid-way
 * @param prompt - The prompt text to truncate
 * @param maxLength - Maximum length (default: 500)
 * @returns Truncated text that doesn't exceed maxLength and ends at word boundary
 */
export function truncatePrompt(prompt: string, maxLength: number = 500): string {
	// If prompt is within limit, return as-is
	if (prompt.length <= maxLength) {
		return prompt;
	}

	// Find the last space before maxLength to avoid cutting words
	const truncated = prompt.substring(0, maxLength);
	const lastSpaceIndex = truncated.lastIndexOf(' ');

	// If no space found, return full truncated string (single long word)
	if (lastSpaceIndex === -1) {
		return truncated;
	}

	// Return text up to last complete word
	return truncated.substring(0, lastSpaceIndex);
}
