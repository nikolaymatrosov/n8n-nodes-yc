import { NodeOperationError } from 'n8n-workflow';
import { mock } from 'jest-mock-extended';
import type { INode } from 'n8n-workflow';
import {
	parseServiceAccountJson,
	validateServiceAccountCredentials,
	createYandexSession,
	type IServiceAccountCredentials,
} from '../authUtils';

describe('authUtils', () => {
	describe('parseServiceAccountJson', () => {
		it('should parse valid service account JSON with snake_case', () => {
			const jsonString = JSON.stringify({
				service_account_id: 'sa-123',
				id: 'key-456',
				private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
			});

			const result = parseServiceAccountJson(jsonString);

			expect(result).toEqual({
				serviceAccountId: 'sa-123',
				accessKeyId: 'key-456',
				privateKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
			});
		});

		it('should parse valid service account JSON with camelCase', () => {
			const jsonString = JSON.stringify({
				serviceAccountId: 'sa-123',
				accessKeyId: 'key-456',
				privateKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
			});

			const result = parseServiceAccountJson(jsonString);

			expect(result).toEqual({
				serviceAccountId: 'sa-123',
				accessKeyId: 'key-456',
				privateKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
			});
		});

		it('should handle id field as fallback for accessKeyId', () => {
			const jsonString = JSON.stringify({
				service_account_id: 'sa-123',
				id: 'key-456',
				private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
			});

			const result = parseServiceAccountJson(jsonString);

			expect(result.accessKeyId).toBe('key-456');
		});

		it('should throw error for invalid JSON', () => {
			const invalidJson = '{invalid json}';

			expect(() => parseServiceAccountJson(invalidJson)).toThrow(
				'Failed to parse service account JSON',
			);
		});

		it('should return empty strings for missing fields', () => {
			const jsonString = JSON.stringify({});

			const result = parseServiceAccountJson(jsonString);

			expect(result).toEqual({
				serviceAccountId: '',
				accessKeyId: '',
				privateKey: '',
			});
		});
	});

	describe('validateServiceAccountCredentials', () => {
		const mockNode = mock<INode>();

		const validCredentials: IServiceAccountCredentials = {
			serviceAccountId: 'sa-123',
			accessKeyId: 'key-456',
			privateKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
		};

		it('should not throw for valid credentials', () => {
			expect(() =>
				validateServiceAccountCredentials(validCredentials, mockNode),
			).not.toThrow();
		});

		it('should throw NodeOperationError for missing serviceAccountId', () => {
			const invalidCredentials = { ...validCredentials, serviceAccountId: '' };

			expect(() =>
				validateServiceAccountCredentials(invalidCredentials, mockNode),
			).toThrow(NodeOperationError);

			expect(() =>
				validateServiceAccountCredentials(invalidCredentials, mockNode),
			).toThrow('Service Account ID');
		});

		it('should throw NodeOperationError for missing accessKeyId', () => {
			const invalidCredentials = { ...validCredentials, accessKeyId: '' };

			expect(() =>
				validateServiceAccountCredentials(invalidCredentials, mockNode),
			).toThrow(NodeOperationError);

			expect(() =>
				validateServiceAccountCredentials(invalidCredentials, mockNode),
			).toThrow('Access Key ID');
		});

		it('should throw NodeOperationError for missing privateKey', () => {
			const invalidCredentials = { ...validCredentials, privateKey: '' };

			expect(() =>
				validateServiceAccountCredentials(invalidCredentials, mockNode),
			).toThrow(NodeOperationError);

			expect(() =>
				validateServiceAccountCredentials(invalidCredentials, mockNode),
			).toThrow('Private Key');
		});

		it('should accept node as function', () => {
			const getNode = () => mockNode;

			expect(() =>
				validateServiceAccountCredentials(validCredentials, getNode),
			).not.toThrow();
		});
	});

	describe('createYandexSession', () => {
		it('should create a Session instance', () => {
			const credentials: IServiceAccountCredentials = {
				serviceAccountId: 'sa-123',
				accessKeyId: 'key-456',
				privateKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
			};

			const session = createYandexSession(credentials);

			expect(session).toBeDefined();
			expect(session.constructor.name).toBe('Session');
		});
	});
});
