import { IExecuteFunctions, NodeOperationError } from 'n8n-workflow';
import { Session } from '@yandex-cloud/nodejs-sdk';
import { ocrService } from '@yandex-cloud/nodejs-sdk/dist/clients/ai-ocr-v1/index';
import { mapKeys, camelCase } from 'lodash';
import type { IIAmCredentials } from './types';

/**
 * Converts a Yandex Cloud service account key JSON to IIAmCredentials format
 * Handles both snake_case (Yandex Cloud format) and camelCase formats
 */
export function parseServiceAccountJson(jsonString: string): IIAmCredentials {
	const parsed = JSON.parse(jsonString);

	// Convert all keys to camelCase for consistent handling
	const camelCased = mapKeys(parsed, (_value, key) => camelCase(key));

	// Map the Yandex Cloud format to the expected format
	return {
		serviceAccountId: camelCased.serviceAccountId || '',
		accessKeyId: camelCased.id || camelCased.accessKeyId || '',
		privateKey: camelCased.privateKey || '',
	};
}

/**
 * Validates IAM credentials structure
 * @throws NodeOperationError if credentials are invalid
 */
export function validateIAmCredentials(
	credentials: IIAmCredentials,
	node: IExecuteFunctions['getNode'],
): void {
	if (!credentials.serviceAccountId) {
		throw new NodeOperationError(
			node(),
			'Service Account ID (service_account_id) is required in the service account JSON',
		);
	}

	if (!credentials.accessKeyId) {
		throw new NodeOperationError(
			node(),
			'Access Key ID (id) is required in the service account JSON',
		);
	}

	if (!credentials.privateKey) {
		throw new NodeOperationError(
			node(),
			'Private Key (private_key) is required in the service account JSON',
		);
	}
}

/**
 * Creates OCR service client using Session
 */
export function createOcrClient(credentials: IIAmCredentials) {
	const session = new Session({ serviceAccountJson: credentials });

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
