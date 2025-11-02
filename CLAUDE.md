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

**AWS SDK-compatible nodes** (use @aws-sdk/* packages):

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

```
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
