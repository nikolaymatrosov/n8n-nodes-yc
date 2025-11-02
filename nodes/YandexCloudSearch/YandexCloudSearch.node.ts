import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { Session } from '@yandex-cloud/nodejs-sdk';
import {
	searchService,
	genSearchService,
} from '@yandex-cloud/nodejs-sdk/dist/clients/searchapi-v2/index';
import {
	SearchQuery_SearchType,
	SearchQuery_FamilyMode,
	SearchQuery_FixTypoMode,
} from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/searchapi/v2/search_query';
import {
	SortSpec_SortMode,
	SortSpec_SortOrder,
	GroupSpec_GroupMode,
	WebSearchRequest_Localization,
	WebSearchRequest_Format,
} from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/searchapi/v2/search_service';
import { Role } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/searchapi/v2/gen_search_service';
import { mapKeys, camelCase } from 'lodash';
import * as xml2js from 'xml2js';

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

/**
 * Parse XML response to JSON
 */
async function parseXmlToJson(xml: string): Promise<any> {
	const parser = new xml2js.Parser({
		explicitArray: false,
		mergeAttrs: true,
		normalize: true,
		normalizeTags: true,
		trim: true,
	});
	return await parser.parseStringPromise(xml);
}

export class YandexCloudSearch implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Yandex Cloud Search',
		name: 'yandexCloudSearch',
		icon: 'file:Search.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Search using Yandex Cloud Search API',
		defaults: {
			name: 'Yandex Cloud Search',
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
			// Operation selector
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Web Search',
						value: 'webSearch',
						description: 'Perform a web search',
						action: 'Perform web search',
					},
					{
						name: 'Generative Search',
						value: 'genSearch',
						description: 'Perform a generative search with AI-powered answers',
						action: 'Perform generative search',
					},
				],
				default: 'webSearch',
			},

			// Folder ID
			{
				displayName: 'Folder ID',
				name: 'folderId',
				type: 'string',
				default: '={{$credentials.folderId}}',
				description:
					'Folder ID to use. Defaults to the folder ID from credentials. Required if not set in credentials.',
				hint: 'Leave empty to use folder ID from credentials',
			},

			// ===== WEB SEARCH PARAMETERS =====
			{
				displayName: 'Query',
				name: 'queryText',
				type: 'string',
				displayOptions: {
					show: {
						operation: ['webSearch'],
					},
				},
				default: '',
				required: true,
				placeholder: 'n8n automation',
				description: 'Search query text',
			},

			{
				displayName: 'Search Type',
				name: 'searchType',
				type: 'options',
				displayOptions: {
					show: {
						operation: ['webSearch'],
					},
				},
				options: [
					{
						name: 'Belarusian (BY)',
						value: 'BY',
					},
					{
						name: 'International (COM)',
						value: 'COM',
					},
					{
						name: 'Kazakh (KK)',
						value: 'KK',
					},
					{
						name: 'Russian (RU)',
						value: 'RU',
					},
					{
						name: 'Turkish (TR)',
						value: 'TR',
					},
					{
						name: 'Uzbek (UZ)',
						value: 'UZ',
					},
				],
				default: 'RU',
				description: 'Search type based on region',
			},

			{
				displayName: 'Additional Options',
				name: 'webSearchOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						operation: ['webSearch'],
					},
				},
				options: [
					{
						displayName: 'Docs in Group',
						name: 'docsInGroup',
						type: 'number',
						default: 1,
						description: 'Number of documents per group',
					},
					{
						displayName: 'Family Mode',
						name: 'familyMode',
						type: 'options',
						options: [
							{
								name: 'None',
								value: 'FAMILY_MODE_NONE',
							},
							{
								name: 'Moderate',
								value: 'FAMILY_MODE_MODERATE',
							},
							{
								name: 'Strict',
								value: 'FAMILY_MODE_STRICT',
							},
						],
						default: 'FAMILY_MODE_NONE',
						description: 'Content filtering mode',
					},
					{
						displayName: 'Fix Typos',
						name: 'fixTypoMode',
						type: 'options',
						options: [
							{
								name: 'Auto',
								value: 'FIX_TYPO_MODE_AUTO',
							},
							{
								name: 'Disabled',
								value: 'FIX_TYPO_MODE_DISABLED',
							},
						],
						default: 'FIX_TYPO_MODE_AUTO',
						description: 'Whether to fix typos in query',
					},
					{
						displayName: 'Group By',
						name: 'groupBy',
						type: 'options',
						options: [
							{
								name: 'Flat',
								value: 'FLAT',
							},
							{
								name: 'By Domain',
								value: 'DEEP',
							},
						],
						default: 'FLAT',
						description: 'How to group results',
					},
					{
						displayName: 'Groups on Page',
						name: 'groupsOnPage',
						type: 'number',
						default: 10,
						description: 'Number of groups per page',
					},
					{
						displayName: 'Localization',
						name: 'l10n',
						type: 'options',
						options: [
							{ name: 'Belarusian', value: 'BE' },
							{ name: 'English', value: 'EN' },
							{ name: 'Kazakh', value: 'KK' },
							{ name: 'Russian', value: 'RU' },
							{ name: 'Turkish', value: 'TR' },
							{ name: 'Ukrainian', value: 'UK' },
						],
						default: 'RU',
						description: 'Interface localization',
					},
					{
						displayName: 'Max Passages',
						name: 'maxPassages',
						type: 'number',
						default: 2,
						description: 'Maximum passages in snippet',
					},
					{
						displayName: 'Page Number',
						name: 'page',
						type: 'number',
						default: 0,
						description: 'Page number (0-based)',
					},
					{
						displayName: 'Parse XML to JSON',
						name: 'parseXml',
						type: 'boolean',
						default: true,
						description: 'Whether to parse XML response to JSON',
					},
					{
						displayName: 'Region',
						name: 'region',
						type: 'string',
						default: '',
						placeholder: '213',
						description: 'Search region ID (e.g., 213 for Moscow)',
					},
					{
						displayName: 'Response Format',
						name: 'responseFormat',
						type: 'options',
						options: [
							{ name: 'XML', value: 'XML' },
							{ name: 'HTML', value: 'HTML' },
						],
						default: 'XML',
					},
					{
						displayName: 'Sort By',
						name: 'sortBy',
						type: 'options',
						options: [
							{
								name: 'Relevance',
								value: 'BY_RELEVANCE',
							},
							{
								name: 'Time',
								value: 'BY_TIME',
							},
						],
						default: 'BY_RELEVANCE',
						description: 'Sort order',
					},
					{
						displayName: 'Sort Order',
						name: 'sortOrder',
						type: 'options',
						options: [
							{
								name: 'Descending',
								value: 'DESCENDING',
							},
							{
								name: 'Ascending',
								value: 'ASCENDING',
							},
						],
						default: 'DESCENDING',
						description: 'Sort direction (only for time sorting)',
					},
				],
			},

			// ===== GENERATIVE SEARCH PARAMETERS =====
			{
				displayName: 'Messages',
				name: 'messages',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				displayOptions: {
					show: {
						operation: ['genSearch'],
					},
				},
				default: {},
				required: true,
				placeholder: 'Add Message',
				description: 'Conversation messages',
				options: [
					{
						name: 'messageValues',
						displayName: 'Message',
						values: [
							{
								displayName: 'Role',
								name: 'role',
								type: 'options',
								options: [
									{
										name: 'User',
										value: 'USER',
									},
									{
										name: 'Assistant',
										value: 'ASSISTANT',
									},
								],
								default: 'USER',
								description: 'Message role',
							},
							{
								displayName: 'Content',
								name: 'content',
								type: 'string',
								typeOptions: {
									rows: 3,
								},
								default: '',
								placeholder: 'What is n8n?',
								description: 'Message content',
							},
						],
					},
				],
			},

			{
				displayName: 'Additional Options',
				name: 'genSearchOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						operation: ['genSearch'],
					},
				},
				options: [
					{
						displayName: 'Enable NRFM Docs',
						name: 'enableNrfmDocs',
						type: 'boolean',
						default: false,
						description: 'Whether to use documents not on front page',
					},
					{
						displayName: 'Fix Misspell',
						name: 'fixMisspell',
						type: 'boolean',
						default: false,
						description: 'Whether to fix misspells in query',
					},
					{
						displayName: 'Get Partial Results',
						name: 'getPartialResults',
						type: 'boolean',
						default: false,
						description: 'Whether to get partial streaming results',
					},
					{
						displayName: 'Host Restriction',
						name: 'host',
						type: 'string',
						default: '',
						placeholder: 'www.example.com',
						description: 'Restrict search to specific host',
					},
					{
						displayName: 'Search Type',
						name: 'searchType',
						type: 'options',
						options: [
							{ name: 'Belarusian (BY)', value: 'BY' },
							{ name: 'International (COM)', value: 'COM' },
							{ name: 'Kazakh (KK)', value: 'KK' },
							{ name: 'Russian (RU)', value: 'RU' },
							{ name: 'Turkish (TR)', value: 'TR' },
							{ name: 'Uzbek (UZ)', value: 'UZ' },
						],
						default: 'RU',
						description: 'Search type based on region',
					},
					{
						displayName: 'Site Restriction',
						name: 'site',
						type: 'string',
						default: '',
						placeholder: 'example.com',
						description: 'Restrict search to specific site',
					},
					{
						displayName: 'URL Restriction',
						name: 'url',
						type: 'string',
						default: '',
						placeholder: 'https://example.com/docs',
						description: 'Restrict search to specific URL',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
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

		// Handle operations (per item)
		for (let i = 0; i < items.length; i++) {
			try {
				if (operation === 'webSearch') {
					// Web Search operation
					const queryText = this.getNodeParameter('queryText', i) as string;
					const searchType = this.getNodeParameter('searchType', i, 'RU') as string;
					const options = this.getNodeParameter('webSearchOptions', i, {}) as any;

					const client = session.client(searchService.WebSearchServiceClient);

					// Build search query
					const query: any = {
						queryText,
						searchType:
							SearchQuery_SearchType[
								`SEARCH_TYPE_${searchType}` as keyof typeof SearchQuery_SearchType
							],
						familyMode: SearchQuery_FamilyMode[options.familyMode || 'FAMILY_MODE_NONE'],
						page: options.page || 0,
						fixTypoMode: SearchQuery_FixTypoMode[options.fixTypoMode || 'FIX_TYPO_MODE_AUTO'],
					};

					// Build request
					const request: any = {
						folderId,
						query,
					};

					// Add optional sort spec
					if (options.sortBy) {
						request.sortSpec = {
							sortMode:
								SortSpec_SortMode[`SORT_MODE_${options.sortBy}` as keyof typeof SortSpec_SortMode],
							sortOrder:
								SortSpec_SortOrder[
									`SORT_ORDER_${options.sortOrder || 'DESC'}` as keyof typeof SortSpec_SortOrder
								],
						};
					}

					// Add optional group spec
					if (options.groupBy) {
						request.groupSpec = {
							groupMode:
								GroupSpec_GroupMode[
									`GROUP_MODE_${options.groupBy}` as keyof typeof GroupSpec_GroupMode
								],
							groupsOnPage: options.groupsOnPage || 10,
							docsInGroup: options.docsInGroup || 1,
						};
					}

					// Add optional fields
					if (options.maxPassages !== undefined) {
						request.maxPassages = options.maxPassages;
					}
					if (options.region) {
						request.region = options.region;
					}
					if (options.l10n) {
						request.l10n =
							WebSearchRequest_Localization[
								`LOCALIZATION_${options.l10n}` as keyof typeof WebSearchRequest_Localization
							];
					}
					if (options.responseFormat) {
						request.responseFormat =
							WebSearchRequest_Format[
								`FORMAT_${options.responseFormat}` as keyof typeof WebSearchRequest_Format
							];
					}

					// Call API
					const response = await client.search(searchService.WebSearchRequest.fromPartial(request));

					// Parse XML to JSON if requested
					let resultData: any = {
						rawData: response.rawData,
					};

					if (options.parseXml !== false && response.rawData) {
						try {
							// Convert Buffer to string if needed
							const xmlString =
								typeof response.rawData === 'string'
									? response.rawData
									: response.rawData.toString('utf-8');
							const parsed = await parseXmlToJson(xmlString);
							resultData.parsedData = parsed;
						} catch (parseError: any) {
							resultData.parseError = parseError.message;
						}
					}

					returnData.push({
						json: resultData,
						pairedItem: { item: i },
					});
				} else if (operation === 'genSearch') {
					// Generative Search operation
					const messagesInput = this.getNodeParameter('messages', i, {}) as any;
					const options = this.getNodeParameter('genSearchOptions', i, {}) as any;

					// Build messages array
					const messages: any[] = [];
					if (messagesInput.messageValues && Array.isArray(messagesInput.messageValues)) {
						for (const msg of messagesInput.messageValues) {
							messages.push({
								content: msg.content,
								role: Role[`ROLE_${msg.role}` as keyof typeof Role],
							});
						}
					}

					if (messages.length === 0) {
						throw new NodeOperationError(this.getNode(), 'At least one message is required');
					}

					const client = session.client(genSearchService.GenSearchServiceClient);

					// Build request
					const request: any = {
						messages,
						folderId,
					};

					// Add optional search type
					if (options.searchType) {
						request.searchType =
							SearchQuery_SearchType[
								`SEARCH_TYPE_${options.searchType}` as keyof typeof SearchQuery_SearchType
							];
					}

					// Add optional restrictions (mutually exclusive)
					if (options.site) {
						request.site = { site: Array.isArray(options.site) ? options.site : [options.site] };
					} else if (options.host) {
						request.host = { host: Array.isArray(options.host) ? options.host : [options.host] };
					} else if (options.url) {
						request.url = { url: Array.isArray(options.url) ? options.url : [options.url] };
					}

					// Add optional flags
					if (options.fixMisspell !== undefined) {
						request.fixMisspell = options.fixMisspell;
					}
					if (options.enableNrfmDocs !== undefined) {
						request.enableNrfmDocs = options.enableNrfmDocs;
					}
					if (options.getPartialResults !== undefined) {
						request.getPartialResults = options.getPartialResults;
					}

					// Call streaming API
					const stream = client.search(genSearchService.GenSearchRequest.fromPartial(request));

					// Accumulate streaming responses
					const responses: any[] = [];
					for await (const response of stream) {
						responses.push({
							message: response.message,
							sources: response.sources?.map((s: any) => ({
								url: s.url,
								title: s.title,
								used: s.used,
							})),
							searchQueries: response.searchQueries,
							fixedMisspellQuery: response.fixedMisspellQuery,
							isAnswerRejected: response.isAnswerRejected,
							isBulletAnswer: response.isBulletAnswer,
						});
					}

					// Return accumulated responses
					returnData.push({
						json: {
							responses,
							finalResponse: responses[responses.length - 1],
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
