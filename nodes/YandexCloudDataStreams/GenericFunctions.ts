import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { KinesisClient, ListStreamsCommand } from '@aws-sdk/client-kinesis';

/**
 * Creates and configures a Kinesis client for Yandex Data Streams
 */
export function createKinesisClient(credentials: {
	accessKeyId: string;
	secretAccessKey: string;
}): KinesisClient {
	return new KinesisClient({
		region: 'ru-central1',
		endpoint: 'https://yds.serverless.yandexcloud.net',
		credentials: {
			accessKeyId: credentials.accessKeyId,
			secretAccessKey: credentials.secretAccessKey,
		},
	});
}

/**
 * Formats a stream name to full path if necessary
 * Full format: /ru-central1/{cloudId}/{databaseId}/{streamName}
 */
export function formatStreamName(
	streamName: string,
	cloudId?: string,
	databaseId?: string,
): string {
	// If already in full format, return as-is
	if (streamName.startsWith('/')) {
		return streamName;
	}

	// If cloudId and databaseId provided, construct full path
	if (cloudId && databaseId) {
		return `/ru-central1/${cloudId}/${databaseId}/${streamName}`;
	}

	// Otherwise return as-is (assume it's already a full path or will be handled)
	return streamName;
}

/**
 * Load streams for resource locator
 */
export async function loadStreams(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const credentials = await this.getCredentials('yandexCloudStaticApi');

	const client = createKinesisClient({
		accessKeyId: credentials.accessKeyId as string,
		secretAccessKey: credentials.secretAccessKey as string,
	});

	try {
		const response = await client.send(new ListStreamsCommand({}));

		if (!response.StreamNames || response.StreamNames.length === 0) {
			return { results: [] };
		}

		let results = response.StreamNames.map((streamName: string) => {
			// Extract just the stream name from full path for display
			const displayName = streamName.split('/').pop() || streamName;
			return {
				name: displayName,
				value: streamName,
			};
		});

		// Filter results if search filter is provided
		if (filter) {
			const filterLower = filter.toLowerCase();
			results = results.filter(
				(stream: { name: string; value: string }) =>
					stream.name.toLowerCase().includes(filterLower) ||
					stream.value.toLowerCase().includes(filterLower),
			);
		}

		return { results };
	} catch (error) {
		throw new NodeOperationError(
			this.getNode(),
			`Failed to list streams: ${error.message}`,
		);
	}
}

