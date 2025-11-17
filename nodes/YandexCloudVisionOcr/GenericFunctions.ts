import { IExecuteFunctions } from 'n8n-workflow';
import { ocrService } from '@yandex-cloud/nodejs-sdk/dist/clients/ai-ocr-v1/index';
import type { IIAmCredentials } from './types';
import {
	parseServiceAccountJson,
	validateServiceAccountCredentials,
	createYandexSession,
} from '@utils/authUtils';

// Re-export for backward compatibility
export { parseServiceAccountJson };

/**
 * Validates IAM credentials structure
 * @throws NodeOperationError if credentials are invalid
 */
export function validateIAmCredentials(
	credentials: IIAmCredentials,
	node: IExecuteFunctions['getNode'],
): void {
	validateServiceAccountCredentials(credentials, node);
}

/**
 * Creates OCR service client using Session
 */
export function createOcrClient(credentials: IIAmCredentials) {
	const session = createYandexSession(credentials);

	// Create TextRecognitionService client
	const client = session.client(
		ocrService.TextRecognitionServiceClient,
		'ocr.api.cloud.yandex.net:443',
	);

	return client;
}

/**
 * Detects MIME type from buffer or uses provided type
 */
export function detectMimeType(buffer: Buffer, providedMimeType?: string): string {
	if (providedMimeType && providedMimeType !== 'auto') {
		return providedMimeType;
	}

	// Check magic bytes for common image formats
	if (buffer.length >= 3) {
		// JPEG: FF D8 FF
		if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
			return 'image/jpeg';
		}

		// PNG: 89 50 4E 47
		if (
			buffer[0] === 0x89 &&
			buffer[1] === 0x50 &&
			buffer[2] === 0x4e &&
			buffer.length >= 4 &&
			buffer[3] === 0x47
		) {
			return 'image/png';
		}

		// PDF: 25 50 44 46
		if (
			buffer[0] === 0x25 &&
			buffer[1] === 0x50 &&
			buffer[2] === 0x44 &&
			buffer.length >= 4 &&
			buffer[3] === 0x46
		) {
			return 'application/pdf';
		}
	}

	// Default to JPEG if unable to detect
	return 'image/jpeg';
}

/**
 * Formats the OCR response based on output format preference
 */
export function formatOcrResponse(
	textAnnotations: any[],
	outputFormat: string,
): Record<string, any> {
	if (textAnnotations.length === 0) {
		return {
			fullText: '',
			structured: null,
		};
	}

	// Combine all text annotations (for multi-page PDFs)
	const fullText = textAnnotations
		.map((annotation) => annotation.fullText || '')
		.filter((text) => text.length > 0)
		.join('\n\n');

	const structured = textAnnotations.map((annotation, index) => ({
		page: index + 1,
		width: annotation.width || 0,
		height: annotation.height || 0,
		blocks: annotation.blocks || [],
		entities: annotation.entities || [],
		tables: annotation.tables || [],
		markdown: annotation.markdown || null,
		pictures: annotation.pictures || [],
		rotate: annotation.rotate || 'ANGLE_0',
	}));

	if (outputFormat === 'fullText') {
		return { fullText };
	}

	if (outputFormat === 'structured') {
		return { structured };
	}

	// 'both' format
	return {
		fullText,
		structured,
	};
}
