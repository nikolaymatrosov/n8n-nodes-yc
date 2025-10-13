import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

export class YandexCloudPostbox implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Yandex Cloud Postbox',
		name: 'yandexCloudPostbox',
		icon: 'file:Postbox.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Send emails using Yandex Cloud Postbox via AWS SDK',
		defaults: {
			name: 'Yandex Cloud Postbox',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'yandexCloudStatic',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Email',
						value: 'email',
					},
				],
				default: 'email',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['email'],
					},
				},
				options: [
					{
						name: 'Send',
						value: 'send',
						description: 'Send an email',
						action: 'Send an email',
					},
				],
				default: 'send',
			},
			{
				displayName: 'From Email',
				name: 'fromEmail',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['email'],
						operation: ['send'],
					},
				},
				default: '',
				placeholder: 'noreply@yourdomain.com',
				description: 'Email address of the sender. Domain must be verified in Yandex Cloud Postbox.',
			},
			{
				displayName: 'To Email',
				name: 'toEmail',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['email'],
						operation: ['send'],
					},
				},
				default: '',
				placeholder: 'recipient@example.com',
				description: 'Email address of the recipient. Multiple addresses can be separated by commas.',
			},
			{
				displayName: 'Subject',
				name: 'subject',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['email'],
						operation: ['send'],
					},
				},
				default: '',
				placeholder: 'Email subject',
				description: 'Subject line of the email',
			},
			{
				displayName: 'HTML Body',
				name: 'htmlBody',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['email'],
						operation: ['send'],
					},
				},
				typeOptions: {
					rows: 5,
				},
				default: '',
				placeholder: '<h1>Hello</h1><p>Email content</p>',
				description: 'HTML version of the email body',
			},
			{
				displayName: 'Text Body',
				name: 'textBody',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['email'],
						operation: ['send'],
					},
				},
				typeOptions: {
					rows: 5,
				},
				default: '',
				placeholder: 'Plain text email content',
				description: 'Plain text version of the email body for clients without HTML support',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		// Get credentials
		const credentials = await this.getCredentials('yandexCloudStatic');

		// Create SES client
		const client = new SESv2Client({
			region: 'ru-central1',
			endpoint: 'https://postbox.cloud.yandex.net',
			credentials: {
				accessKeyId: credentials.accessKeyId as string,
				secretAccessKey: credentials.secretAccessKey as string,
			},
		});

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'email' && operation === 'send') {
					const fromEmail = this.getNodeParameter('fromEmail', i) as string;
					const toEmail = this.getNodeParameter('toEmail', i) as string;
					const subject = this.getNodeParameter('subject', i) as string;
					const htmlBody = this.getNodeParameter('htmlBody', i) as string;
					const textBody = this.getNodeParameter('textBody', i) as string;

					// Parse recipients (support comma-separated emails)
					const recipients = toEmail
						.split(',')
						.map((email) => email.trim())
						.filter((email) => email.length > 0);

					// Build email parameters
					const params = {
						Destination: {
							ToAddresses: recipients,
						},
						Content: {
							Simple: {
								Subject: {
									Charset: 'UTF-8',
									Data: subject,
								},
								Body: {
									Html: {
										Charset: 'UTF-8',
										Data: htmlBody,
									},
									Text: {
										Charset: 'UTF-8',
										Data: textBody,
									},
								},
							},
						},
						FromEmailAddress: fromEmail,
					};

					// Create and send command
					const command = new SendEmailCommand(params);
					const response = await client.send(command);

					returnData.push({
						json: {
							messageId: response.MessageId,
							success: true,
							from: fromEmail,
							to: recipients,
							subject,
						},
						pairedItem: { item: i },
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
							success: false,
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}

