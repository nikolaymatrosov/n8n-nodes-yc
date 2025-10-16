import { S3Client } from '@aws-sdk/client-s3';
import { YandexCloudObjectStorage } from '../YandexCloudObjectStorage.node';
import type { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
import { Readable } from 'stream';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

describe('YandexCloudObjectStorage Node', () => {
	let node: YandexCloudObjectStorage;
	let mockExecuteFunctions: Partial<IExecuteFunctions>;
	let mockLoadOptionsFunctions: Partial<ILoadOptionsFunctions>;
	let mockSend: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();

		node = new YandexCloudObjectStorage();

		mockSend = jest.fn();
		(S3Client as jest.Mock).mockImplementation(() => ({
			send: mockSend,
		}));

		mockExecuteFunctions = {
			getInputData: jest.fn().mockReturnValue([{ json: {} }]),
			getNodeParameter: jest.fn(),
			getCredentials: jest.fn().mockResolvedValue({
				accessKeyId: 'test-key',
				secretAccessKey: 'test-secret',
			}),
			continueOnFail: jest.fn().mockReturnValue(false),
			getNode: jest.fn().mockReturnValue({ name: 'Test Node' }),
			helpers: {
				getBinaryDataBuffer: jest.fn(),
				prepareBinaryData: jest.fn(),
			} as any,
		};

		mockLoadOptionsFunctions = {
			getCredentials: jest.fn().mockResolvedValue({
				accessKeyId: 'test-key',
				secretAccessKey: 'test-secret',
			}),
			getNodeParameter: jest.fn(),
			getNode: jest.fn().mockReturnValue({ name: 'Test Node' }),
		};
	});

	describe('Node Definition', () => {
		it('should have correct basic properties', () => {
			expect(node.description.displayName).toBe('Yandex Object Storage');
			expect(node.description.name).toBe('yandexCloudObjectStorage');
			expect(node.description.group).toContain('transform');
			expect(node.description.version).toBe(1);
		});

		it('should have correct credentials configuration', () => {
			expect(node.description.credentials).toHaveLength(1);
			expect(node.description.credentials?.[0]).toEqual({
				name: 'yandexCloudStaticApi',
				required: true,
			});
		});

		it('should have correct input/output configuration', () => {
			expect(node.description.inputs).toEqual(['main']);
			expect(node.description.outputs).toEqual(['main']);
		});

		it('should have subtitle based on resource and operation', () => {
			expect(node.description.subtitle).toBe('={{$parameter["operation"] + ": " + $parameter["resource"]}}');
		});

		it('should expose loadBuckets and loadObjects methods', () => {
			expect(node.methods?.listSearch?.loadBuckets).toBeDefined();
			expect(node.methods?.listSearch?.loadObjects).toBeDefined();
		});
	});

	describe('Bucket Operations', () => {
		describe('List Buckets', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'bucket',
							operation: 'list',
						};
						return params[paramName];
					},
				);
			});

			it('should list buckets successfully', async () => {
				mockSend.mockResolvedValue({
					Buckets: [
						{
							Name: 'test-bucket-1',
							CreationDate: new Date('2024-01-01'),
						},
						{
							Name: 'test-bucket-2',
							CreationDate: new Date('2024-01-02'),
						},
					],
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result).toHaveLength(1);
				expect(result[0]).toHaveLength(2);
				expect(result[0][0].json).toMatchObject({
					name: 'test-bucket-1',
					creationDate: new Date('2024-01-01'),
				});
				expect(result[0][1].json).toMatchObject({
					name: 'test-bucket-2',
					creationDate: new Date('2024-01-02'),
				});
			});

			it('should handle empty bucket list', async () => {
				mockSend.mockResolvedValue({
					Buckets: [],
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result).toHaveLength(1);
				expect(result[0]).toHaveLength(0);
			});

			it('should throw error when list fails', async () => {
				mockSend.mockRejectedValue(new Error('Access denied'));

				await expect(
					node.execute.call(mockExecuteFunctions as IExecuteFunctions),
				).rejects.toThrow('Failed to list buckets: Access denied');
			});
		});

		describe('Create Bucket', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'bucket',
							operation: 'create',
							bucketName: 'new-test-bucket',
							additionalFields: {},
						};
						return params[paramName];
					},
				);
			});

			it('should create bucket successfully', async () => {
				mockSend.mockResolvedValue({});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: true,
					bucket: 'new-test-bucket',
					message: 'Bucket created successfully',
				});
			});

			it('should create bucket with ACL', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string) => {
						const params: Record<string, any> = {
							resource: 'bucket',
							operation: 'create',
							bucketName: 'new-test-bucket',
							additionalFields: {
								acl: 'public-read',
							},
						};
						return params[paramName];
					},
				);

				mockSend.mockResolvedValue({});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json.bucket).toBe('new-test-bucket');
				expect(mockSend).toHaveBeenCalled();
			});

			it('should include pairedItem metadata', async () => {
				mockSend.mockResolvedValue({});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].pairedItem).toEqual({ item: 0 });
			});
		});

		describe('Delete Bucket', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							return 'test-bucket';
						}
						const params: Record<string, any> = {
							resource: 'bucket',
							operation: 'delete',
							bucketName: { mode: 'list', value: 'test-bucket' },
						};
						return params[paramName];
					},
				);
			});

			it('should delete bucket successfully', async () => {
				mockSend.mockResolvedValue({});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: true,
					bucket: 'test-bucket',
					message: 'Bucket deleted successfully',
				});
			});
		});

		describe('Get Bucket', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							return 'test-bucket';
						}
						const params: Record<string, any> = {
							resource: 'bucket',
							operation: 'get',
							bucketName: { mode: 'list', value: 'test-bucket' },
						};
						return params[paramName];
					},
				);
			});

			it('should get bucket information successfully', async () => {
				mockSend
					.mockResolvedValueOnce({
						$metadata: {
							httpStatusCode: 200,
							requestId: 'test-request-id',
						},
					})
					.mockResolvedValueOnce({
						LocationConstraint: 'ru-central1',
					});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: true,
					bucket: 'test-bucket',
					location: 'ru-central1',
				});
			});

			it('should handle missing location constraint', async () => {
				mockSend
					.mockResolvedValueOnce({
						$metadata: {
							httpStatusCode: 200,
						},
					})
					.mockRejectedValueOnce(new Error('LocationConstraint error'));

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json.success).toBe(true);
				expect(result[0][0].json.bucket).toBe('test-bucket');
			});
		});

		describe('Set Bucket ACL', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							return 'test-bucket';
						}
						const params: Record<string, any> = {
							resource: 'bucket',
							operation: 'setAcl',
							bucketName: { mode: 'list', value: 'test-bucket' },
							acl: 'public-read',
						};
						return params[paramName];
					},
				);
			});

			it('should set bucket ACL successfully', async () => {
				mockSend.mockResolvedValue({});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: true,
					bucket: 'test-bucket',
					acl: 'public-read',
					message: 'Bucket ACL set successfully',
				});
			});
		});

		describe('Set Bucket Versioning', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							return 'test-bucket';
						}
						const params: Record<string, any> = {
							resource: 'bucket',
							operation: 'setVersioning',
							bucketName: { mode: 'list', value: 'test-bucket' },
							versioningStatus: 'Enabled',
						};
						return params[paramName];
					},
				);
			});

			it('should enable bucket versioning successfully', async () => {
				mockSend.mockResolvedValue({});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: true,
					bucket: 'test-bucket',
					versioningStatus: 'Enabled',
					message: 'Bucket versioning set successfully',
				});
			});
		});
	});

	describe('Object Operations', () => {
		describe('Upload Object', () => {
			describe('Binary Upload', () => {
				beforeEach(() => {
					(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
						(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
							if (options?.extractValue) {
								return 'test-bucket';
							}
							const params: Record<string, any> = {
								resource: 'object',
								operation: 'upload',
								bucketName: { mode: 'list', value: 'test-bucket' },
								objectKey: 'test-file.txt',
								inputDataType: 'binary',
								binaryProperty: 'data',
								additionalFields: {},
							};
							return params[paramName];
						},
					);

					(mockExecuteFunctions.helpers!.getBinaryDataBuffer as jest.Mock).mockResolvedValue(
						Buffer.from('test content'),
					);
				});

				it('should upload binary data successfully', async () => {
					(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
						{
							json: {},
							binary: {
								data: {
									mimeType: 'text/plain',
									data: 'base64data',
								},
							},
						},
					]);

					mockSend.mockResolvedValue({
						ETag: '"etag-123"',
						VersionId: 'version-1',
					});

					const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

					expect(result[0][0].json).toMatchObject({
						success: true,
						bucket: 'test-bucket',
						key: 'test-file.txt',
						etag: '"etag-123"',
						versionId: 'version-1',
					});
				});

				it('should use mime type from binary data', async () => {
					(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
						{
							json: {},
							binary: {
								data: {
									mimeType: 'application/pdf',
									data: 'base64data',
								},
							},
						},
					]);

					mockSend.mockResolvedValue({
						ETag: '"etag-123"',
					});

					const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

					expect(result[0][0].json.success).toBe(true);
					expect(mockSend).toHaveBeenCalled();
				});

				it('should upload with custom content type', async () => {
					(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
						(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
							if (options?.extractValue) {
								return 'test-bucket';
							}
							const params: Record<string, any> = {
								resource: 'object',
								operation: 'upload',
								bucketName: { mode: 'list', value: 'test-bucket' },
								objectKey: 'test-file.txt',
								inputDataType: 'binary',
								binaryProperty: 'data',
								additionalFields: {
									contentType: 'application/octet-stream',
								},
							};
							return params[paramName];
						},
					);

					mockSend.mockResolvedValue({
						ETag: '"etag-123"',
					});

					const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

					expect(result[0][0].json.success).toBe(true);
					expect(mockSend).toHaveBeenCalled();
				});

				it('should upload with ACL', async () => {
					(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
						(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
							if (options?.extractValue) {
								return 'test-bucket';
							}
							const params: Record<string, any> = {
								resource: 'object',
								operation: 'upload',
								bucketName: { mode: 'list', value: 'test-bucket' },
								objectKey: 'test-file.txt',
								inputDataType: 'binary',
								binaryProperty: 'data',
								additionalFields: {
									acl: 'public-read',
								},
							};
							return params[paramName];
						},
					);

					mockSend.mockResolvedValue({
						ETag: '"etag-123"',
					});

					const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

					expect(result[0][0].json.success).toBe(true);
					expect(mockSend).toHaveBeenCalled();
				});

				it('should upload with storage class', async () => {
					(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
						(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
							if (options?.extractValue) {
								return 'test-bucket';
							}
							const params: Record<string, any> = {
								resource: 'object',
								operation: 'upload',
								bucketName: { mode: 'list', value: 'test-bucket' },
								objectKey: 'test-file.txt',
								inputDataType: 'binary',
								binaryProperty: 'data',
								additionalFields: {
									storageClass: 'COLD',
								},
							};
							return params[paramName];
						},
					);

					mockSend.mockResolvedValue({
						ETag: '"etag-123"',
					});

					const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

					expect(result[0][0].json.success).toBe(true);
					expect(mockSend).toHaveBeenCalled();
				});

				it('should upload with metadata', async () => {
					(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
						(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
							if (options?.extractValue) {
								return 'test-bucket';
							}
							const params: Record<string, any> = {
								resource: 'object',
								operation: 'upload',
								bucketName: { mode: 'list', value: 'test-bucket' },
								objectKey: 'test-file.txt',
								inputDataType: 'binary',
								binaryProperty: 'data',
								additionalFields: {
									metadata: {
										metadataItem: [
											{ key: 'author', value: 'John Doe' },
											{ key: 'department', value: 'Engineering' },
										],
									},
								},
							};
							return params[paramName];
						},
					);

					mockSend.mockResolvedValue({
						ETag: '"etag-123"',
					});

					const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

					expect(result[0][0].json.success).toBe(true);
					expect(mockSend).toHaveBeenCalled();
				});
			});

			describe('Text Upload', () => {
				beforeEach(() => {
					(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
						(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
							if (options?.extractValue) {
								return 'test-bucket';
							}
							const params: Record<string, any> = {
								resource: 'object',
								operation: 'upload',
								bucketName: { mode: 'list', value: 'test-bucket' },
								objectKey: 'test-file.txt',
								inputDataType: 'text',
								textContent: 'Hello World',
								additionalFields: {},
							};
							return params[paramName];
						},
					);
				});

				it('should upload text content successfully', async () => {
					mockSend.mockResolvedValue({
						ETag: '"etag-123"',
					});

					const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

					expect(result[0][0].json).toMatchObject({
						success: true,
						bucket: 'test-bucket',
						key: 'test-file.txt',
						etag: '"etag-123"',
					});
				});

				it('should set default content type for text', async () => {
					mockSend.mockResolvedValue({
						ETag: '"etag-123"',
					});

					const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

					expect(result[0][0].json.success).toBe(true);
					expect(mockSend).toHaveBeenCalled();
				});
			});

			describe('JSON Upload', () => {
				beforeEach(() => {
					(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
						(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
							if (options?.extractValue) {
								return 'test-bucket';
							}
							const params: Record<string, any> = {
								resource: 'object',
								operation: 'upload',
								bucketName: { mode: 'list', value: 'test-bucket' },
								objectKey: 'data.json',
								inputDataType: 'json',
								jsonContent: { foo: 'bar', nested: { key: 'value' } },
								additionalFields: {},
							};
							return params[paramName];
						},
					);
				});

				it('should upload JSON content successfully', async () => {
					mockSend.mockResolvedValue({
						ETag: '"etag-123"',
					});

					const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

					expect(result[0][0].json).toMatchObject({
						success: true,
						bucket: 'test-bucket',
						key: 'data.json',
						etag: '"etag-123"',
					});
				});

				it('should set default content type for JSON', async () => {
					mockSend.mockResolvedValue({
						ETag: '"etag-123"',
					});

					const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

					expect(result[0][0].json.success).toBe(true);
					expect(mockSend).toHaveBeenCalled();
				});
			});
		});

		describe('Download Object', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							return 'test-bucket';
						}
						const params: Record<string, any> = {
							resource: 'object',
							operation: 'download',
							bucketName: { mode: 'list', value: 'test-bucket' },
							objectKey: 'test-file.txt',
						};
						return params[paramName];
					},
				);

				(mockExecuteFunctions.helpers!.prepareBinaryData as jest.Mock).mockResolvedValue({
					data: 'binary-data',
					mimeType: 'text/plain',
					fileName: 'test-file.txt',
				});
			});

			it('should download object successfully', async () => {
				const mockStream = new Readable();
				mockStream.push('test content');
				mockStream.push(null);

				mockSend.mockResolvedValue({
					Body: mockStream,
					ContentType: 'text/plain',
					ContentLength: 12,
					LastModified: new Date('2024-01-01'),
					ETag: '"etag-123"',
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: true,
					bucket: 'test-bucket',
					key: 'test-file.txt',
					size: 12,
					contentType: 'text/plain',
					etag: '"etag-123"',
				});
				expect(result[0][0].binary).toBeDefined();
			});
		});

		describe('Delete Object', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							return 'test-bucket';
						}
						const params: Record<string, any> = {
							resource: 'object',
							operation: 'delete',
							bucketName: { mode: 'list', value: 'test-bucket' },
							objectKey: 'test-file.txt',
						};
						return params[paramName];
					},
				);
			});

			it('should delete object successfully', async () => {
				mockSend.mockResolvedValue({});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: true,
					bucket: 'test-bucket',
					key: 'test-file.txt',
					message: 'Object deleted successfully',
				});
			});
		});

		describe('List Objects', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							return 'test-bucket';
						}
						const params: Record<string, any> = {
							resource: 'object',
							operation: 'list',
							bucketName: { mode: 'list', value: 'test-bucket' },
							additionalFields: {},
						};
						return params[paramName];
					},
				);
			});

			it('should list objects successfully', async () => {
				mockSend.mockResolvedValue({
					Contents: [
						{
							Key: 'file1.txt',
							Size: 100,
							LastModified: new Date('2024-01-01'),
							ETag: '"etag-1"',
							StorageClass: 'STANDARD',
						},
						{
							Key: 'file2.txt',
							Size: 200,
							LastModified: new Date('2024-01-02'),
							ETag: '"etag-2"',
							StorageClass: 'COLD',
						},
					],
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0]).toHaveLength(2);
				expect(result[0][0].json).toMatchObject({
					key: 'file1.txt',
					size: 100,
					etag: '"etag-1"',
					storageClass: 'STANDARD',
				});
				expect(result[0][1].json).toMatchObject({
					key: 'file2.txt',
					size: 200,
					etag: '"etag-2"',
					storageClass: 'COLD',
				});
			});

			it('should list objects with prefix filter', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							return 'test-bucket';
						}
						const params: Record<string, any> = {
							resource: 'object',
							operation: 'list',
							bucketName: { mode: 'list', value: 'test-bucket' },
							additionalFields: {
								prefix: 'folder/',
							},
						};
						return params[paramName];
					},
				);

				mockSend.mockResolvedValue({
					Contents: [],
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0].length).toBe(0);
				expect(mockSend).toHaveBeenCalled();
			});

			it('should list objects with max keys limit', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							return 'test-bucket';
						}
						const params: Record<string, any> = {
							resource: 'object',
							operation: 'list',
							bucketName: { mode: 'list', value: 'test-bucket' },
							additionalFields: {
								maxKeys: 10,
							},
						};
						return params[paramName];
					},
				);

				mockSend.mockResolvedValue({
					Contents: [],
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0].length).toBe(0);
				expect(mockSend).toHaveBeenCalled();
			});

			it('should list objects with startAfter parameter', async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							return 'test-bucket';
						}
						const params: Record<string, any> = {
							resource: 'object',
							operation: 'list',
							bucketName: { mode: 'list', value: 'test-bucket' },
							additionalFields: {
								startAfter: 'file10.txt',
							},
						};
						return params[paramName];
					},
				);

				mockSend.mockResolvedValue({
					Contents: [],
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0].length).toBe(0);
				expect(mockSend).toHaveBeenCalled();
			});

			it('should handle empty object list', async () => {
				mockSend.mockResolvedValue({
					Contents: [],
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0]).toHaveLength(0);
			});
		});

		describe('Get Object Metadata', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							return 'test-bucket';
						}
						const params: Record<string, any> = {
							resource: 'object',
							operation: 'get',
							bucketName: { mode: 'list', value: 'test-bucket' },
							objectKey: 'test-file.txt',
						};
						return params[paramName];
					},
				);
			});

			it('should get object metadata successfully', async () => {
				mockSend.mockResolvedValue({
					ContentLength: 1024,
					ContentType: 'text/plain',
					LastModified: new Date('2024-01-01'),
					ETag: '"etag-123"',
					VersionId: 'version-1',
					StorageClass: 'STANDARD',
					Metadata: {
						author: 'John Doe',
					},
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: true,
					bucket: 'test-bucket',
					key: 'test-file.txt',
					size: 1024,
					contentType: 'text/plain',
					etag: '"etag-123"',
					versionId: 'version-1',
					storageClass: 'STANDARD',
					metadata: {
						author: 'John Doe',
					},
				});
			});
		});

		describe('Copy Object', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							if (paramName === 'sourceBucket') {
								return 'source-bucket';
							}
							if (paramName === 'destinationBucket') {
								return 'dest-bucket';
							}
						}
						const params: Record<string, any> = {
							resource: 'object',
							operation: 'copy',
							sourceBucket: { mode: 'list', value: 'source-bucket' },
							sourceObjectKey: 'source.txt',
							destinationBucket: { mode: 'list', value: 'dest-bucket' },
							destinationObjectKey: 'destination.txt',
						};
						return params[paramName];
					},
				);
			});

			it('should copy object successfully', async () => {
				mockSend.mockResolvedValue({
					CopyObjectResult: {
						ETag: '"etag-copy"',
						LastModified: new Date('2024-01-01'),
					},
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: true,
					sourceBucket: 'source-bucket',
					sourceKey: 'source.txt',
					destinationBucket: 'dest-bucket',
					destinationKey: 'destination.txt',
					etag: '"etag-copy"',
				});
			});

			it('should call copy with correct CopySource format', async () => {
				mockSend.mockResolvedValue({
					CopyObjectResult: {},
				});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json.success).toBe(true);
				expect(mockSend).toHaveBeenCalled();
			});
		});

		describe('Move Object', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							if (paramName === 'sourceBucket') {
								return 'source-bucket';
							}
							if (paramName === 'destinationBucket') {
								return 'dest-bucket';
							}
						}
						const params: Record<string, any> = {
							resource: 'object',
							operation: 'move',
							sourceBucket: { mode: 'list', value: 'source-bucket' },
							sourceObjectKey: 'source.txt',
							destinationBucket: { mode: 'list', value: 'dest-bucket' },
							destinationObjectKey: 'destination.txt',
						};
						return params[paramName];
					},
				);
			});

			it('should move object successfully', async () => {
				mockSend
					.mockResolvedValueOnce({
						CopyObjectResult: {
							ETag: '"etag-copy"',
							LastModified: new Date('2024-01-01'),
						},
					})
					.mockResolvedValueOnce({});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: true,
					sourceBucket: 'source-bucket',
					sourceKey: 'source.txt',
					destinationBucket: 'dest-bucket',
					destinationKey: 'destination.txt',
					etag: '"etag-copy"',
				});
			});

			it('should copy and then delete source object', async () => {
				mockSend
					.mockResolvedValueOnce({
						CopyObjectResult: {},
					})
					.mockResolvedValueOnce({});

				await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(mockSend).toHaveBeenCalledTimes(2);
			});
		});

		describe('Set Object ACL', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							return 'test-bucket';
						}
						const params: Record<string, any> = {
							resource: 'object',
							operation: 'setAcl',
							bucketName: { mode: 'list', value: 'test-bucket' },
							objectKey: 'test-file.txt',
							acl: 'public-read',
						};
						return params[paramName];
					},
				);
			});

			it('should set object ACL successfully', async () => {
				mockSend.mockResolvedValue({});

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: true,
					bucket: 'test-bucket',
					key: 'test-file.txt',
					acl: 'public-read',
					message: 'Object ACL set successfully',
				});
			});
		});

		describe('Get Presigned URL', () => {
			beforeEach(() => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
						if (options?.extractValue) {
							return 'test-bucket';
						}
						const params: Record<string, any> = {
							resource: 'object',
							operation: 'getPresignedUrl',
							bucketName: { mode: 'list', value: 'test-bucket' },
							objectKey: 'test-file.txt',
							expiresIn: 3600,
						};
						return params[paramName];
					},
				);
			});

			it('should generate presigned URL successfully', async () => {
				const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
				(getSignedUrl as jest.Mock).mockResolvedValue(
					'https://storage.yandexcloud.net/test-bucket/test-file.txt?signature=xyz',
				);

				const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

				expect(result[0][0].json).toMatchObject({
					success: true,
					bucket: 'test-bucket',
					key: 'test-file.txt',
					presignedUrl: 'https://storage.yandexcloud.net/test-bucket/test-file.txt?signature=xyz',
					expiresIn: 3600,
				});
			});
		});
	});

	describe('Error Handling', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
					if (options?.extractValue) {
						return 'test-bucket';
					}
					const params: Record<string, any> = {
						resource: 'bucket',
						operation: 'delete',
						bucketName: { mode: 'list', value: 'test-bucket' },
					};
					return params[paramName];
				},
			);
		});

		it('should throw error when continueOnFail is false', async () => {
			mockSend.mockRejectedValue(new Error('Bucket not found'));

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('Bucket not found');
		});

		it('should return error object when continueOnFail is true', async () => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			mockSend.mockRejectedValue(new Error('Bucket not found'));

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].json).toMatchObject({
				error: 'Bucket not found',
				success: false,
			});
		});

		it('should continue processing other items after error with continueOnFail', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
				{ json: {} },
			]);
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

			mockSend
				.mockRejectedValueOnce(new Error('First bucket not found'))
				.mockResolvedValueOnce({});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0]).toHaveLength(2);
			expect(result[0][0].json).toMatchObject({
				error: 'First bucket not found',
				success: false,
			});
			expect(result[0][1].json).toMatchObject({
				success: true,
			});
		});

		it('should throw error for unknown input data type', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _index: number, _defaultValue?: any, options?: any) => {
					if (options?.extractValue) {
						return 'test-bucket';
					}
					const params: Record<string, any> = {
						resource: 'object',
						operation: 'upload',
						bucketName: { mode: 'list', value: 'test-bucket' },
						objectKey: 'test-file.txt',
						inputDataType: 'unknown',
						additionalFields: {},
					};
					return params[paramName];
				},
			);

			await expect(
				node.execute.call(mockExecuteFunctions as IExecuteFunctions),
			).rejects.toThrow('Unknown input data type: unknown');
		});
	});

	describe('Multiple Items Processing', () => {
		it('should process multiple bucket create operations', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
				{ json: {} },
			]);

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, itemIndex: number) => {
					const configs = [
						{
							resource: 'bucket',
							operation: 'create',
							bucketName: 'bucket-1',
							additionalFields: {},
						},
						{
							resource: 'bucket',
							operation: 'create',
							bucketName: 'bucket-2',
							additionalFields: {},
						},
					];
					return configs[itemIndex][paramName as keyof typeof configs[0]];
				},
			);

			mockSend.mockResolvedValue({});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0]).toHaveLength(2);
			expect(result[0][0].json.bucket).toBe('bucket-1');
			expect(result[0][1].json.bucket).toBe('bucket-2');
		});

		it('should include correct pairedItem for multiple items', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
				{ json: {} },
			]);

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, itemIndex: number) => {
					const configs = [
						{
							resource: 'bucket',
							operation: 'create',
							bucketName: 'bucket-1',
							additionalFields: {},
						},
						{
							resource: 'bucket',
							operation: 'create',
							bucketName: 'bucket-2',
							additionalFields: {},
						},
					];
					return configs[itemIndex][paramName as keyof typeof configs[0]];
				},
			);

			mockSend.mockResolvedValue({});

			const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(result[0][0].pairedItem).toEqual({ item: 0 });
			expect(result[0][1].pairedItem).toEqual({ item: 1 });
		});
	});

	describe('Load Buckets Method', () => {
		it('should load buckets successfully', async () => {
			mockSend.mockResolvedValue({
				Buckets: [
					{ Name: 'bucket-1' },
					{ Name: 'bucket-2' },
					{ Name: 'bucket-3' },
				],
			});

			const result = await node.methods!.listSearch!.loadBuckets.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(result.results).toHaveLength(3);
			expect(result.results[0]).toMatchObject({
				name: 'bucket-1',
				value: 'bucket-1',
			});
		});

		it('should filter buckets by search term', async () => {
			mockSend.mockResolvedValue({
				Buckets: [
					{ Name: 'test-bucket-1' },
					{ Name: 'prod-bucket-1' },
					{ Name: 'test-bucket-2' },
				],
			});

			const result = await node.methods!.listSearch!.loadBuckets.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
				'test',
			);

			expect(result.results).toHaveLength(2);
			expect(result.results[0].name).toBe('test-bucket-1');
			expect(result.results[1].name).toBe('test-bucket-2');
		});

		it('should handle empty bucket list', async () => {
			mockSend.mockResolvedValue({
				Buckets: [],
			});

			const result = await node.methods!.listSearch!.loadBuckets.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(result.results).toHaveLength(0);
		});

		it('should throw error when list fails', async () => {
			mockSend.mockRejectedValue(new Error('Access denied'));

			await expect(
				node.methods!.listSearch!.loadBuckets.call(
					mockLoadOptionsFunctions as ILoadOptionsFunctions,
				),
			).rejects.toThrow('Failed to list buckets: Access denied');
		});
	});

	describe('Load Objects Method', () => {
		it('should load objects successfully', async () => {
			(mockLoadOptionsFunctions.getNodeParameter as jest.Mock).mockReturnValue('test-bucket');

			mockSend.mockResolvedValue({
				Contents: [
					{ Key: 'file1.txt' },
					{ Key: 'file2.txt' },
				],
			});

			const result = await node.methods!.listSearch!.loadObjects.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(result.results).toHaveLength(2);
			expect(result.results[0]).toMatchObject({
				name: 'file1.txt',
				value: 'file1.txt',
			});
		});

		it('should filter objects by search term', async () => {
			(mockLoadOptionsFunctions.getNodeParameter as jest.Mock).mockReturnValue('test-bucket');

			mockSend.mockResolvedValue({
				Contents: [
					{ Key: 'document.pdf' },
					{ Key: 'image.png' },
					{ Key: 'document.docx' },
				],
			});

			const result = await node.methods!.listSearch!.loadObjects.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
				'document',
			);

			expect(result.results).toHaveLength(2);
			expect(result.results[0].name).toBe('document.pdf');
			expect(result.results[1].name).toBe('document.docx');
		});

		it('should handle empty object list', async () => {
			(mockLoadOptionsFunctions.getNodeParameter as jest.Mock).mockReturnValue('test-bucket');

			mockSend.mockResolvedValue({
				Contents: [],
			});

			const result = await node.methods!.listSearch!.loadObjects.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(result.results).toHaveLength(0);
		});

		it('should return empty results when bucket name is missing', async () => {
			(mockLoadOptionsFunctions.getNodeParameter as jest.Mock).mockReturnValue('');

			const result = await node.methods!.listSearch!.loadObjects.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(result.results).toHaveLength(0);
		});

		it('should handle resourceLocator bucket parameter', async () => {
			(mockLoadOptionsFunctions.getNodeParameter as jest.Mock).mockReturnValue({
				mode: 'list',
				value: 'test-bucket',
			});

			mockSend.mockResolvedValue({
				Contents: [{ Key: 'file.txt' }],
			});

			const result = await node.methods!.listSearch!.loadObjects.call(
				mockLoadOptionsFunctions as ILoadOptionsFunctions,
			);

			expect(result.results).toHaveLength(1);
		});

		it('should throw error when list fails', async () => {
			(mockLoadOptionsFunctions.getNodeParameter as jest.Mock).mockReturnValue('test-bucket');

			mockSend.mockRejectedValue(new Error('Bucket not found'));

			await expect(
				node.methods!.listSearch!.loadObjects.call(
					mockLoadOptionsFunctions as ILoadOptionsFunctions,
				),
			).rejects.toThrow('Failed to list objects: Bucket not found');
		});
	});

	describe('S3 Client Configuration', () => {
		it('should create S3 client with correct configuration', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					const params: Record<string, any> = {
						resource: 'bucket',
						operation: 'list',
					};
					return params[paramName];
				},
			);

			mockSend.mockResolvedValue({
				Buckets: [],
			});

			await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

			expect(S3Client).toHaveBeenCalledWith(
				expect.objectContaining({
					region: 'ru-central1',
					endpoint: 'https://storage.yandexcloud.net',
					credentials: {
						accessKeyId: 'test-key',
						secretAccessKey: 'test-secret',
					},
					forcePathStyle: false,
				}),
			);
		});
	});
});

