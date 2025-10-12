import type {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class YandexCloudPostboxApi implements ICredentialType {
	name = 'yandexCloudPostboxApi';

	displayName = 'Yandex Cloud Postbox API';

	documentationUrl = 'https://yandex.cloud/ru/docs/postbox/quickstart';

	properties: INodeProperties[] = [
		{
			displayName: 'Access Key ID',
			name: 'accessKeyId',
			type: 'string',
			required: true,
			default: '',
			description: 'The static access key ID for Yandex Cloud',
		},
		{
			displayName: 'Secret Access Key',
			name: 'secretAccessKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description: 'The secret access key for Yandex Cloud',
		},
	];
}

