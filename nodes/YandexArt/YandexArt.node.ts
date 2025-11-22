import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { parseServiceAccountJson, validateServiceAccountCredentials } from '@utils/authUtils';
import {
	createImageGenerationClient,
	createOperationClient,
	pollOperationUntilDone,
	extractImageResponse,
	buildModelUri,
	getFileExtensionFromMimeType,
} from './GenericFunctions';
import {
	RESOURCES,
	IMAGE_OPERATIONS,
	PARAMS,
	DEFAULTS,
	SUPPORTED_MIME_TYPES,
	ASPECT_RATIOS,
	ASPECT_RATIO_KEYS,
	type IAspectRatio,
	type IImageGenerationMessage,
} from './types';
import { ImageGenerationRequest } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/ai/foundation_models/v1/image_generation/image_generation_service';

export class YandexArt implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Yandex Art',
		name: 'yandexArt',
		icon: 'file:Art.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'A Art node for debugging and testing purposes',
		defaults: {
			name: 'Yandex Art',
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
						name: 'Image',
						value: RESOURCES.IMAGE,
					},
				],
				default: 'image',
			},
			// Operation selector
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						[PARAMS.RESOURCE]: [RESOURCES.IMAGE],
					},
				},
				options: [
					{
						name: 'Generate',
						value: IMAGE_OPERATIONS.GENERATE,
						description: 'Generate an image from a text description',
						action: 'Generate image',
					},
				],
				default: 'generate',
			},
			// Prompt (required)
			{
				displayName: 'Prompt',
				name: PARAMS.PROMPT,
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				displayOptions: {
					show: {
						[PARAMS.RESOURCE]: [RESOURCES.IMAGE],
						[PARAMS.OPERATION]: [IMAGE_OPERATIONS.GENERATE],
					},
				},
				default: '',
				required: true,
				placeholder: 'A serene mountain landscape at sunset with snow-capped peaks',
				description: 'Text description of the image to generate',
			},
			// Additional Options
			{
				displayName: 'Additional Options',
				name: PARAMS.ADDITIONAL_OPTIONS,
				type: 'collection',
				placeholder: 'Add Option',
				displayOptions: {
					show: {
						[PARAMS.RESOURCE]: [RESOURCES.IMAGE],
						[PARAMS.OPERATION]: [IMAGE_OPERATIONS.GENERATE],
					},
				},
				default: {},
				options: [
					{
						displayName: 'Negative Prompt',
						name: PARAMS.NEGATIVE_PROMPT,
						type: 'string',
						typeOptions: {
							rows: 3,
						},
						default: '',
						placeholder: 'blurry, low quality, distorted',
						description: 'Text description of what to avoid in the generated image (weight: -1)',
					},
					{
						displayName: 'MIME Type',
						name: PARAMS.MIME_TYPE,
						type: 'options',
						default: 'image/jpeg',
						options: [
							{
								name: 'JPEG',
								value: SUPPORTED_MIME_TYPES.JPEG,
							},
							{
								name: 'PNG',
								value: SUPPORTED_MIME_TYPES.PNG,
							},
						],
						description: 'Output image format',
					},
					{
						displayName: 'Aspect Ratio',
						name: PARAMS.ASPECT_RATIO,
						type: 'options',
						default: 'SQUARE',
						options: [
							{
								name: 'Landscape 16:9',
								value: ASPECT_RATIO_KEYS.LANDSCAPE_16_9,
								description: 'Widescreen landscape (16:9)',
							},
							{
								name: 'Landscape 21:9',
								value: ASPECT_RATIO_KEYS.LANDSCAPE_21_9,
								description: 'Ultra-wide landscape (21:9)',
							},
							{
								name: 'Portrait 9:16',
								value: ASPECT_RATIO_KEYS.PORTRAIT_9_16,
								description: 'Portrait orientation (9:16)',
							},
							{
								name: 'Portrait 9:21',
								value: ASPECT_RATIO_KEYS.PORTRAIT_9_21,
								description: 'Tall portrait (9:21)',
							},
							{
								name: 'Square (1:1)',
								value: ASPECT_RATIO_KEYS.SQUARE,
								description: 'Square aspect ratio (1:1)',
							},
						],
					},
					{
						displayName: 'Seed',
						name: PARAMS.SEED,
						type: 'number',
						default: undefined,
						placeholder: '12345',
						description:
							'Seed for image generation. Use the same seed with the same prompt to get reproducible results. If not set, a random seed will be used.',
					},
				],
			},
			// Advanced Options
			{
				displayName: 'Advanced Options',
				name: PARAMS.ADVANCED_OPTIONS,
				type: 'collection',
				placeholder: 'Add Option',
				displayOptions: {
					show: {
						[PARAMS.RESOURCE]: [RESOURCES.IMAGE],
						[PARAMS.OPERATION]: [IMAGE_OPERATIONS.GENERATE],
					},
				},
				default: {},
				options: [
					{
						displayName: 'Wait for Completion',
						name: PARAMS.WAIT_FOR_COMPLETION,
						type: 'boolean',
						default: true,
						description:
							'Whether to wait for image generation to complete. If false, returns operation ID immediately.',
					},
					{
						displayName: 'Poll Interval (Seconds)',
						name: PARAMS.POLL_INTERVAL,
						type: 'number',
						displayOptions: {
							show: {
								[PARAMS.WAIT_FOR_COMPLETION]: [true],
							},
						},
						default: 2,
						typeOptions: {
							minValue: 1,
							maxValue: 60,
						},
						description: 'Interval between status checks in seconds',
					},
					{
						displayName: 'Max Wait Time (Seconds)',
						name: PARAMS.MAX_WAIT_TIME,
						type: 'number',
						displayOptions: {
							show: {
								[PARAMS.WAIT_FOR_COMPLETION]: [true],
							},
						},
						default: 300,
						typeOptions: {
							minValue: 10,
							maxValue: 600,
						},
						description:
							'Maximum time to wait for completion in seconds. After this time, an error will be thrown.',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter(PARAMS.RESOURCE, 0) as string;
		const operation = this.getNodeParameter(PARAMS.OPERATION, 0) as string;

		// Get credentials and validate
		const credentials = await this.getCredentials('yandexCloudAuthorizedApi');
		const serviceAccountJson = parseServiceAccountJson(credentials.serviceAccountJson as string);
		validateServiceAccountCredentials(serviceAccountJson, this.getNode());

		// Create clients
		const imageClient = createImageGenerationClient(serviceAccountJson);
		const operationClient = createOperationClient(serviceAccountJson);

		// Build model URI from folder ID
		const folderId = credentials.folderId as string;
		const modelUri = buildModelUri(folderId);

		// Process each input item
		if (resource === RESOURCES.IMAGE && operation === IMAGE_OPERATIONS.GENERATE) {
			for (let i = 0; i < items.length; i++) {
				try {
					// Get parameters
					const prompt = this.getNodeParameter(PARAMS.PROMPT, i) as string;
					const additionalOptions = this.getNodeParameter(PARAMS.ADDITIONAL_OPTIONS, i, {}) as any;
					const advancedOptions = this.getNodeParameter(PARAMS.ADVANCED_OPTIONS, i, {}) as any;

					// Extract options with defaults
					const negativePrompt = (additionalOptions[PARAMS.NEGATIVE_PROMPT] || '') as string;
					const mimeType = (additionalOptions[PARAMS.MIME_TYPE] || DEFAULTS.MIME_TYPE) as string;
					const aspectRatioKey = (additionalOptions[PARAMS.ASPECT_RATIO] ||
						DEFAULTS.ASPECT_RATIO) as keyof typeof ASPECT_RATIOS;
					const seed = additionalOptions[PARAMS.SEED] as number | undefined;

					const waitForCompletion =
						advancedOptions[PARAMS.WAIT_FOR_COMPLETION] !== undefined
							? (advancedOptions[PARAMS.WAIT_FOR_COMPLETION] as boolean)
							: true;
					const pollIntervalSeconds = (advancedOptions[PARAMS.POLL_INTERVAL] ||
						DEFAULTS.POLL_INTERVAL_SECONDS) as number;
					const maxWaitTimeSeconds = (advancedOptions[PARAMS.MAX_WAIT_TIME] ||
						DEFAULTS.MAX_WAIT_TIME_SECONDS) as number;

					// Convert seconds to milliseconds for internal use
					const pollInterval = pollIntervalSeconds * 1000;
					const maxWaitTime = maxWaitTimeSeconds * 1000;

					// Validate prompt
					if (!prompt || prompt.trim().length === 0) {
						throw new NodeOperationError(this.getNode(), 'Prompt cannot be empty');
					}

					// Build messages array
					const messages: IImageGenerationMessage[] = [
						{
							text: prompt.trim(),
							weight: 1,
						},
					];

					// Add negative prompt if provided
					if (negativePrompt && negativePrompt.trim().length > 0) {
						messages.push({
							text: negativePrompt.trim(),
							weight: -1,
						});
					}

					// Get aspect ratio configuration
					const aspectRatio: IAspectRatio = ASPECT_RATIOS[aspectRatioKey];

					// Build request
					const request = ImageGenerationRequest.fromJSON({
						modelUri,
						messages,
						generationOptions: {
							mimeType,
							aspectRatio: {
								widthRatio: aspectRatio.widthRatio,
								heightRatio: aspectRatio.heightRatio,
							},
							...(seed !== undefined && seed !== null ? { seed } : {}),
						},
					});

					// Call generate API (returns Operation)
					const operation = await imageClient.generate(request);

					// If not waiting for completion, return operation ID
					if (!waitForCompletion) {
						returnData.push({
							json: {
								success: true,
								operationId: operation.id,
								done: operation.done,
								message: 'Image generation started. Use the operation ID to check status manually.',
								prompt,
								aspectRatio: aspectRatioKey,
								mimeType,
							},
							pairedItem: { item: i },
						});
						continue;
					}

					// Poll until completion
					const completedOperation = await pollOperationUntilDone(
						operationClient,
						operation.id,
						pollInterval,
						maxWaitTime,
						this.getNode(),
					);

					// Extract image from response
					const { image, modelVersion } = extractImageResponse(completedOperation, this.getNode());

					// Determine file extension
					const extension = getFileExtensionFromMimeType(mimeType);

					// Generate filename with timestamp
					const timestamp = Date.now();
					const filename = `yandexart_${timestamp}.${extension}`;

					// Prepare binary data
					const binaryData = await this.helpers.prepareBinaryData(image, filename, mimeType);

					// Return result with binary data
					returnData.push({
						json: {
							success: true,
							operationId: operation.id,
							modelVersion,
							prompt,
							negativePrompt: negativePrompt || undefined,
							aspectRatio: aspectRatioKey,
							aspectRatioValues: aspectRatio,
							mimeType,
							seed: seed || 'auto',
							imageSize: image.length,
							filename,
						},
						binary: {
							data: binaryData,
						},
						pairedItem: { item: i },
					});
				} catch (error) {
					// Handle continueOnFail mode
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
		}

		return [returnData];
	}
}
