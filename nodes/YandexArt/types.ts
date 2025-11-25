/**
 * Type definitions and constants for YandexCloudYandexART node
 */

/**
 * IAM credentials structure from Service Account JSON
 */
export interface IIAmCredentials {
	serviceAccountId: string;
	accessKeyId: string;
	privateKey: string;
}

/**
 * Image generation request message
 */
export interface IImageGenerationMessage {
	text: string;
	weight: number;
}


/**
 * Supported MIME types for generated images
 */
export const SUPPORTED_MIME_TYPES = {
	JPEG: 'image/jpeg',
	PNG: 'image/png',
} as const;

export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[keyof typeof SUPPORTED_MIME_TYPES];

/**
 * Aspect ratio keys
 */
export const ASPECT_RATIO_KEYS = {
	SQUARE: 'SQUARE',
	LANDSCAPE_16_9: 'LANDSCAPE_16_9',
	LANDSCAPE_21_9: 'LANDSCAPE_21_9',
	PORTRAIT_9_16: 'PORTRAIT_9_16',
	PORTRAIT_9_21: 'PORTRAIT_9_21',
} as const;

/**
 * Common aspect ratios for image generation
 */
export const ASPECT_RATIOS = {
	[ASPECT_RATIO_KEYS.SQUARE]: { widthRatio: 1, heightRatio: 1 },
	[ASPECT_RATIO_KEYS.LANDSCAPE_16_9]: { widthRatio: 16, heightRatio: 9 },
	[ASPECT_RATIO_KEYS.LANDSCAPE_21_9]: { widthRatio: 21, heightRatio: 9 },
	[ASPECT_RATIO_KEYS.PORTRAIT_9_16]: { widthRatio: 9, heightRatio: 16 },
	[ASPECT_RATIO_KEYS.PORTRAIT_9_21]: { widthRatio: 9, heightRatio: 21 },
} as const;

/**
 * Aspect ratio type
 */
export interface IAspectRatio {
	widthRatio: number;
	heightRatio: number;
}

/**
 * Resource constants
 */
export const RESOURCES = {
	IMAGE: 'image',
} as const;

export type Resource = (typeof RESOURCES)[keyof typeof RESOURCES];

/**
 * Image operation constants
 */
export const IMAGE_OPERATIONS = {
	GENERATE: 'generate',
} as const;

export type ImageOperation = (typeof IMAGE_OPERATIONS)[keyof typeof IMAGE_OPERATIONS];

/**
 * Parameter name constants
 * Used with getNodeParameter() to ensure type safety and consistency
 */
export const PARAMS = {
	RESOURCE: 'resource',
	OPERATION: 'operation',
	PROMPT: 'prompt',
	ADDITIONAL_OPTIONS: 'additionalOptions',
	NEGATIVE_PROMPT: 'negativePrompt',
	MIME_TYPE: 'mimeType',
	ASPECT_RATIO: 'aspectRatio',
	SEED: 'seed',
	ADVANCED_OPTIONS: 'advancedOptions',
	WAIT_FOR_COMPLETION: 'waitForCompletion',
	POLL_INTERVAL: 'pollInterval',
	MAX_WAIT_TIME: 'maxWaitTime',
	TRUNCATE_PROMPT: 'truncatePrompt',
} as const;

export type ParamName = (typeof PARAMS)[keyof typeof PARAMS];

/**
 * Default values for configuration
 */
export const DEFAULTS = {
	POLL_INTERVAL_SECONDS: 2, // 2 seconds
	MAX_WAIT_TIME_SECONDS: 300, // 5 minutes (300 seconds)
	MIME_TYPE: SUPPORTED_MIME_TYPES.JPEG,
	ASPECT_RATIO: 'SQUARE',
	MAX_PROMPT_LENGTH: 500, // Maximum characters allowed by Yandex ART API
} as const;
