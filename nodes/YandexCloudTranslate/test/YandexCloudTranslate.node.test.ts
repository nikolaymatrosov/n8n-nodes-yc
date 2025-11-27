import { YandexCloudTranslate } from '../YandexCloudTranslate.node';
import type { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';

// Mock Yandex Cloud SDK
jest.mock('@yandex-cloud/nodejs-sdk');

describe('YandexCloudTranslate Node', () => {
	let node: YandexCloudTranslate;
	let mockExecuteFunctions: Partial<IExecuteFunctions>;
	let mockLoadOptionsFunctions: Partial<ILoadOptionsFunctions>;
	let mockSession: any;
	let mockTranslationServiceClient: any;

	beforeEach(() => {
		jest.clearAllMocks();

		node = new YandexCloudTranslate();

		// Mock Translation Service Client
		mockTranslationServiceClient = {
			translate: jest.fn(),
			detectLanguage: jest.fn(),
			listLanguages: jest.fn(),
		};

		// Mock Session
		mockSession = {
			client: jest.fn().mockReturnValue(mockTranslationServiceClient),
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

		// Mock Load Options Functions
		mockLoadOptionsFunctions = {
			getCredentials: jest.fn().mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					service_account_id: 'sa-test-id',
					id: 'key-test-id',
					private_key: 'test-private-key',
				}),
				folderId: 'folder-test-id',
			}),
			getNodeParameter: jest.fn().mockReturnValue(''),
			getNode: jest.fn().mockReturnValue({ name: 'Test Node' }),
		};
	});

	describe('Node Definition', () => {
		it('should have correct basic properties', () => {
			expect(node.description.displayName).toBe('Yandex Cloud Translate');
			expect(node.description.name).toBe('yandexCloudTranslate');
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

		it('should expose loadSourceLanguages method', () => {
			expect(node.methods?.loadOptions?.loadSourceLanguages).toBeDefined();
		});

		it('should expose loadTargetLanguages method', () => {
			expect(node.methods?.loadOptions?.loadTargetLanguages).toBeDefined();
		});
	});

	describe('Load Source Languages Method', () => {
		it('should load languages with auto-detect option', async () => {
			mockTranslationServiceClient.listLanguages.mockResolvedValue({
				languages: [
					{ code: 'en', name: 'English' },
					{ code: 'ru', name: 'русский' },
					{ code: 'es', name: 'Español' },
				],
			});

			const result = await node.methods!.loadOptions!.loadSourceLanguages.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(result).toHaveLength(4);
			expect(result[0]).toMatchObject({
				name: 'Auto-Detect',
				value: '',
				description: 'Automatically detect source language',
			});
		});

		it('should sort languages alphabetically', async () => {
			mockTranslationServiceClient.listLanguages.mockResolvedValue({
				languages: [
					{ code: 'ru', name: 'русский' },
					{ code: 'en', name: 'English' },
					{ code: 'es', name: 'Español' },
				],
			});

			const result = await node.methods!.loadOptions!.loadSourceLanguages.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			// First should be auto-detect
			expect(result[0].name).toBe('Auto-Detect');
			// Rest should be sorted
			expect(result[1].name).toBe('English (en)');
			expect(result[2].name).toBe('Español (es)');
			expect(result[3].name).toBe('русский (ru)');
		});

		it('should use folder ID from node parameter if provided', async () => {
			(mockLoadOptionsFunctions.getNodeParameter as jest.Mock).mockReturnValue('override-folder-id');

			mockTranslationServiceClient.listLanguages.mockResolvedValue({
				languages: [],
			});

			await node.methods!.loadOptions!.loadSourceLanguages.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(mockTranslationServiceClient.listLanguages).toHaveBeenCalledWith(
				expect.objectContaining({
					folderId: 'override-folder-id',
				}),
			);
		});

		it('should throw error if folder ID is missing', async () => {
			(mockLoadOptionsFunctions.getCredentials as jest.Mock).mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					service_account_id: 'sa-test-id',
					id: 'key-test-id',
					private_key: 'test-private-key',
				}),
				folderId: '',
			});

			await expect(
				node.methods!.loadOptions!.loadSourceLanguages.call(
					mockLoadOptionsFunctions as ILoadOptionsFunctions,
				),
			).rejects.toThrow('Folder ID is required to load languages');
		});

		it('should handle API errors gracefully', async () => {
			mockTranslationServiceClient.listLanguages.mockRejectedValue(
				new Error('API Error'),
			);

			await expect(
				node.methods!.loadOptions!.loadSourceLanguages.call(
					mockLoadOptionsFunctions as ILoadOptionsFunctions,
				),
			).rejects.toThrow('Yandex Cloud SDK error in list languages');
		});
	});

	describe('Load Target Languages Method', () => {
		it('should load languages without auto-detect option', async () => {
			mockTranslationServiceClient.listLanguages.mockResolvedValue({
				languages: [
					{ code: 'en', name: 'English' },
					{ code: 'ru', name: 'русский' },
				],
			});

			const result = await node.methods!.loadOptions!.loadTargetLanguages.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(result).toHaveLength(2);
			expect(result.find(l => l.value === '')).toBeUndefined();
		});

		it('should format language names correctly', async () => {
			mockTranslationServiceClient.listLanguages.mockResolvedValue({
				languages: [
					{ code: 'en', name: 'English' },
				],
			});

			const result = await node.methods!.loadOptions!.loadTargetLanguages.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(result[0]).toMatchObject({
				name: 'English (en)',
				value: 'en',
			});
		});
	});

	describe('Translate Operation', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string) => {
					const params: Record<string, any> = {
						resource: 'text',
						operation: 'translate',
						folderId: 'folder-test-id',
						texts: 'Hello world',
						sourceLanguageCode: '',
						targetLanguageCode: 'ru',
						additionalOptions: {},
					};
					return params[paramName];
				});
		});

		it('should translate single text successfully', async () => {
			mockTranslationServiceClient.translate.mockResolvedValue({
				translations: [
					{
						text: 'Привет мир',
						detectedLanguageCode: 'en',
					},
				],
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toMatchObject({
				success: true,
				sourceLanguageCode: 'auto-detected',
				targetLanguageCode: 'ru',
				translations: [
					{
						text: 'Привет мир',
						detectedLanguageCode: 'en',
					},
				],
			});
		});

		it('should translate multiple texts', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string) => {
					if (paramName === 'texts') return 'Hello\nGoodbye\nThank you';
					const params: Record<string, any> = {
						resource: 'text',
						operation: 'translate',
						folderId: 'folder-test-id',
						sourceLanguageCode: 'en',
						targetLanguageCode: 'ru',
						additionalOptions: {},
					};
					return params[paramName];
				});

			mockTranslationServiceClient.translate.mockResolvedValue({
				translations: [
					{ text: 'Привет', detectedLanguageCode: 'en' },
					{ text: 'До свидания', detectedLanguageCode: 'en' },
					{ text: 'Спасибо', detectedLanguageCode: 'en' },
				],
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json.translations).toHaveLength(3);
			expect(mockTranslationServiceClient.translate).toHaveBeenCalledWith(
				expect.objectContaining({
					texts: ['Hello', 'Goodbye', 'Thank you'],
				}),
			);
		});

		it('should handle HTML format', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string) => {
					if (paramName === 'texts') return '<p>Hello</p>';
					if (paramName === 'additionalOptions') return { format: 'HTML' };
					const params: Record<string, any> = {
						resource: 'text',
						operation: 'translate',
						folderId: 'folder-test-id',
						sourceLanguageCode: 'en',
						targetLanguageCode: 'ru',
					};
					return params[paramName];
				});

			mockTranslationServiceClient.translate.mockResolvedValue({
				translations: [
					{ text: '<p>Привет</p>', detectedLanguageCode: 'en' },
				],
			});

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(mockTranslationServiceClient.translate).toHaveBeenCalledWith(
				expect.objectContaining({
					format: 2, // HTML format
				}),
			);
		});

		it('should apply spell checker when enabled', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string) => {
					if (paramName === 'additionalOptions') return { speller: true };
					const params: Record<string, any> = {
						resource: 'text',
						operation: 'translate',
						folderId: 'folder-test-id',
						texts: 'Helo wrld',
						sourceLanguageCode: 'en',
						targetLanguageCode: 'ru',
					};
					return params[paramName];
				});

			mockTranslationServiceClient.translate.mockResolvedValue({
				translations: [
					{ text: 'Привет мир', detectedLanguageCode: 'en' },
				],
			});

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(mockTranslationServiceClient.translate).toHaveBeenCalledWith(
				expect.objectContaining({
					speller: true,
				}),
			);
		});

		it('should use custom model when provided', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string) => {
					if (paramName === 'additionalOptions') return { model: 'custom-model-id' };
					const params: Record<string, any> = {
						resource: 'text',
						operation: 'translate',
						folderId: 'folder-test-id',
						texts: 'Hello',
						sourceLanguageCode: 'en',
						targetLanguageCode: 'ru',
					};
					return params[paramName];
				});

			mockTranslationServiceClient.translate.mockResolvedValue({
				translations: [
					{ text: 'Привет', detectedLanguageCode: 'en' },
				],
			});

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(mockTranslationServiceClient.translate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: 'custom-model-id',
				}),
			);
		});

		it('should apply glossary terms', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string) => {
					if (paramName === 'additionalOptions') {
						return {
							glossary: {
								glossaryPairs: [
									{
										sourceText: 'API',
										translatedText: 'Интерфейс программирования',
										exact: true,
									},
								],
							},
						};
					}
					const params: Record<string, any> = {
						resource: 'text',
						operation: 'translate',
						folderId: 'folder-test-id',
						texts: 'The API is great',
						sourceLanguageCode: 'en',
						targetLanguageCode: 'ru',
					};
					return params[paramName];
				});

			mockTranslationServiceClient.translate.mockResolvedValue({
				translations: [
					{ text: 'Интерфейс программирования отличный', detectedLanguageCode: 'en' },
				],
			});

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(mockTranslationServiceClient.translate).toHaveBeenCalledWith(
				expect.objectContaining({
					glossaryConfig: {
						glossaryData: {
							glossaryPairs: [
								{
									sourceText: 'API',
									translatedText: 'Интерфейс программирования',
									exact: true,
								},
							],
						},
					},
				}),
			);
		});

		it('should validate text length limit', async () => {
			const longText = 'a'.repeat(10001);
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string) => {
					if (paramName === 'texts') return longText;
					const params: Record<string, any> = {
						resource: 'text',
						operation: 'translate',
						folderId: 'folder-test-id',
						sourceLanguageCode: 'en',
						targetLanguageCode: 'ru',
						additionalOptions: {},
					};
					return params[paramName];
				});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('Total text length (10001) exceeds maximum of 10,000 characters');
		});

		it('should require at least one text', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string) => {
					if (paramName === 'texts') return '';
					const params: Record<string, any> = {
						resource: 'text',
						operation: 'translate',
						folderId: 'folder-test-id',
						sourceLanguageCode: 'en',
						targetLanguageCode: 'ru',
						additionalOptions: {},
					};
					return params[paramName];
				});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('At least one text is required');
		});

		it('should handle error with continueOnFail', async () => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			mockTranslationServiceClient.translate.mockRejectedValue(new Error('API Error'));

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toMatchObject({
				error: 'Yandex Cloud SDK error in translate text',
				success: false,
			});
		});
	});

	describe('Detect Language Operation', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string) => {
					const params: Record<string, any> = {
						resource: 'text',
						operation: 'detectLanguage',
						folderId: 'folder-test-id',
						text: 'Hello world',
						languageCodeHints: '',
					};
					return params[paramName];
				});
		});

		it('should detect language successfully', async () => {
			mockTranslationServiceClient.detectLanguage.mockResolvedValue({
				languageCode: 'en',
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toMatchObject({
				success: true,
				text: 'Hello world',
				languageCode: 'en',
			});
		});

		it('should use language hints when provided', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string) => {
					if (paramName === 'languageCodeHints') return 'en,ru,es';
					const params: Record<string, any> = {
						resource: 'text',
						operation: 'detectLanguage',
						folderId: 'folder-test-id',
						text: 'Hello',
					};
					return params[paramName];
				});

			mockTranslationServiceClient.detectLanguage.mockResolvedValue({
				languageCode: 'en',
			});

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(mockTranslationServiceClient.detectLanguage).toHaveBeenCalledWith(
				expect.objectContaining({
					languageCodeHints: ['en', 'ru', 'es'],
				}),
			);
		});

		it('should handle error with continueOnFail', async () => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			mockTranslationServiceClient.detectLanguage.mockRejectedValue(new Error('API Error'));

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toMatchObject({
				error: 'Yandex Cloud SDK error in detect language',
				success: false,
			});
		});
	});

	describe('List Languages Operation', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string) => {
					const params: Record<string, any> = {
						resource: 'languages',
						operation: 'list',
						folderId: 'folder-test-id',
					};
					return params[paramName];
				});
		});

		it('should list languages successfully', async () => {
			mockTranslationServiceClient.listLanguages.mockResolvedValue({
				languages: [
					{ code: 'en', name: 'English' },
					{ code: 'ru', name: 'русский' },
					{ code: 'es', name: 'Español' },
				],
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0]).toHaveLength(3);
			expect(result[0][0].json).toMatchObject({
				code: 'en',
				name: 'English',
			});
			expect(result[0][1].json).toMatchObject({
				code: 'ru',
				name: 'русский',
			});
		});

		it('should handle API errors', async () => {
			mockTranslationServiceClient.listLanguages.mockRejectedValue(
				new Error('API Error'),
			);

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('Yandex Cloud SDK error in list languages');
		});
	});

	describe('Credentials Validation', () => {
		it('should throw error for invalid service account JSON', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				serviceAccountJson: 'invalid-json',
				folderId: 'folder-test-id',
			});

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string) => {
					const params: Record<string, any> = {
						resource: 'languages',
						operation: 'list',
						folderId: 'folder-test-id',
					};
					return params[paramName];
				});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('Invalid service account JSON credentials');
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
					const params: Record<string, any> = {
						resource: 'languages',
						operation: 'list',
						folderId: '',
					};
					return params[paramName];
				});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('Folder ID is required either in credentials or as node parameter');
		});
	});
});

