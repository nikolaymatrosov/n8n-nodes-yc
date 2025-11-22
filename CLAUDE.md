# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an n8n community node package that provides integration with Yandex Cloud services. The package contains multiple nodes for various Yandex Cloud services (Functions, Object Storage, GPT, YDB, etc.) and their associated credentials.

**Key characteristics:**

- TypeScript-based n8n node package
- Supports multiple Yandex Cloud services via nodes
- Uses both AWS SDK (for S3-compatible services) and Yandex Cloud SDK
- Includes comprehensive unit tests using Jest
- Built as CommonJS module (ES2021 target)

## Build and Development Commands

### Primary Commands

```bash
npm run build           # Full build: clean dist, compile TS, copy icons, validate nodes
npm run dev             # Watch mode TypeScript compilation
npm test                # Run all Jest tests
npm test:watch          # Run tests in watch mode
npm test:coverage       # Run tests with coverage report
npm run lint            # Check for linting errors
npm run lintfix         # Fix linting errors automatically
```

### Build Process Details

The build process is multi-step:

1. `rimraf dist` - Clean output directory
2. `tsc` - Compile TypeScript to JavaScript
3. `tsc-alias` - Resolve path aliases (e.g., `@utils/*`)
4. `gulp build:icons` - Copy PNG/SVG icons from nodes/ and credentials/ to dist/
5. `validate:nodes` - Run node validation script

### Testing

- **Unit tests location:** `nodes/**/test/*.test.ts`
- **Test framework:** Jest with ts-jest
- **Mocking:** jest-mock-extended for interfaces, nock for HTTP requests
- **Test timeout:** 10 seconds default
- **Coverage threshold:** Aim for >85%
- Always mock external dependencies (AWS SDK, Yandex Cloud SDK, HTTP calls)

### Running Single Test

```bash
npm test -- YandexCloudObjectStorage.node.test.ts
```

## Architecture

### Credential Types

The package uses four distinct credential types:

1. **yandexCloudAuthorizedApi** - Service Account JSON authentication
   - Used for: Functions, Containers, Compute, SpeechKit, Workflows, YDB, Translate
   - Provides: Service Account JSON, Folder ID
   - Generates IAM tokens via `@yandex-cloud/nodejs-sdk`

2. **yandexCloudStaticApi** - Static Access Keys (S3-compatible)
   - Used for: Object Storage, Data Streams, Message Queue, Postbox
   - Provides: Access Key ID, Secret Access Key
   - Compatible with AWS SDK

3. **yandexCloudGptApi** - Foundation Models API Key
   - Used for: LMChatYandexGpt, YandexCloudFomo
   - Provides: API Key, Folder ID, Endpoint URL

4. **yandexCloudYdbApi** - YDB Connection Parameters
   - Used for: YandexCloudYDB (in combination with yandexCloudAuthorizedApi)
   - Provides: Endpoint, Database path
   - Requires yandexCloudAuthorizedApi for authentication

### Node Categories

**SDK-based nodes** (use @yandex-cloud/nodejs-sdk):

- YandexCloudFunctions, YandexCloudContainers, YandexCloudCompute, YandexCloudWorkflows
- Pattern: Parse service account JSON → Create SDK session → Call service-specific client
- IAM token generation: `IamTokenService` from SDK

**AWS SDK-compatible nodes** (use @aws-sdk/\* packages):

- YandexCloudObjectStorage (S3), YandexCloudDataStreams (Kinesis), YandexCloudMessageQueue (SQS), YandexCloudPostbox (SES)
- Pattern: Create AWS SDK client with Yandex Cloud endpoint and static credentials

**gRPC-based nodes** (use nice-grpc):

- YandexCloudSpeechKit (TTS), YandexCloudSpeechKitSTT, YandexCloudTranslate
- Pattern: Create gRPC client → Stream data → Process response
- Uses protocol buffers for communication

**LangChain integration:**

- LMChatYandexGpt: Chat Model compatible with LangChain (@langchain/community, @langchain/core)
- Uses OpenAI-compatible API protocol for YandexGPT

**YDB Database:**

- YandexCloudYDB: Uses @ydbjs/core, @ydbjs/query, @ydbjs/value
- Dual credential approach: yandexCloudAuthorizedApi (auth) + yandexCloudYdbApi (connection)
- Pattern: Generate IAM token → Create Driver → Execute YQL queries → Convert types

### Common Patterns

**GenericFunctions.ts:**

- Most nodes have a GenericFunctions.ts file containing helper functions
- Common helpers: credential parsing, client creation, error handling
- Service account JSON parsing uses lodash's `camelCase` to handle both snake_case and camelCase formats

**Error Handling:**

- YandexCloudFomo uses custom `sendErrorPostReceive` function
- Pattern: Extract detailed error from API response → Create NodeApiError with context
- All nodes support `continueOnFail` mode

**Type Conversion:**

- YDB uses bidirectional type conversion: JavaScript ↔ YDB types
- `fromJs()` and `toJs()` from @ydbjs/value handle automatic conversion

**Resource Locators:**

- Many nodes use resource locators for selecting resources (functions, buckets, queues, etc.)
- Pattern: Load list via API → Present dropdown → Allow manual ID entry

## Common Node Patterns

This section provides detailed implementation patterns for building n8n nodes in this project. Follow these patterns to ensure consistency, maintainability, and proper integration with the existing codebase.

### 1. Node Structure Pattern

All nodes follow a standard structure implementing `INodeType`:

```typescript
export class YandexCloudNodeName implements INodeType {
 description: INodeTypeDescription = {
  displayName: 'Yandex Cloud Service Name',
  name: 'yandexCloudNodeName',
  icon: 'file:yandexCloud.svg',
  group: ['transform'],
  version: 1,
  subtitle: '={{$parameter["operation"]}}',
  description: 'Interact with Yandex Cloud Service',
  defaults: { name: 'Yandex Cloud Service' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'yandexCloudAuthorizedApi', required: true }],
  properties: [
   // Resource selector
   {
    displayName: 'Resource',
    name: 'resource',
    type: 'options',
    options: [
     /* resources */
    ],
    default: 'resource1',
   },
   // Operation selector
   {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    displayOptions: { show: { resource: ['resource1'] } },
    options: [
     /* operations */
    ],
    default: 'list',
   },
   // Operation-specific parameters
  ],
 };

 // Optional: Resource loaders for dynamic dropdowns
 methods = {
  listSearch: {
   loadResources,
  },
 };

 async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const returnData: INodeExecutionData[] = [];
  const resource = this.getNodeParameter('resource', 0);
  const operation = this.getNodeParameter('operation', 0);

  for (let i = 0; i < items.length; i++) {
   try {
    // Get credentials and create client
    // Process operation
    // Add to returnData
   } catch (error) {
    if (this.continueOnFail()) {
     returnData.push({
      json: { error: error.message, success: false },
      pairedItem: { item: i },
     });
     continue;
    }
    throw error;
   }
  }

  return [returnData];
 }
}
```

