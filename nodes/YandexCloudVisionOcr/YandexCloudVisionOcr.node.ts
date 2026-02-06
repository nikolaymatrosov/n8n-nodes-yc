import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	parseServiceAccountJson,
	createOcrClient,
	createAsyncOcrClient,
	detectMimeType,
	formatOcrResponse,
	sleep,
} from './GenericFunctions';
import { LANGUAGE_CODES, OCR_MODELS, SUPPORTED_MIME_TYPES, OPERATIONS, ASYNC_DEFAULTS, FILE_SIZE_LIMITS } from './types';
import { RecognizeTextRequest } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/ai/ocr/v1/ocr_service';
import { validateServiceAccountCredentials } from '@utils/authUtils';
import { YandexCloudSdkError, withSdkErrorHandling } from '@utils/sdkErrorHandling';

export class YandexCloudVisionOcr implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Yandex Cloud Vision OCR',
		name: 'yandexCloudVisionOcr',
		icon: 'file:Vision.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Recognize text in images using Yandex Cloud Vision OCR API',
		defaults: {
			name: 'Yandex Cloud Vision OCR',
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
						name: 'Text Recognition',
						value: 'textRecognition',
					},
				],
				default: 'textRecognition',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['textRecognition'],
					},
				},
				options: [
					{
						name: 'Get Recognition Results',
						value: OPERATIONS.GET_RECOGNITION_RESULTS,
						description: 'Get results of asynchronous text recognition (auto-polling)',
						action: 'Get async recognition results',
					},
					{
						name: 'Recognize',
						value: OPERATIONS.RECOGNIZE,
						description: 'Recognize text in an image (synchronous, single page)',
						action: 'Recognize text in image',
					},
					{
						name: 'Recognize Async',
						value: OPERATIONS.RECOGNIZE_ASYNC,
						description: 'Start asynchronous text recognition (supports multipage PDFs)',
						action: 'Start async text recognition',
					},
				],
				default: 'recognize',
			},
			// Binary property selection
			{
				displayName: 'Binary Property',
				name: 'binaryProperty',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: {
					show: {
						resource: ['textRecognition'],
						operation: [OPERATIONS.RECOGNIZE, OPERATIONS.RECOGNIZE_ASYNC],
					},
				},
				description: 'Name of the binary property containing the image data',
			},
			// MIME type selection
			{
				displayName: 'MIME Type',
				name: 'mimeType',
				type: 'options',
				options: [
					{
						name: 'Auto-Detect',
						value: 'auto',
					},
					{
						name: 'JPEG',
						value: SUPPORTED_MIME_TYPES.JPEG,
					},
					{
						name: 'PNG',
						value: SUPPORTED_MIME_TYPES.PNG,
					},
					{
						name: 'PDF',
						value: SUPPORTED_MIME_TYPES.PDF,
					},
				],
				default: 'auto',
				displayOptions: {
					show: {
						resource: ['textRecognition'],
						operation: [OPERATIONS.RECOGNIZE, OPERATIONS.RECOGNIZE_ASYNC],
					},
				},
				description:
					'MIME type of the input image. Choose auto-detect to automatically determine the type.',
			},
			// Language codes
			{
				displayName: 'Languages',
				name: 'languageCodes',
				type: 'multiOptions',
				options: LANGUAGE_CODES.map((lang) => ({
					name: lang.name,
					value: lang.value,
				})),
				default: ['ru', 'en'],
				displayOptions: {
					show: {
						resource: ['textRecognition'],
						operation: [OPERATIONS.RECOGNIZE, OPERATIONS.RECOGNIZE_ASYNC],
					},
				},
				description: 'Languages to recognize in the image',
			},
			// Model selection
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				default: 'page',
				options: [
					{
						name: 'Page',
						value: OCR_MODELS.PAGE,
						description: 'General purpose text recognition',
					},
					{
						name: 'Page Column Sort',
						value: OCR_MODELS.PAGE_COLUMN_SORT,
						description: 'Multi-column text recognition',
					},
					{
						name: 'Handwritten',
						value: OCR_MODELS.HANDWRITTEN,
						description: 'Optimized for handwritten text recognition',
					},
					{
						name: 'Table',
						value: OCR_MODELS.TABLE,
						description: 'Optimized for table recognition',
					},
					{
						name: 'Markdown',
						value: OCR_MODELS.MARKDOWN,
						description: 'Returns text in markdown format',
					},
					{
						name: 'Math Markdown',
						value: OCR_MODELS.MATH_MARKDOWN,
						description: 'Returns text with mathematical formulas in markdown',
					},
					{
						name: 'Passport',
						value: OCR_MODELS.PASSPORT,
						description: 'Template recognition for passport documents',
					},
					{
						name: 'Driver License Front',
						value: OCR_MODELS.DRIVER_LICENSE_FRONT,
						description: 'Template recognition for driver license (front side)',
					},
					{
						name: 'Driver License Back',
						value: OCR_MODELS.DRIVER_LICENSE_BACK,
						description: 'Template recognition for driver license (back side)',
					},
					{
						name: 'Vehicle Registration Front',
						value: OCR_MODELS.VEHICLE_REGISTRATION_FRONT,
						description: 'Template recognition for vehicle registration certificate (front)',
					},
					{
						name: 'Vehicle Registration Back',
						value: OCR_MODELS.VEHICLE_REGISTRATION_BACK,
						description: 'Template recognition for vehicle registration certificate (back)',
					},
					{
						name: 'License Plates',
						value: OCR_MODELS.LICENSE_PLATES,
						description: 'Recognition of vehicle license plates',
					},
				],
				displayOptions: {
					show: {
						resource: ['textRecognition'],
						operation: [OPERATIONS.RECOGNIZE, OPERATIONS.RECOGNIZE_ASYNC],
					},
				},
				description: 'OCR model to use for text recognition',
			},
			// Output format
			{
				displayName: 'Output Format',
				name: 'outputFormat',
				type: 'options',
				options: [
					{
						name: 'Full Text Only',
						value: 'fullText',
						description: 'Return only the recognized text as a string',
					},
					{
						name: 'Structured Data',
						value: 'structured',
						description: 'Return detailed structure with blocks, lines, words and coordinates',
					},
					{
						name: 'Both',
						value: 'both',
						description: 'Return both full text and structured data',
					},
				],
				default: 'fullText',
				displayOptions: {
					show: {
						resource: ['textRecognition'],
						operation: [OPERATIONS.RECOGNIZE, OPERATIONS.GET_RECOGNITION_RESULTS],
					},
				},
				description: 'Format of the output data',
			},

			// =====================================
			// Get Recognition Results
			// =====================================
			{
				displayName: 'Operation ID',
				name: 'operationId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['textRecognition'],
						operation: [OPERATIONS.GET_RECOGNITION_RESULTS],
					},
				},
				default: '',
				placeholder: 'e03sup6d5h1q********',
				description: 'Operation ID from the Recognize Async operation',
			},
			{
				displayName: 'Polling Options',
				name: 'pollingOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						resource: ['textRecognition'],
						operation: [OPERATIONS.GET_RECOGNITION_RESULTS],
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
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		// Get credentials
		const credentials = await this.getCredentials('yandexCloudAuthorizedApi');

		// Parse and validate credentials
		let serviceAccountJson;
		try {
			serviceAccountJson = parseServiceAccountJson(credentials.serviceAccountJson as string);
			validateServiceAccountCredentials(serviceAccountJson, this.getNode());
		} catch (error) {
			throw new NodeOperationError(
				this.getNode(),
				`Invalid service account JSON credentials: ${error.message}`,
			);
		}

		// Create appropriate client based on operation
		const client = operation === OPERATIONS.RECOGNIZE
			? createOcrClient(serviceAccountJson)
			: undefined;
		const asyncClient = (operation === OPERATIONS.RECOGNIZE_ASYNC || operation === OPERATIONS.GET_RECOGNITION_RESULTS)
			? createAsyncOcrClient(serviceAccountJson)
			: undefined;

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'textRecognition') {
					// =====================================
					// Recognize (synchronous)
					// =====================================
					if (operation === OPERATIONS.RECOGNIZE) {
						// Get parameters
						const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;
						const mimeTypeParam = this.getNodeParameter('mimeType', i) as string;
						const languageCodes = this.getNodeParameter('languageCodes', i) as string[];
						const model = this.getNodeParameter('model', i) as string;
						const outputFormat = this.getNodeParameter('outputFormat', i) as string;

						// Get binary data
						const binaryData = await this.helpers.getBinaryDataBuffer(i, binaryProperty);

						if (!binaryData || binaryData.length === 0) {
							throw new NodeOperationError(
								this.getNode(),
								`No binary data found in property "${binaryProperty}"`,
								{ itemIndex: i },
							);
						}

						// Detect or use provided MIME type
						const mimeType = detectMimeType(binaryData, mimeTypeParam);

						// Validate file size (max 10MB as per Yandex Cloud limits)
						if (binaryData.length > FILE_SIZE_LIMITS.SYNC_MAX_BYTES) {
							throw new NodeOperationError(
								this.getNode(),
								`Image size (${(binaryData.length / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (10MB)`,
								{ itemIndex: i },
							);
						}

						// Validate license-plates model requires explicit language
						if (model === 'license-plates' && (!languageCodes || languageCodes.length === 0)) {
							throw new NodeOperationError(
								this.getNode(),
								'The license-plates model requires at least one language to be specified. Please select a language from the Languages field.',
								{ itemIndex: i },
							);
						}

						// Build request
						const request: RecognizeTextRequest = {
							content: binaryData,
							mimeType,
							languageCodes,
							model,
						};

						// Execute recognition with streaming response
						const textAnnotations: any[] = [];
						const responseStream = client!.recognize(request);

						await withSdkErrorHandling(
							this.getNode(),
							async () => {
								for await (const response of responseStream) {
									if (response.textAnnotation) {
										textAnnotations.push(response.textAnnotation);
									}
								}
							},
							'recognize text',
							i,
						);

						// Format response
						const result = formatOcrResponse(textAnnotations, outputFormat);

						returnData.push({
							json: result,
							pairedItem: { item: i },
						});
					}
					// =====================================
					// Recognize Async
					// =====================================
					else if (operation === OPERATIONS.RECOGNIZE_ASYNC) {
						// Get parameters
						const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;
						const mimeTypeParam = this.getNodeParameter('mimeType', i) as string;
						const languageCodes = this.getNodeParameter('languageCodes', i) as string[];
						const model = this.getNodeParameter('model', i) as string;

						// Get binary data
						const binaryData = await this.helpers.getBinaryDataBuffer(i, binaryProperty);

						if (!binaryData || binaryData.length === 0) {
							throw new NodeOperationError(
								this.getNode(),
								`No binary data found in property "${binaryProperty}"`,
								{ itemIndex: i },
							);
						}

						// Detect or use provided MIME type
						const mimeType = detectMimeType(binaryData, mimeTypeParam);

						// Validate license-plates model requires explicit language
						if (model === 'license-plates' && (!languageCodes || languageCodes.length === 0)) {
							throw new NodeOperationError(
								this.getNode(),
								'The license-plates model requires at least one language to be specified. Please select a language from the Languages field.',
								{ itemIndex: i },
							);
						}

						// Build request (same RecognizeTextRequest as sync)
						const request: RecognizeTextRequest = {
							content: binaryData,
							mimeType,
							languageCodes,
							model,
						};

						// Submit for async recognition
						const asyncOperation = await withSdkErrorHandling(
							this.getNode(),
							() => asyncClient!.recognize(request),
							'start async text recognition',
							i,
						);

						returnData.push({
							json: {
								success: true,
								operationId: asyncOperation.id,
								mimeType,
								model,
								languageCodes,
								status: 'RUNNING',
							},
							pairedItem: { item: i },
						});
					}
					// =====================================
					// Get Recognition Results
					// =====================================
					else if (operation === OPERATIONS.GET_RECOGNITION_RESULTS) {
						const operationId = this.getNodeParameter('operationId', i) as string;
						const outputFormat = this.getNodeParameter('outputFormat', i) as string;
						const pollingOptions = this.getNodeParameter('pollingOptions', i, {}) as {
							pollInterval?: number;
							maxAttempts?: number;
							returnPartialResults?: boolean;
						};

						const pollInterval = (pollingOptions.pollInterval || ASYNC_DEFAULTS.POLL_INTERVAL_SECONDS) * 1000;
						const maxAttempts = pollingOptions.maxAttempts || ASYNC_DEFAULTS.MAX_ATTEMPTS;
						const returnPartialResults = pollingOptions.returnPartialResults || false;

						// Polling loop
						let attempt = 0;
						let isDone = false;
						const textAnnotations: any[] = [];

						while (attempt < maxAttempts && !isDone) {
							attempt++;

							try {
								await withSdkErrorHandling(
									this.getNode(),
									async () => {
										const responseStream = asyncClient!.getRecognition({
											operationId,
										});

										for await (const response of responseStream) {
											if (response.textAnnotation) {
												textAnnotations.push(response.textAnnotation);
											}
										}

										// Stream completed normally - recognition is done
										isDone = true;
									},
									'get recognition results',
									i,
								);
							} catch (error: any) {
								// Handle race condition: operation data is not ready yet
								const errorText = error.description || error.message || '';
								const isNotReadyError = errorText.includes('NOT_FOUND') &&
									errorText.includes('operation data is not ready');

								if (!isNotReadyError) {
									throw error;
								}
								// If it's the "not ready" error, continue polling
							}

							if (!isDone && attempt < maxAttempts) {
								await sleep(pollInterval);
							}
						}

						// Process results
						if (isDone && textAnnotations.length > 0) {
							const result = formatOcrResponse(textAnnotations, outputFormat);
							returnData.push({
								json: {
									...result,
									operationId,
									status: 'DONE',
									attemptsUsed: attempt,
								},
								pairedItem: { item: i },
							});
						} else if (!isDone && returnPartialResults && textAnnotations.length > 0) {
							const result = formatOcrResponse(textAnnotations, outputFormat);
							returnData.push({
								json: {
									...result,
									operationId,
									status: 'RUNNING',
									error: `Recognition timeout after ${attempt} attempts`,
									attemptsUsed: attempt,
								},
								pairedItem: { item: i },
							});
						} else {
							throw new NodeOperationError(
								this.getNode(),
								`Recognition timeout after ${attempt} attempts. Total time: ${(attempt * pollInterval) / 1000} seconds. Operation ID: ${operationId}`,
							);
						}
					}
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
