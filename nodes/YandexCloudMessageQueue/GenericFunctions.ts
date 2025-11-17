import { ListQueuesCommand } from '@aws-sdk/client-sqs';
import { createSQSClient } from '@utils/awsClientFactory';
import { createResourceLoader, parseStaticApiCredentials } from '@utils/resourceLocator';

export const loadQueues = createResourceLoader({
	credentialType: 'yandexCloudStaticApi',
	clientFactory: createSQSClient,
	resourceFetcher: async (client) => {
		const response = await client.send(new ListQueuesCommand({}));
		return response.QueueUrls || [];
	},
	resourceMapper: (queueUrl: string) => {
		// Extract queue name from URL (last part after /)
		const queueName = queueUrl.split('/').pop() || queueUrl;
		return {
			name: queueName,
			value: queueUrl,
		};
	},
	errorMessage: 'Failed to list queues',
	errorType: 'operation',
	credentialParser: parseStaticApiCredentials,
});

