import type { INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { chatFields, chatOperations } from './ChatDescription';

export class YandexCloudGpt implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Yandex Cloud GPT',
		name: 'yandexCloudGpt',
		group: ['transform'],
		icon: { light: 'file:fomo.svg', dark: 'file:fomo.dark.svg' },
		version: [1, 1.1],
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Consume Yandex Cloud Foundation Models API',
		defaults: {
			name: 'Yandex Cloud GPT',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'yandexCloudGptApi',
				required: true,
			},
		],
		requestDefaults: {
			ignoreHttpStatusErrors: true,
			baseURL: '={{ $credentials.url ?? "https://llm.api.cloud.yandex.net/v1" }}',
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Chat',
						value: 'chat',
					},
				],
				default: 'chat',
			},

			...chatOperations,
			...chatFields,
		],
	};
}

