import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { Session } from '@yandex-cloud/nodejs-sdk';
import { ttsService, tts } from '@yandex-cloud/nodejs-sdk/dist/clients/ai-tts-v3/index';
import { mapKeys, camelCase } from 'lodash';
import { YandexCloudSdkError } from '@utils/sdkErrorHandling';
import { withSdkErrorHandling } from '@utils/errorHandling';

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
 * Get file extension and MIME type based on audio format
 */
function getAudioFormat(formatType: string, containerType?: string): { extension: string; mimeType: string } {
	if (formatType === 'container') {
		switch (containerType) {
			case 'WAV':
				return { extension: 'wav', mimeType: 'audio/wav' };
			case 'OGG_OPUS':
				return { extension: 'ogg', mimeType: 'audio/ogg' };
			case 'MP3':
				return { extension: 'mp3', mimeType: 'audio/mpeg' };
			default:
				return { extension: 'wav', mimeType: 'audio/wav' };
		}
	}
	// Raw audio defaults to WAV-like format
	return { extension: 'raw', mimeType: 'audio/l16' };
}

export class YandexCloudSpeechKit implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Yandex Cloud SpeechKit',
		name: 'yandexCloudSpeechKit',
		icon: 'file:SpeechKit.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Synthesize speech using Yandex SpeechKit TTS API',
		defaults: {
			name: 'Yandex Cloud SpeechKit',
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
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Speech',
						value: 'speech',
					},
				],
				default: 'speech',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['speech'],
					},
				},
				options: [
					{
						name: 'Synthesize',
						value: 'synthesize',
						description: 'Convert text to speech',
						action: 'Synthesize speech from text',
					},
				],
				default: 'synthesize',
			},
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['speech'],
						operation: ['synthesize'],
					},
				},
				default: '',
				placeholder: 'Text to synthesize',
				description: 'The text to convert to speech',
				typeOptions: {
					rows: 4,
				},
			},
			{
				displayName: 'Voice',
				name: 'voice',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['speech'],
						operation: ['synthesize'],
					},
				},
				options: [
					{
						name: 'Alena (Female, Russian)',
						value: 'alena',
					},
					{
						name: 'Filipp (Male, Russian)',
						value: 'filipp',
					},
					{
						name: 'Jane (Female, Russian/English)',
						value: 'jane',
					},
					{
						name: 'John (Male, English)',
						value: 'john',
					},
					{
						name: 'Masha (Female, Russian)',
						value: 'masha',
					},
					{
						name: 'Omazh (Female, Russian)',
						value: 'omazh',
					},
					{
						name: 'Zahar (Male, Russian)',
						value: 'zahar',
					},
				],
				default: 'alena',
				description: 'Voice to use for synthesis',
			},
			{
				displayName: 'Role',
				name: 'role',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['speech'],
						operation: ['synthesize'],
					},
				},
				options: [
					{
						name: 'Neutral',
						value: 'neutral',
					},
					{
						name: 'Good',
						value: 'good',
					},
					{
						name: 'Evil',
						value: 'evil',
					},
				],
				default: 'neutral',
				description: 'Emotion or role for the voice',
			},
			{
				displayName: 'Audio Format Type',
				name: 'audioFormatType',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['speech'],
						operation: ['synthesize'],
					},
				},
				options: [
					{
						name: 'Container (WAV, MP3, OGG)',
						value: 'container',
					},
					{
						name: 'Raw PCM',
						value: 'raw',
					},
				],
				default: 'container',
				description: 'Type of audio format to output',
			},
			{
				displayName: 'Container Type',
				name: 'containerType',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['speech'],
						operation: ['synthesize'],
						audioFormatType: ['container'],
					},
				},
				options: [
					{
						name: 'WAV',
						value: 'WAV',
					},
					{
						name: 'MP3',
						value: 'MP3',
					},
					{
						name: 'OGG Opus',
						value: 'OGG_OPUS',
					},
				],
				default: 'WAV',
				description: 'Container format for the audio',
			},
			{
				displayName: 'Sample Rate',
				name: 'sampleRate',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['speech'],
						operation: ['synthesize'],
						audioFormatType: ['raw'],
					},
				},
				options: [
					{
						name: '8000 Hz',
						value: 8000,
					},
					{
						name: '16000 Hz',
						value: 16000,
					},
					{
						name: '22050 Hz',
						value: 22050,
					},
					{
						name: '48000 Hz',
						value: 48000,
					},
				],
				default: 22050,
				description: 'Sample rate for raw PCM audio',
			},
			{
				displayName: 'Additional Options',
				name: 'additionalOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						resource: ['speech'],
						operation: ['synthesize'],
					},
				},
				options: [
					{
						displayName: 'Speed',
						name: 'speed',
						type: 'number',
						default: 1.0,
						description: 'Speech speed multiplier (0.1 to 3.0)',
						typeOptions: {
							minValue: 0.1,
							maxValue: 3.0,
							numberPrecision: 1,
						},
					},
					{
						displayName: 'Volume',
						name: 'volume',
						type: 'number',
						default: 0,
						description: 'Volume adjustment. For LUFS normalization: -145 to 0 (default -19). For MAX_PEAK: 0 to 1 (default 0.7).',
						typeOptions: {
							minValue: -145,
							maxValue: 1,
						},
					},
					{
						displayName: 'Pitch Shift',
						name: 'pitchShift',
						type: 'number',
						default: 0,
						description: 'Pitch adjustment in Hz (-1000 to 1000)',
						typeOptions: {
							minValue: -1000,
							maxValue: 1000,
						},
					},
				],
			},
		],
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
				throw new NodeOperationError(
					this.getNode(),
					'id or accessKeyId is required',
				);
			}
			if (!serviceAccountJson.privateKey) {
				throw new NodeOperationError(
					this.getNode(),
					'private_key or privateKey is required',
				);
			}
		} catch (error) {
			throw new NodeOperationError(
				this.getNode(),
				`Invalid service account JSON credentials: ${error.message}`,
			);
		}

		// Create session for SDK calls
		const session = new Session({ serviceAccountJson });

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'speech' && operation === 'synthesize') {
					const text = this.getNodeParameter('text', i) as string;
					const voice = this.getNodeParameter('voice', i) as string;
					const role = this.getNodeParameter('role', i) as string;
					const audioFormatType = this.getNodeParameter('audioFormatType', i) as string;
					const additionalOptions = this.getNodeParameter('additionalOptions', i, {}) as {
						speed?: number;
						volume?: number;
						pitchShift?: number;
					};

					// Build audio format options
					let outputAudioSpec: tts.AudioFormatOptions;
					let formatInfo: { extension: string; mimeType: string };

					if (audioFormatType === 'container') {
						const containerType = this.getNodeParameter('containerType', i) as string;
						formatInfo = getAudioFormat('container', containerType);

						outputAudioSpec = tts.AudioFormatOptions.fromPartial({
							containerAudio: tts.ContainerAudio.fromPartial({
								containerAudioType: tts.ContainerAudio_ContainerAudioType[containerType as keyof typeof tts.ContainerAudio_ContainerAudioType],
							}),
						});
					} else {
						const sampleRate = this.getNodeParameter('sampleRate', i) as number;
						formatInfo = getAudioFormat('raw');

						outputAudioSpec = tts.AudioFormatOptions.fromPartial({
							rawAudio: tts.RawAudio.fromPartial({
								audioEncoding: tts.RawAudio_AudioEncoding.LINEAR16_PCM,
								sampleRateHertz: sampleRate,
							}),
						});
					}

					// Build hints
					const hints: tts.Hints = tts.Hints.fromPartial({
						voice,
						role,
					});

					if (additionalOptions.speed !== undefined) {
						hints.speed = additionalOptions.speed;
					}
					if (additionalOptions.volume !== undefined) {
						hints.volume = additionalOptions.volume;
					}
					if (additionalOptions.pitchShift !== undefined) {
						hints.pitchShift = additionalOptions.pitchShift;
					}

					// Create TTS client
					const client = session.client(ttsService.SynthesizerClient, 'tts.api.cloud.yandex.net:443');

					// Create synthesis request
					const request = tts.UtteranceSynthesisRequest.fromPartial({
						model: '',
						text,
						hints: [hints],
						outputAudioSpec,
					});

					// Execute synthesis and collect audio chunks
					const audioChunks: Buffer[] = [];

					await withSdkErrorHandling(
						this.getNode(),
						async () => {
							const responseStream = client.utteranceSynthesis(request);
							for await (const response of responseStream) {
								if (response.audioChunk?.data) {
									audioChunks.push(response.audioChunk.data);
								}
							}
						},
						'synthesize speech',
						i
					);

					// Combine all audio chunks
					const audioBuffer = Buffer.concat(audioChunks);

					// Prepare binary data
					const binaryData = await this.helpers.prepareBinaryData(
						audioBuffer,
						`synthesized_audio.${formatInfo.extension}`,
						formatInfo.mimeType,
					);

					returnData.push({
						json: {
							success: true,
							operation: 'synthesize',
							text,
							voice,
							role,
							audioFormat: audioFormatType,
							audioSize: audioBuffer.length,
						},
						binary: {
							data: binaryData,
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

