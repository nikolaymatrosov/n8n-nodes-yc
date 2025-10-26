import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import OpenAI from 'openai';

import { getProxyAgent } from '@utils/httpProxyAgent';

export async function searchModels(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const credentials = await this.getCredentials('yandexCloudFomoApi');
	// Use the OpenAI-compatible endpoint to list models (needs /v1 for OpenAI SDK)
	const baseURL = `${(credentials.url as string) || 'https://llm.api.cloud.yandex.net'}/v1`;

	const openai = new OpenAI({
		baseURL,
		apiKey: credentials.apiKey as string,
		defaultHeaders: {
			'x-folder-id': credentials.folderId as string,
		},
		httpAgent: getProxyAgent(baseURL),
	} as any);

	try {
		const { data: models = [] } = await openai.models.list();

		const filteredModels = models.filter((model: { id: string }) => {
			const id = model.id.toLowerCase();
			if (!filter) return true;
			return id.includes(filter.toLowerCase());
		});

		filteredModels.sort((a, b) => a.id.localeCompare(b.id));

		return {
			results: filteredModels.map((model: { id: string }) => ({
				name: model.id,
				value: model.id,
			})),
		};
	} catch (error) {
		// If the API endpoint doesn't support listing, return some default models
		const defaultModels = [
			{ name: 'gpt://{{folderId}}/yandexgpt/latest', value: 'yandexgpt/latest' },
			{ name: 'gpt://{{folderId}}/yandexgpt-lite/latest', value: 'yandexgpt-lite/latest' },
			{ name: 'gpt://{{folderId}}/summarization/latest', value: 'summarization/latest' },
		];

		const filteredModels = filter
			? defaultModels.filter((model) =>
					model.value.toLowerCase().includes(filter.toLowerCase()),
			  )
			: defaultModels;

		return {
			results: filteredModels,
		};
	}
}

