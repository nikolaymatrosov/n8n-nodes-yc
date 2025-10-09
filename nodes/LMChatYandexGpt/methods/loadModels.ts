import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import OpenAI from 'openai';

import { getProxyAgent } from '@utils/httpProxyAgent';

export async function searchModels(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const credentials = await this.getCredentials('yandexCloudGptApi');
	const baseURL = (credentials.url as string) || 'https://api.studio.yandex-team.ru/v1';

	const openai = new OpenAI({
		baseURL,
		apiKey: credentials.apiKey as string,
		defaultHeaders: {
			'x-folder-id': credentials.folderId as string,
		},
		httpAgent: getProxyAgent(baseURL),
	} as any);
	const { data: models = [] } = await openai.models.list();

	const filteredModels = models.filter((model: { id: string }) => {
		const id = model.id.toLowerCase();
		if (!id.startsWith('gpt://')) return false;
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
}
