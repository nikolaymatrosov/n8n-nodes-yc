import type { INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { chatFields, chatOperations } from './ChatDescription';
import { searchModels } from './methods/loadModels';

export class YandexCloudFomo implements INodeType {
	methods = {
		listSearch: {
			searchModels,
		},
	};

	description: INodeTypeDescription = {
		displayName: 'Yandex Cloud Foundation Models',
		name: 'yandexCloudFomo',
		group: ['transform'],
		icon: { light: 'file:fomo.svg', dark: 'file:fomo.dark.svg' },
		version: [1, 1.1],
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Consume Yandex Cloud Foundation Models API',
		defaults: {
			name: 'Yandex Cloud Foundation Models',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'yandexCloudFomoApi',
				required: true,
			},
		],
		requestDefaults: {
			ignoreHttpStatusErrors: true,
			baseURL: '={{ $credentials.url ?? "https://llm.api.cloud.yandex.net" }}',
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

