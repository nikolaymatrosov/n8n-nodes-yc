import { NodeOperationError, type INode } from 'n8n-workflow';
import { Session } from '@yandex-cloud/nodejs-sdk';
import { mapKeys, camelCase } from 'lodash';

/**
 * Interface for Yandex Cloud IAM credentials
 */
export interface IServiceAccountCredentials {
	serviceAccountId: string;
	accessKeyId: string;
	privateKey: string;
}

/**
 * Converts a Yandex Cloud service account key JSON to IServiceAccountCredentials format.
 * Handles both snake_case (Yandex Cloud format) and camelCase formats.
 *
 * @param jsonString - The service account JSON string
 * @returns Parsed and normalized credentials
 * @throws Error if JSON parsing fails
 *
 * @example
 * ```typescript
 * const credentials = parseServiceAccountJson('{"service_account_id":"sa-123","id":"key-456","private_key":"-----BEGIN..."}');
 * // Returns: { serviceAccountId: 'sa-123', accessKeyId: 'key-456', privateKey: '-----BEGIN...' }
 * ```
 */
export function parseServiceAccountJson(jsonString: string): IServiceAccountCredentials {
	try {
		const parsed = JSON.parse(jsonString);

		// Convert all keys to camelCase for consistent handling
		const camelCased = mapKeys(parsed, (_value, key) => camelCase(key));

		// Map the Yandex Cloud format to the expected format
		return {
			serviceAccountId: camelCased.serviceAccountId || '',
			accessKeyId: camelCased.id || camelCased.accessKeyId || '',
			privateKey: camelCased.privateKey || '',
		};
	} catch (error) {
		throw new Error(`Failed to parse service account JSON: ${(error as Error).message}`);
	}
}

/**
 * Validates service account credentials structure.
 * Always throws NodeOperationError if credentials are invalid.
 *
 * @param credentials - The credentials to validate
 * @param node - The node instance (or function returning node) for error context
 * @throws NodeOperationError if credentials are invalid
 *
 * @example
 * ```typescript
 * // In a node execute function
 * validateServiceAccountCredentials(credentials, this.getNode);
 * ```
 */
export function validateServiceAccountCredentials(
	credentials: IServiceAccountCredentials,
	node: INode | (() => INode),
): void {
	const nodeInstance = typeof node === 'function' ? node() : node;

	if (!credentials.serviceAccountId) {
		throw new NodeOperationError(
			nodeInstance,
			'Service Account ID (service_account_id) is required in the service account JSON',
		);
	}

	if (!credentials.accessKeyId) {
		throw new NodeOperationError(
			nodeInstance,
			'Access Key ID (id) is required in the service account JSON',
		);
	}

	if (!credentials.privateKey) {
		throw new NodeOperationError(
			nodeInstance,
			'Private Key (private_key) is required in the service account JSON',
		);
	}
}

/**
 * Creates a Yandex Cloud SDK session from service account credentials.
 *
 * @param serviceAccountJson - Parsed service account credentials
 * @returns Yandex Cloud SDK Session instance
 *
 * @example
 * ```typescript
 * const credentials = parseServiceAccountJson(jsonString);
 * const session = createYandexSession(credentials);
 * const client = session.client(SomeServiceClient);
 * ```
 */
export function createYandexSession(
	serviceAccountJson: IServiceAccountCredentials,
): Session {
	return new Session({ serviceAccountJson });
}
