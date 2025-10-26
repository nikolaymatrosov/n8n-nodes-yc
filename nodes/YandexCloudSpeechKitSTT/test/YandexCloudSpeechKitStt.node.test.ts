import { YandexCloudSpeechKitStt } from '../YandexCloudSpeechKitStt.node';
import type { IExecuteFunctions } from 'n8n-workflow';

// Mock Yandex Cloud SDK
jest.mock('@yandex-cloud/nodejs-sdk');

// Mock STT module
jest.mock('@yandex-cloud/nodejs-sdk/dist/clients/ai-stt-v3/index', () => {
	return {
		stt: {
			AudioFormatOptions: {
				fromPartial: jest.fn((data: any) => data),
			},
			RawAudio: {
				fromPartial: jest.fn((data: any) => data),
			},
			RawAudio_AudioEncoding: {
				LINEAR16_PCM: 1,
			},
			ContainerAudio: {
				fromPartial: jest.fn((data: any) => data),
			},
			ContainerAudio_ContainerAudioType: {
				OGG_OPUS: 1,
				MP3: 2,
			},
			LanguageRestrictionOptions: {
				fromPartial: jest.fn((data: any) => data),
			},
			LanguageRestrictionOptions_LanguageRestrictionType: {
				WHITELIST: 1,
			},
			TextNormalizationOptions: {
				fromPartial: jest.fn((data: any) => data),
			},
			TextNormalizationOptions_TextNormalization: {
				TEXT_NORMALIZATION_ENABLED: 1,
			},
			RecognitionModelOptions: {
				fromPartial: jest.fn((data: any) => data),
			},
			RecognitionModelOptions_AudioProcessingType: {
				FULL_DATA: 2,
			},
			RecognizeFileRequest: {
				fromPartial: jest.fn((data: any) => data),
			},
		},
		sttService: {
			AsyncRecognizerClient: jest.fn(),
		},
	};
}, { virtual: true });

