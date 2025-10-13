import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SQSClient, ListQueuesCommand } from '@aws-sdk/client-sqs';

export async function loadQueues(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const credentials = await this.getCredentials('yandexCloudStatic');

	// Create SQS client
	const client = new SQSClient({
		region: 'ru-central1',
		endpoint: 'https://message-queue.api.cloud.yandex.net',
		credentials: {
			accessKeyId: credentials.accessKeyId as string,
			secretAccessKey: credentials.secretAccessKey as string,
		},
	});

	try {
		// List all queues
		const response = await client.send(new ListQueuesCommand({}));

		if (!response.QueueUrls || response.QueueUrls.length === 0) {
			return { results: [] };
		}

		// Map queue URLs to list search results
		let results = response.QueueUrls.map((queueUrl) => {
			// Extract queue name from URL (last part after /)
			const queueName = queueUrl.split('/').pop() || queueUrl;
			return {
				name: queueName,
				value: queueUrl,
				url: queueUrl,
			};
		});

		// Filter results if search filter is provided
		if (filter) {
			const filterLower = filter.toLowerCase();
			results = results.filter(
				(queue) =>
					queue.name.toLowerCase().includes(filterLower) ||
					queue.value.toLowerCase().includes(filterLower),
			);
		}

		return { results };
	} catch (error) {
		throw new NodeOperationError(
			this.getNode(),
			`Failed to list queues: ${error.message}`,
		);
	}
}

