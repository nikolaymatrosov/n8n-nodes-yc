import { YandexCloudSpeechKit } from '../YandexCloudSpeechKit.node';
import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

// Mock Yandex Cloud SDK
jest.mock('@yandex-cloud/nodejs-sdk');

// Mock TTS module
jest.mock('@yandex-cloud/nodejs-sdk/dist/clients/ai-tts-v3/index', () => {
	return {
		tts: {
			AudioFormatOptions: {
				fromPartial: jest.fn((data: any) => data),
			},
			ContainerAudio: {
				fromPartial: jest.fn((data: any) => data),
			},
			ContainerAudio_ContainerAudioType: {
				WAV: 1,
				MP3: 3,
				OGG_OPUS: 2,
			},
			RawAudio: {
				fromPartial: jest.fn((data: any) => data),
			},
			RawAudio_AudioEncoding: {
				LINEAR16_PCM: 1,
			},
			Hints: {
				fromPartial: jest.fn((data: any) => data),
			},
			UtteranceSynthesisRequest: {
				fromPartial: jest.fn((data: any) => data),
			},
		},
		ttsService: {
			SynthesizerClient: jest.fn(),
		},
	};
}, { virtual: true });

describe('YandexCloudSpeechKit Node', () => {
	let node: YandexCloudSpeechKit;
	let mockExecuteFunctions: Partial<IExecuteFunctions>;
	let mockSession: any;
	let mockSynthesizerClient: any;
	let mockResponseStream: any;

	beforeEach(() => {
		jest.clearAllMocks();

		node = new YandexCloudSpeechKit();

		// Mock Synthesizer Client
		mockResponseStream = {
			[Symbol.asyncIterator]: jest.fn(),
		};

		mockSynthesizerClient = {
			utteranceSynthesis: jest.fn().mockReturnValue(mockResponseStream),
		};

		// Mock Session
		mockSession = {
			client: jest.fn().mockReturnValue(mockSynthesizerClient),
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
			helpers: {
				prepareBinaryData: jest.fn().mockResolvedValue({
					data: 'mock-binary-id',
					mimeType: 'audio/wav',
					fileName: 'synthesized_audio.wav',
				}),
			} as any,
		};
	});

	describe('Node Definition', () => {
		it('should have correct basic properties', () => {
			expect(node.description.displayName).toBe('Yandex Cloud SpeechKit');
			expect(node.description.name).toBe('yandexCloudSpeechKit');
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

		it('should have speech resource', () => {
			const resourceProperty = node.description.properties.find(
				(prop) => prop.name === 'resource',
			);
			expect(resourceProperty).toBeDefined();
			expect(resourceProperty?.options).toContainEqual({
				name: 'Speech',
				value: 'speech',
			});
		});

		it('should have synthesize operation', () => {
			const operationProperty = node.description.properties.find(
				(prop) => prop.name === 'operation',
			);
			expect(operationProperty).toBeDefined();
			expect(operationProperty?.options).toContainEqual({
				name: 'Synthesize',
				value: 'synthesize',
				description: 'Convert text to speech',
				action: 'Synthesize speech from text',
			});
		});
	});

	describe('Credential Validation', () => {
		it('should throw error for invalid service account JSON', async () => {
			mockExecuteFunctions.getCredentials = jest.fn().mockResolvedValue({
				serviceAccountJson: 'invalid-json',
			});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow(NodeOperationError);
		});

		it('should throw error for missing service_account_id', async () => {
			mockExecuteFunctions.getCredentials = jest.fn().mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					id: 'key-test-id',
					private_key: 'test-private-key',
				}),
			});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('service_account_id or serviceAccountId is required');
		});

		it('should throw error for missing id/accessKeyId', async () => {
			mockExecuteFunctions.getCredentials = jest.fn().mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					service_account_id: 'sa-test-id',
					private_key: 'test-private-key',
				}),
			});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('id or accessKeyId is required');
		});

		it('should throw error for missing private_key', async () => {
			mockExecuteFunctions.getCredentials = jest.fn().mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					service_account_id: 'sa-test-id',
					id: 'key-test-id',
				}),
			});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('private_key or privateKey is required');
		});

		it('should accept camelCase service account JSON', async () => {
			mockExecuteFunctions.getCredentials = jest.fn().mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					serviceAccountId: 'sa-test-id',
					accessKeyId: 'key-test-id',
					privateKey: 'test-private-key',
				}),
			});

			const getNodeParam = mockExecuteFunctions.getNodeParameter as jest.Mock;
			getNodeParam.mockImplementation((paramName: string) => {
				const params: Record<string, any> = {
					resource: 'speech',
					operation: 'synthesize',
					text: 'Test text',
					voice: 'alena',
					role: 'neutral',
					audioFormatType: 'container',
					containerType: 'WAV',
					additionalOptions: {},
				};
				return params[paramName];
			});

			// Setup mock stream
			mockResponseStream[Symbol.asyncIterator] = async function* () {
				yield {
					audioChunk: { data: Buffer.from('audio-data') },
				};
			};

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result).toBeDefined();
			expect(result[0][0].json.success).toBe(true);
		});
	});

	describe('Synthesize Operation', () => {
		beforeEach(() => {
			const getNodeParam = mockExecuteFunctions.getNodeParameter as jest.Mock;
			getNodeParam.mockImplementation((paramName: string) => {
				const params: Record<string, any> = {
					resource: 'speech',
					operation: 'synthesize',
					text: 'Hello, world!',
					voice: 'alena',
					role: 'neutral',
					audioFormatType: 'container',
					containerType: 'WAV',
					additionalOptions: {},
				};
				return params[paramName];
			});
		});

		it('should successfully synthesize speech with WAV container', async () => {
			// Setup mock stream
			mockResponseStream[Symbol.asyncIterator] = async function* () {
				yield {
					audioChunk: { data: Buffer.from('audio-chunk-1') },
				};
				yield {
					audioChunk: { data: Buffer.from('audio-chunk-2') },
				};
			};

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(mockSession.client).toHaveBeenCalled();
			expect(mockSynthesizerClient.utteranceSynthesis).toHaveBeenCalledWith(
				expect.objectContaining({
					text: 'Hello, world!',
					hints: expect.arrayContaining([
						expect.objectContaining({
							voice: 'alena',
							role: 'neutral',
						}),
					]),
				}),
			);

			expect(mockExecuteFunctions.helpers?.prepareBinaryData).toHaveBeenCalledWith(
				expect.any(Buffer),
				'synthesized_audio.wav',
				'audio/wav',
			);

			expect(result[0]).toHaveLength(1);
			expect(result[0][0].json).toMatchObject({
				success: true,
				operation: 'synthesize',
				text: 'Hello, world!',
				voice: 'alena',
				role: 'neutral',
				audioFormat: 'container',
			});
			expect(result[0][0].binary?.data).toBeDefined();
		});

		it('should successfully synthesize speech with MP3 container', async () => {
			const getNodeParam = mockExecuteFunctions.getNodeParameter as jest.Mock;
			getNodeParam.mockImplementation((paramName: string) => {
				const params: Record<string, any> = {
					resource: 'speech',
					operation: 'synthesize',
					text: 'Test MP3',
					voice: 'masha',
					role: 'good',
					audioFormatType: 'container',
					containerType: 'MP3',
					additionalOptions: {},
				};
				return params[paramName];
			});

			mockResponseStream[Symbol.asyncIterator] = async function* () {
				yield {
					audioChunk: { data: Buffer.from('mp3-data') },
				};
			};

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(mockExecuteFunctions.helpers?.prepareBinaryData).toHaveBeenCalledWith(
				expect.any(Buffer),
				'synthesized_audio.mp3',
				'audio/mpeg',
			);

			expect(result[0][0].json.success).toBe(true);
		});

		it('should successfully synthesize speech with OGG container', async () => {
			const getNodeParam = mockExecuteFunctions.getNodeParameter as jest.Mock;
			getNodeParam.mockImplementation((paramName: string) => {
				const params: Record<string, any> = {
					resource: 'speech',
					operation: 'synthesize',
					text: 'Test OGG',
					voice: 'filipp',
					role: 'neutral',
					audioFormatType: 'container',
					containerType: 'OGG_OPUS',
					additionalOptions: {},
				};
				return params[paramName];
			});

			mockResponseStream[Symbol.asyncIterator] = async function* () {
				yield {
					audioChunk: { data: Buffer.from('ogg-data') },
				};
			};

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(mockExecuteFunctions.helpers?.prepareBinaryData).toHaveBeenCalledWith(
				expect.any(Buffer),
				'synthesized_audio.ogg',
				'audio/ogg',
			);

			expect(result[0][0].json.success).toBe(true);
		});

		it('should successfully synthesize speech with raw PCM format', async () => {
			const getNodeParam = mockExecuteFunctions.getNodeParameter as jest.Mock;
			getNodeParam.mockImplementation((paramName: string) => {
				const params: Record<string, any> = {
					resource: 'speech',
					operation: 'synthesize',
					text: 'Test raw audio',
					voice: 'alena',
					role: 'neutral',
					audioFormatType: 'raw',
					sampleRate: 16000,
					additionalOptions: {},
				};
				return params[paramName];
			});

			mockResponseStream[Symbol.asyncIterator] = async function* () {
				yield {
					audioChunk: { data: Buffer.from('raw-pcm-data') },
				};
			};

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(mockExecuteFunctions.helpers?.prepareBinaryData).toHaveBeenCalledWith(
				expect.any(Buffer),
				'synthesized_audio.raw',
				'audio/l16',
			);

			expect(result[0][0].json.success).toBe(true);
		});

		it('should apply additional options (speed, volume, pitch)', async () => {
			const getNodeParam = mockExecuteFunctions.getNodeParameter as jest.Mock;
			getNodeParam.mockImplementation((paramName: string) => {
				const params: Record<string, any> = {
					resource: 'speech',
					operation: 'synthesize',
					text: 'Test with options',
					voice: 'alena',
					role: 'neutral',
					audioFormatType: 'container',
					containerType: 'WAV',
					additionalOptions: {
						speed: 1.5,
						volume: -10,
						pitchShift: 100,
					},
				};
				return params[paramName];
			});

			mockResponseStream[Symbol.asyncIterator] = async function* () {
				yield {
					audioChunk: { data: Buffer.from('audio-data') },
				};
			};

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(mockSynthesizerClient.utteranceSynthesis).toHaveBeenCalledWith(
				expect.objectContaining({
					hints: expect.arrayContaining([
						expect.objectContaining({
							speed: 1.5,
							volume: -10,
							pitchShift: 100,
						}),
					]),
				}),
			);

			expect(result[0][0].json.success).toBe(true);
		});

		it('should handle empty audio response', async () => {
			mockResponseStream[Symbol.asyncIterator] = async function* () {
				yield {
					audioChunk: undefined,
				};
			};

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(mockExecuteFunctions.helpers?.prepareBinaryData).toHaveBeenCalledWith(
				expect.any(Buffer),
				expect.any(String),
				expect.any(String),
			);

			const bufferArg = (mockExecuteFunctions.helpers?.prepareBinaryData as jest.Mock).mock
				.calls[0][0];
			expect(bufferArg.length).toBe(0);
		});
	});

	describe('Error Handling', () => {
		beforeEach(() => {
			const getNodeParam = mockExecuteFunctions.getNodeParameter as jest.Mock;
			getNodeParam.mockImplementation((paramName: string) => {
				const params: Record<string, any> = {
					resource: 'speech',
					operation: 'synthesize',
					text: 'Test text',
					voice: 'alena',
					role: 'neutral',
					audioFormatType: 'container',
					containerType: 'WAV',
					additionalOptions: {},
				};
				return params[paramName];
			});
		});

		it('should throw error when synthesis fails', async () => {
			mockSynthesizerClient.utteranceSynthesis.mockImplementation(() => {
				throw new Error('Synthesis failed');
			});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('Synthesis failed');
		});

		it('should handle error with continueOnFail enabled', async () => {
			mockExecuteFunctions.continueOnFail = jest.fn().mockReturnValue(true);
			mockSynthesizerClient.utteranceSynthesis.mockImplementation(() => {
				throw new Error('API Error');
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toMatchObject({
				error: 'API Error',
				success: false,
			});
		});

		it('should handle stream error with continueOnFail enabled', async () => {
			mockExecuteFunctions.continueOnFail = jest.fn().mockReturnValue(true);

			mockResponseStream[Symbol.asyncIterator] = async function* () {
				throw new Error('Stream error');
			};

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			// Test passes if execution completes without throwing
			expect(mockExecuteFunctions.continueOnFail).toHaveBeenCalled();
		});
	});

	describe('Multiple Items Processing', () => {
		it('should process multiple input items', async () => {
			mockExecuteFunctions.getInputData = jest.fn().mockReturnValue([
				{ json: {} },
				{ json: {} },
			]);

			const getNodeParam = mockExecuteFunctions.getNodeParameter as jest.Mock;
			getNodeParam.mockImplementation((paramName: string, itemIndex: number) => {
				const params: Record<string, any> = {
					resource: 'speech',
					operation: 'synthesize',
					text: `Text ${itemIndex + 1}`,
					voice: 'alena',
					role: 'neutral',
					audioFormatType: 'container',
					containerType: 'WAV',
					additionalOptions: {},
				};
				return params[paramName];
			});

			mockResponseStream[Symbol.asyncIterator] = async function* () {
				yield {
					audioChunk: { data: Buffer.from('audio-data') },
				};
			};

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0]).toHaveLength(2);
			expect(result[0][0].json.text).toBe('Text 1');
			expect(result[0][1].json.text).toBe('Text 2');
		});
	});
});

