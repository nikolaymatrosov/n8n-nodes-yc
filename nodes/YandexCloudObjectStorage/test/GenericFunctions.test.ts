import { S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { createS3Client, getObjectUrl, streamToBuffer } from '../GenericFunctions';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');

describe('GenericFunctions', () => {
	describe('createS3Client', () => {
		it('should create S3 client with correct configuration', () => {
			const credentials = {
				accessKeyId: 'test-key-id',
				secretAccessKey: 'test-secret-key',
			};

			createS3Client(credentials);

			expect(S3Client).toHaveBeenCalledWith({
				region: 'ru-central1',
				endpoint: 'https://storage.yandexcloud.net',
				credentials: {
					accessKeyId: 'test-key-id',
					secretAccessKey: 'test-secret-key',
				},
				forcePathStyle: false,
			});
		});

		it('should use virtual-hosted-style URLs', () => {
			const credentials = {
				accessKeyId: 'test-key',
				secretAccessKey: 'test-secret',
			};

			createS3Client(credentials);

			expect(S3Client).toHaveBeenCalledWith(
				expect.objectContaining({
					forcePathStyle: false,
				}),
			);
		});

		it('should use ru-central1 region', () => {
			const credentials = {
				accessKeyId: 'test-key',
				secretAccessKey: 'test-secret',
			};

			createS3Client(credentials);

			expect(S3Client).toHaveBeenCalledWith(
				expect.objectContaining({
					region: 'ru-central1',
				}),
			);
		});

		it('should use Yandex Cloud endpoint', () => {
			const credentials = {
				accessKeyId: 'test-key',
				secretAccessKey: 'test-secret',
			};

			createS3Client(credentials);

			expect(S3Client).toHaveBeenCalledWith(
				expect.objectContaining({
					endpoint: 'https://storage.yandexcloud.net',
				}),
			);
		});
	});

	describe('streamToBuffer', () => {
		it('should convert stream to buffer successfully', async () => {
			const testData = 'Hello World!';
			const stream = new Readable({
				read() {
					this.push(testData);
					this.push(null);
				},
			});

			const buffer = await streamToBuffer(stream);

			expect(buffer.toString()).toBe(testData);
		});

		it('should handle multiple chunks', async () => {
			const chunks = ['Hello ', 'World', '!'];
			let index = 0;
			const stream = new Readable({
				read() {
					if (index < chunks.length) {
						this.push(chunks[index++]);
					} else {
						this.push(null);
					}
				},
			});

			const buffer = await streamToBuffer(stream);

			expect(buffer.toString()).toBe('Hello World!');
		});

		it('should handle binary data', async () => {
			const binaryData = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
			const stream = new Readable({
				read() {
					this.push(binaryData);
					this.push(null);
				},
			});

			const buffer = await streamToBuffer(stream);

			expect(buffer).toEqual(binaryData);
		});

		it('should handle empty stream', async () => {
			const stream = new Readable({
				read() {
					this.push(null);
				},
			});

			const buffer = await streamToBuffer(stream);

			expect(buffer.length).toBe(0);
		});

		it('should reject on stream error', async () => {
			const stream = new Readable({
				read() {
					// Emit error on first read
					this.destroy(new Error('Stream error'));
				},
			});

			await expect(streamToBuffer(stream)).rejects.toThrow('Stream error');
		});

		it('should handle large streams', async () => {
			const largeData = Buffer.alloc(1024 * 1024); // 1MB
			const stream = new Readable({
				read() {
					this.push(largeData);
					this.push(null);
				},
			});

			const buffer = await streamToBuffer(stream);

			expect(buffer.length).toBe(1024 * 1024);
		});
	});

	describe('getObjectUrl', () => {
		it('should construct correct URL with simple bucket and key', () => {
			const url = getObjectUrl('my-bucket', 'file.txt');
			expect(url).toBe('https://storage.yandexcloud.net/my-bucket/file.txt');
		});

		it('should construct URL with nested path', () => {
			const url = getObjectUrl('my-bucket', 'folder/subfolder/file.txt');
			expect(url).toBe('https://storage.yandexcloud.net/my-bucket/folder/subfolder/file.txt');
		});

		it('should construct URL with special characters in key', () => {
			const url = getObjectUrl('test-bucket', 'my_file-name.tar.gz');
			expect(url).toBe('https://storage.yandexcloud.net/test-bucket/my_file-name.tar.gz');
		});

		it('should construct URL with bucket containing hyphens', () => {
			const url = getObjectUrl('my-test-bucket-123', 'data.json');
			expect(url).toBe('https://storage.yandexcloud.net/my-test-bucket-123/data.json');
		});

		it('should construct URL with deep nested structure', () => {
			const url = getObjectUrl('bucket', 'a/b/c/d/e/file.txt');
			expect(url).toBe('https://storage.yandexcloud.net/bucket/a/b/c/d/e/file.txt');
		});
	});
});

