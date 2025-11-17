import type { ILoadOptionsFunctions, INode } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import { loadLogGroups } from '../GenericFunctions';

// Mock dependencies
jest.mock('@yandex-cloud/nodejs-sdk', () => ({
	Session: jest.fn(),
}));

// Mock the logging module - Jest should resolve imports without /index to this
jest.mock('@yandex-cloud/nodejs-sdk/dist/clients/logging-v1/index', () => ({
	logGroupService: {
		LogGroupServiceClient: class MockLogGroupServiceClient {},
	},
}));

describe('YandexCloudLogging GenericFunctions', () => {
	describe('loadLogGroups', () => {
		let mockLoadOptionsFunctions: Partial<ILoadOptionsFunctions>;
		let mockSession: any;
		let mockClient: any;
		let mockNode: INode;

		const mockCredentials = {
			serviceAccountJson: JSON.stringify({
				service_account_id: 'sa-test-id',
				id: 'key-test-id',
				private_key: 'test-private-key',
			}),
			folderId: 'folder-test-id',
		};

		beforeEach(() => {
			jest.clearAllMocks();

			mockNode = {
				id: 'test-node-id',
				name: 'Yandex Cloud Logging',
				type: 'n8n-nodes-yc.yandexCloudLogging',
				typeVersion: 1,
				position: [0, 0],
				parameters: {},
			};

			mockClient = {
				list: jest.fn(),
			};

			mockSession = {
				client: jest.fn(() => mockClient),
			};

			// Mock Session constructor
			const { Session } = require('@yandex-cloud/nodejs-sdk');
			Session.mockImplementation(() => mockSession);

			mockLoadOptionsFunctions = {
				getCredentials: jest.fn().mockResolvedValue(mockCredentials),
				getNode: jest.fn().mockReturnValue(mockNode),
			};
		});

		it('should load log groups successfully', async () => {
			mockClient.list.mockResolvedValue({
				groups: [
					{
						id: 'log-group-1',
						name: 'Production Logs',
						folderId: 'folder-test-id',
					},
					{
						id: 'log-group-2',
						name: 'Development Logs',
						folderId: 'folder-test-id',
					},
					{
						id: 'log-group-3',
						name: 'Staging Logs',
						folderId: 'folder-test-id',
					},
				],
				nextPageToken: '',
			});

			const result = await loadLogGroups.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(result.results).toHaveLength(3);
			expect(result.results[0]).toEqual({
				name: 'Production Logs (log-group-1)',
				value: 'log-group-1',
			});
			expect(result.results[1]).toEqual({
				name: 'Development Logs (log-group-2)',
				value: 'log-group-2',
			});
			expect(result.results[2]).toEqual({
				name: 'Staging Logs (log-group-3)',
				value: 'log-group-3',
			});
		});

		it('should filter log groups by name', async () => {
			mockClient.list.mockResolvedValue({
				groups: [
					{
						id: 'log-group-1',
						name: 'Production Logs',
						folderId: 'folder-test-id',
					},
					{
						id: 'log-group-2',
						name: 'Development Logs',
						folderId: 'folder-test-id',
					},
					{
						id: 'log-group-3',
						name: 'Staging Logs',
						folderId: 'folder-test-id',
					},
				],
				nextPageToken: '',
			});

			const result = await loadLogGroups.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
				'production',
			);

			expect(result.results).toHaveLength(1);
			expect(result.results[0]).toEqual({
				name: 'Production Logs (log-group-1)',
				value: 'log-group-1',
			});
		});

		it('should filter log groups by ID', async () => {
			mockClient.list.mockResolvedValue({
				groups: [
					{
						id: 'log-group-1',
						name: 'Production Logs',
						folderId: 'folder-test-id',
					},
					{
						id: 'log-group-2',
						name: 'Development Logs',
						folderId: 'folder-test-id',
					},
					{
						id: 'log-group-special',
						name: 'Staging Logs',
						folderId: 'folder-test-id',
					},
				],
				nextPageToken: '',
			});

			const result = await loadLogGroups.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
				'special',
			);

			expect(result.results).toHaveLength(1);
			expect(result.results[0]).toEqual({
				name: 'Staging Logs (log-group-special)',
				value: 'log-group-special',
			});
		});

		it('should be case-insensitive when filtering', async () => {
			mockClient.list.mockResolvedValue({
				groups: [
					{
						id: 'log-group-1',
						name: 'Production Logs',
						folderId: 'folder-test-id',
					},
					{
						id: 'log-group-2',
						name: 'Development Logs',
						folderId: 'folder-test-id',
					},
				],
				nextPageToken: '',
			});

			const result = await loadLogGroups.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
				'PRODUCTION',
			);

			expect(result.results).toHaveLength(1);
			expect(result.results[0].name).toContain('Production Logs');
		});

		it('should return empty results when no groups match filter', async () => {
			mockClient.list.mockResolvedValue({
				groups: [
					{
						id: 'log-group-1',
						name: 'Production Logs',
						folderId: 'folder-test-id',
					},
				],
				nextPageToken: '',
			});

			const result = await loadLogGroups.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
				'nonexistent',
			);

			expect(result.results).toHaveLength(0);
		});

		it('should return empty results when no groups exist', async () => {
			mockClient.list.mockResolvedValue({
				groups: [],
				nextPageToken: '',
			});

			const result = await loadLogGroups.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(result.results).toHaveLength(0);
		});

		it('should throw error when folder ID is missing', async () => {
			(mockLoadOptionsFunctions.getCredentials as jest.Mock).mockResolvedValue({
				serviceAccountJson: mockCredentials.serviceAccountJson,
				folderId: '',
			});

			await expect(
				loadLogGroups.call(mockLoadOptionsFunctions as ILoadOptionsFunctions),
			).rejects.toThrow(NodeApiError);

			await expect(
				loadLogGroups.call(mockLoadOptionsFunctions as ILoadOptionsFunctions),
			).rejects.toThrow('Folder ID is missing in credentials');
		});

		it('should throw error when service account JSON is invalid', async () => {
			(mockLoadOptionsFunctions.getCredentials as jest.Mock).mockResolvedValue({
				serviceAccountJson: 'invalid-json',
				folderId: 'folder-test-id',
			});

			await expect(
				loadLogGroups.call(mockLoadOptionsFunctions as ILoadOptionsFunctions),
			).rejects.toThrow();
		});

		it('should throw error when API call fails', async () => {
			mockClient.list.mockRejectedValue(new Error('API Error'));

			await expect(
				loadLogGroups.call(mockLoadOptionsFunctions as ILoadOptionsFunctions),
			).rejects.toThrow(NodeApiError);

			await expect(
				loadLogGroups.call(mockLoadOptionsFunctions as ILoadOptionsFunctions),
			).rejects.toThrow('Failed to load log groups');
		});

		it('should call API with correct parameters', async () => {
			mockClient.list.mockResolvedValue({
				groups: [],
				nextPageToken: '',
			});

			await loadLogGroups.call(mockLoadOptionsFunctions as ILoadOptionsFunctions);

			expect(mockClient.list).toHaveBeenCalledWith({
				folderId: 'folder-test-id',
				pageSize: 1000,
				pageToken: '',
				filter: '',
			});
		});

		it('should handle groups with special characters in names', async () => {
			mockClient.list.mockResolvedValue({
				groups: [
					{
						id: 'log-group-1',
						name: 'Logs (Production) [2024]',
						folderId: 'folder-test-id',
					},
					{
						id: 'log-group-2',
						name: 'Dev-Logs_Test',
						folderId: 'folder-test-id',
					},
				],
				nextPageToken: '',
			});

			const result = await loadLogGroups.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(result.results).toHaveLength(2);
			expect(result.results[0]).toEqual({
				name: 'Logs (Production) [2024] (log-group-1)',
				value: 'log-group-1',
			});
			expect(result.results[1]).toEqual({
				name: 'Dev-Logs_Test (log-group-2)',
				value: 'log-group-2',
			});
		});

		it('should filter with partial matches', async () => {
			mockClient.list.mockResolvedValue({
				groups: [
					{
						id: 'log-group-prod-1',
						name: 'Production API Logs',
						folderId: 'folder-test-id',
					},
					{
						id: 'log-group-prod-2',
						name: 'Production Worker Logs',
						folderId: 'folder-test-id',
					},
					{
						id: 'log-group-dev-1',
						name: 'Development Logs',
						folderId: 'folder-test-id',
					},
				],
				nextPageToken: '',
			});

			const result = await loadLogGroups.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
				'prod',
			);

			expect(result.results).toHaveLength(2);
			expect(result.results.every((r) => r.name.toLowerCase().includes('prod') || r.value.toString().includes('prod'))).toBe(
				true,
			);
		});
	});
});
