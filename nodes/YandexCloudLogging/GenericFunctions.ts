import type {
	ICredentialDataDecryptedObject,
	IDataObject,
	ILoadOptionsFunctions,
	INode,
	INodeListSearchResult,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import { Session } from '@yandex-cloud/nodejs-sdk';
import { camelCase, mapKeys } from 'lodash';
import type { IServiceAccountJson } from './types';
import {
	LogEntry,
	LogLevel_Level,
} from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/logging/v1/log_entry';
import { logGroupService } from '@yandex-cloud/nodejs-sdk/dist/clients/logging-v1';

/**
 * Parse service account JSON from credentials
 * Handles both snake_case and camelCase formats
 */
export function parseServiceAccountJson(jsonString: string): IServiceAccountJson {
	try {
		const parsed = JSON.parse(jsonString);
		const camelCased = mapKeys(parsed, (_value, key) => camelCase(key));

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
 * Validate service account credentials
 */
export function validateServiceAccountJson(credentials: IServiceAccountJson, node: INode): void {
	if (!credentials.serviceAccountId) {
		throw new NodeApiError(node, {
			message: 'Service Account ID is missing in credentials',
			description: 'Please check your Yandex Cloud credentials configuration',
		});
	}

	if (!credentials.accessKeyId) {
		throw new NodeApiError(node, {
			message: 'Access Key ID is missing in credentials',
			description: 'Please check your Yandex Cloud credentials configuration',
		});
	}

	if (!credentials.privateKey) {
		throw new NodeApiError(node, {
			message: 'Private Key is missing in credentials',
			description: 'Please check your Yandex Cloud credentials configuration',
		});
	}
}

/**
 * Create Yandex Cloud SDK session
 */
export function createSession(serviceAccountJson: IServiceAccountJson): Session {
	return new Session({ serviceAccountJson });
}

/**
 * Parse log level string to LogLevel enum
 */
export function parseLogLevel(level?: string): LogLevel_Level {
	if (!level) {
		return LogLevel_Level.LEVEL_UNSPECIFIED;
	}

	const upperLevel = level.toUpperCase();
	// LogLevel is an object with { level?: LogLevel_Level }
	// We need to map string to LogLevel_Level enum

	switch (upperLevel) {
		case 'TRACE':
			return LogLevel_Level.TRACE;
		case 'DEBUG':
			return LogLevel_Level.DEBUG;
		case 'INFO':
			return LogLevel_Level.INFO;
		case 'WARN':
			return LogLevel_Level.WARN;
		case 'ERROR':
			return LogLevel_Level.ERROR;
		case 'FATAL':
			return LogLevel_Level.FATAL;
		default:
			return LogLevel_Level.LEVEL_UNSPECIFIED;
	}
}

/**
 * Format timestamp for API
 */
export function formatTimestamp(timestamp?: string | Date): Date | undefined {
	if (!timestamp) {
		return undefined;
	}

	if (timestamp instanceof Date) {
		return timestamp;
	}

	const parsed = new Date(timestamp);
	if (isNaN(parsed.getTime())) {
		return undefined;
	}

	return parsed;
}

/**
 * Load log groups for resource locator dropdown
 */
export async function loadLogGroups(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const credentials = (await this.getCredentials(
		'yandexCloudAuthorizedApi',
	)) as ICredentialDataDecryptedObject;

	// Parse and validate credentials
	const serviceAccountJson = parseServiceAccountJson(credentials.serviceAccountJson as string);
	validateServiceAccountJson(serviceAccountJson, this.getNode());

	// Get folder ID from credentials
	const folderId = credentials.folderId as string;
	if (!folderId) {
		throw new NodeApiError(this.getNode(), {
			message: 'Folder ID is missing in credentials',
			description: 'Please add Folder ID to your Yandex Cloud credentials',
		});
	}

	try {
		// Create session
		const session = createSession(serviceAccountJson);

		// Create client
		const client = session.client(logGroupService.LogGroupServiceClient);

		// List log groups
		const response = await client.list({
			folderId,
			pageSize: 1000,
			pageToken: '',
			filter: '',
		});

		let results = (response.groups as any[]).map((group: any) => ({
			name: `${group.name} (${group.id})`,
			value: group.id,
		}));

		// Apply filter if provided
		if (filter) {
			const filterLower = filter.toLowerCase();
			results = results.filter(
				(item) =>
					item.name.toLowerCase().includes(filterLower) ||
					item.value.toLowerCase().includes(filterLower),
			);
		}

		return { results };
	} catch (error) {
		throw new NodeApiError(this.getNode(), {
			message: `Failed to load log groups: ${(error as Error).message}`,
			description: 'Please check your credentials and folder ID',
		});
	}
}

/**
 * Convert log entry object to JSON payload
 */
export function parseJsonPayload(payload: any): Record<string, any> | undefined {
	if (!payload) {
		return undefined;
	}

	if (typeof payload === 'string') {
		try {
			return JSON.parse(payload);
		} catch {
			return { data: payload };
		}
	}

	if (typeof payload === 'object') {
		return payload as Record<string, any>;
	}

	return { data: String(payload) };
}

export function humanReadableLogLevel(entry: LogEntry): IDataObject {
	let level = LogLevel_Level[entry.level || LogLevel_Level.LEVEL_UNSPECIFIED].toString();

	return {
		...entry,
		level,
	} as any;
}
