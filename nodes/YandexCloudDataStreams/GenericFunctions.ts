import { ListStreamsCommand } from '@aws-sdk/client-kinesis';
import { createKinesisClient } from '@utils/awsClientFactory';
import { createResourceLoader, parseStaticApiCredentials } from '@utils/resourceLocator';

// Re-export for backward compatibility
export { createKinesisClient };

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
export const loadStreams = createResourceLoader({
	credentialType: 'yandexCloudStaticApi',
	clientFactory: createKinesisClient,
	resourceFetcher: async (client) => {
		const response = await client.send(new ListStreamsCommand({}));
		return response.StreamNames || [];
	},
	resourceMapper: (streamName: string) => {
		// Extract just the stream name from full path for display
		const displayName = streamName.split('/').pop() || streamName;
		return {
			name: displayName,
			value: streamName,
		};
	},
	errorMessage: 'Failed to list streams',
	errorType: 'operation',
	credentialParser: parseStaticApiCredentials,
});