**Key files:**

- [YandexCloudObjectStorage.node.ts](nodes/YandexCloudObjectStorage/YandexCloudObjectStorage.node.ts) (AWS SDK pattern)
- [YandexCloudLogging.node.ts](nodes/YandexCloudLogging/YandexCloudLogging.node.ts) (Yandex SDK pattern)
- [YandexCloudVisionOcr.node.ts](nodes/YandexCloudVisionOcr/YandexCloudVisionOcr.node.ts) (gRPC pattern)

### 2. Authentication & Client Creation Patterns

#### 2.1 AWS SDK Pattern (S3-Compatible Services)

**Use for:** Object Storage, Data Streams, Message Queue, Postbox

**Implementation:**

```typescript
import { createS3Client } from '@utils/awsClientFactory';
import { parseStaticApiCredentials } from '@utils/authUtils';

// In execute method
const credentials = await this.getCredentials('yandexCloudStaticApi');
const parsedCredentials = parseStaticApiCredentials(credentials);
const client = createS3Client(parsedCredentials);

// Use client
const response = await client.send(new CommandClass(params));
```

**Available client factories in [awsClientFactory.ts](utils/awsClientFactory.ts):**

- `createS3Client()` - Object Storage
- `createKinesisClient()` - Data Streams
- `createSQSClient()` - Message Queue
- `createSESClient()` - Postbox (Email)

#### 2.2 Yandex SDK Pattern (Service Account JSON)

**Use for:** Functions, Containers, Compute, SpeechKit, Logging, Vision OCR, Translate

**Implementation:**

```typescript
import {
 parseServiceAccountJson,
 validateServiceAccountCredentials,
 createYandexSession,
} from '@utils/authUtils';
import { serviceModule } from '@yandex-cloud/nodejs-sdk/dist/clients/service-v1';

// In execute method
const credentials = await this.getCredentials('yandexCloudAuthorizedApi');
const serviceAccountJson = parseServiceAccountJson(credentials.serviceAccountJson as string);
validateServiceAccountCredentials(serviceAccountJson, this.getNode);
const session = createYandexSession(serviceAccountJson);
const client = session.client(serviceModule.ServiceClient);

// Use client
const response = await client.methodName(params);
```

**Key utilities in [authUtils.ts](utils/authUtils.ts):**

- `parseServiceAccountJson()` - Parses JSON, handles snake_case/camelCase
- `validateServiceAccountCredentials()` - Validates required fields
- `createYandexSession()` - Creates SDK session

