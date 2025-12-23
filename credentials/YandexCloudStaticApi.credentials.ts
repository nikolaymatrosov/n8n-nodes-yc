import type { Icon, ICredentialType, INodeProperties } from 'n8n-workflow';

export class YandexCloudStaticApi implements ICredentialType {
	name = 'yandexCloudStaticApi';

	icon = `file:IAM.svg` as Icon;

	displayName = 'Yandex Cloud Static Access Key API';

	documentationUrl = 'https://yandex.cloud/ru/docs/iam/concepts/authorization/access-key';

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
