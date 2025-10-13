import type {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class YandexCloudApi implements ICredentialType {
	name = 'yandexCloudApi';

	displayName = 'Yandex Cloud API';

	documentationUrl = 'https://yandex.cloud/ru/docs/iam/concepts/authorization/service-account';

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
			description: 'Service account key JSON from Yandex Cloud. Paste the entire JSON content downloaded when creating a service account key. Supports both snake_case (from YC) and camelCase formats.',
			placeholder: '{"id": "ajek6t...", "service_account_id": "aje69k...", "private_key": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"}',
		},
		{
			displayName: 'Folder ID',
			name: 'folderId',
			type: 'string',
			required: false,
			default: '',
			description: 'Default folder ID (can be overridden in individual nodes)',
		},
	];
}