**Example:** [YandexCloudLogging GenericFunctions.ts:21-36](nodes/YandexCloudLogging/GenericFunctions.ts#L21-L36)

#### 2.3 IAM Token Pattern (Direct API Calls)

**Use for:** Services without full SDK support, direct HTTP endpoints

**Implementation:**

```typescript
import { IamTokenService } from '@yandex-cloud/nodejs-sdk/dist/token-service/iam-token-service';
import { parseServiceAccountJson } from '@utils/authUtils';

// In execute method
const credentials = await this.getCredentials('yandexCloudAuthorizedApi');
const serviceAccountJson = parseServiceAccountJson(credentials.serviceAccountJson as string);
const iamTokenService = new IamTokenService(serviceAccountJson);
const token = await iamTokenService.getToken();

// Use in HTTP headers
const headers = {
 Authorization: `Bearer ${token}`,
 'Content-Type': 'application/json',
};
```

**Example:** [YandexCloudFunctions.node.ts:361-385](nodes/YandexCloudFunctions/YandexCloudFunctions.node.ts#L361-L385) (function invocation)

#### 2.4 Dual Credentials Pattern (YDB)

**Use for:** Services requiring both authentication and connection parameters

**Implementation:**

```typescript
import { createYDBDriver } from './GenericFunctions';
import { parseServiceAccountJson } from '@utils/authUtils';

// In execute method
const authCredentials = await this.getCredentials('yandexCloudAuthorizedApi');
const ydbCredentials = await this.getCredentials('yandexCloudYdbApi');

const serviceAccountJson = parseServiceAccountJson(authCredentials.serviceAccountJson as string);
const driver = await createYDBDriver(
 serviceAccountJson,
 ydbCredentials.endpoint as string,
 ydbCredentials.database as string,
);

// Use driver
const session = await driver.tableClient.withSession(async (session) => {
 return await session.executeQuery(query, params);
});
```

**Example:** [YandexCloudYdb.node.ts:175-320](nodes/YandexCloudYDB/YandexCloudYdb.node.ts#L175-L320)

### 3. Resource Locator Patterns

Resource locators provide searchable dropdowns for users to select existing resources (buckets, queues, functions, etc.).

#### 3.1 Generic Resource Loader Factory

**Use the centralized factory from [resourceLocator.ts](utils/resourceLocator.ts):**

```typescript
import { createResourceLoader } from '@utils/resourceLocator';
import { createS3Client } from '@utils/awsClientFactory';
import { parseStaticApiCredentials } from '@utils/authUtils';
import { ListBucketsCommand } from '@aws-sdk/client-s3';

export const loadBuckets = createResourceLoader({
 credentialType: 'yandexCloudStaticApi',
 clientFactory: createS3Client,
 resourceFetcher: async (client) => {
  const response = await client.send(new ListBucketsCommand({}));
  return response.Buckets || [];
 },
 resourceMapper: (bucket) => ({
  name: bucket.Name!,
  value: bucket.Name!,
 }),
 errorMessage: 'Failed to list buckets',
 errorType: 'operation',
 credentialParser: parseStaticApiCredentials,
});
```

**Benefits:**

- Consistent error handling across all resource loaders
- Built-in filtering support
- Type-safe
- Minimal boilerplate

**Examples:**

- [YandexCloudObjectStorage GenericFunctions.ts:23-38](nodes/YandexCloudObjectStorage/GenericFunctions.ts#L23-L38)
- [YandexCloudDataStreams GenericFunctions.ts:33-52](nodes/YandexCloudDataStreams/GenericFunctions.ts#L33-L52)
- [YandexCloudMessageQueue GenericFunctions.ts:5-23](nodes/YandexCloudMessageQueue/GenericFunctions.ts#L5-L23)

#### 3.2 SDK-Based Resource Loader

**For Yandex SDK services:**

```typescript
import {
 parseServiceAccountJson,
 validateServiceAccountCredentials,
 createYandexSession,
} from '@utils/authUtils';
import { logGroupService } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/logging/v1';

export async function loadLogGroups(
 this: ILoadOptionsFunctions,
 filter?: string,
): Promise<INodeListSearchResult> {
 const credentials = await this.getCredentials('yandexCloudAuthorizedApi');
 const serviceAccountJson = parseServiceAccountJson(credentials.serviceAccountJson as string);
 validateServiceAccountCredentials(serviceAccountJson, this.getNode());

 const session = createYandexSession(serviceAccountJson);
 const client = session.client(logGroupService.LogGroupServiceClient);

 const response = await client.list({
  folderId: credentials.folderId as string,
  pageSize: 1000,
 });

 let results = response.groups.map((group) => ({
  name: `${group.name} (${group.id})`,
  value: group.id,
 }));

 // Apply filter if provided
 if (filter) {
  const filterLower = filter.toLowerCase();
  results = results.filter(
   (item) =>
    item.name.toLowerCase().includes(filterLower) ||
    item.value.toLowerCase().includes(filterLower),
  );
 }

 return { results };
}
```

**Example:** [YandexCloudLogging GenericFunctions.ts:91-149](nodes/YandexCloudLogging/GenericFunctions.ts#L91-L149)

#### 3.3 Resource Locator in Node Properties

```typescript
{
  displayName: 'Bucket',
  name: 'bucketName',
  type: 'resourceLocator',
  default: { mode: 'list', value: '' },
  required: true,
  modes: [
    {
      displayName: 'From List',
      name: 'list',
      type: 'list',
      typeOptions: {
        searchListMethod: 'loadBuckets',
        searchable: true,
      },
    },
    {
      displayName: 'By Name',
      name: 'name',
      type: 'string',
      placeholder: 'my-bucket',
    },
    {
      displayName: 'By ID',
      name: 'id',
      type: 'string',
      placeholder: 'bucket-id-12345',
    },
  ],
}
```

**Extract value in execute method:**

```typescript
const bucketName = this.getNodeParameter('bucketName', i, '', {
 extractValue: true,
}) as string;
```

**Register in node methods:**

```typescript
methods = {
 listSearch: {
  loadBuckets,
  loadQueues,
  // ... other loaders
 },
};
```

### 4. Binary Data Handling Patterns

#### 4.1 Binary Upload Pattern

```typescript
// Get binary data from input
const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;
const binaryData = await this.helpers.getBinaryDataBuffer(i, binaryProperty);

// Get metadata if available
const itemBinaryData = items[i].binary?.[binaryProperty];
const mimeType = itemBinaryData?.mimeType;
const fileName = itemBinaryData?.fileName || 'file';

// Upload
const response = await client.send(
 new PutObjectCommand({
  Bucket: bucketName,
  Key: objectKey,
  Body: binaryData,
  ContentType: mimeType,
 }),
);

returnData.push({
 json: { success: true, key: objectKey },
 pairedItem: { item: i },
});
```

**Example:** [YandexCloudObjectStorage.node.ts:988-1047](nodes/YandexCloudObjectStorage/YandexCloudObjectStorage.node.ts#L988-L1047)

#### 4.2 Binary Download Pattern

```typescript
import { Readable } from 'stream';

// Download
const response = await client.send(
 new GetObjectCommand({
  Bucket: bucketName,
  Key: objectKey,
 }),
);

// Convert stream to buffer
const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
 return new Promise((resolve, reject) => {
  const chunks: Buffer[] = [];
  stream.on('data', (chunk) => chunks.push(chunk));
  stream.on('error', reject);
  stream.on('end', () => resolve(Buffer.concat(chunks)));
 });
};

const bodyBuffer = await streamToBuffer(response.Body as Readable);

// Prepare binary data
const binaryData = await this.helpers.prepareBinaryData(
 bodyBuffer,
 objectKey.split('/').pop() || 'file',
 response.ContentType,
);

// Return with binary
returnData.push({
 json: {
  success: true,
  size: response.ContentLength,
  contentType: response.ContentType,
 },
 binary: { data: binaryData },
 pairedItem: { item: i },
});
```

**Helper in GenericFunctions.ts:**

```typescript
export async function streamToBuffer(stream: Readable): Promise<Buffer> {
 return new Promise((resolve, reject) => {
  const chunks: Buffer[] = [];
  stream.on('data', (chunk) => chunks.push(chunk));
  stream.on('error', reject);
  stream.on('end', () => resolve(Buffer.concat(chunks)));
 });
}
```

**Example:** [YandexCloudObjectStorage GenericFunctions.ts:12-19](nodes/YandexCloudObjectStorage/GenericFunctions.ts#L12-L19)

#### 4.3 Streaming Binary Output (gRPC)

**For audio synthesis, real-time processing:**

```typescript
// Stream from gRPC service
const audioChunks: Buffer[] = [];
const responseStream = client.utteranceSynthesis(request);

for await (const response of responseStream) {
 if (response.audioChunk?.data) {
  audioChunks.push(response.audioChunk.data);
 }
}

// Combine chunks
const audioBuffer = Buffer.concat(audioChunks);

// Prepare binary data
const binaryData = await this.helpers.prepareBinaryData(
 audioBuffer,
 `synthesized_audio.${formatInfo.extension}`,
 formatInfo.mimeType,
);

returnData.push({
 json: { success: true, size: audioBuffer.length },
 binary: { data: binaryData },
 pairedItem: { item: i },
});
```

**Example:** [YandexCloudSpeechKit.node.ts:441-475](nodes/YandexCloudSpeechKit/YandexCloudSpeechKit.node.ts#L441-L475)

### 5. Pagination Patterns

#### 5.1 Token-Based Pagination

**For services that use page tokens (common in Yandex SDK):**

```typescript
const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
const limit = returnAll ? 0 : (this.getNodeParameter('limit', i, 50) as number);

let allEntries: any[] = [];
let pageToken: string | undefined;

do {
 const request: any = {
  folderId: credentials.folderId,
  pageSize: 1000, // Max per request
 };

 if (pageToken) {
  request.pageToken = pageToken;
 }

 const response = await client.list(request);

 if (response.items && response.items.length > 0) {
  allEntries = allEntries.concat(response.items);
 }

 pageToken = returnAll ? response.nextPageToken : undefined;

 // Break if we have enough entries when not returning all
 if (!returnAll && allEntries.length >= limit) {
  allEntries = allEntries.slice(0, limit);
  break;
 }
} while (pageToken);

// Return as separate items
for (const entry of allEntries) {
 returnData.push({
  json: entry,
  pairedItem: { item: i },
 });
}
```

**Property definition:**

```typescript
{
  displayName: 'Return All',
  name: 'returnAll',
  type: 'boolean',
  default: false,
  description: 'Whether to return all results or only up to a given limit',
},
{
  displayName: 'Limit',
  name: 'limit',
  type: 'number',
  default: 50,
  displayOptions: {
    show: {
      returnAll: [false],
    },
  },
  typeOptions: {
    minValue: 1,
  },
  description: 'Max number of results to return',
},
```

**Example:** [YandexCloudLogging.node.ts:688-717](nodes/YandexCloudLogging/YandexCloudLogging.node.ts#L688-L717)

#### 5.2 Limit/Offset Pattern

**For AWS SDK-compatible services:**

```typescript
const additionalFields = this.getNodeParameter('additionalFields', i) as {
 maxKeys?: number;
 prefix?: string;
};

const params: ListObjectsV2CommandInput = {
 Bucket: bucketName,
};

if (additionalFields.maxKeys) {
 params.MaxKeys = additionalFields.maxKeys;
}

if (additionalFields.prefix) {
 params.Prefix = additionalFields.prefix;
}

const response = await client.send(new ListObjectsV2Command(params));

for (const object of response.Contents || []) {
 returnData.push({
  json: object,
  pairedItem: { item: i },
 });
}
```

### 6. Error Handling Patterns

#### 6.1 Standard Try-Catch with continueOnFail

**All nodes must implement this pattern:**

```typescript
for (let i = 0; i < items.length; i++) {
 try {
  // Get parameters
  const param = this.getNodeParameter('param', i);

  // Execute operation
  const result = await performOperation(client, param);

  // Success response
  returnData.push({
   json: result,
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
```

#### 6.2 Credential Validation Pattern

```typescript
import { parseServiceAccountJson, validateServiceAccountCredentials } from '@utils/authUtils';
import { NodeOperationError } from 'n8n-workflow';

// In execute method
let serviceAccountJson;
try {
 const credentials = await this.getCredentials('yandexCloudAuthorizedApi');
 serviceAccountJson = parseServiceAccountJson(credentials.serviceAccountJson as string);
 validateServiceAccountCredentials(serviceAccountJson, this.getNode);
} catch (error) {
 throw new NodeOperationError(
  this.getNode(),
  `Invalid service account JSON credentials: ${error.message}`,
 );
}
```

**Example:** [YandexCloudVisionOcr.node.ts:257-267](nodes/YandexCloudVisionOcr/YandexCloudVisionOcr.node.ts#L257-L267)

#### 6.3 Error Handling Utilities

**Use centralized utilities from [errorHandling.ts](utils/errorHandling.ts):**

```typescript
import {
 createOperationError,
 withErrorHandling,
 validateRequiredFields,
} from '@utils/errorHandling';

// Create standardized errors
throw createOperationError(
 this.getNode(),
 'Failed to upload file',
 'Check that the bucket exists and you have write permissions',
);

// Wrap operations with automatic error handling
const result = await withErrorHandling(
 this.getNode(),
 async () => await client.send(command),
 'Failed to execute command',
 'operation', // or 'api'
);

// Validate required fields
validateRequiredFields(data, ['serviceAccountId', 'privateKey'], this.getNode(), 'Service Account');
```

**Available utilities:**

- `createOperationError()` - Create NodeOperationError
- `createApiError()` - Create NodeApiError
- `withErrorHandling()` - Wrap async operations
- `validateRequiredFields()` - Validate object fields

#### 6.4 Operation-Specific Error Messages

Always provide context in error messages:

```typescript
throw new NodeOperationError(
 this.getNode(),
 `Failed to list objects in bucket "${bucketName}": ${error.message}`,
);
```

### 7. Type Definition Patterns

#### 7.1 Credential Interface Types

```typescript
export interface IServiceAccountJson {
 serviceAccountId: string;
 accessKeyId: string;
 privateKey: string;
}

export interface IStaticCredentials {
 accessKeyId: string;
 secretAccessKey: string;
}
```

**Example:** [YandexCloudLogging types.ts:168-174](nodes/YandexCloudLogging/types.ts#L168-L174)

#### 7.2 Enum Constants with `as const`

```typescript
export const SUPPORTED_MIME_TYPES = {
 JPEG: 'image/jpeg',
 PNG: 'image/png',
 PDF: 'application/pdf',
} as const;

export const OCR_MODELS = {
 PAGE: 'page',
 PAGE_COLUMN_SORT: 'page-column-sort',
 HANDWRITTEN: 'handwritten',
 TEXT_LINE: 'text-line',
} as const;

export type OcrModel = (typeof OCR_MODELS)[keyof typeof OCR_MODELS];
```

**Example:** [YandexCloudVisionOcr types.ts:17-42](nodes/YandexCloudVisionOcr/types.ts#L17-L42)

#### 7.3 Request/Response Types

```typescript
export interface IWriteRequest {
 destination: IDestination;
 resource?: ILogEntryResource;
 entries: IIncomingLogEntry[];
 defaults?: ILogEntryDefaults;
}

export interface IWriteResponse {
 errors?: Record<number, any>;
}

export interface IReadCriteria {
 logGroupId?: string;
 resourceIds?: string[];
 since?: string;
 until?: string;
 levels?: string[];
 filter?: string;
 streamNames?: string[];
}
```

**Example:** [YandexCloudLogging types.ts:57-70](nodes/YandexCloudLogging/types.ts#L57-L70)

### 8. Testing Patterns

#### 8.1 Test File Structure

```typescript
import { ServiceClient } from '@aws-sdk/client-service';
import { NodeClass } from '../NodeFile.node';
import type { IExecuteFunctions } from 'n8n-workflow';

// Mock external dependencies
jest.mock('@aws-sdk/client-service');

describe('YandexCloudNodeName', () => {
 let node: NodeClass;
 let mockExecuteFunctions: Partial<IExecuteFunctions>;
 let mockSend: jest.Mock;

 beforeEach(() => {
  jest.clearAllMocks();

  node = new NodeClass();

  mockSend = jest.fn();
  (ServiceClient as jest.Mock).mockImplementation(() => ({
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
 });

 describe('Node Definition', () => {
  it('should have correct basic properties', () => {
   expect(node.description.displayName).toBe('Display Name');
   expect(node.description.name).toBe('nodeName');
   expect(node.description.version).toBe(1);
  });

  it('should have correct credential configuration', () => {
   expect(node.description.credentials).toHaveLength(1);
   expect(node.description.credentials?.[0].name).toBe('yandexCloudStaticApi');
  });
 });

 describe('Operations', () => {
  describe('List Operation', () => {
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

   it('should list resources successfully', async () => {
    mockSend.mockResolvedValue({
     Items: [{ Name: 'test-item' }],
    });

    const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(1);
    expect(result[0][0].json).toMatchObject({ Name: 'test-item' });
    expect(mockSend).toHaveBeenCalledTimes(1);
   });

   it('should handle errors when continueOnFail is false', async () => {
    mockSend.mockRejectedValue(new Error('Access denied'));

    await expect(
     node.execute.call(mockExecuteFunctions as IExecuteFunctions),
    ).rejects.toThrow();
   });

   it('should handle errors when continueOnFail is true', async () => {
    (mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
    mockSend.mockRejectedValue(new Error('Access denied'));

    const result = await node.execute.call(mockExecuteFunctions as IExecuteFunctions);

    expect(result[0][0].json).toMatchObject({
     success: false,
     error: 'Access denied',
    });
   });
  });
 });
});
```

#### 8.2 Mocking Patterns

**AWS SDK:**

```typescript
jest.mock('@aws-sdk/client-s3');

const mockSend = jest.fn();
(S3Client as jest.Mock).mockImplementation(() => ({
 send: mockSend,
}));

// In test
mockSend.mockResolvedValue({
 Buckets: [{ Name: 'test-bucket' }],
});
```

**Yandex SDK:**

```typescript
jest.mock('@yandex-cloud/nodejs-sdk');

const mockList = jest.fn();
const mockClient = jest.fn().mockReturnValue({
 list: mockList,
 get: jest.fn(),
 create: jest.fn(),
});
const mockSession = {
 client: mockClient,
};
(Session as jest.Mock).mockImplementation(() => mockSession);

// In test
mockList.mockResolvedValue({
 items: [{ id: '123', name: 'test' }],
 nextPageToken: '',
});
```

**Binary Data:**

```typescript
const mockBinaryData = Buffer.from('test data');
(mockExecuteFunctions.helpers!.getBinaryDataBuffer as jest.Mock).mockResolvedValue(mockBinaryData);

(mockExecuteFunctions.helpers!.prepareBinaryData as jest.Mock).mockResolvedValue({
 data: mockBinaryData.toString('base64'),
 mimeType: 'application/octet-stream',
 fileName: 'test.bin',
});
```

#### 8.3 Test Categories

Organize tests into these categories:

1. **Node Definition Tests**
   - Basic properties (displayName, name, version)
   - Credentials configuration
   - Input/output configuration
   - Properties structure

2. **Operation Tests**
   - Happy path for each operation
   - Error handling (continueOnFail true/false)
   - Edge cases (empty results, pagination)

3. **Parameter Validation Tests**
   - Required parameters
   - Parameter types
   - Invalid values
   - Conditional parameters

4. **Binary Data Tests**
   - Upload operations
   - Download operations
   - Stream handling
   - MIME type handling

5. **Authentication Tests**
   - Credential parsing
   - Credential validation
   - Token generation
   - Invalid credentials

### 9. Decision Guide: When to Use Each Pattern

#### Use AWS SDK Pattern When

- ✅ Service is S3/Kinesis/SQS/SES compatible
- ✅ Yandex provides AWS-compatible endpoint
- ✅ Need static access keys (yandexCloudStaticApi)

**Example services:** Object Storage, Data Streams, Message Queue, Postbox

#### Use Yandex SDK Pattern When

- ✅ Official Yandex Cloud SDK available for the service
- ✅ Need IAM token authentication (yandexCloudAuthorizedApi)
- ✅ Service uses gRPC protocol
- ✅ Complex service-specific types and operations

**Example services:** Functions, Containers, Compute, SpeechKit, Logging, Vision OCR, Translate, Workflows

#### Use Direct API Call Pattern When

- ✅ Simple HTTP endpoint
- ✅ SDK overhead not justified
- ✅ Need fine-grained control over requests
- ✅ Lightweight operation (like function invocation)

**Example:** Functions invocation endpoint (uses IAM token but direct HTTP)

#### Use Dual Credential Pattern When

- ✅ Service needs both authentication AND connection parameters
- ✅ Credentials come from different sources
- ✅ Connection info separate from auth info

**Example:** YDB (yandexCloudAuthorizedApi for auth + yandexCloudYdbApi for endpoint/database)

#### Use Resource Locator Pattern When

- ✅ User needs to select from existing resources
- ✅ List operation is available via API
- ✅ Want searchable dropdown for better UX
- ✅ Resource IDs are not user-friendly

**When NOT to use:**

- ❌ Create operations (no existing resources yet)
- ❌ No list API available
- ❌ Performance concerns (too many resources)

#### Use Streaming Pattern When

- ✅ Handling large files (>10MB)
- ✅ Real-time data processing
- ✅ Binary data from gRPC services
- ✅ Memory efficiency important

**Examples:** Audio synthesis, large file downloads, streaming OCR, video processing

#### Use Generic Resource Loader Factory When

- ✅ Building new resource locator
- ✅ Want consistent error handling
- ✅ Need filtering support
- ✅ Reduce boilerplate code

**When to write custom loader:**

- ❌ Very complex filtering logic
- ❌ Multi-step resource loading
- ❌ Custom pagination handling

### 10. Utility Extraction Pattern

Recent refactoring moved common code to centralized utilities. **Always use these utilities** instead of duplicating code:

**Authentication & Credentials:** [authUtils.ts](utils/authUtils.ts)

- `parseServiceAccountJson()` - Parse and normalize service account JSON
- `parseStaticApiCredentials()` - Parse static API credentials
- `validateServiceAccountCredentials()` - Validate required fields
- `createYandexSession()` - Create Yandex SDK session

**Client Factories:** [awsClientFactory.ts](utils/awsClientFactory.ts)

- `createS3Client()` - S3/Object Storage client
- `createKinesisClient()` - Kinesis/Data Streams client
- `createSQSClient()` - SQS/Message Queue client
- `createSESClient()` - SES/Postbox client

**Resource Loaders:** [resourceLocator.ts](utils/resourceLocator.ts)

- `createResourceLoader()` - Generic factory for resource locators

**Error Handling:** [errorHandling.ts](utils/errorHandling.ts)

- `createOperationError()` - Create NodeOperationError
- `createApiError()` - Create NodeApiError
- `withErrorHandling()` - Wrap operations with error handling
- `validateRequiredFields()` - Validate required fields

**Backwards Compatibility:**

When utilities are moved, maintain compatibility by re-exporting:

```typescript
// In GenericFunctions.ts
import { parseServiceAccountJson as utilParseServiceAccountJson } from '@utils/authUtils';

// Re-export for backward compatibility
export { utilParseServiceAccountJson as parseServiceAccountJson };
```

**Example:** [YandexCloudVisionOcr GenericFunctions.ts:11](nodes/YandexCloudVisionOcr/GenericFunctions.ts#L11)

### 11. Node Refactoring Guidelines

When nodes grow large and complex (500+ lines, 10+ operations), refactor them into a modular structure for better maintainability and testability.

#### 11.1 When to Refactor

Refactor a node when it meets **any** of these criteria:

- ✅ Main node file exceeds 500 lines
- ✅ Node implements 10+ operations
- ✅ Execute method contains complex nested if/else or switch logic
- ✅ Operations contain 50+ lines of logic each
- ✅ Difficult to locate specific operation implementations
- ✅ Adding new operations requires significant scrolling

**Example:** YandexCloudObjectStorage was refactored from 1314 lines with 15 operations into a modular structure.

#### 11.2 Refactored File Structure

Organize refactored nodes using this structure:

```
nodes/NodeName/
├── NodeName.node.ts         # Main file (150-200 lines)
├── GenericFunctions.ts      # Shared helpers
├── types.ts                 # Constants and interfaces
├── resources/               # NEW: Operation modules
│   ├── resource1.operations.ts  # Operations for resource1
│   ├── resource2.operations.ts  # Operations for resource2
│   └── index.ts                 # Re-exports all operations
└── test/
    └── NodeName.node.test.ts    # Existing tests (unchanged)
```

**Reference:** [YandexCloudObjectStorage](nodes/YandexCloudObjectStorage/)

#### 11.3 Define Typed Constants (types.ts)

Create a `types.ts` file with resource and operation constants:

```typescript
import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import type { S3Client } from '@aws-sdk/client-s3';

/**
 * Context passed to all operation functions
 */
export interface IOperationContext {
 executeFunctions: IExecuteFunctions;
 client: S3Client;  // Or your client type
 itemIndex: number;
}

/**
 * Shared return type for operations
 */
export type OperationResult = INodeExecutionData | INodeExecutionData[];

/**
 * Resource constants
 */
export const RESOURCES = {
 RESOURCE1: 'resource1',
 RESOURCE2: 'resource2',
} as const;

export type Resource = (typeof RESOURCES)[keyof typeof RESOURCES];

/**
 * Resource1 operation constants
 */
export const RESOURCE1_OPERATIONS = {
 LIST: 'list',
 CREATE: 'create',
 DELETE: 'delete',
 GET: 'get',
 UPDATE: 'update',
} as const;

export type Resource1Operation = (typeof RESOURCE1_OPERATIONS)[keyof typeof RESOURCE1_OPERATIONS];

/**
 * Resource2 operation constants
 */
export const RESOURCE2_OPERATIONS = {
 UPLOAD: 'upload',
 DOWNLOAD: 'download',
 DELETE: 'delete',
} as const;

export type Resource2Operation = (typeof RESOURCE2_OPERATIONS)[keyof typeof RESOURCE2_OPERATIONS];
```

**Key points:**

- Use `as const` for literal type inference
- Export both constants and derived types
- Define `IOperationContext` with your specific client type
- Use consistent naming: `RESOURCES`, `RESOURCE1_OPERATIONS`, etc.

**Reference:** [YandexCloudObjectStorage types.ts](nodes/YandexCloudObjectStorage/types.ts)

#### 11.4 Extract Operations by Resource (resources/*.operations.ts)

Create one file per resource containing all its operations:

```typescript
import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { S3Client } from '@aws-sdk/client-s3';
import { ListCommand, CreateCommand, DeleteCommand } from '@aws-sdk/client-s3';

import type { IOperationContext, OperationResult } from '../types';
import { RESOURCE1_OPERATIONS } from '../types';

/**
 * Execute a resource1 operation based on the operation type
 */
export async function executeResource1Operation(
 context: IOperationContext,
 operation: string,
): Promise<OperationResult> {
 const { executeFunctions, client, itemIndex } = context;

 switch (operation) {
  case RESOURCE1_OPERATIONS.LIST:
   return await listResource1(executeFunctions, client, itemIndex);
  case RESOURCE1_OPERATIONS.CREATE:
   return await createResource1(executeFunctions, client, itemIndex);
  case RESOURCE1_OPERATIONS.DELETE:
   return await deleteResource1(executeFunctions, client, itemIndex);
  case RESOURCE1_OPERATIONS.GET:
   return await getResource1(executeFunctions, client, itemIndex);
  case RESOURCE1_OPERATIONS.UPDATE:
   return await updateResource1(executeFunctions, client, itemIndex);
  default:
   throw new NodeOperationError(
    executeFunctions.getNode(),
    `Unknown resource1 operation: ${operation}`,
   );
 }
}

/**
 * List all resource1 items
 */
async function listResource1(
 executeFunctions: IExecuteFunctions,
 client: S3Client,
 i: number,
): Promise<INodeExecutionData[]> {
 // Copy exact logic from original execute() method
 // Replace 'this.' with 'executeFunctions.'
 // Keep all parameter extraction and processing identical
 const param = executeFunctions.getNodeParameter('param', i) as string;

 const response = await client.send(new ListCommand({ Param: param }));

 return response.Items.map(item => ({
  json: item,
  pairedItem: { item: i },
 }));
}

/**
 * Create a resource1 item
 */
async function createResource1(
 executeFunctions: IExecuteFunctions,
 client: S3Client,
 i: number,
): Promise<INodeExecutionData> {
 // Copy exact logic from original execute() method
 // ...operation implementation...

 return {
  json: { success: true },
  pairedItem: { item: i },
 };
}

// ... other operations ...
```

**Migration steps:**

1. Copy entire operation code block from `execute()` method
2. Wrap in new function with parameters: `executeFunctions`, `client`, `i`
3. Replace `this.` with `executeFunctions.` (use find-replace)
4. Keep ALL logic identical - no refactoring yet
5. Make operation functions `async` and `private` (not exported)
6. Export only the main `executeResourceOperation()` function

**Reference:** [YandexCloudObjectStorage bucket.operations.ts](nodes/YandexCloudObjectStorage/resources/bucket.operations.ts)

#### 11.5 Create Index File (resources/index.ts)

Re-export all operation functions:

```typescript
export * from './resource1.operations';
export * from './resource2.operations';
```

This allows clean imports in the main node file.

#### 11.6 Refactor Main Node File

Reduce the main node file to routing logic only:

```typescript
import type {
 IExecuteFunctions,
 INodeExecutionData,
 INodeType,
 INodeTypeDescription,
} from 'n8n-workflow';

import { createClient, loadResources } from './GenericFunctions';
import { executeResource1Operation, executeResource2Operation } from './resources';
import { RESOURCES, RESOURCE1_OPERATIONS, RESOURCE2_OPERATIONS } from './types';

export class YandexCloudNodeName implements INodeType {
 description: INodeTypeDescription = {
  displayName: 'Node Name',
  name: 'nodeName',
  // ... node metadata ...
  properties: [
   {
    displayName: 'Resource',
    name: 'resource',
    type: 'options',
    default: 'resource1',  // Use literal for default
    noDataExpression: true,
    options: [
     {
      name: 'Resource1',
      value: RESOURCES.RESOURCE1,  // Use constant for value
     },
     {
      name: 'Resource2',
      value: RESOURCES.RESOURCE2,
     },
    ],
   },
   {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    default: 'list',  // Use literal for default
    noDataExpression: true,
    displayOptions: {
     show: {
      resource: [RESOURCES.RESOURCE1],  // Use constant
     },
    },
    options: [
     {
      name: 'List',
      value: RESOURCE1_OPERATIONS.LIST,  // Use constant
      description: 'List all items',
      action: 'List items',
     },
     // ... other operations ...
    ],
   },
   // ... other properties with constants ...
  ],
 };

 methods = {
  listSearch: {
   loadResources,
  },
 };

 async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const returnData: INodeExecutionData[] = [];
  const resource = this.getNodeParameter('resource', 0) as string;
  const operation = this.getNodeParameter('operation', 0) as string;

  // Get credentials and create client
  const credentials = await this.getCredentials('credentialType');
  const client = createClient(credentials);

  // Resource1 operations
  if (resource === RESOURCES.RESOURCE1) {
   // Handle operations that return immediately (like list)
   if (operation === RESOURCE1_OPERATIONS.LIST) {
    const results = await executeResource1Operation(
     { executeFunctions: this, client, itemIndex: 0 },
     operation,
    );
    return [results as INodeExecutionData[]];
   }

   // Per-item operations
   for (let i = 0; i < items.length; i++) {
    try {
     const result = await executeResource1Operation(
      { executeFunctions: this, client, itemIndex: i },
      operation,
     );
     returnData.push(result as INodeExecutionData);
    } catch (error) {
     if (this.continueOnFail()) {
      returnData.push({
       json: { error: error.message, success: false },
       pairedItem: { item: i },
      });
      continue;
     }
     throw error;
    }
   }
  }

  // Resource2 operations
  if (resource === RESOURCES.RESOURCE2) {
   for (let i = 0; i < items.length; i++) {
    try {
     const result = await executeResource2Operation(
      { executeFunctions: this, client, itemIndex: i },
      operation,
     );

     // Handle operations that return arrays
     if (Array.isArray(result)) {
      returnData.push(...result);
     } else {
      returnData.push(result);
     }
    } catch (error) {
     if (this.continueOnFail()) {
      returnData.push({
       json: { error: error.message, success: false },
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
```

**Key points:**

- Main file handles: routing, credentials, client creation, error handling
- Operation files handle: all business logic, parameter extraction, API calls
- Use constants in `displayOptions.show` arrays for resources and operations
- Use **literal strings** for `default` properties (linter requirement)
- Use **constants** for option `value` properties
- Preserve exact error handling behavior with `continueOnFail()`

**Reference:** [YandexCloudObjectStorage.node.ts](nodes/YandexCloudObjectStorage/YandexCloudObjectStorage.node.ts)

#### 11.7 Testing Requirements

**Critical:** All existing tests must pass unchanged after refactoring.

1. **Do not modify test files** during initial refactoring
2. **Run tests after each step**:

   ```bash
   npm run build
   npm test -- YourNode.node.test.ts
   npm run lint
   ```

3. **Verify zero behavior changes**: Tests validate identical functionality
4. **Add new tests later** (optional): After refactoring succeeds, add unit tests for individual operations

**Validation checklist:**

- ✅ All existing tests pass
- ✅ Build completes successfully
- ✅ Linting passes
- ✅ Node appears correctly in n8n UI
- ✅ All operations work identically to before

#### 11.8 Constants Usage Rules

**In node properties:**

- Use **literal strings** for `default` values: `default: 'resource1'`
- Use **constants** for option `value` fields: `value: RESOURCES.RESOURCE1`
- Use **constants** in `displayOptions.show` arrays: `resource: [RESOURCES.RESOURCE1]`

**In operation files:**

- Use **constants** in switch statements: `case RESOURCE1_OPERATIONS.LIST:`
- Use **constants** for comparisons: `if (operation === RESOURCE1_OPERATIONS.LIST)`

**Rationale:** n8n's linter requires literal `default` values for property validation, but constants everywhere else provide type safety and prevent typos.

#### 11.9 Benefits of Refactoring

**Quantified improvements from YandexCloudObjectStorage refactoring:**

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Main file size | 1314 lines | 869 lines | 34% smaller |
| Largest function | 500+ lines | ~90 lines | 82% smaller |
| Operation size | Mixed in execute() | 20-50 lines each | Isolated |
| File organization | 1 monolithic file | 5 focused files | Modular |

**Qualitative benefits:**

- ✅ Each operation is self-contained and easy to understand
- ✅ Operations can be unit tested in isolation
- ✅ Main file focuses on routing, not implementation
- ✅ Single source of truth for operation names (constants)
- ✅ Better IDE support with autocomplete for constants
- ✅ Easier to locate and modify specific operations
- ✅ Reduced cognitive load when reading code

#### 11.10 Refactoring Checklist

Use this checklist when refactoring a node:

- [ ] Node meets refactoring criteria (500+ lines or 10+ operations)
- [ ] Create `types.ts` with constants and interfaces
- [ ] Create `resources/` subfolder
- [ ] Extract operations to `resources/resource.operations.ts` files
- [ ] Create `resources/index.ts` with exports
- [ ] Update main node file to use operation functions
- [ ] Replace magic strings with constants in properties
- [ ] Use literals for `default`, constants for `value`
- [ ] Run build: `npm run build`
- [ ] Run tests: `npm test -- YourNode.node.test.ts`
- [ ] Verify all tests pass unchanged
- [ ] Run linter: `npm run lint`
- [ ] Manually test node in n8n UI (if possible)
- [ ] Document refactoring in commit message

**Example commit:**

```
refactor(storage): extract operations into modular structure

- Create types.ts with resource/operation constants
- Extract 6 bucket operations to bucket.operations.ts
- Extract 9 object operations to object.operations.ts
- Reduce main file from 1314 to 869 lines (34% smaller)
- All 62 existing tests pass unchanged
- Improve maintainability and testability

Ref: YandexCloudObjectStorage refactoring pattern
```

## Important Development Rules

### Code Quality

- **TypeScript strict mode is enabled:** All null checks and type safety must be enforced
- **Path aliases:** Use `@utils/*` for utility imports (configured in tsconfig.json)
- **No implicit any:** All types must be explicit
- **Module system:** CommonJS (not ESM)

### Testing Guidelines (from .cursor/rules)

- **Always work from package directory** when running tests
- **Mock all external dependencies** - never make real API calls
- **Confirm test cases with user** before writing extensive tests
- **Don't add useless comments** like "Arrange, Act, Assert"
- Test categories: Happy Path, Error Handling, Edge Cases, Parameter Validation, Binary Data, Authentication
- Use `jest-mock-extended` for mocking n8n interfaces
- Use `nock` for HTTP request mocking

### Commit Messages (Conventional Commits)

- **Format:** `<type>[optional scope]: <description>`
- **Types:** feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
- **Scopes:** compute, containers, streams, functions, gpt, mq, storage, postbox, speechkit, workflows, creds, utils, types
- **Rules:**
  - Use imperative mood: "add" not "added"
  - Lowercase type and description
  - No period at end
  - First line under 72 characters
  - Breaking changes: add `!` after type/scope OR use `BREAKING CHANGE:` footer

### Critical Rules

- **NEVER edit SVG files** - these are generated/designed assets
- **Always run full build** before publishing: `npm run build`
- **Validate nodes:** Build process includes node validation script
- **Icons must be copied:** Gulp task copies icons to dist/

### Node Documentation (from .cursor/rules)

When adding a new node:

1. Update bug report template
2. Update both README.md (English) and README.ru.md (Russian)
3. Update package.json `n8n.nodes` array
4. Add node icon (PNG/SVG)

## Key File Locations

```text
nodes/
  ├── YandexCloud*/          # Node implementations
  │   ├── *.node.ts          # Main node file
  │   ├── GenericFunctions.ts # Helper functions (if needed)
  │   ├── types.ts           # Type definitions (if needed)
  │   └── test/              # Unit tests
  │       └── *.test.ts
credentials/
  └── *.credentials.ts       # Credential type definitions
scripts/
  ├── validate-nodes.js      # Node validation script
  └── promote-changelog.js   # Changelog management
docs/
  ├── TESTING.md             # Testing approach documentation
  ├── TESTING_PROMPT.md      # AI testing prompt template
  └── TESTING_PROMPT_WORKFLOW.md # Workflow testing template
```

## Dependencies

**Runtime:**

- `@yandex-cloud/nodejs-sdk` - Official Yandex Cloud SDK
- `@aws-sdk/client-*` - AWS SDK for S3-compatible services
- `@ydbjs/*` - YDB database client
- `@langchain/*` - LangChain for AI model integration
- `nice-grpc` - gRPC client
- `lodash` - Utility functions (especially camelCase for credential parsing)
- `xml2js` - XML parsing
- `undici` - HTTP client

**Development:**

- `typescript` + `ts-jest` - TypeScript compilation and testing
- `jest` + `jest-mock-extended` - Testing framework
- `eslint` + `eslint-plugin-n8n-nodes-base` - Linting
- `prettier` - Code formatting
- `gulp` - Icon copying task
- `tsc-alias` - Path alias resolution
- `nock` - HTTP mocking

## n8n Node Structure

**Node files must export:**

- `description` object with node metadata (INodeTypeDescription)
- `execute()` or `supplyData()` method for node execution
- For AI nodes: `supplyData()` returns tool/model instances

**Credential files must export:**

- Class implementing `ICredentialType`
- `name`, `displayName`, `properties` fields

**Node registration:**

- Nodes are registered in package.json under `n8n.nodes` array
- Credentials in `n8n.credentials` array
- All paths point to compiled JS files in dist/

## Adding new node

- You shoud add tests in the test subfolder
- You should never try to edit svg files. They will be added separtely
- You need to edit README.md and README.ru.md adding information about the new node.
- Update CHANGELOG.md
- If the new node is really complex add separate README.md file into the node folder with examples of how to use the new node
