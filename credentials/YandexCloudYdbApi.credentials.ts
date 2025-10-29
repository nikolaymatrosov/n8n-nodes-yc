import type {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class YandexCloudYdbApi implements ICredentialType {
	name = 'yandexCloudYdbApi';

	displayName = 'Yandex Cloud YDB API';

	documentationUrl = 'https://yandex.cloud/ru/docs/ydb/';

	properties: INodeProperties[] = [
		{
			displayName: 'Service Account JSON',
			name: 'serviceAccountJson',
			type: 'string',
			typeOptions: {
				password: true,
				rows: 5,
			},
			required: true,
			default: '',
			description: 'Service account key JSON from Yandex Cloud. Supports both snake_case and camelCase formats.',
			placeholder: '{"id": "ajek6t...", "service_account_id": "aje69k...", "private_key": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"}',
		},
		{
			displayName: 'Endpoint',
			name: 'endpoint',
			type: 'string',
			required: true,
			default: 'grpcs://ydb.serverless.yandexcloud.net:2135',
			description: 'YDB endpoint URL',
			placeholder: 'grpcs://ydb.serverless.yandexcloud.net:2135',
		},
		{
			displayName: 'Database',
			name: 'database',
			type: 'string',
			required: true,
			default: '',
			description: 'YDB database path (e.g., /ru-central1/b1gxxxxxxxxxx/etnxxxxxxxxxx)',
			placeholder: '/ru-central1/b1g.../etn...',
		},
	];
}
