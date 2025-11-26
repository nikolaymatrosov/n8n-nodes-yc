/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import type { Metadata } from 'nice-grpc';
import type { INode, JsonObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { removeCircularRefs } from 'n8n-workflow';

/**
 * Interface representing a Yandex Cloud SDK ApiError
 * Based on @yandex-cloud/nodejs-sdk error structure
 */
export interface ISdkApiError extends Error {
	metadata: Metadata;
	requestId?: string;
	serverTraceId?: string;
}

/**
 * Interface for operation errors from long-running operations
 */
export interface IOperationError {
	code?: number | string;
	message?: string;
	details?: any;
}

/**
 * Options for YandexCloudSdkError constructor
 */
export interface ISdkErrorOptions {
	message?: string;
	description?: string;
	operation?: string; // operation name for context
	runIndex?: number;
	itemIndex?: number;
	httpCode?: string;
}

/**
 * Top-level properties where an error message can be found in an SDK error response.
 * Order is important, precedence is from top to bottom
 * Based on NodeApiError key priority order
 */
const POSSIBLE_SDK_ERROR_MESSAGE_KEYS = [
	'cause',
	'error',
	'message',
	'msg',
	'description',
	'reason',
	'details',
	'errorMessage',
	'error_message',
	'text',
];

/**
 * Properties where a nested object can be found in an SDK error response.
 */
const POSSIBLE_NESTED_SDK_ERROR_KEYS = ['error', 'details', 'data', 'response'];

/**
 * Descriptive messages for common gRPC status codes
 * Based on https://grpc.github.io/grpc/core/md_doc_statuscodes.html
 */
const GRPC_STATUS_CODE_MESSAGES: { [key: string]: string } = {
	'1': 'Operation was cancelled',
	'2': 'Unknown error occurred',
	'3': 'Invalid argument provided - please check your parameters',
	'4': 'Operation deadline exceeded - the operation took too long',
	'5': 'Resource not found - the requested resource does not exist',
	'6': 'Resource already exists',
	'7': 'Permission denied - check your credentials and permissions',
	'8': 'Resource exhausted - quota exceeded or rate limit reached',
	'9': 'Precondition failed - the system is not in the required state',
	'10': 'Operation was aborted',
	'11': 'Operation attempted past the valid range',
	'12': 'Operation is not implemented or not supported',
	'13': 'Internal error - service failed to process your request',
	'14': 'Service is currently unavailable - try again later',
	'15': 'Data loss or corruption detected',
	'16': 'Authentication failed - please check your credentials',
};

/**
 * Type guard to check if an error is a Yandex Cloud SDK ApiError
 */
export function isSdkApiError(error: any): error is ISdkApiError {
	return (
		error instanceof Error &&
		'metadata' in error &&
		typeof error.metadata === 'object' &&
		error.metadata !== null
	);
}

/**
 * Type guard to check if an error is an operation error
 */
export function isOperationError(obj: any): obj is IOperationError {
	return (
		obj !== null &&
		typeof obj === 'object' &&
		('code' in obj || 'message' in obj || 'details' in obj)
	);
}

/**
 * Extracts error information from various SDK error structures
 */
export function extractSdkErrorInfo(error: any): {
	message: string;
	code?: string;
	requestId?: string;
	serverTraceId?: string;
	details?: any;
} {
	const info: {
		message: string;
		code?: string;
		requestId?: string;
		serverTraceId?: string;
		details?: any;
	} = {
		message: 'Unknown SDK error',
	};

	// Check if it's an SDK ApiError
	if (isSdkApiError(error)) {
		info.message = error.message || 'SDK API error';
		info.requestId = error.metadata?.get?.('x-request-id') as string | undefined;
		info.serverTraceId = error.metadata?.get?.('x-server-trace-id') as string | undefined;

		// Try to extract gRPC status code from metadata
		const grpcStatus = error.metadata?.get?.('grpc-status') as string | undefined;
		if (grpcStatus) {
			info.code = grpcStatus;
		}
	}
	// Check if it's a standard Error
	else if (error instanceof Error) {
		info.message = error.message;

		// Try to extract additional info from error object properties
		const errorObj = error as any;
		if (errorObj.code) {
			info.code = String(errorObj.code);
		}
		if (errorObj.details) {
			info.details = errorObj.details;
		}
	}
	// Handle plain object errors
	else if (typeof error === 'object' && error !== null) {
		// Search for message in various possible keys
		for (const key of POSSIBLE_SDK_ERROR_MESSAGE_KEYS) {
			if (error[key] && typeof error[key] === 'string') {
				info.message = error[key];
				break;
			}
		}

		// Extract code if available
		if (error.code !== undefined) {
			info.code = String(error.code);
		}

		// Extract details if available
		if (error.details) {
			info.details = error.details;
		}

		// Check nested objects for additional info
		for (const key of POSSIBLE_NESTED_SDK_ERROR_KEYS) {
			if (error[key] && typeof error[key] === 'object') {
				const nestedInfo = extractSdkErrorInfo(error[key]);
				if (nestedInfo.message !== 'Unknown SDK error') {
					info.message = nestedInfo.message;
					if (nestedInfo.code) info.code = nestedInfo.code;
					if (nestedInfo.requestId) info.requestId = nestedInfo.requestId;
					if (nestedInfo.serverTraceId) info.serverTraceId = nestedInfo.serverTraceId;
					if (nestedInfo.details) info.details = nestedInfo.details;
					break;
				}
			}
		}
	}

	return info;
}

/**
 * Class for instantiating errors from Yandex Cloud SDK operations.
 * Similar to NodeApiError but specifically designed for SDK errors.
 *
 * This class extends NodeOperationError and provides:
 * - Extraction of requestId and serverTraceId for support tickets
 * - gRPC status code mapping to user-friendly messages
 * - Handling of various SDK error structures
 * - Context information (operation name, item index, etc.)
 *
 * @example
 * ```typescript
 * try {
 *   await client.create(request);
 * } catch (error) {
 *   throw new YandexCloudSdkError(this.getNode(), error, {
 *     operation: 'create log group',
 *     itemIndex: i,
 *   });
 * }
 * ```
 */
export class YandexCloudSdkError extends NodeOperationError {
	requestId?: string;
	serverTraceId?: string;
	grpcCode?: string;

	constructor(
		node: INode,
		sdkError: ISdkApiError | Error | JsonObject,
		{ message, description, operation, runIndex, itemIndex, httpCode }: ISdkErrorOptions = {},
	) {
		// If it's already a YandexCloudSdkError, return it
		if (sdkError instanceof YandexCloudSdkError) {
			return sdkError;
		}

		// Extract error information
		const errorInfo = extractSdkErrorInfo(sdkError);

		// Build the error message
		let finalMessage = message || 'Yandex Cloud SDK error';
		if (operation) {
			finalMessage = `${finalMessage} in ${operation}`;
		}

		// Build the description with support information
		let finalDescription: string;

		// If custom description provided, use it directly
		if (description) {
			finalDescription = description;
		}
		// Otherwise, try to build from gRPC status code or error message
		else if (errorInfo.code && GRPC_STATUS_CODE_MESSAGES[errorInfo.code]) {
			finalDescription = GRPC_STATUS_CODE_MESSAGES[errorInfo.code];
			if (errorInfo.message && errorInfo.message !== 'Unknown SDK error') {
				finalDescription += `\n\nDetails: ${errorInfo.message}`;
			}
		}
		// Fall back to extracted error message
		else {
			finalDescription = errorInfo.message;
		}

		// Add support ticket information if available
		const supportInfo: string[] = [];
		if (errorInfo.requestId) {
			supportInfo.push(`Request ID: ${errorInfo.requestId}`);
		}
		if (errorInfo.serverTraceId) {
			supportInfo.push(`Trace ID: ${errorInfo.serverTraceId}`);
		}

		if (supportInfo.length > 0) {
			finalDescription += `\n\nFor support, reference: ${supportInfo.join(', ')}`;
		}

		// Call parent constructor
		super(node, finalMessage, {
			description: finalDescription,
			...(runIndex !== undefined && { runIndex }),
			...(itemIndex !== undefined && { itemIndex }),
		});

		// Remove circular references from error if it's an object
		if (typeof sdkError === 'object' && sdkError !== null) {
			removeCircularRefs(sdkError as JsonObject);
		}

		// Store SDK-specific properties
		this.requestId = errorInfo.requestId;
		this.serverTraceId = errorInfo.serverTraceId;
		this.grpcCode = errorInfo.code;

		// Store additional context
		if (errorInfo.details) {
			this.context = {
				...this.context,
				sdkDetails: errorInfo.details,
			};
		}

		// Add HTTP code if provided
		if (httpCode) {
			this.context = {
				...this.context,
				httpCode,
			};
		}
	}
}

/**
 * Handles operation errors from long-running Yandex Cloud operations
 *
 * @param node - The node instance
 * @param operation - The operation object containing potential error
 * @param operationName - Name of the operation for context
 * @throws YandexCloudSdkError if operation contains an error
 *
 * @example
 * ```typescript
 * const operation = await operationClient.get({ operationId });
 * handleOperationError(this.getNode(), operation, 'image generation');
 * ```
 */
export function handleOperationError(
	node: INode,
	operation: { error?: IOperationError | null },
	operationName: string,
): void {
	if (operation.error) {
		const errorCode = operation.error.code ? String(operation.error.code) : undefined;
		const errorMessage = operation.error.message || 'Unknown error';

		throw new YandexCloudSdkError(node, operation.error as any, {
			message: `${operationName} failed`,
			description: `${errorMessage}${errorCode ? ` (code: ${errorCode})` : ''}`,
			operation: operationName,
		});
	}
}

/**
 * Wrapper function for SDK calls with automatic error handling
 *
 * @param node - The node instance
 * @param fn - The async function to execute
 * @param operation - Name of the operation for context
 * @param itemIndex - Optional item index for batch operations
 * @returns Promise with the function result
 * @throws YandexCloudSdkError on failure
 *
 * @example
 * ```typescript
 * const response = await withSdkErrorHandling(
 *   this.getNode(),
 *   () => client.list({ folderId }),
 *   'list log groups',
 *   i
 * );
 * ```
 */
export async function withSdkErrorHandling<T>(
	node: INode,
	fn: () => Promise<T>,
	operation: string,
	itemIndex?: number,
): Promise<T> {
	try {
		return await fn();
	} catch (error) {
		throw new YandexCloudSdkError(node, error as Error, {
			operation,
			itemIndex,
		});
	}
}
