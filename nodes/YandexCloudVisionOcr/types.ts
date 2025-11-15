/**
 * IAM credentials structure parsed from service account JSON
 */
export interface IIAmCredentials {
	serviceAccountId: string;
	accessKeyId: string;
	privateKey: string;
}

/**
 * Supported output formats for OCR results
 */
export type OutputFormat = 'fullText' | 'structured' | 'both';

/**
 * Supported MIME types for image input
 */
export const SUPPORTED_MIME_TYPES = {
	JPEG: 'image/jpeg',
	PNG: 'image/png',
	PDF: 'application/pdf',
} as const;

/**
 * Supported OCR models
 */
export const OCR_MODELS = {
	// General text recognition models
	PAGE: 'page',
	PAGE_COLUMN_SORT: 'page-column-sort',
	HANDWRITTEN: 'handwritten',
	TABLE: 'table',
	MARKDOWN: 'markdown',
	MATH_MARKDOWN: 'math-markdown',
	// Template document recognition models
	PASSPORT: 'passport',
	DRIVER_LICENSE_FRONT: 'driver-license-front',
	DRIVER_LICENSE_BACK: 'driver-license-back',
	VEHICLE_REGISTRATION_FRONT: 'vehicle-registration-front',
	VEHICLE_REGISTRATION_BACK: 'vehicle-registration-back',
	LICENSE_PLATES: 'license-plates',
} as const;

/**
 * Common language codes for OCR (ISO 639-1 format)
 * Based on Yandex Cloud Vision OCR supported languages
 */
export const LANGUAGE_CODES = [
	// Latin-Cyrillic model languages
	{ name: 'English', value: 'en' },
	{ name: 'Russian', value: 'ru' },
	{ name: 'Azerbaijani', value: 'az' },
	{ name: 'Bashkir', value: 'ba' },
	{ name: 'Belarusian', value: 'be' },
	{ name: 'Bulgarian', value: 'bg' },
	{ name: 'Bosnian', value: 'bs' },
	{ name: 'Czech', value: 'cs' },
	{ name: 'Chuvash', value: 'cv' },
	{ name: 'Danish', value: 'da' },
	{ name: 'German', value: 'de' },
	{ name: 'Spanish', value: 'es' },
	{ name: 'Estonian', value: 'et' },
	{ name: 'Finnish', value: 'fi' },
	{ name: 'French', value: 'fr' },
	{ name: 'Hungarian', value: 'hu' },
	{ name: 'Indonesian', value: 'id' },
	{ name: 'Italian', value: 'it' },
	{ name: 'Kazakh', value: 'kk' },
	{ name: 'Kyrgyz', value: 'ky' },
	{ name: 'Lithuanian', value: 'lt' },
	{ name: 'Latvian', value: 'lv' },
	{ name: 'Maltese', value: 'mt' },
	{ name: 'Dutch', value: 'nl' },
	{ name: 'Norwegian', value: 'no' },
	{ name: 'Polish', value: 'pl' },
	{ name: 'Portuguese', value: 'pt' },
	{ name: 'Romanian', value: 'ro' },
	{ name: 'Yakut', value: 'sah' },
	{ name: 'Slovak', value: 'sk' },
	{ name: 'Slovenian', value: 'sl' },
	{ name: 'Serbian', value: 'sr' },
	{ name: 'Swedish', value: 'sv' },
	{ name: 'Tajik', value: 'tg' },
	{ name: 'Turkish', value: 'tr' },
	{ name: 'Tatar', value: 'tt' },
	{ name: 'Uzbek', value: 'uz' },
	// Other model languages (with Russian and English support)
	{ name: 'Arabic', value: 'ar' },
	{ name: 'Greek', value: 'el' },
	{ name: 'Hebrew', value: 'he' },
	{ name: 'Armenian', value: 'hy' },
	{ name: 'Japanese', value: 'ja' },
	{ name: 'Georgian', value: 'ka' },
	{ name: 'Korean', value: 'ko' },
	{ name: 'Thai', value: 'th' },
	{ name: 'Vietnamese', value: 'vi' },
	{ name: 'Chinese', value: 'zh' },
] as const;
