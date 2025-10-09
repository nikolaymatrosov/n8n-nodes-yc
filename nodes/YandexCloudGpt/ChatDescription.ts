import type { INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { sendErrorPostReceive } from './GenericFunctions';

export const chatOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['chat'],
			},
		},
		options: [
			{
				name: 'Complete',
				value: 'complete',
				action: 'Create a completion',
				description: 'Create a completion for a given prompt',
				routing: {
					request: {
						method: 'POST',
						url: '/completions',
					},
					output: { postReceive: [sendErrorPostReceive] },
				},
			},
		],
		default: 'complete',
	},
];

const completeOperations: INodeProperties[] = [
	{
		displayName: 'Model URI',
		name: 'modelUri',
		type: 'string',
		description: 'The model URI in format: gpt://{folder_id}/{model_name}',
		displayOptions: {
			show: {
				operation: ['complete'],
				resource: ['chat'],
			},
		},
		default: 'gpt://{{$credentials.folderId}}/yandexgpt/latest',
		placeholder: 'e.g. gpt://b1g2345example/yandexgpt/latest',
		routing: {
			send: {
				type: 'body',
				property: 'modelUri',
			},
		},
	},
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'fixedCollection',
		typeOptions: {
			sortable: true,
			multipleValues: true,
		},
		displayOptions: {
			show: {
				resource: ['chat'],
				operation: ['complete'],
			},
		},
		placeholder: 'Add Message',
		default: {},
		options: [
			{
				displayName: 'Messages',
				name: 'messages',
				values: [
					{
						displayName: 'Role',
						name: 'role',
						type: 'options',
						options: [
							{
								name: 'Assistant',
								value: 'assistant',
							},
							{
								name: 'System',
								value: 'system',
							},
							{
								name: 'User',
								value: 'user',
							},
						],
						default: 'user',
					},
					{
						displayName: 'Text',
						name: 'text',
						type: 'string',
						default: '',
						typeOptions: {
							rows: 2,
						},
					},
				],
			},
		],
		routing: {
			send: {
				type: 'body',
				property: 'completionOptions.messages',
				value: '={{ $value.messages }}',
			},
		},
	},
];

const sharedOperations: INodeProperties[] = [
	{
		displayName: 'Simplify',
		name: 'simplifyOutput',
		type: 'boolean',
		default: true,
		displayOptions: {
			show: {
				operation: ['complete'],
				resource: ['chat'],
			},
		},
		routing: {
			output: {
				postReceive: [
					{
						type: 'set',
						enabled: '={{$value}}',
						properties: {
							value: '={{ { "data": [$response.body.result] } }}',
						},
					},
					{
						type: 'rootProperty',
						enabled: '={{$value}}',
						properties: {
							property: 'data',
						},
					},
					async function (items: INodeExecutionData[]): Promise<INodeExecutionData[]> {
						if (this.getNode().parameters.simplifyOutput === false) {
							return items;
						}
						return items.map((item) => {
							const alternatives = (item.json as any).alternatives || [];
							return {
								json: {
									...item.json,
									text: alternatives[0]?.message?.text || '',
									message: alternatives[0]?.message,
								},
							};
						});
					},
				],
			},
		},
		description: 'Whether to return a simplified version of the response instead of the raw data',
	},

	{
		displayName: 'Options',
		name: 'options',
		placeholder: 'Add option',
		description: 'Additional options to add',
		type: 'collection',
		default: {},
		displayOptions: {
			show: {
				operation: ['complete'],
				resource: ['chat'],
			},
		},
		options: [
			{
				displayName: 'Stream',
				name: 'stream',
				type: 'boolean',
				description: 'Whether to stream the response',
				default: false,
				routing: {
					send: {
						type: 'body',
						property: 'completionOptions.stream',
					},
				},
			},
			{
				displayName: 'Temperature',
				name: 'temperature',
				default: 0.6,
				typeOptions: { maxValue: 1, minValue: 0, numberPrecision: 1 },
				description:
					'Controls randomness: Lowering results in less random completions. As the temperature approaches zero, the model will become deterministic and repetitive.',
				type: 'number',
				routing: {
					send: {
						type: 'body',
						property: 'completionOptions.temperature',
					},
				},
			},
			{
				displayName: 'Max Tokens',
				name: 'maxTokens',
				default: 2000,
				description: 'The maximum number of tokens to generate in the completion',
				type: 'number',
				typeOptions: {
					maxValue: 8000,
				},
				routing: {
					send: {
						type: 'body',
						property: 'completionOptions.maxTokens',
					},
				},
			},
		],
	},
];

export const chatFields: INodeProperties[] = [
	/* -------------------------------------------------------------------------- */
	/*                               chat:complete                                */
	/* -------------------------------------------------------------------------- */
	...completeOperations,

	/* -------------------------------------------------------------------------- */
	/*                                chat:ALL                                    */
	/* -------------------------------------------------------------------------- */
	...sharedOperations,
];

