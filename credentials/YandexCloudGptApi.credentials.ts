import type {
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IHttpRequestOptions,
	INodeProperties,
} from 'n8n-workflow';

export class YandexCloudGptApi implements ICredentialType {
	name = 'yandexCloudGptApi';

	displayName = 'Yandex Cloud GPT API (OpenAI-Compatible) API';

	documentationUrl = 'https://yandex.cloud/ru/docs/ai-studio/concepts/openai-compatibility';

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
			default: 'https://llm.api.cloud.yandex.net/v1',
			description: 'Override the default base URL for the API',
		},
		{
			displayName: 'Disable Data Logging',
			name: 'disableDataLogging',
			type: 'boolean',
			default: false,
			description: 'Whether to disable logging of request data to Yandex Cloud. When enabled, request data will not be logged.',
		},
	];

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials?.url}}',
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

		// Add x-data-logging-enabled header if disabled
		if (credentials.disableDataLogging === true) {
			requestOptions.headers['x-data-logging-enabled'] = 'false';
		}

		return requestOptions;
	}
}

