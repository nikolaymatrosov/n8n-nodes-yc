import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { secretService, payloadService } from '@yandex-cloud/nodejs-sdk/dist/clients/lockbox-v1/index';
import {
	parseServiceAccountJson,
	validateServiceAccountCredentials,
	createYandexSession,
} from '@utils/authUtils';
import { withSdkErrorHandling } from '@utils/sdkErrorHandling';
import type { IPayloadEntry } from './types';

/**
 * Create Lockbox service clients from credentials
 */
export function createLockboxClients(credentials: any): {
	secretClient: any;
	payloadClient: any;
} {
	const serviceAccountJson = parseServiceAccountJson(credentials.serviceAccountJson as string);
	const session = createYandexSession(serviceAccountJson);

	return {
		secretClient: session.client(secretService.SecretServiceClient),
		payloadClient: session.client(payloadService.PayloadServiceClient),
	};
}

/**
 * Load secrets for resource locator
 */
export async function loadSecrets(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const credentials = await this.getCredentials('yandexCloudAuthorizedApi');

	const serviceAccountJson = parseServiceAccountJson(credentials.serviceAccountJson as string);
	validateServiceAccountCredentials(serviceAccountJson, this.getNode());

	const session = createYandexSession(serviceAccountJson);
	const client = session.client(secretService.SecretServiceClient);

	const folderId = credentials.folderId as string;

	const response = await withSdkErrorHandling(
		this.getNode(),
		() =>
			client.list({
				folderId,
				pageSize: 1000,
				pageToken: '',
			}),
		'load secrets',
	) as any;

	let results = response.secrets.map((secret: any) => ({
		name: `${secret.name} (${secret.id})`,
		value: secret.id,
	}));

	// Apply filter if provided
	if (filter) {
		const filterLower = filter.toLowerCase();
		results = results.filter(
			(item: any) =>
				item.name.toLowerCase().includes(filterLower) ||
				item.value.toLowerCase().includes(filterLower),
		);
	}

	return { results };
}

/**
 * Load versions for a specific secret
 */
export async function loadVersions(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const credentials = await this.getCredentials('yandexCloudAuthorizedApi');

	const serviceAccountJson = parseServiceAccountJson(credentials.serviceAccountJson as string);
	validateServiceAccountCredentials(serviceAccountJson, this.getNode());

	const session = createYandexSession(serviceAccountJson);
	const client = session.client(secretService.SecretServiceClient);

	// Get secretId from node parameter
	let secretId = '';
	try {
		const secretIdParam = this.getNodeParameter('secretId', 0) as any;
		// Extract value from resource locator
		if (typeof secretIdParam === 'object' && secretIdParam.value) {
			secretId = secretIdParam.value;
		} else if (typeof secretIdParam === 'string') {
			secretId = secretIdParam;
		}
	} catch (error) {
		// Parameter might not be set yet
	}

	if (!secretId) {
		throw new NodeOperationError(this.getNode(), 'Secret ID is required to load versions');
	}

	const response = await withSdkErrorHandling(
		this.getNode(),
		() =>
			client.listVersions({
				secretId,
				pageSize: 1000,
				pageToken: '',
			}),
		'load versions',
	) as any;

	let results = response.versions.map((version: any) => ({
		name: `${version.description || 'Version'} (${version.id})`,
		value: version.id,
	}));

	// Apply filter if provided
	if (filter) {
		const filterLower = filter.toLowerCase();
		results = results.filter(
			(item: any) =>
				item.name.toLowerCase().includes(filterLower) ||
				item.value.toLowerCase().includes(filterLower),
		);
	}

	return { results };
}

/**
 * Parse payload entries from n8n format to SDK format
 */
export function parsePayloadEntries(entries: IPayloadEntry[]): Array<{
	key: string;
	textValue?: string;
	binaryValue?: Uint8Array;
}> {
	return entries.map((entry) => {
		if (entry.valueType === 'text') {
			return {
				key: entry.key,
				textValue: entry.textValue,
			};
		} else {
			// Convert base64 string to Uint8Array
			const binaryData = entry.binaryValue
				? Buffer.from(entry.binaryValue, 'base64')
				: Buffer.from('');
			return {
				key: entry.key,
				binaryValue: new Uint8Array(binaryData),
			};
		}
	});
}

/**
 * Format secret status enum to human-readable string
 */
export function formatSecretStatus(status: number): string {
	const statusMap: Record<number, string> = {
		0: 'UNSPECIFIED',
		1: 'CREATING',
		2: 'ACTIVE',
		3: 'INACTIVE',
	};
	return statusMap[status] || `UNKNOWN(${status})`;
}

/**
 * Format version status enum to human-readable string
 */
export function formatVersionStatus(status: number): string {
	const statusMap: Record<number, string> = {
		0: 'UNSPECIFIED',
		1: 'ACTIVE',
		2: 'SCHEDULED_FOR_DESTRUCTION',
	};
	return statusMap[status] || `UNKNOWN(${status})`;
}
