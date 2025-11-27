import { YandexCloudVisionOcr } from '../YandexCloudVisionOcr.node';
import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

// Mock Yandex Cloud SDK
jest.mock('@yandex-cloud/nodejs-sdk');

// Mock OCR module
jest.mock('@yandex-cloud/nodejs-sdk/dist/clients/ai-ocr-v1/index', () => {
	return {
		ocr: {
			RecognizeTextRequest: {
				fromPartial: jest.fn((data: any) => data),
			},
		},
		ocrService: {
			TextRecognitionServiceClient: jest.fn(),
		},
	};
}, { virtual: true });

describe('YandexCloudVisionOcr Node', () => {
	let node: YandexCloudVisionOcr;
	let mockExecuteFunctions: Partial<IExecuteFunctions>;
	let mockSession: any;
	let mockOcrClient: any;
	let mockResponseStream: any;

	// Sample image buffers for testing
	const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]); // JPEG magic bytes
	const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]); // PNG magic bytes
	const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]); // PDF magic bytes

	beforeEach(() => {
		jest.clearAllMocks();

		node = new YandexCloudVisionOcr();

		// Mock OCR Client response
		mockResponseStream = {
			[Symbol.asyncIterator]: jest.fn(),
		};

		mockOcrClient = {
			recognize: jest.fn().mockReturnValue(mockResponseStream),
		};

		// Mock Session
		mockSession = {
			client: jest.fn().mockReturnValue(mockOcrClient),
		};

		const { Session } = require('@yandex-cloud/nodejs-sdk');
		Session.mockImplementation(() => mockSession);

		// Mock Execute Functions
		mockExecuteFunctions = {
			getInputData: jest.fn().mockReturnValue([{ json: {}, binary: {} }]),
			getNodeParameter: jest.fn(),
			getCredentials: jest.fn().mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					service_account_id: 'sa-test-id',
					id: 'key-test-id',
					private_key: 'test-private-key',
				}),
			}),
			continueOnFail: jest.fn().mockReturnValue(false),
			getNode: jest.fn().mockReturnValue({ name: 'Test Node' }),
			helpers: {
				getBinaryDataBuffer: jest.fn().mockResolvedValue(jpegBuffer),
			} as any,
		};
	});

	describe('Node Definition', () => {
		it('should have correct basic properties', () => {
			expect(node.description.displayName).toBe('Yandex Cloud Vision OCR');
			expect(node.description.name).toBe('yandexCloudVisionOcr');
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

		it('should have textRecognition resource', () => {
			const resourceProperty = node.description.properties.find(
				(prop) => prop.name === 'resource',
			);
			expect(resourceProperty).toBeDefined();
			expect(resourceProperty?.options).toContainEqual({
				name: 'Text Recognition',
				value: 'textRecognition',
			});
		});

		it('should have recognize operation', () => {
			const operationProperty = node.description.properties.find(
				(prop) => prop.name === 'operation',
			);
			expect(operationProperty).toBeDefined();
			expect(operationProperty?.options).toContainEqual({
				name: 'Recognize',
				value: 'recognize',
				description: 'Recognize text in an image',
				action: 'Recognize text in image',
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
			).rejects.toThrow('Service Account ID');
		});

		it('should throw error for missing access key id', async () => {
			mockExecuteFunctions.getCredentials = jest.fn().mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					service_account_id: 'sa-test-id',
					private_key: 'test-private-key',
				}),
			});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('Access Key ID');
		});

		it('should throw error for missing private key', async () => {
			mockExecuteFunctions.getCredentials = jest.fn().mockResolvedValue({
				serviceAccountJson: JSON.stringify({
					service_account_id: 'sa-test-id',
					id: 'key-test-id',
				}),
			});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('Private Key');
		});
	});

	describe('Text Recognition - Happy Path', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((param: string) => {
				const params: Record<string, any> = {
					resource: 'textRecognition',
					operation: 'recognize',
					binaryProperty: 'data',
					mimeType: 'auto',
					languageCodes: ['ru', 'en'],
					model: 'page',
					outputFormat: 'fullText',
				};
				return params[param];
			});
		});

		it('should successfully recognize text from JPEG image', async () => {
			const mockTextAnnotation = {
				width: 800,
				height: 600,
				blocks: [],
				entities: [],
				tables: [],
				fullText: 'Recognized text from image',
				rotate: 'ANGLE_0',
			};

			mockResponseStream[Symbol.asyncIterator] = jest.fn(async function* () {
				yield { textAnnotation: mockTextAnnotation, page: 1 };
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result).toHaveLength(1);
			expect(result[0]).toHaveLength(1);
			expect(result[0][0].json).toEqual({
				fullText: 'Recognized text from image',
			});
			expect(mockOcrClient.recognize).toHaveBeenCalledWith({
				content: jpegBuffer,
				mimeType: 'image/jpeg',
				languageCodes: ['ru', 'en'],
				model: 'page',
			});
		});

		it('should detect PNG MIME type correctly', async () => {
			(mockExecuteFunctions.helpers!.getBinaryDataBuffer as jest.Mock).mockResolvedValue(pngBuffer);

			const mockTextAnnotation = {
				fullText: 'PNG image text',
			};

			mockResponseStream[Symbol.asyncIterator] = jest.fn(async function* () {
				yield { textAnnotation: mockTextAnnotation };
			});

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(mockOcrClient.recognize).toHaveBeenCalledWith(
				expect.objectContaining({
					mimeType: 'image/png',
				}),
			);
		});

		it('should detect PDF MIME type correctly', async () => {
			(mockExecuteFunctions.helpers!.getBinaryDataBuffer as jest.Mock).mockResolvedValue(pdfBuffer);

			const mockTextAnnotation = {
				fullText: 'PDF document text',
			};

			mockResponseStream[Symbol.asyncIterator] = jest.fn(async function* () {
				yield { textAnnotation: mockTextAnnotation };
			});

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(mockOcrClient.recognize).toHaveBeenCalledWith(
				expect.objectContaining({
					mimeType: 'application/pdf',
				}),
			);
		});

		it('should use provided MIME type when not auto-detect', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((param: string) => {
				const params: Record<string, any> = {
					resource: 'textRecognition',
					operation: 'recognize',
					binaryProperty: 'data',
					mimeType: 'image/png',
					languageCodes: ['ru', 'en'],
					model: 'page',
					outputFormat: 'fullText',
				};
				return params[param];
			});

			const mockTextAnnotation = {
				fullText: 'Text content',
			};

			mockResponseStream[Symbol.asyncIterator] = jest.fn(async function* () {
				yield { textAnnotation: mockTextAnnotation };
			});

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(mockOcrClient.recognize).toHaveBeenCalledWith(
				expect.objectContaining({
					mimeType: 'image/png',
				}),
			);
		});

		it('should pass language codes correctly', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((param: string) => {
				const params: Record<string, any> = {
					resource: 'textRecognition',
					operation: 'recognize',
					binaryProperty: 'data',
					mimeType: 'auto',
					languageCodes: ['en', 'ru'],
					model: 'page',
					outputFormat: 'fullText',
				};
				return params[param];
			});

			const mockTextAnnotation = {
				fullText: 'Multilingual text',
			};

			mockResponseStream[Symbol.asyncIterator] = jest.fn(async function* () {
				yield { textAnnotation: mockTextAnnotation };
			});

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(mockOcrClient.recognize).toHaveBeenCalledWith(
				expect.objectContaining({
					languageCodes: ['en', 'ru'],
				}),
			);
		});

		it('should return structured data when outputFormat is structured', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((param: string) => {
				const params: Record<string, any> = {
					resource: 'textRecognition',
					operation: 'recognize',
					binaryProperty: 'data',
					mimeType: 'auto',
					languageCodes: ['ru', 'en'],
					model: 'page',
					outputFormat: 'structured',
				};
				return params[param];
			});

			const mockTextAnnotation = {
				width: 800,
				height: 600,
				blocks: [{ text: 'Block 1' }],
				entities: [],
				tables: [],
				fullText: 'Full text',
				rotate: 'ANGLE_0',
			};

			mockResponseStream[Symbol.asyncIterator] = jest.fn(async function* () {
				yield { textAnnotation: mockTextAnnotation };
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toHaveProperty('structured');
			expect(result[0][0].json).not.toHaveProperty('fullText');
			expect(result[0][0].json.structured).toHaveLength(1);
		});

		it('should return both formats when outputFormat is both', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((param: string) => {
				const params: Record<string, any> = {
					resource: 'textRecognition',
					operation: 'recognize',
					binaryProperty: 'data',
					mimeType: 'auto',
					languageCodes: ['ru', 'en'],
					model: 'page',
					outputFormat: 'both',
				};
				return params[param];
			});

			const mockTextAnnotation = {
				width: 800,
				height: 600,
				blocks: [],
				fullText: 'Full text',
				entities: [],
				tables: [],
			};

			mockResponseStream[Symbol.asyncIterator] = jest.fn(async function* () {
				yield { textAnnotation: mockTextAnnotation };
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toHaveProperty('fullText');
			expect(result[0][0].json).toHaveProperty('structured');
		});

		it('should handle multi-page PDF results', async () => {
			const mockTextAnnotations = [
				{ fullText: 'Page 1 text' },
				{ fullText: 'Page 2 text' },
			];

			mockResponseStream[Symbol.asyncIterator] = jest.fn(async function* () {
				yield { textAnnotation: mockTextAnnotations[0], page: 1 };
				yield { textAnnotation: mockTextAnnotations[1], page: 2 };
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json.fullText).toBe('Page 1 text\n\nPage 2 text');
		});
	});

	describe('Error Handling', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((param: string) => {
				const params: Record<string, any> = {
					resource: 'textRecognition',
					operation: 'recognize',
					binaryProperty: 'data',
					mimeType: 'auto',
					languageCodes: ['ru', 'en'],
					model: 'page',
					outputFormat: 'fullText',
				};
				return params[param];
			});
		});

		it('should throw error when binary data is missing', async () => {
			(mockExecuteFunctions.helpers!.getBinaryDataBuffer as jest.Mock).mockResolvedValue(null);

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('No binary data found');
		});

		it('should throw error when binary data is empty', async () => {
			(mockExecuteFunctions.helpers!.getBinaryDataBuffer as jest.Mock).mockResolvedValue(
				Buffer.from([]),
			);

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('No binary data found');
		});

		it('should throw error for file size exceeding limit', async () => {
			const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
			(mockExecuteFunctions.helpers!.getBinaryDataBuffer as jest.Mock).mockResolvedValue(
				largeBuffer,
			);

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('exceeds maximum allowed size');
		});

		it('should continue on fail when continueOnFail is true', async () => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			(mockExecuteFunctions.helpers!.getBinaryDataBuffer as jest.Mock).mockResolvedValue(null);

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result).toHaveLength(1);
			expect(result[0]).toHaveLength(1);
			expect(result[0][0].json).toHaveProperty('error');
			expect(result[0][0].json.success).toBe(false);
		});

		it('should handle OCR service errors gracefully', async () => {
			mockOcrClient.recognize.mockImplementation(() => {
				throw new Error('OCR service error');
			});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('Yandex Cloud SDK error in recognize');
		});

		it('should continue on OCR errors when continueOnFail is enabled', async () => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			mockOcrClient.recognize.mockImplementation(() => {
				throw new Error('OCR service error');
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toHaveProperty('error');
			expect(result[0][0].json.error).toBe('OCR service error');
		});

		it('should throw error for license-plates model without language', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((param: string) => {
				const params: Record<string, any> = {
					resource: 'textRecognition',
					operation: 'recognize',
					binaryProperty: 'data',
					mimeType: 'auto',
					languageCodes: [],
					model: 'license-plates',
					outputFormat: 'fullText',
				};
				return params[param];
			});

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('license-plates model requires at least one language');
		});
	});

	describe('Multiple Items Processing', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((param: string) => {
				const params: Record<string, any> = {
					resource: 'textRecognition',
					operation: 'recognize',
					binaryProperty: 'data',
					mimeType: 'auto',
					languageCodes: ['ru', 'en'],
					model: 'page',
					outputFormat: 'fullText',
				};
				return params[param];
			});
		});

		it('should process multiple items correctly', async () => {
			mockExecuteFunctions.getInputData = jest.fn().mockReturnValue([
				{ json: {}, binary: {} },
				{ json: {}, binary: {} },
			]);

			const mockTextAnnotations = [
				{ fullText: 'First image text' },
				{ fullText: 'Second image text' },
			];

			let callCount = 0;
			mockResponseStream[Symbol.asyncIterator] = jest.fn(async function* () {
				yield { textAnnotation: mockTextAnnotations[callCount++] };
			});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result).toHaveLength(1);
			expect(result[0]).toHaveLength(2);
			expect(result[0][0].json.fullText).toBe('First image text');
			expect(result[0][1].json.fullText).toBe('Second image text');
		});
	});
});
