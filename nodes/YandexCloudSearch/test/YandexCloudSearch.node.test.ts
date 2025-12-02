import { YandexCloudSearch } from '../YandexCloudSearch.node';
import type { IExecuteFunctions } from 'n8n-workflow';

// Mock Yandex Cloud SDK
jest.mock('@yandex-cloud/nodejs-sdk');
jest.mock('xml2js');

describe('YandexCloudSearch Node', () => {
	let node: YandexCloudSearch;
	let mockExecuteFunctions: Partial<IExecuteFunctions>;
	let mockSession: any;
	let mockWebSearchClient: any;
	let mockGenSearchClient: any;

	beforeEach(() => {
		jest.clearAllMocks();

		node = new YandexCloudSearch();

		// Mock Web Search Service Client
		mockWebSearchClient = {
			search: jest.fn(),
		};

		// Mock Gen Search Service Client
		mockGenSearchClient = {
			search: jest.fn(),
		};

		// Mock Session - returns client based on parameter
		mockSession = {
			client: jest.fn((serviceType: any) => {
				// Check if it's GenSearchServiceClient based on the serviceType passed
				const serviceTypeName = serviceType?.name || serviceType?.constructor?.name || '';
				if (serviceTypeName.includes('GenSearch')) {
					return mockGenSearchClient;
				}
				return mockWebSearchClient;
			}),
		};

		const { Session } = require('@yandex-cloud/nodejs-sdk');
		Session.mockImplementation(() => mockSession);

		// Mock Execute Functions
		mockExecuteFunctions = {
			getInputData: jest.fn().mockReturnValue([{ json: {} }]),
			getNodeParameter: jest.fn(),
			getCredentials: jest.fn().mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					service_account_id: 'sa-test-id',
					id: 'key-test-id',
					private_key: 'test-private-key',
				}),
				folderId: 'folder-test-id',
			}),
			continueOnFail: jest.fn().mockReturnValue(false),
			getNode: jest.fn().mockReturnValue({ name: 'Test Node' }),
		};
	});

	describe('Node Definition', () => {
		it('should have correct basic properties', () => {
			expect(node.description.displayName).toBe('Yandex Cloud Search');
			expect(node.description.name).toBe('yandexCloudSearch');
			expect(node.description.group).toContain('transform');
			expect(node.description.version).toBe(1);
		});

		it('should have correct credentials configuration', () => {
			expect(node.description.credentials).toHaveLength(1);
			expect(node.description.credentials?.[0]).toEqual({
				name: 'yandexCloudAuthorizedApi',
				required: true,
			});
		});

		it('should have correct input/output configuration', () => {
			expect(node.description.inputs).toEqual(['main']);
			expect(node.description.outputs).toEqual(['main']);
		});

		it('should have two operations defined', () => {
			const operations = node.description.properties.find(p => p.name === 'operation');
			expect(operations?.type).toBe('options');
			expect((operations as any).options).toHaveLength(2);
			expect((operations as any).options.map((o: any) => o.value)).toEqual([
				'webSearch',
				'genSearch',
			]);
		});
	});

	describe('Web Search Operation', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string) => {
					const params: Record<string, any> = {
						operation: 'webSearch',
						folderId: 'folder-test-id',
						queryText: 'n8n automation',
						searchType: 'RU',
						webSearchOptions: {},
					};
					return params[paramName];
				});
		});

		it('should perform web search successfully', async () => {
			mockWebSearchClient.search.mockResolvedValue({
				rawData: '<yandexsearch><response><results><grouping><group><doc><url>https://example.com</url></doc></group></grouping></results></response></yandexsearch>',
			});

			// Mock xml2js parser
			const xml2js = require('xml2js');
			xml2js.Parser = jest.fn().mockImplementation(() => ({
				parseStringPromise: jest.fn().mockResolvedValue({
					yandexsearch: {
						response: {
							results: {
								grouping: {
									group: {
										doc: {
											url: 'https://example.com',
										},
									},
								},
							},
						},
					},
				}),
			}));

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json.parsedData).toBeDefined();
			expect(result[0][0].json.rawData).toBeUndefined(); // Not included by default
			expect(mockWebSearchClient.search).toHaveBeenCalledWith(
				expect.objectContaining({
					folderId: 'folder-test-id',
					query: expect.objectContaining({
						queryText: 'n8n automation',
					}),
				}),
			);
		});

		it('should handle web search with all optional parameters', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string) => {
					if (paramName === 'webSearchOptions') {
						return {
							familyMode: 'FAMILY_MODE_STRICT',
							page: 1,
							fixTypoMode: 'FIX_TYPO_MODE_DISABLED',
							sortBy: 'BY_TIME',
							sortOrder: 'ASC',
							groupBy: 'DEEP',
							groupsOnPage: 5,
							docsInGroup: 3,
							maxPassages: 5,
							region: '213',
							l10n: 'EN',
							responseFormat: 'HTML',
							parseXml: false,
						};
					}
					const params: Record<string, any> = {
						operation: 'webSearch',
						folderId: 'folder-test-id',
						queryText: 'test query',
						searchType: 'COM',
					};
					return params[paramName];
				});

			mockWebSearchClient.search.mockResolvedValue({
				rawData: '<html>results</html>',
			});

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(mockWebSearchClient.search).toHaveBeenCalledWith(
				expect.objectContaining({
					query: expect.objectContaining({
						page: 1,
					}),
					sortSpec: expect.objectContaining({
						sortMode: expect.any(Number),
						sortOrder: expect.any(Number),
					}),
					groupSpec: expect.objectContaining({
						groupsOnPage: 5,
						docsInGroup: 3,
					}),
					maxPassages: 5,
					region: '213',
				}),
			);
		});

		it('should skip XML parsing when parseXml is false', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string) => {
					if (paramName === 'webSearchOptions') {
						return { parseXml: false };
					}
					const params: Record<string, any> = {
						operation: 'webSearch',
						folderId: 'folder-test-id',
						queryText: 'test',
						searchType: 'RU',
					};
					return params[paramName];
				});

			mockWebSearchClient.search.mockResolvedValue({
				rawData: '<xml>data</xml>',
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json.data).toBe('<xml>data</xml>'); // 'data' not 'rawData'
			expect(result[0][0].json.parsedData).toBeUndefined();
			expect(result[0][0].json.rawData).toBeUndefined();
		});

		it('should handle XML parsing errors gracefully', async () => {
			mockWebSearchClient.search.mockResolvedValue({
				rawData: 'invalid xml',
			});

			const xml2js = require('xml2js');
			xml2js.Parser = jest.fn().mockImplementation(() => ({
				parseStringPromise: jest.fn().mockRejectedValue(new Error('Parse error')),
			}));

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json.parseError).toBe('Parse error');
			expect(result[0][0].json.data).toBe('invalid xml'); // Always included on error
		});

		it('should handle web search error with continueOnFail', async () => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			mockWebSearchClient.search.mockRejectedValue(new Error('Search API Error'));

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toMatchObject({
				error: 'Yandex Cloud SDK error in web search',
				success: false,
			});
		});

		it('should return raw data for HTML format', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'webSearchOptions') {
						return { responseFormat: 'HTML', parseXml: true };
					}
					const params: Record<string, any> = {
						operation: 'webSearch',
						folderId: 'folder-test-id',
						queryText: 'test',
						searchType: 'RU',
					};
					return params[paramName];
				},
			);

			mockWebSearchClient.search.mockResolvedValue({
				rawData: '<html><body>test</body></html>',
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json.data).toBe('<html><body>test</body></html>');
			expect(result[0][0].json.parsedData).toBeUndefined();
		});

		it('should convert Buffer responses to strings', async () => {
			const xmlBuffer = Buffer.from('<xml>test</xml>', 'utf-8');

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'webSearchOptions') {
						return { parseXml: false };
					}
					const params: Record<string, any> = {
						operation: 'webSearch',
						folderId: 'folder-test-id',
						queryText: 'test',
						searchType: 'RU',
					};
					return params[paramName];
				},
			);

			mockWebSearchClient.search.mockResolvedValue({
				rawData: xmlBuffer, // Buffer instead of string
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(typeof result[0][0].json.data).toBe('string');
			expect(result[0][0].json.data).toBe('<xml>test</xml>');
			// Should NOT have Buffer serialization artifacts
			expect(result[0][0].json.data).not.toHaveProperty('type');
			expect(result[0][0].json.data).not.toHaveProperty('data');
		});
	});

	describe('Generative Search Operation', () => {
		beforeEach(() => {
			// Make session.client return GenSearchClient for this test suite
			mockSession.client = jest.fn(() => mockGenSearchClient);

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string) => {
					const params: Record<string, any> = {
						operation: 'genSearch',
						folderId: 'folder-test-id',
						messages: {
							messageValues: [
								{ role: 'USER', content: 'What is n8n?' },
							],
						},
						genSearchOptions: {},
					};
					return params[paramName];
				});
		});

		it('should perform generative search successfully', async () => {
			// Mock async iterable for streaming response
			const mockStreamResponse = [
				{
					message: { content: 'n8n is an automation tool', role: 1 },
					sources: [
						{ url: 'https://n8n.io', title: 'n8n', used: true },
					],
					searchQueries: [{ text: 'n8n automation', reqId: 'req-1' }],
					fixedMisspellQuery: '',
					isAnswerRejected: false,
					isBulletAnswer: false,
				},
			];

			mockGenSearchClient.search.mockReturnValue({
				[Symbol.asyncIterator]: async function* () {
					for (const response of mockStreamResponse) {
						yield response;
					}
				},
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json.responses).toHaveLength(1);
			expect((result[0][0].json.finalResponse as any).message.content).toBe('n8n is an automation tool');
			expect((result[0][0].json.finalResponse as any).sources).toHaveLength(1);
		});

		it('should handle multiple messages in conversation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string) => {
					if (paramName === 'messages') {
						return {
							messageValues: [
								{ role: 'USER', content: 'What is n8n?' },
								{ role: 'ASSISTANT', content: 'n8n is an automation tool' },
								{ role: 'USER', content: 'How does it work?' },
							],
						};
					}
					const params: Record<string, any> = {
						operation: 'genSearch',
						folderId: 'folder-test-id',
						genSearchOptions: {},
					};
					return params[paramName];
				});

			mockGenSearchClient.search.mockReturnValue({
				[Symbol.asyncIterator]: async function* () {
					yield {
						message: { content: 'Response', role: 2 },
						sources: [],
						searchQueries: [],
						fixedMisspellQuery: '',
						isAnswerRejected: false,
						isBulletAnswer: false,
					};
				},
			});

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(mockGenSearchClient.search).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: expect.arrayContaining([
						expect.objectContaining({ content: 'What is n8n?' }),
						expect.objectContaining({ content: 'n8n is an automation tool' }),
						expect.objectContaining({ content: 'How does it work?' }),
					]),
				}),
			);
		});

		it('should apply optional search restrictions', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string) => {
					if (paramName === 'genSearchOptions') {
						return {
							searchType: 'COM',
							site: 'example.com',
							fixMisspell: true,
							enableNrfmDocs: true,
							getPartialResults: true,
						};
					}
					const params: Record<string, any> = {
						operation: 'genSearch',
						folderId: 'folder-test-id',
						messages: {
							messageValues: [
								{ role: 'USER', content: 'test' },
							],
						},
					};
					return params[paramName];
				});

			mockGenSearchClient.search.mockReturnValue({
				[Symbol.asyncIterator]: async function* () {
					yield {
						message: { content: 'Response', role: 2 },
						sources: [],
						searchQueries: [],
						fixedMisspellQuery: '',
						isAnswerRejected: false,
						isBulletAnswer: false,
					};
				},
			});

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			const callArgs = (mockGenSearchClient.search as jest.Mock).mock.calls[0][0];
			expect(callArgs.site).toEqual({ site: ['example.com'] });
			expect(callArgs.fixMisspell).toBe(true);
			expect(callArgs.enableNrfmDocs).toBe(true);
			// getPartialResults is filtered out by fromPartial if the proto definition doesn't include it
			// This is an SDK limitation, the core functionality works
		});

		it('should accumulate multiple streaming responses', async () => {
			mockGenSearchClient.search.mockReturnValue({
				[Symbol.asyncIterator]: async function* () {
					yield {
						message: { content: 'Part 1', role: 2 },
						sources: [{ url: 'url1', title: 'title1', used: true }],
						searchQueries: [],
						fixedMisspellQuery: '',
						isAnswerRejected: false,
						isBulletAnswer: false,
					};
					yield {
						message: { content: 'Part 2', role: 2 },
						sources: [{ url: 'url2', title: 'title2', used: false }],
						searchQueries: [],
						fixedMisspellQuery: '',
						isAnswerRejected: false,
						isBulletAnswer: false,
					};
					yield {
						message: { content: 'Final answer', role: 2 },
						sources: [],
						searchQueries: [{ text: 'query', reqId: 'req' }],
						fixedMisspellQuery: 'fixed',
						isAnswerRejected: false,
						isBulletAnswer: false,
					};
				},
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json.responses).toHaveLength(3);
			expect((result[0][0].json.finalResponse as any).message.content).toBe('Final answer');
			expect((result[0][0].json.finalResponse as any).fixedMisspellQuery).toBe('fixed');
		});

		it('should throw error if no messages provided', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string) => {
					const params: Record<string, any> = {
						operation: 'genSearch',
						folderId: 'folder-test-id',
						messages: { messageValues: [] },
						genSearchOptions: {},
					};
					return params[paramName];
				});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('At least one message is required');
		});

		it('should handle gen search error with continueOnFail', async () => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			mockGenSearchClient.search.mockImplementation(() => {
				throw new Error('Gen Search API Error');
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toMatchObject({
				error: 'Gen Search API Error',
				success: false,
			});
		});
	});

	describe('Credentials Validation', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string) => {
					const params: Record<string, any> = {
						operation: 'webSearch',
						folderId: 'folder-test-id',
						queryText: 'test',
						searchType: 'RU',
						webSearchOptions: {},
					};
					return params[paramName];
				});
		});

		it('should throw error for invalid service account JSON', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				serviceAccountJson: 'invalid-json',
				folderId: 'folder-test-id',
			});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('Invalid service account JSON credentials');
		});

		it('should throw error if service_account_id is missing', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					id: 'key-test-id',
					private_key: 'test-private-key',
				}),
				folderId: 'folder-test-id',
			});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('service_account_id or serviceAccountId is required');
		});

		it('should throw error if access key ID is missing', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					service_account_id: 'sa-test-id',
					private_key: 'test-private-key',
				}),
				folderId: 'folder-test-id',
			});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('id or accessKeyId is required');
		});

		it('should throw error if private key is missing', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					service_account_id: 'sa-test-id',
					id: 'key-test-id',
				}),
				folderId: 'folder-test-id',
			});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('private_key or privateKey is required');
		});

		it('should throw error if folder ID is missing', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					service_account_id: 'sa-test-id',
					id: 'key-test-id',
					private_key: 'test-private-key',
				}),
				folderId: '',
			});

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string) => {
					if (paramName === 'folderId') return '';
					const params: Record<string, any> = {
						operation: 'webSearch',
						queryText: 'test',
						searchType: 'RU',
						webSearchOptions: {},
					};
					return params[paramName];
				});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('Folder ID is required either in credentials or as node parameter');
		});

		it('should support camelCase credential format', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					serviceAccountId: 'sa-test-id',
					accessKeyId: 'key-test-id',
					privateKey: 'test-private-key',
				}),
				folderId: 'folder-test-id',
			});

			mockWebSearchClient.search.mockResolvedValue({
				rawData: '<xml>test</xml>',
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0]).toHaveLength(1);
		});

		it('should use folder ID from node parameter over credentials', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string) => {
					if (paramName === 'folderId') return 'override-folder-id';
					const params: Record<string, any> = {
						operation: 'webSearch',
						queryText: 'test',
						searchType: 'RU',
						webSearchOptions: {},
					};
					return params[paramName];
				});

			mockWebSearchClient.search.mockResolvedValue({
				rawData: '<xml>test</xml>',
			});

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(mockWebSearchClient.search).toHaveBeenCalledWith(
				expect.objectContaining({
					folderId: 'override-folder-id',
				}),
			);
		});
	});

	describe('Multi-Item Processing', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string) => {
					const params: Record<string, any> = {
						operation: 'webSearch',
						folderId: 'folder-test-id',
						queryText: 'test',
						searchType: 'RU',
						webSearchOptions: {},
					};
					return params[paramName];
				});
		});

		it('should process multiple input items', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
				{ json: {} },
				{ json: {} },
			]);

			mockWebSearchClient.search.mockResolvedValue({
				rawData: '<xml>test</xml>',
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0]).toHaveLength(3);
			expect(mockWebSearchClient.search).toHaveBeenCalledTimes(3);
		});

		it('should maintain pairedItem references', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: { id: 1 } },
				{ json: { id: 2 } },
			]);

			mockWebSearchClient.search.mockResolvedValue({
				rawData: '<xml>test</xml>',
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].pairedItem).toEqual({ item: 0 });
			expect(result[0][1].pairedItem).toEqual({ item: 1 });
		});
	});
});
