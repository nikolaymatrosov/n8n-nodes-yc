import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ILoadOptionsFunctions,
	INodePropertyOptions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { Session } from '@yandex-cloud/nodejs-sdk';
import { translationService } from '@yandex-cloud/nodejs-sdk/dist/clients/ai-translate-v2/index';
import { mapKeys, camelCase } from 'lodash';
import { YandexCloudSdkError, withSdkErrorHandling } from '@utils/sdkErrorHandling';

interface IIAmCredentials {
	serviceAccountId: string;
	accessKeyId: string;
	privateKey: string;
}

/**
 * Converts a Yandex Cloud service account key JSON to IIAmCredentials format
 */
function parseServiceAccountJson(jsonString: string): IIAmCredentials {
	const parsed = JSON.parse(jsonString);

	// Convert all keys to camelCase
	const camelCased = mapKeys(parsed, (_value, key) => camelCase(key));

	// Map the Yandex Cloud format to the expected format
	return {
		serviceAccountId: camelCased.serviceAccountId || '',
		accessKeyId: camelCased.id || camelCased.accessKeyId || '',
		privateKey: camelCased.privateKey || '',
	};
}

export class YandexCloudTranslate implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Yandex Cloud Translate',
		name: 'yandexCloudTranslate',
		icon: 'file:Translate.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Translate text using Yandex Cloud Translate',
		defaults: {
			name: 'Yandex Cloud Translate',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'yandexCloudAuthorizedApi',
				required: true,
			},
		],
		properties: [
			// Resource selector
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Text',
						value: 'text',
					},
					{
						name: 'Language',
						value: 'languages',
					},
				],
				default: 'text',
			},

			// Text Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['text'],
					},
				},
				options: [
					{
						name: 'Translate',
						value: 'translate',
						description: 'Translate text to target language',
						action: 'Translate text',
					},
					{
						name: 'Detect Language',
						value: 'detectLanguage',
						description: 'Detect the language of text',
						action: 'Detect language of text',
					},
				],
				default: 'translate',
			},

			// Languages Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['languages'],
					},
				},
				options: [
					{
						name: 'List',
						value: 'list',
						description: 'Get list of supported languages',
						action: 'List supported languages',
					},
				],
				default: 'list',
			},

			// Folder ID
			{
				displayName: 'Folder ID',
				name: 'folderId',
				type: 'string',
				default: '={{$credentials.folderId}}',
				description: 'Folder ID to use. Defaults to the folder ID from credentials. Required if not set in credentials.',
				hint: 'Leave empty to use folder ID from credentials',
			},

			// Translate: Texts input
			{
				displayName: 'Texts',
				name: 'texts',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				displayOptions: {
					show: {
						resource: ['text'],
						operation: ['translate'],
					},
				},
				default: '',
				required: true,
				placeholder: 'Hello world',
				description: 'Text to translate. For multiple texts, separate with newlines or use an expression returning an array.',
			},

			// Translate: Source Language
			{
				displayName: 'Source Language Name or ID',
				name: 'sourceLanguageCode',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'loadSourceLanguages',
					loadOptionsDependsOn: ['folderId'],
				},
				displayOptions: {
					show: {
						resource: ['text'],
						operation: ['translate'],
					},
				},
				default: '',
				description: 'Source language (leave empty for automatic detection). Choose from the list, or specify a language code using an <a href="https://docs.n8n.io/code/expressions/">expression</a>. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},

			// Translate: Target Language
			{
				displayName: 'Target Language Name or ID',
				name: 'targetLanguageCode',
				type: 'options',
				required: true,
				typeOptions: {
					loadOptionsMethod: 'loadTargetLanguages',
					loadOptionsDependsOn: ['folderId'],
				},
				displayOptions: {
					show: {
						resource: ['text'],
						operation: ['translate'],
					},
				},
				default: 'en',
				description: 'Target language. Choose from the list, or specify a language code using an <a href="https://docs.n8n.io/code/expressions/">expression</a>. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},

			// Translate: Additional Options
			{
				displayName: 'Additional Options',
				name: 'additionalOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						resource: ['text'],
						operation: ['translate'],
					},
				},
				options: [
					{
						displayName: 'Format',
						name: 'format',
						type: 'options',
						options: [
							{
								name: 'Plain Text',
								value: 'PLAIN_TEXT',
							},
							{
								name: 'HTML',
								value: 'HTML',
							},
						],
						default: 'PLAIN_TEXT',
						description: 'Format of the text to translate',
					},
					{
						displayName: 'Enable Spell Checker',
						name: 'speller',
						type: 'boolean',
						default: false,
						description: 'Whether to enable spell checking before translation',
					},
					{
						displayName: 'Model',
						name: 'model',
						type: 'string',
						default: '',
						placeholder: 'model-ID',
						description: 'Custom translation model ID (leave empty for default)',
					},
					{
						displayName: 'Glossary',
						name: 'glossary',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						placeholder: 'Add Glossary Term',
						description: 'Custom glossary terms for translation',
						options: [
							{
								name: 'glossaryPairs',
								displayName: 'Glossary Pairs',
								values: [
									{
										displayName: 'Source Text',
										name: 'sourceText',
										type: 'string',
										default: '',
										placeholder: 'API',
										description: 'Text in source language',
									},
									{
										displayName: 'Translated Text',
										name: 'translatedText',
										type: 'string',
										default: '',
										placeholder: 'Программный интерфейс',
										description: 'Text in target language',
									},
									{
										displayName: 'Exact Match',
										name: 'exact',
										type: 'boolean',
										default: false,
										description: 'Whether to use exact word matching',
									},
								],
							},
						],
					},
				],
			},

			// Detect Language: Text input
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				displayOptions: {
					show: {
						resource: ['text'],
						operation: ['detectLanguage'],
					},
				},
				default: '',
				required: true,
				placeholder: 'Hello world',
				description: 'Text to detect language for',
			},

			// Detect Language: Language Hints
			{
				displayName: 'Language Hints',
				name: 'languageCodeHints',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['text'],
						operation: ['detectLanguage'],
					},
				},
				default: '',
				placeholder: 'en,ru,es',
				description: 'Comma-separated list of language codes to prioritize (e.g., en,ru,es)',
			},
		],
	};

	methods = {
		loadOptions: {
			// Load source languages with auto-detect option
			async loadSourceLanguages(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('yandexCloudAuthorizedApi');

				// Parse service account JSON
				let serviceAccountJson: IIAmCredentials;
				try {
					serviceAccountJson = parseServiceAccountJson(credentials.serviceAccountJson as string);

					// Validate required fields
					if (!serviceAccountJson.serviceAccountId) {
						throw new NodeOperationError(
							this.getNode(),
							'service_account_id or serviceAccountId is required',
						);
					}
					if (!serviceAccountJson.accessKeyId) {
						throw new NodeOperationError(this.getNode(), 'id or accessKeyId is required');
					}
					if (!serviceAccountJson.privateKey) {
						throw new NodeOperationError(this.getNode(), 'private_key or privateKey is required');
					}
				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						`Invalid service account JSON credentials: ${error.message}`,
					);
				}

				// Get folder ID
				const folderIdOverride = this.getNodeParameter('folderId', '') as string;
				const folderId = folderIdOverride || (credentials.folderId as string);

				if (!folderId) {
					throw new NodeOperationError(
						this.getNode(),
						'Folder ID is required to load languages',
					);
				}

				try {
					// Create session and client
					const session = new Session({ serviceAccountJson });
					const client = session.client(translationService.TranslationServiceClient);

					// Fetch languages
					const response = await withSdkErrorHandling(
						this.getNode(),
						() => client.listLanguages(
							translationService.ListLanguagesRequest.fromPartial({ folderId }),
						),
						'list languages'
					);

					// Build options list with auto-detect first
					const options: INodePropertyOptions[] = [
						{
							name: 'Auto-Detect',
							value: '',
							description: 'Automatically detect source language',
						},
					];

					// Add languages
					for (const lang of response.languages) {
						options.push({
							name: `${lang.name} (${lang.code})`,
							value: lang.code,
						});
					}

					// Sort alphabetically (except Auto-detect)
					const autoDetect = options.shift();
					options.sort((a, b) => a.name.localeCompare(b.name));
					options.unshift(autoDetect!);

					return options;
				} catch (error) {
					// Re-throw SDK errors as-is
					if (error instanceof YandexCloudSdkError) {
						throw error;
					}
					throw new NodeOperationError(
						this.getNode(),
						`Failed to load language options: ${(error as Error).message}`,
					);
				}
			},

			// Load target languages without auto-detect
			async loadTargetLanguages(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('yandexCloudAuthorizedApi');

				// Parse service account JSON
				let serviceAccountJson: IIAmCredentials;
				try {
					serviceAccountJson = parseServiceAccountJson(credentials.serviceAccountJson as string);

					// Validate required fields
					if (!serviceAccountJson.serviceAccountId) {
						throw new NodeOperationError(
							this.getNode(),
							'service_account_id or serviceAccountId is required',
						);
					}
					if (!serviceAccountJson.accessKeyId) {
						throw new NodeOperationError(this.getNode(), 'id or accessKeyId is required');
					}
					if (!serviceAccountJson.privateKey) {
						throw new NodeOperationError(this.getNode(), 'private_key or privateKey is required');
					}
				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						`Invalid service account JSON credentials: ${error.message}`,
					);
				}

				// Get folder ID
				const folderIdOverride = this.getNodeParameter('folderId', '') as string;
				const folderId = folderIdOverride || (credentials.folderId as string);

				if (!folderId) {
					throw new NodeOperationError(
						this.getNode(),
						'Folder ID is required to load languages',
					);
				}

				try {
					// Create session and client
					const session = new Session({ serviceAccountJson });
					const client = session.client(translationService.TranslationServiceClient);

					// Fetch languages
					const response = await withSdkErrorHandling(
						this.getNode(),
						() => client.listLanguages(
							translationService.ListLanguagesRequest.fromPartial({ folderId }),
						),
						'list languages'
					);

					// Build options list
					const options: INodePropertyOptions[] = response.languages.map((lang) => ({
						name: `${lang.name} (${lang.code})`,
						value: lang.code,
					}));

					// Sort alphabetically
					options.sort((a, b) => a.name.localeCompare(b.name));

					return options;
				} catch (error) {
					// Re-throw SDK errors as-is
					if (error instanceof YandexCloudSdkError) {
						throw error;
					}
					throw new NodeOperationError(
						this.getNode(),
						`Failed to load language options: ${(error as Error).message}`,
					);
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		// Get credentials
		const credentials = await this.getCredentials('yandexCloudAuthorizedApi');

		// Parse service account JSON
		let serviceAccountJson: IIAmCredentials;
		try {
			serviceAccountJson = parseServiceAccountJson(credentials.serviceAccountJson as string);

			// Validate required fields
			if (!serviceAccountJson.serviceAccountId) {
				throw new NodeOperationError(
					this.getNode(),
					'service_account_id or serviceAccountId is required',
				);
			}
			if (!serviceAccountJson.accessKeyId) {
				throw new NodeOperationError(this.getNode(), 'id or accessKeyId is required');
			}
			if (!serviceAccountJson.privateKey) {
				throw new NodeOperationError(this.getNode(), 'private_key or privateKey is required');
			}
		} catch (error) {
			throw new NodeOperationError(
				this.getNode(),
				`Invalid service account JSON credentials: ${error.message}`,
			);
		}

		// Get folder ID
		const folderIdOverride = this.getNodeParameter('folderId', 0) as string;
		const folderId = folderIdOverride || (credentials.folderId as string);

		if (!folderId) {
			throw new NodeOperationError(
				this.getNode(),
				'Folder ID is required either in credentials or as node parameter',
			);
		}

		// Create session
		const session = new Session({ serviceAccountJson });
		const client = session.client(translationService.TranslationServiceClient);

		// Handle Languages > List operation
		if (resource === 'languages' && operation === 'list') {
			try {
				const response = await withSdkErrorHandling(
					this.getNode(),
					() => client.listLanguages(
						translationService.ListLanguagesRequest.fromPartial({ folderId }),
					),
					'list languages'
				);

				const languages = response.languages.map((lang) => ({
					json: {
						code: lang.code,
						name: lang.name,
					},
					pairedItem: { item: 0 },
				}));

				return [languages];
			} catch (error) {
				// Re-throw SDK errors as-is
				if (error instanceof YandexCloudSdkError) {
					throw error;
				}
				throw new NodeOperationError(
					this.getNode(),
					`Failed to list languages: ${(error as Error).message}`,
				);
			}
		}

		// Handle Text operations (per item)
		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'text' && operation === 'translate') {
					// Get translation parameters
					const textsInput = this.getNodeParameter('texts', i) as string;
					const sourceLanguageCode = this.getNodeParameter('sourceLanguageCode', i, '') as string;
					const targetLanguageCode = this.getNodeParameter('targetLanguageCode', i) as string;
					const additionalOptions = this.getNodeParameter('additionalOptions', i, {}) as {
						format?: string;
						speller?: boolean;
						model?: string;
						glossary?: {
							glossaryPairs?: Array<{
								sourceText: string;
								translatedText: string;
								exact: boolean;
							}>;
						};
					};

					// Parse texts (handle both string and array)
					let texts: string[] = [];
					if (Array.isArray(textsInput)) {
						texts = textsInput;
					} else {
						// Split by newlines for multiple texts
						texts = textsInput.split('\n').filter((text) => text.trim() !== '');
					}

					if (texts.length === 0) {
						throw new NodeOperationError(this.getNode(), 'At least one text is required');
					}

					// Validate text length
					const totalLength = texts.reduce((sum, text) => sum + text.length, 0);
					if (totalLength > 10000) {
						throw new NodeOperationError(
							this.getNode(),
							`Total text length (${totalLength}) exceeds maximum of 10,000 characters`,
						);
					}

					// Determine format
					let format = translationService.TranslateRequest_Format.PLAIN_TEXT;
					if (additionalOptions.format === 'HTML') {
						format = translationService.TranslateRequest_Format.HTML;
					}

					// Build request
					const request: any = {
						sourceLanguageCode: sourceLanguageCode || '',
						targetLanguageCode,
						format,
						texts,
						folderId,
						speller: additionalOptions.speller || false,
					};

					// Add optional model
					if (additionalOptions.model) {
						request.model = additionalOptions.model;
					}

					// Add optional glossary
					if (additionalOptions.glossary?.glossaryPairs && additionalOptions.glossary.glossaryPairs.length > 0) {
						request.glossaryConfig = {
							glossaryData: {
								glossaryPairs: additionalOptions.glossary.glossaryPairs,
							},
						};
					}

					// Call API
					const response = await withSdkErrorHandling(
						this.getNode(),
						() => client.translate(
							translationService.TranslateRequest.fromPartial(request),
						),
						'translate text',
						i
					);

					// Return results
					returnData.push({
						json: {
							success: true,
							sourceLanguageCode: sourceLanguageCode || 'auto-detected',
							targetLanguageCode,
							translations: response.translations.map((t) => ({
								text: t.text,
								detectedLanguageCode: t.detectedLanguageCode,
							})),
						},
						pairedItem: { item: i },
					});
				} else if (resource === 'text' && operation === 'detectLanguage') {
					// Get text to detect
					const text = this.getNodeParameter('text', i) as string;
					const languageCodeHints = this.getNodeParameter('languageCodeHints', i, '') as string;

					// Parse hints
					const hints = languageCodeHints
						? languageCodeHints.split(',').map((h) => h.trim()).filter((h) => h !== '')
						: [];

					// Call API
					const response = await withSdkErrorHandling(
						this.getNode(),
						() => client.detectLanguage(
							translationService.DetectLanguageRequest.fromPartial({
								text,
								languageCodeHints: hints,
								folderId,
							}),
						),
						'detect language',
						i
					);

					// Return result
					returnData.push({
						json: {
							success: true,
							text,
							languageCode: response.languageCode,
						},
						pairedItem: { item: i },
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: (error as Error).message,
							success: false,
						},
						pairedItem: { item: i },
					});
					continue;
				}
				// If it's already one of our custom errors, re-throw as-is
				if (error instanceof YandexCloudSdkError || error instanceof NodeOperationError) {
					throw error;
				}
				// Otherwise wrap in YandexCloudSdkError
				throw new YandexCloudSdkError(this.getNode(), error as Error, {
					operation: operation as string,
					itemIndex: i,
				});
			}
		}

		return [returnData];
	}
}

