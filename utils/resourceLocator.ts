import type {
	ICredentialDataDecryptedObject,
	ILoadOptionsFunctions,
	INodeListSearchResult,
	INodeListSearchItems,
} from 'n8n-workflow';
import { NodeOperationError, NodeApiError } from 'n8n-workflow';

/**
 * Resource item mapping function type
 */
export type ResourceMapper<TResource> = (resource: TResource) => INodeListSearchItems;

/**
 * Client factory function type
 */
export type ClientFactory<TClient, TCredentials> = (credentials: TCredentials) => TClient;

/**
 * Resource list fetcher function type
 */
export type ResourceFetcher<TClient, TResource> = (
	client: TClient,
	context: ILoadOptionsFunctions,
) => Promise<TResource[]>;

/**
 * Error type for resource locator
 */
export type ResourceLocatorErrorType = 'operation' | 'api';

/**
 * Options for creating a resource loader
 */
export interface IResourceLoaderOptions<TClient, TCredentials, TResource> {
	/** Credential type name (e.g., 'yandexCloudStaticApi') */
	credentialType: string;
	/** Function to create a client from credentials */
	clientFactory: ClientFactory<TClient, TCredentials>;
	/** Function to fetch resources using the client */
	resourceFetcher: ResourceFetcher<TClient, TResource>;
	/** Function to map resource to { name, value } format */
	resourceMapper: ResourceMapper<TResource>;
	/** Error message prefix for failures */
	errorMessage?: string;
	/** Type of error to throw */
	errorType?: ResourceLocatorErrorType;
	/** Custom credential parser function */
	credentialParser?: (credentials: ICredentialDataDecryptedObject) => TCredentials;
}

/**
 * Creates a generic resource loader function for n8n resource locators.
 * This factory function standardizes the pattern of listing resources (buckets, streams, queues, etc.)
 * with filtering support.
 *
 * @param options - Configuration options for the resource loader
 * @returns A function that can be used as a resource locator in n8n nodes
 *
 * @example
 * ```typescript
 * // Example: Create a bucket loader for S3
 * export const loadBuckets = createResourceLoader({
 *   credentialType: 'yandexCloudStaticApi',
 *   clientFactory: (creds) => createS3Client(creds),
 *   resourceFetcher: async (client) => {
 *     const response = await client.send(new ListBucketsCommand({}));
 *     return response.Buckets || [];
 *   },
 *   resourceMapper: (bucket) => ({
 *     name: bucket.Name!,
 *     value: bucket.Name!,
 *   }),
 *   errorMessage: 'Failed to list buckets',
 * });
 * ```
 */
export function createResourceLoader<TClient, TCredentials, TResource>(
	options: IResourceLoaderOptions<TClient, TCredentials, TResource>,
): (this: ILoadOptionsFunctions, filter?: string) => Promise<INodeListSearchResult> {
	const {
		credentialType,
		clientFactory,
		resourceFetcher,
		resourceMapper,
		errorMessage = 'Failed to load resources',
		errorType = 'operation',
		credentialParser,
	} = options;

	return async function (
		this: ILoadOptionsFunctions,
		filter?: string,
	): Promise<INodeListSearchResult> {
		try {
			// Get credentials
			const rawCredentials = await this.getCredentials(credentialType);

			// Parse credentials if custom parser provided
			const credentials = credentialParser
				? credentialParser(rawCredentials)
				: (rawCredentials as unknown as TCredentials);

			// Create client
			const client = clientFactory(credentials);

			// Fetch resources
			const resources = await resourceFetcher(client, this);

			// Map resources to { name, value } format
			let results = resources.map(resourceMapper);

			// Apply filter if provided
			if (filter) {
				const filterLower = filter.toLowerCase();
				results = results.filter(
					(item) =>
						item.name.toLowerCase().includes(filterLower) ||
						item.value.toString().toLowerCase().includes(filterLower),
				);
			}

			return { results };
		} catch (error) {
			const errorMsg = `${errorMessage}: ${(error as Error).message}`;

			if (errorType === 'operation') {
				throw new NodeOperationError(this.getNode(), errorMsg);
			} else {
				throw new NodeApiError(this.getNode(), {
					message: errorMsg,
					description: 'Please check your credentials and configuration',
				});
			}
		}
	};
}

/**
 * Default credential parser for AWS SDK-compatible services (Static API credentials)
 */
export function parseStaticApiCredentials(
	credentials: ICredentialDataDecryptedObject,
): { accessKeyId: string; secretAccessKey: string } {
	return {
		accessKeyId: credentials.accessKeyId as string,
		secretAccessKey: credentials.secretAccessKey as string,
	};
}
