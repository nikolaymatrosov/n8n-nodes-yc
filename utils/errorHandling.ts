import { NodeApiError, NodeOperationError, type INode } from 'n8n-workflow';

/**
 * Creates a standardized NodeOperationError with consistent messaging.
 *
 * @param node - The node instance
 * @param message - The error message
 * @param description - Optional error description
 * @returns NodeOperationError instance
 *
 * @example
 * ```typescript
 * throw createOperationError(
 *   this.getNode(),
 *   'Failed to parse configuration',
 *   'Check your JSON syntax'
 * );
 * ```
 */
export function createOperationError(
	node: INode,
	message: string,
	description?: string,
): NodeOperationError {
	if (description) {
		return new NodeOperationError(node, message, { description });
	}
	return new NodeOperationError(node, message);
}

/**
 * Creates a standardized NodeApiError with consistent messaging.
 *
 * @param node - The node instance
 * @param message - The error message
 * @param description - Optional error description
 * @param additionalData - Additional error data to include
 * @returns NodeApiError instance
 *
 * @example
 * ```typescript
 * throw createApiError(
 *   this.getNode(),
 *   'API request failed',
 *   'Check your credentials and try again',
 *   { statusCode: 401 }
 * );
 * ```
 */
export function createApiError(
	node: INode,
	message: string,
	description?: string,
	additionalData?: Record<string, any>,
): NodeApiError {
	const errorData: Record<string, any> = {
		message,
		...(description && { description }),
		...additionalData,
	};

	return new NodeApiError(node, errorData as any);
}

/**
 * Wraps a function call with standardized error handling.
 * Converts any thrown errors into NodeOperationError or NodeApiError.
 *
 * @param node - The node instance
 * @param fn - The function to execute
 * @param errorMessage - Error message prefix
 * @param errorType - Type of error to throw: 'operation' or 'api'
 * @returns Promise with the function result
 *
 * @example
 * ```typescript
 * const result = await withErrorHandling(
 *   this.getNode(),
 *   () => client.send(new ListBucketsCommand({})),
 *   'Failed to list buckets',
 *   'operation'
 * );
 * ```
 */
export async function withErrorHandling<T>(
	node: INode,
	fn: () => Promise<T>,
	errorMessage: string,
	errorType: 'operation' | 'api' = 'operation',
): Promise<T> {
	try {
		return await fn();
	} catch (error) {
		const fullMessage = `${errorMessage}: ${(error as Error).message}`;

		if (errorType === 'operation') {
			throw createOperationError(node, fullMessage);
		} else {
			throw createApiError(
				node,
				fullMessage,
				'Please check your credentials and configuration',
			);
		}
	}
}

/**
 * Extracts error message from various error types.
 * Handles Error objects, string messages, and unknown error types.
 *
 * @param error - The error to extract message from
 * @returns The error message string
 *
 * @example
 * ```typescript
 * try {
 *   // ... some code
 * } catch (error) {
 *   const message = extractErrorMessage(error);
 *   console.log(message);
 * }
 * ```
 */
export function extractErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	if (typeof error === 'string') {
		return error;
	}

	if (error && typeof error === 'object' && 'message' in error) {
		return String(error.message);
	}

	return 'Unknown error occurred';
}

/**
 * Validates that required fields are present in an object.
 * Throws NodeOperationError if any required field is missing.
 *
 * @param data - The object to validate
 * @param requiredFields - Array of required field names
 * @param node - The node instance for error context
 * @param entityName - Name of the entity being validated (for error message)
 *
 * @example
 * ```typescript
 * validateRequiredFields(
 *   { name: 'test' },
 *   ['name', 'id'],
 *   this.getNode(),
 *   'User'
 * );
 * // Throws: "User validation failed: Missing required field 'id'"
 * ```
 */
export function validateRequiredFields(
	data: Record<string, any>,
	requiredFields: string[],
	node: INode,
	entityName: string = 'Object',
): void {
	const missingFields: string[] = [];

	for (const field of requiredFields) {
		if (data[field] === undefined || data[field] === null || data[field] === '') {
			missingFields.push(field);
		}
	}

	if (missingFields.length > 0) {
		throw createOperationError(
			node,
			`${entityName} validation failed: Missing required field${missingFields.length > 1 ? 's' : ''}: ${missingFields.map((f) => `'${f}'`).join(', ')}`,
		);
	}
}
