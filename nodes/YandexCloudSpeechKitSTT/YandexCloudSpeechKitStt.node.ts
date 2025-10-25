import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { Session } from '@yandex-cloud/nodejs-sdk';
import { sttService, stt } from '@yandex-cloud/nodejs-sdk/dist/clients/ai-stt-v3/index';
import { mapKeys, camelCase } from 'lodash';

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
 * Sleep utility for polling
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export class YandexCloudSpeechKitStt implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Yandex Cloud SpeechKit STT',
		name: 'yandexCloudSpeechKitStt',
		icon: 'file:SpeechKit.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Transcribe audio to text using Yandex SpeechKit STT v3 API',
		defaults: {
			name: 'Yandex Cloud SpeechKit STT',
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
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Recognize Audio',
						value: 'recognizeAudio',
						description: 'Start asynchronous audio transcription',
						action: 'Start audio recognition',
					},
					{
						name: 'Get Recognition Results',
						value: 'getResults',
						description: 'Get transcription results (auto-polling)',
						action: 'Get recognition results',
					},
				],
				default: 'recognizeAudio',
			},

			// =====================================
			// STT: Recognize Audio
			// =====================================
			{
				displayName: 'Audio URL',
				name: 'audioUrl',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						operation: ['recognizeAudio'],
					},
				},
				default: '',
				placeholder: 'https://storage.yandexcloud.net/bucket/audio.wav',
				description: 'URL of the audio file in Yandex Object Storage',
			},
			{
				displayName: 'Language Code',
				name: 'languageCode',
				type: 'options',
				displayOptions: {
					show: {
						operation: ['recognizeAudio'],
					},
				},
				options: [
					{
						name: 'Automatic Detection',
						value: 'auto',
					},
					{
						name: 'Brazilian Portuguese',
						value: 'pt-BR',
					},
					{
						name: 'Dutch',
						value: 'nl-NL',
					},
					{
						name: 'English',
						value: 'en-US',
					},
					{
						name: 'Finnish',
						value: 'fi-FI',
					},
					{
						name: 'French',
						value: 'fr-FR',
					},
					{
						name: 'German',
						value: 'de-DE',
					},
					{
						name: 'Hebrew',
						value: 'he-IL',
					},
					{
						name: 'Italian',
						value: 'it-IT',
					},
					{
						name: 'Kazakh',
						value: 'kk-KZ',
					},
					{
						name: 'Polish',
						value: 'pl-PL',
					},
					{
						name: 'Portuguese',
						value: 'pt-PT',
					},
					{
						name: 'Russian',
						value: 'ru-RU',
					},
					{
						name: 'Spanish',
						value: 'es-ES',
					},
			{
				name: 'Swedish',
				value: 'sv-SE',
			},
			{
				name: 'Turkish',
				value: 'tr-TR',
			},
			{
				name: 'Uzbek (Latin)',
				value: 'uz-UZ',
			},
		],
		default: 'ru-RU',
		description: 'Language code for recognition',
	},
	{
		displayName: 'Audio Format',
		name: 'audioFormat',
		type: 'options',
		displayOptions: {
			show: {
				operation: ['recognizeAudio'],
			},
		},
		options: [
			{
				name: 'LPCM',
				value: 'LPCM',
			},
			{
				name: 'OGG Opus',
				value: 'OGG_OPUS',
			},
			{
				name: 'MP3',
				value: 'MP3',
			},
		],
		default: 'LPCM',
		description: 'Audio file format',
	},
	{
		displayName: 'Recognition Options',
		name: 'recognitionOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				operation: ['recognizeAudio'],
			},
		},
		options: [
			{
				displayName: 'Audio Channel Count',
				name: 'audioChannelCount',
				type: 'number',
				default: 1,
				description: 'Number of audio channels',
				typeOptions: {
					minValue: 1,
					maxValue: 8,
				},
			},
			{
				displayName: 'Literature Text',
				name: 'literatureText',
				type: 'boolean',
				default: false,
				description: 'Whether to use literature text normalization',
			},
			{
				displayName: 'Profanity Filter',
				name: 'profanityFilter',
				type: 'boolean',
				default: false,
				description: 'Whether to filter profanity in results',
			},
			{
				displayName: 'Sample Rate',
				name: 'sampleRate',
				type: 'number',
				default: 8000,
				description: 'Sample rate in Hz (e.g., 8000, 16000, 48000)',
			},
		],
	},

			// =====================================
			// STT: Get Recognition Results
			// =====================================
			{
				displayName: 'Operation ID',
				name: 'operationId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						operation: ['getResults'],
					},
				},
				default: '',
				placeholder: 'e03sup6d5h1q********',
				description: 'Operation ID from the Recognize Audio operation',
			},
			{
				displayName: 'Polling Options',
				name: 'pollingOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						operation: ['getResults'],
					},
				},
				options: [
					{
						displayName: 'Poll Interval (Seconds)',
						name: 'pollInterval',
						type: 'number',
						default: 5,
						description: 'Time to wait between polling attempts',
						typeOptions: {
							minValue: 1,
							maxValue: 60,
						},
					},
					{
						displayName: 'Max Attempts',
						name: 'maxAttempts',
						type: 'number',
						default: 60,
						description: 'Maximum number of polling attempts before timeout',
						typeOptions: {
							minValue: 1,
							maxValue: 300,
						},
					},
					{
						displayName: 'Return Partial Results',
						name: 'returnPartialResults',
						type: 'boolean',
						default: false,
						description: 'Whether to return partial results if recognition is not yet complete',
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
				// =====================================
				// STT: Recognize Audio
				// =====================================
			if (operation === 'recognizeAudio') {
				const audioUrl = this.getNodeParameter('audioUrl', i) as string;
				const languageCode = this.getNodeParameter('languageCode', i) as string;
				const audioFormat = this.getNodeParameter('audioFormat', i) as string;
				const recognitionOptions = this.getNodeParameter('recognitionOptions', i, {}) as {
					sampleRate?: number;
					audioChannelCount?: number;
					profanityFilter?: boolean;
					literatureText?: boolean;
				};

					// Model is hardcoded to 'general'
					const model = 'general';

					// Create STT client
					const client = session.client(
						sttService.AsyncRecognizerClient,
						'stt.api.cloud.yandex.net:443',
					);

				// Build audio format options
				let audioFormatOptions: stt.AudioFormatOptions | undefined;
				if (audioFormat) {
					const formatMap: Record<string, any> = {
						LPCM: {
							rawAudio: stt.RawAudio.fromPartial({
								audioEncoding: stt.RawAudio_AudioEncoding.LINEAR16_PCM,
								sampleRateHertz: recognitionOptions.sampleRate || 8000,
								audioChannelCount: recognitionOptions.audioChannelCount || 1,
							}),
						},
						OGG_OPUS: {
							containerAudio: stt.ContainerAudio.fromPartial({
								containerAudioType: stt.ContainerAudio_ContainerAudioType.OGG_OPUS,
							}),
						},
						MP3: {
							containerAudio: stt.ContainerAudio.fromPartial({
								containerAudioType: stt.ContainerAudio_ContainerAudioType.MP3,
							}),
						},
					};

					audioFormatOptions = stt.AudioFormatOptions.fromPartial(
						formatMap[audioFormat] || formatMap.LPCM,
					);
				}

					// Build language restriction
					const languageRestriction = stt.LanguageRestrictionOptions.fromPartial({
						restrictionType:
							stt.LanguageRestrictionOptions_LanguageRestrictionType.WHITELIST,
						languageCode: [languageCode],
					});

					// Build text normalization
					const textNormalization = stt.TextNormalizationOptions.fromPartial({
						textNormalization: stt.TextNormalizationOptions_TextNormalization.TEXT_NORMALIZATION_ENABLED,
						profanityFilter: recognitionOptions.profanityFilter || false,
						literatureText: recognitionOptions.literatureText || false,
					});

				// Build recognition model options
				const recognitionModel = stt.RecognitionModelOptions.fromPartial({
					model,
					audioFormat: audioFormatOptions,
					textNormalization,
					languageRestriction,
					audioProcessingType:
						stt.RecognitionModelOptions_AudioProcessingType.FULL_DATA,
				});

					// Build recognition request
					const request = stt.RecognizeFileRequest.fromPartial({
						uri: audioUrl,
						recognitionModel,
					});

					// Start recognition
					const operation = await client.recognizeFile(request);

					returnData.push({
						json: {
							success: true,
							operationId: operation.id,
							audioUrl,
							model,
							languageCode,
							status: 'RUNNING',
						},
						pairedItem: { item: i },
					});
				}
				// =====================================
				// STT: Get Recognition Results
				// =====================================
				else if (operation === 'getResults') {
					const operationId = this.getNodeParameter('operationId', i) as string;
					const pollingOptions = this.getNodeParameter('pollingOptions', i, {}) as {
						pollInterval?: number;
						maxAttempts?: number;
						returnPartialResults?: boolean;
					};

					const pollInterval = (pollingOptions.pollInterval || 5) * 1000; // Convert to ms
					const maxAttempts = pollingOptions.maxAttempts || 60;
					const returnPartialResults = pollingOptions.returnPartialResults || false;

					// Create STT client
					const client = session.client(
						sttService.AsyncRecognizerClient,
						'stt.api.cloud.yandex.net:443',
					);

					// Polling loop
					let attempt = 0;
					let isDone = false;
					const finalResults: any[] = [];
					const partialResults: any[] = [];
					let channelTag: string = '';

					while (attempt < maxAttempts && !isDone) {
						attempt++;

						// Get recognition status - this returns a stream
						const responseStream = client.getRecognition({
							operationId,
						});

						// Collect all responses from the stream
						for await (const response of responseStream) {
							if (response.channelTag) {
								channelTag = response.channelTag;
							}

							if (response.eouUpdate) {
								// End of utterance - recognition is done
								isDone = true;
							}

							if (response.final) {
								// Final results
								finalResults.push(response.final);
								isDone = true;
							}

							if (response.partial) {
								// Partial results
								partialResults.push(response.partial);
							}
						}

						if (!isDone && attempt < maxAttempts) {
							// Wait before next poll
							await sleep(pollInterval);
						}
					}

					// Process results
					if (isDone && finalResults.length > 0) {
						// Extract full text from all final results
						const fullText = finalResults
							.map((result: any) => {
								const alternatives = result.alternatives || [];
								return alternatives.length > 0 ? alternatives[0].text : '';
							})
							.filter((text: string) => text.length > 0)
							.join(' ');

						returnData.push({
							json: {
								success: true,
								operationId,
								status: 'DONE',
								text: fullText,
								channelTag,
								finalResults,
								attemptsUsed: attempt,
							},
							pairedItem: { item: i },
						});
					} else if (!isDone && returnPartialResults && (partialResults.length > 0 || finalResults.length > 0)) {
						// Return partial results if requested
						const allResults = [...finalResults, ...partialResults];
						const partialText = allResults
							.map((result: any) => {
								const alternatives = result.alternatives || [];
								return alternatives.length > 0 ? alternatives[0].text : '';
							})
							.filter((text: string) => text.length > 0)
							.join(' ');

						returnData.push({
							json: {
								success: false,
								operationId,
								status: 'RUNNING',
								error: `Recognition timeout after ${attempt} attempts`,
								attemptsUsed: attempt,
								partialText,
								channelTag,
								finalResults,
								partialResults,
							},
							pairedItem: { item: i },
						});
					} else {
						// Timeout without results
						throw new NodeOperationError(
							this.getNode(),
							`Recognition timeout after ${attempt} attempts. Total time: ${(attempt * pollInterval) / 1000} seconds`,
						);
					}
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