describe('YandexCloudSpeechKitStt Node', () => {
	let node: YandexCloudSpeechKitStt;
	let mockExecuteFunctions: Partial<IExecuteFunctions>;
	let mockSession: any;
	let mockAsyncRecognizerClient: any;

	beforeEach(() => {
		jest.clearAllMocks();

		node = new YandexCloudSpeechKitStt();

		// Mock Async Recognizer Client
		mockAsyncRecognizerClient = {
			recognizeFile: jest.fn(),
			getRecognition: jest.fn(),
		};

		// Mock Session
		mockSession = {
			client: jest.fn().mockReturnValue(mockAsyncRecognizerClient),
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
			helpers: {} as any,
		};
	});

	describe('Node Definition', () => {
		it('should have correct basic properties', () => {
			expect(node.description.displayName).toBe('Yandex Cloud SpeechKit STT');
			expect(node.description.name).toBe('yandexCloudSpeechKitStt');
			expect(node.description.group).toContain('transform');
			expect(node.description.version).toBe(1);
		});

		it('should have correct credential requirements', () => {
			expect(node.description.credentials).toHaveLength(1);
			expect(node.description.credentials?.[0].name).toBe('yandexCloudAuthorizedApi');
			expect(node.description.credentials?.[0].required).toBe(true);
		});

		it('should have two operations defined', () => {
			const operationProperty = node.description.properties.find(
				(p) => p.name === 'operation',
			);
			expect(operationProperty).toBeDefined();
			expect(operationProperty?.type).toBe('options');

			const options = (operationProperty as any)?.options || [];
			expect(options).toHaveLength(2);
			expect(options[0].value).toBe('recognizeAudio');
			expect(options[1].value).toBe('getResults');
		});

		it('should have audioUrl parameter for recognizeAudio operation', () => {
			const audioUrlProperty = node.description.properties.find(
				(p) => p.name === 'audioUrl',
			);
			expect(audioUrlProperty).toBeDefined();
			expect(audioUrlProperty?.required).toBe(true);
		});

		it('should have operationId parameter for getResults operation', () => {
			const operationIdProperty = node.description.properties.find(
				(p) => p.name === 'operationId',
			);
			expect(operationIdProperty).toBeDefined();
			expect(operationIdProperty?.required).toBe(true);
		});
	});

	describe('Credential Validation', () => {
	it('should validate service account JSON with snake_case format', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('recognizeAudio')
			.mockReturnValueOnce('https://storage.yandexcloud.net/bucket/audio.wav')
			.mockReturnValueOnce('ru-RU')
			.mockReturnValueOnce('audioFormat')
			.mockReturnValueOnce('LPCM')
			.mockReturnValueOnce({});

		mockAsyncRecognizerClient.recognizeFile.mockResolvedValue({
			id: 'operation-123',
		});

		await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

		expect(mockSession.client).toHaveBeenCalledWith(
			expect.anything(),
			'stt.api.cloud.yandex.net:443',
		);
	});

		it('should throw error for missing service_account_id', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					id: 'key-test-id',
					private_key: 'test-private-key',
				}),
			});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('service_account_id or serviceAccountId is required');
		});

		it('should throw error for missing access key id', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					service_account_id: 'sa-test-id',
					private_key: 'test-private-key',
				}),
			});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('id or accessKeyId is required');
		});

		it('should throw error for missing private key', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					service_account_id: 'sa-test-id',
					id: 'key-test-id',
				}),
			});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('private_key or privateKey is required');
		});

		it('should throw error for invalid JSON credentials', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				serviceAccountJson: 'invalid json',
			});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow(/Invalid service account JSON credentials/);
		});
	});

	describe('Operation: recognizeAudio', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('recognizeAudio');
		});

	it('should start audio recognition with minimal parameters', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('https://storage.yandexcloud.net/bucket/audio.wav')
			.mockReturnValueOnce('ru-RU')
			.mockReturnValueOnce('audioFormat')
			.mockReturnValueOnce('LPCM')
			.mockReturnValueOnce({});

		mockAsyncRecognizerClient.recognizeFile.mockResolvedValue({
			id: 'operation-123',
		});

		const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

		expect(result[0]).toHaveLength(1);
		expect(result[0][0].json).toMatchObject({
			success: true,
			operationId: 'operation-123',
			audioUrl: 'https://storage.yandexcloud.net/bucket/audio.wav',
			model: 'general',
			languageCode: 'ru-RU',
			status: 'RUNNING',
		});
	});

	it('should start recognition with LPCM audio format', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('https://storage.yandexcloud.net/bucket/audio.wav')
			.mockReturnValueOnce('ru-RU')
			.mockReturnValueOnce('audioFormat')
			.mockReturnValueOnce('LPCM')
			.mockReturnValueOnce({
				sampleRate: 16000,
				audioChannelCount: 2,
			});

		mockAsyncRecognizerClient.recognizeFile.mockResolvedValue({
			id: 'operation-456',
		});

		const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

		expect(mockAsyncRecognizerClient.recognizeFile).toHaveBeenCalled();
		expect(result[0][0].json.success).toBe(true);
		expect(result[0][0].json.operationId).toBe('operation-456');
	});

	it('should start recognition with OGG_OPUS format', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('https://storage.yandexcloud.net/bucket/audio.ogg')
			.mockReturnValueOnce('en-US')
			.mockReturnValueOnce('audioFormat')
			.mockReturnValueOnce('OGG_OPUS')
			.mockReturnValueOnce({});

		mockAsyncRecognizerClient.recognizeFile.mockResolvedValue({
			id: 'operation-789',
		});

		const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

		expect(result[0][0].json).toMatchObject({
			success: true,
			operationId: 'operation-789',
			model: 'general',
			languageCode: 'en-US',
		});
	});

	it('should start recognition with profanity filter enabled', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('https://storage.yandexcloud.net/bucket/audio.mp3')
			.mockReturnValueOnce('ru-RU')
			.mockReturnValueOnce('audioFormat')
			.mockReturnValueOnce('MP3')
			.mockReturnValueOnce({
				profanityFilter: true,
				literatureText: true,
			});

		mockAsyncRecognizerClient.recognizeFile.mockResolvedValue({
			id: 'operation-999',
		});

		const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

		expect(result[0][0].json.success).toBe(true);
	});

	it('should recognize audio using MIME type (audio/wav)', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('https://storage.yandexcloud.net/bucket/audio.wav')
			.mockReturnValueOnce('ru-RU')
			.mockReturnValueOnce('mimeType')
			.mockReturnValueOnce('audio/wav')
			.mockReturnValueOnce({});

		mockAsyncRecognizerClient.recognizeFile.mockResolvedValue({
			id: 'operation-mime-1',
		});

		const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

		expect(result[0][0].json).toMatchObject({
			success: true,
			operationId: 'operation-mime-1',
		});
	});

	it('should recognize audio using MIME type (audio/ogg)', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('https://storage.yandexcloud.net/bucket/audio.ogg')
			.mockReturnValueOnce('ru-RU')
			.mockReturnValueOnce('mimeType')
			.mockReturnValueOnce('audio/ogg')
			.mockReturnValueOnce({});

		mockAsyncRecognizerClient.recognizeFile.mockResolvedValue({
			id: 'operation-mime-2',
		});

		const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

		expect(result[0][0].json).toMatchObject({
			success: true,
			operationId: 'operation-mime-2',
		});
	});

	it('should recognize audio using MIME type (audio/mpeg)', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('https://storage.yandexcloud.net/bucket/audio.mp3')
			.mockReturnValueOnce('en-US')
			.mockReturnValueOnce('mimeType')
			.mockReturnValueOnce('audio/mpeg')
			.mockReturnValueOnce({});

		mockAsyncRecognizerClient.recognizeFile.mockResolvedValue({
			id: 'operation-mime-3',
		});

		const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

		expect(result[0][0].json).toMatchObject({
			success: true,
			operationId: 'operation-mime-3',
		});
	});

	it('should handle API error in recognizeAudio', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('https://storage.yandexcloud.net/bucket/audio.wav')
			.mockReturnValueOnce('ru-RU')
			.mockReturnValueOnce('audioFormat')
			.mockReturnValueOnce('LPCM')
			.mockReturnValueOnce({});

		mockAsyncRecognizerClient.recognizeFile.mockRejectedValue(
			new Error('API Error: Invalid audio URL'),
		);

		await expect(
			node.execute.call(mockExecuteFunctions as IExecuteFunctions),
		).rejects.toThrow('API Error: Invalid audio URL');
	});

	it('should handle error with continueOnFail enabled', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('https://storage.yandexcloud.net/bucket/audio.wav')
			.mockReturnValueOnce('ru-RU')
			.mockReturnValueOnce('audioFormat')
			.mockReturnValueOnce('LPCM')
			.mockReturnValueOnce({});

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		mockAsyncRecognizerClient.recognizeFile.mockRejectedValue(
			new Error('Network error'),
		);

		const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

		expect(result[0][0].json).toMatchObject({
			error: 'Network error',
			success: false,
		});
	});
	});

	describe('Operation: getResults', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('getResults');
		});

		it('should get completed recognition results', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('operation-123')
				.mockReturnValueOnce({});

			const mockResponseStream = {
				[Symbol.asyncIterator]: async function* () {
					yield {
						channelTag: '1',
						final: {
							alternatives: [{ text: 'Hello world', confidence: 0.95 }],
						},
					};
				},
			};

			mockAsyncRecognizerClient.getRecognition.mockReturnValue(mockResponseStream);

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0]).toHaveLength(1);
			expect(result[0][0].json).toMatchObject({
				success: true,
				operationId: 'operation-123',
				status: 'DONE',
				text: 'Hello world',
				channelTag: '1',
			});
			expect(result[0][0].json.attemptsUsed).toBe(1);
		});

		it('should collect multiple final results', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('operation-456')
				.mockReturnValueOnce({});

			const mockResponseStream = {
				[Symbol.asyncIterator]: async function* () {
					yield {
						channelTag: '1',
						final: {
							alternatives: [{ text: 'Hello', confidence: 0.95 }],
						},
					};
					yield {
						channelTag: '1',
						final: {
							alternatives: [{ text: 'world', confidence: 0.92 }],
						},
					};
					yield {
						eouUpdate: { timeMs: 5000 },
					};
				},
			};

			mockAsyncRecognizerClient.getRecognition.mockReturnValue(mockResponseStream);

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json.text).toBe('Hello world');
			expect(result[0][0].json.status).toBe('DONE');
		});

		it('should handle polling with partial results', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('operation-789')
				.mockReturnValueOnce({
					pollInterval: 1,
					maxAttempts: 3,
				});

			let attempt = 0;
			mockAsyncRecognizerClient.getRecognition.mockImplementation(() => ({
				[Symbol.asyncIterator]: async function* () {
					attempt++;
					if (attempt === 2) {
						yield {
							channelTag: '1',
							final: {
								alternatives: [{ text: 'Final result', confidence: 0.9 }],
							},
						};
					} else {
						yield {
							partial: {
								alternatives: [{ text: 'Partial', confidence: 0.7 }],
							},
						};
					}
				},
			}));

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json.status).toBe('DONE');
			expect(result[0][0].json.attemptsUsed).toBe(2);
		});

		it('should timeout after max attempts', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('operation-timeout')
				.mockReturnValueOnce({
					pollInterval: 1,
					maxAttempts: 2,
				});

			mockAsyncRecognizerClient.getRecognition.mockReturnValue({
				[Symbol.asyncIterator]: async function* () {
					yield {
						partial: {
							alternatives: [{ text: 'Still processing', confidence: 0.5 }],
						},
					};
				},
			});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow(/Recognition timeout after 2 attempts/);
		});

	it('should return partial results on timeout if enabled', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('operation-partial')
			.mockReturnValueOnce({
				pollInterval: 1,
				maxAttempts: 2,
				returnPartialResults: true,
			});

		let callCount = 0;
		mockAsyncRecognizerClient.getRecognition.mockReturnValue({
			[Symbol.asyncIterator]: async function* () {
				callCount++;
				if (callCount === 1) {
					yield {
						channelTag: '1',
						partial: {
							alternatives: [{ text: 'Partial text', confidence: 0.6 }],
						},
					};
				}
				// Second call returns no new data
			},
		});

		const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

		expect(result[0][0].json).toMatchObject({
			success: false,
			status: 'RUNNING',
			partialText: 'Partial text',
		});
		expect(result[0][0].json.error).toContain('timeout');
	});

	it('should handle "operation data is not ready" race condition', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('operation-race')
			.mockReturnValueOnce({
				pollInterval: 1,
				maxAttempts: 5,
			});

		let callCount = 0;
		mockAsyncRecognizerClient.getRecognition.mockImplementation(() => {
			callCount++;
			if (callCount <= 2) {
				// First two attempts: operation not ready yet (race condition)
				throw {
					message: 'ClientError: /speechkit.stt.v3.AsyncRecognizer/GetRecognition NOT_FOUND: operation data is not ready f8djm3hl8m9qs9kbjakf',
				};
			}
			// Third attempt: return final result
			return {
				[Symbol.asyncIterator]: async function* () {
					yield {
						channelTag: '1',
						final: {
							alternatives: [{ text: 'Recognition completed', confidence: 0.95 }],
						},
					};
				},
			};
		});

		const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

		expect(result[0][0].json).toMatchObject({
			success: true,
			status: 'DONE',
			text: 'Recognition completed',
		});
		expect(result[0][0].json.attemptsUsed).toBe(3);
		expect(callCount).toBe(3);
	});

	it('should throw error for non-race-condition errors', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('operation-error')
			.mockReturnValueOnce({
				pollInterval: 1,
				maxAttempts: 3,
			});

		mockAsyncRecognizerClient.getRecognition.mockImplementation(() => {
			throw new Error('ClientError: PERMISSION_DENIED: Invalid credentials');
		});

		await expect(
			node.execute.call(mockExecuteFunctions as IExecuteFunctions),
		).rejects.toThrow('PERMISSION_DENIED');
	});

		it('should handle API error in getResults', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('operation-error')
				.mockReturnValueOnce({});

			mockAsyncRecognizerClient.getRecognition.mockImplementation(() => {
				throw new Error('API Error: Invalid operation ID');
			});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('API Error: Invalid operation ID');
		});

		it('should handle error with continueOnFail in getResults', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('operation-error')
				.mockReturnValueOnce({});

			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

			mockAsyncRecognizerClient.getRecognition.mockImplementation(() => {
				throw new Error('Connection timeout');
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toMatchObject({
				error: 'Connection timeout',
				success: false,
			});
		});
	});

	describe('Multiple Items Processing', () => {
	it('should process multiple recognition requests', async () => {
		(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
			{ json: {} },
			{ json: {} },
		]);

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('recognizeAudio')
			.mockReturnValueOnce('https://storage.yandexcloud.net/bucket/audio1.wav')
			.mockReturnValueOnce('ru-RU')
			.mockReturnValueOnce('audioFormat')
			.mockReturnValueOnce('LPCM')
			.mockReturnValueOnce({})
			.mockReturnValueOnce('recognizeAudio')
			.mockReturnValueOnce('https://storage.yandexcloud.net/bucket/audio2.wav')
			.mockReturnValueOnce('en-US')
			.mockReturnValueOnce('audioFormat')
			.mockReturnValueOnce('LPCM')
			.mockReturnValueOnce({});

		mockAsyncRecognizerClient.recognizeFile
			.mockResolvedValueOnce({ id: 'op-1' })
			.mockResolvedValueOnce({ id: 'op-2' });

		const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

		expect(result[0]).toHaveLength(2);
		expect(result[0][0].json.operationId).toBe('op-1');
		expect(result[0][1].json.operationId).toBe('op-2');
	});

	it('should handle mixed success and failure with continueOnFail', async () => {
		(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
			{ json: {} },
			{ json: {} },
		]);

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('recognizeAudio')
			.mockReturnValueOnce('https://storage.yandexcloud.net/bucket/audio1.wav')
			.mockReturnValueOnce('ru-RU')
			.mockReturnValueOnce('audioFormat')
			.mockReturnValueOnce('LPCM')
			.mockReturnValueOnce({})
			.mockReturnValueOnce('recognizeAudio')
			.mockReturnValueOnce('https://storage.yandexcloud.net/bucket/audio2.wav')
			.mockReturnValueOnce('en-US')
			.mockReturnValueOnce('audioFormat')
			.mockReturnValueOnce('LPCM')
			.mockReturnValueOnce({});

		mockAsyncRecognizerClient.recognizeFile
			.mockResolvedValueOnce({ id: 'op-1' })
			.mockRejectedValueOnce(new Error('API Error'));

		const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

		expect(result[0]).toHaveLength(2);
		expect(result[0][0].json.success).toBe(true);
		expect(result[0][1].json.success).toBe(false);
		expect(result[0][1].json.error).toBe('API Error');
	});
	});
});

