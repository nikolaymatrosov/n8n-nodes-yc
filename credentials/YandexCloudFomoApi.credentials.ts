import type {
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IHttpRequestOptions,
	INodeProperties,
} from 'n8n-workflow';

export class YandexCloudFomoApi implements ICredentialType {
	name = 'yandexCloudFomoApi';

	displayName = 'Yandex Cloud Foundation Models API';

	documentationUrl = 'https://yandex.cloud/en/docs/foundation-models/';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description: 'The API key for Yandex Cloud',
		},
		{
			displayName: 'Folder ID',
			name: 'folderId',
			type: 'string',
			required: true,
			default: '',
			description: 'The Yandex Cloud folder ID',
		},
		{
			displayName: 'Base URL',
			name: 'url',
			type: 'string',
			default: 'https://llm.api.cloud.yandex.net',
			description: 'Override the default base URL for the API',
		},
	];

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://llm.api.cloud.yandex.net/v1',
			url: '/models',
			method: 'GET',
		},
	};

	async authenticate(
		credentials: ICredentialDataDecryptedObject,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		requestOptions.headers ??= {};

		requestOptions.headers['Authorization'] = `Api-Key ${credentials.apiKey}`;
		requestOptions.headers['x-folder-id'] = credentials.folderId as string;

		return requestOptions;
	}
}

