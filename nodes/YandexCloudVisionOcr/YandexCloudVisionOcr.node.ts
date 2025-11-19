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
	detectMimeType,
	formatOcrResponse,
} from './GenericFunctions';
import { LANGUAGE_CODES, OCR_MODELS, SUPPORTED_MIME_TYPES } from './types';
import { RecognizeTextRequest } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/ai/ocr/v1/ocr_service';
import { validateServiceAccountCredentials } from '@utils/authUtils';

export class YandexCloudVisionOcr implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Yandex Cloud Vision OCR',
		name: 'yandexCloudVisionOcr',
		icon: 'file:Vision.svg',
		group: ['transform'],
		version: 1,
		subtitle: 'Recognize text in images',
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
						name: 'Recognize',
						value: 'recognize',
						description: 'Recognize text in an image',
						action: 'Recognize text in image',
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
						operation: ['recognize'],
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
						operation: ['recognize'],
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
						operation: ['recognize'],
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
						operation: ['recognize'],
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
						operation: ['recognize'],
					},
				},
				description: 'Format of the output data',
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

		// Create OCR client
		const client = createOcrClient(serviceAccountJson);

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'textRecognition') {
					if (operation === 'recognize') {
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
						const maxSize = 10 * 1024 * 1024; // 10MB
						if (binaryData.length > maxSize) {
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
						const responseStream = client.recognize(request);

						for await (const response of responseStream) {
							if (response.textAnnotation) {
								textAnnotations.push(response.textAnnotation);
							}
						}

						// Format response
						const result = formatOcrResponse(textAnnotations, outputFormat);

						returnData.push({
							json: result,
							pairedItem: { item: i },
						});
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
