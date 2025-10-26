
![Banner](./assets/yc_n8n.svg)

# n8n-nodes-yc Package Description

Integration package for working with Yandex Cloud services in n8n.

## Table of Contents

1. [Yandex Cloud GPT Chat Model](#yandex-cloud-gpt-chat-model)
2. [Yandex Cloud Foundation Models](#yandex-cloud-foundation-models)
3. [Yandex Object Storage](#yandex-object-storage)
4. [Yandex Cloud Functions](#yandex-cloud-functions)
5. [Yandex Cloud Containers](#yandex-cloud-containers)
6. [Yandex Cloud Compute](#yandex-cloud-compute)
7. [Yandex Cloud Data Streams](#yandex-cloud-data-streams)
8. [Yandex Cloud Message Queue](#yandex-cloud-message-queue)
9. [Yandex Cloud Postbox](#yandex-cloud-postbox)
10. [Yandex Cloud SpeechKit](#yandex-cloud-speechkit)
11. [Yandex Cloud SpeechKit STT](#yandex-cloud-speechkit-stt)
12. [Yandex Cloud Translate](#yandex-cloud-translate)
13. [Yandex Cloud Workflows](#yandex-cloud-workflows)

---

## Yandex Cloud GPT Chat Model

**Node for integration with Yandex Cloud Foundation Models API as a language model for LangChain.** This node is an AI chain component and represents a Chat Model compatible with the LangChain framework. Designed for advanced use in AI agents and processing chains (AI Chain, AI Agent). The node has no inputs and outputs a language model object that can be connected to other AI components in n8n.

| Parameter | Type | Description |
|----------|-----|----------|
| **Model** | Resource Locator | YandexGPT model ID (e.g., `yandexgpt/latest`) |
| **Maximum Tokens** | Number | Maximum number of tokens in response (up to 8000) |
| **Temperature** | Number | Controls randomness of generation (0-1, default 0.6) |
| **Timeout** | Number | Request timeout in milliseconds (default 60000) |
| **Max Retries** | Number | Maximum number of retry attempts (default 2) |

**Authentication:** Uses API key via `yandexCloudGptApi` credentials with folder ID passed in `x-folder-id` header. Supports base API URL configuration. The node is compatible with OpenAI API protocol, allowing use of standard LangChain tools. Ideal for creating chatbots, RAG systems, and AI agents using Russian language models.

---

## Yandex Cloud Foundation Models

**Node for working with Yandex Cloud Foundation Models API, providing direct access to YandexGPT generative language models via REST API.** Unlike the Chat Model version, this node works as a regular transformation node with Main-type inputs and outputs, allowing requests to the API and receiving JSON responses in the context of standard workflows.

| Parameter | Type | Description |
|----------|-----|----------|
| **Resource** | Options | Resource type (Chat) |
| **Operation** | Options | Operation to perform |

**Resources and operations:**

- **Chat** - work with model chat functionality

**Authentication:** Uses API key via `yandexCloudFomoApi` credentials. Supports base URL configuration and automatic HTTP error handling (ignoreHttpStatusErrors). Features model selection from dropdown list (similar to LMChatYandexGpt) and enhanced error messages with detailed API responses. The node is suitable for simple text generation scenarios that don't require complex LangChain integration but need direct work with Yandex Cloud API for creating dialogs, generating content, and natural language processing in automated workflows.

---

## Yandex Object Storage

**Node for comprehensive management of Yandex Cloud object storage, compatible with Amazon S3 API.** Provides an exhaustive set of operations for working with both buckets (containers) and objects (files), using AWS SDK to ensure maximum compatibility and reliability.

| Parameter | Type | Resources | Operations |
|----------|-----|---------|----------|
| **Bucket** | Resource | Bucket | Create, Delete, Get, List, Set ACL, Set Versioning |
| **Object** | Resource | Object | Upload, Download, Copy, Move, Delete, Get, List, Set ACL, Get Presigned URL |

**Bucket Operations:**

- **Create** - create new bucket with ACL configuration
- **Delete** - delete empty bucket
- **Get** - get bucket information (location, metadata)
- **List** - enumerate all available buckets
- **Set ACL** - configure access rights (private, public-read, public-read-write, authenticated-read)
- **Set Versioning** - enable/disable object versioning

**Object Operations:**

- **Upload** - upload from binary data, text, or JSON with content-type, storage class (Standard/Cold/Ice) and metadata configuration. Returns `objectUrl` field containing the full object URL (e.g., `https://storage.yandexcloud.net/my-bucket/file.txt`)
- **Download** - download object to binary format
- **Copy** - copy between buckets preserving metadata. Returns `objectUrl` field with the destination object URL
- **Move** - move with automatic source deletion. Returns `objectUrl` field with the destination object URL
- **Delete** - delete object
- **Get** - get metadata (size, content-type, ETag, version)
- **List** - enumerate objects with prefix filtering and pagination (up to 1000 objects)
- **Set ACL** - configure access rights at object level
- **Get Presigned URL** - generate temporary signed URLs for secure access

**Authentication:** Uses static access keys (access key ID and secret access key) via `yandexCloudStaticApi` credentials. Supports resource locator for convenient bucket selection from list or manual name entry. The node is ideal for backup, user file storage, CDN integrations, and organizing data lakes in the cloud.

---

## Yandex Cloud Functions

**Node for invoking serverless functions in Yandex Cloud Functions via HTTP endpoints.** Allows launching cloud functions with parameter passing and getting execution results, automatically managing authentication via IAM tokens.

| Parameter | Type | Description |
|----------|-----|----------|
| **Folder ID** | String | Folder ID for function search (default from credentials) |
| **Function** | Options | Select function from list or specify ID |
| **HTTP Method** | Options | GET or POST |
| **Request Body** | String (JSON) | Request body for POST method |
| **Query Parameters** | Collection | Collection of query parameters (name/value) |
| **Headers** | Collection | Additional HTTP headers |

**Execution process:**

1. Automatic loading of available functions list from specified folder via SDK
2. Getting IAM token from service account credentials
3. Forming HTTP request to endpoint `https://functions.yandexcloud.net/{functionId}`
4. Adding Authorization header with Bearer token
5. Executing request and parsing response (automatic JSON detection)

**Returned data:**

- `statusCode` - HTTP response status
- `headers` - response headers
- `body` - response body (object or string)

**Authentication:** Uses service account JSON via `yandexCloudAuthorizedApi` credentials for automatic IAM token retrieval. Validates JSON request body before sending. The node is ideal for integrating business logic written in Python, Node.js, Go, and other languages into n8n workflows, enabling complex computations and data processing in serverless architecture.

---

## Yandex Cloud Containers

**Node for invoking serverless containers in Yandex Cloud Serverless Containers, providing the ability to run containerized applications via HTTP.** Functionality is similar to Yandex Cloud Functions, but works with Docker containers, allowing use of any dependencies and environments.

| Parameter | Type | Description |
|----------|-----|----------|
| **Folder ID** | String | Folder ID for container search |
| **Container** | Options | Select container from list or specify ID |
| **HTTP Method** | Options | GET or POST |
| **Request Body** | String (JSON) | Request body for POST method |
| **Query Parameters** | Collection | URL request parameters |
| **Headers** | Collection | Custom HTTP headers |

**Workflow:**

1. Loading list of available containers via SDK
2. Getting container URL (field `url`)
3. Generating IAM token for authentication
4. Executing HTTP request to container URL
5. Processing and returning response

**Returned data:**

- `statusCode` - HTTP response code
- `headers` - response headers
- `body` - response body (automatic JSON parsing)

**Authentication:** Service account JSON with automatic IAM token retrieval via `yandexCloudAuthorizedApi`. Supports JSON validation before sending. Differs from Functions by using full Docker images, providing more flexibility in runtime, library, and system dependency choices. Suitable for running ML models, complex applications with many dependencies, and microservices within n8n workflows.

---

## Yandex Cloud Compute

**Node for managing virtual machines in Yandex Compute Cloud, providing basic start and stop instance operations.** Uses official Yandex Cloud SDK for interacting with Compute API.

| Parameter | Type | Description |
|----------|-----|----------|
| **Resource** | Options | Resource type (Instance) |
| **Operation** | Options | Start or Stop |
| **Folder ID** | String | Folder ID with virtual machines |
| **Instance** | Options | Select VM from list or specify ID |

**Operations:**

- **Start** - start stopped virtual machine
- **Stop** - stop running virtual machine

**Execution process:**

1. Parsing service account JSON credentials
2. Creating SDK session with authentication
3. Getting instance list from specified folder
4. Executing start/stop operation via InstanceServiceClient
5. Returning operation information

**Returned data:**

- `success` - execution status
- `operation` - operation type (start/stop)
- `instanceId` - virtual machine ID
- `operationId` - operation ID in Yandex Cloud
- `done` - whether operation is completed
- `metadata` - operation metadata

**Authentication:** Service account JSON via `yandexCloudAuthorizedApi` with mandatory field validation (serviceAccountId, accessKeyId, privateKey). Node shows VM status when selecting from list (RUNNING, STOPPED, etc.). Ideal for infrastructure management automation: VM startup on schedule, stopping to save costs, integration with monitoring and alerting systems.

---

## Yandex Cloud Data Streams

**Node for working with stream data processing via Yandex Cloud Data Streams (YDS), compatible with Apache Kafka and Amazon Kinesis API.** Provides high-performance data transfer between applications with guaranteed delivery and message ordering.

| Parameter | Type | Resources | Operations |
|----------|-----|---------|----------|
| **Record** | Resource | Record | Put, Put Multiple |
| **Stream** | Resource | Stream | Describe, List |

**Record Operations:**

- **Put** - send single record with data type selection (String/JSON), partition key specification and optional parameters (explicit hash key, sequence number)
- **Put Multiple** - batch record sending in two modes:
  - **Define Records** - manual record definition via UI
  - **Use Input Data** - automatic use of incoming items with field mapping

**Stream Operations:**

- **Describe** - get detailed stream information (status, retention period, shards, encryption)
- **List** - enumerate all available streams with limit

**Send parameters:**

- `streamName` - stream name (format: `/ru-central1/{folder-id}/{database-id}/{stream-name}`)
- `data` - data to send (string or JSON)
- `partitionKey` - key for shard determination
- `explicitHashKey` - explicit hash specification for routing
- `dataField` - data field when using input data
- `partitionKeyField` - partition key field

**Returned data:**

- For Put: `shardId`, `sequenceNumber`, `encryptionType`
- For Put Multiple: `successCount`, `failedCount`, detailed information per record
- For Describe: full stream information, shards with hash ranges
- For List: list of stream names

**Authentication:** Static keys via `yandexCloudStaticApi`, uses Kinesis-compatible endpoint. Supports resource locator for convenient stream selection. The node is suitable for building real-time analytics, streaming ETL processing, log and metrics collection, microservice integration with guaranteed message delivery and horizontal scaling capability via sharding.

---

## Yandex Cloud Message Queue

**Node for sending messages to Yandex Cloud Message Queue (YMQ) queues, fully compatible with Amazon SQS API.** Provides reliable asynchronous message passing between distributed system components with support for FIFO and standard queues.

| Parameter | Type | Description |
|----------|-----|----------|
| **Resource** | Options | Message |
| **Operation** | Options | Send |
| **Queue** | Resource Locator | Select queue from list or specify URL |
| **Message Body** | String | Message content (up to 256 KB) |

**Additional fields:**

- **Delay Seconds** - message delivery delay (0-900 seconds)
- **Message Deduplication ID** - deduplication token (required for FIFO)
- **Message Group ID** - message grouping (required for FIFO)

**Message Attributes:**

Collection of message attributes with configuration:

- `name` - attribute name
- `dataType` - data type (String, Number, Binary)
- `value` - attribute value

**Returned data:**

- `messageId` - unique message ID
- `md5OfMessageBody` - MD5 hash of message body
- `md5OfMessageAttributes` - MD5 hash of attributes
- `sequenceNumber` - sequence number (for FIFO)
- `success` - send status
- `queueUrl` - queue URL

**Authentication:** Static keys via `yandexCloudStaticApi`, uses endpoint `https://message-queue.api.cloud.yandex.net`. Supports both standard queues (at-least-once delivery, best-effort ordering) and FIFO queues (exactly-once processing, strict ordering). The node is ideal for building event-driven architectures, splitting monoliths into microservices, buffering load between components, background task processing, and ensuring fault tolerance through asynchronous communication.

---

## Yandex Cloud Postbox

**Node for sending transactional emails via Yandex Cloud Postbox using Amazon SES v2 API.** Provides reliable email delivery with HTML template and variable support, with guaranteed IP address reputation from Yandex Cloud.

| Parameter | Type | Description |
|----------|-----|----------|
| **Resource** | Options | Email |
| **Operation** | Options | Send |
| **Email Type** | Options | Simple or Template |
| **From Email** | String | Sender email (domain must be verified) |
| **To Email** | String | Recipient email (multiple comma-separated) |

**Simple Email (simple mode):**

- **Subject** - email subject
- **HTML Body** - HTML version of email
- **Text Body** - text version for non-HTML clients

**Template Email (template mode):**

- **Template Subject** - subject with `{{variable}}` placeholders
- **Template HTML** - HTML template with placeholders
- **Template Text** - text version of template (optional)
- **Template Data** - JSON object with substitution data

**Send process:**

1. Parsing recipient list (comma separation)
2. Forming Content structure (Simple or Template)
3. Substituting variables in template (if used)
4. Sending via SES API with UTF-8 charset
5. Getting Message ID

**Returned data:**

- `messageId` - unique sent email ID
- `success` - send status
- `from` - sender address
- `to` - array of recipient addresses
- `subject` - email subject
- `emailType` - email type (simple/template)

**Authentication:** Static keys via `yandexCloudStaticApi`, uses endpoint `https://postbox.cloud.yandex.net`. Requires prior domain verification in Yandex Cloud. Supports multiple recipients and templating for personalization. The node is suitable for sending notifications, registration confirmations, password resets, reports, marketing campaigns, and any transactional emails with high deliverability and detailed analytics.

---

## Yandex Cloud SpeechKit

**Node for speech synthesis (Text-to-Speech) using Yandex SpeechKit API v3, providing high-quality audio generation from text.** Supports multiple voices, emotional roles, and flexible synthesis parameter configuration.

| Parameter | Type | Description |
|----------|-----|----------|
| **Resource** | Options | Speech |
| **Operation** | Options | Synthesize |
| **Text** | String | Text for synthesis (multiline) |
| **Voice** | Options | Voice selection (Alena, Filipp, Jane, John, Masha, Omazh, Zahar) |
| **Role** | Options | Emotional coloring (Neutral, Good, Evil) |

**Available voices:**

- **Alena** - female, Russian
- **Filipp** - male, Russian
- **Jane** - female, Russian/English
- **John** - male, English
- **Masha** - female, Russian
- **Omazh** - female, Russian
- **Zahar** - male, Russian

**Audio formats:**

*Container (containerized files):*

- **WAV** - uncompressed format
- **MP3** - lossy compression
- **OGG Opus** - open codec

*Raw PCM (raw audio stream):*

- Sample rates: 8000, 16000, 22050, 48000 Hz
- Encoding: LINEAR16_PCM

**Additional options:**

- **Speed** - speech speed (0.1 - 3.0, default 1.0)
- **Volume** - volume (-145 to 1)
- **Pitch Shift** - voice pitch change (-1000 to 1000 Hz)

**Synthesis process:**

1. Parsing service account credentials
2. Creating SDK session
3. Connecting to TTS API (`tts.api.cloud.yandex.net:443`)
4. Streaming audio chunks generation
5. Combining chunks into final file
6. Preparing binary data with correct MIME type

**Returned data:**

- `success` - synthesis status
- `text` - source text
- `voice` - used voice
- `role` - emotional role
- `audioFormat` - audio format
- `audioSize` - file size in bytes
- Binary data - audio file with .wav/.mp3/.ogg/.raw extension

**Authentication:** Service account JSON via `yandexCloudAuthorizedApi` with automatic IAM token generation. Uses gRPC streaming for efficient audio transfer. The node is ideal for creating voice assistants, notification voiceovers, audiobook generation, accessibility solutions, IVR systems, and any applications requiring text-to-natural-speech conversion in Russian and English.

---

## Yandex Cloud SpeechKit STT

**Node for speech recognition (Speech-to-Text) using Yandex SpeechKit API v3, providing asynchronous audio transcription with high accuracy.** Supports multiple languages and audio formats with automatic language detection capability.

| Parameter | Type | Description |
|----------|-----|----------|
| **Operation** | Options | Recognize Audio or Get Recognition Results |
| **Audio URL** | String | URL of audio file in Yandex Object Storage |
| **Language Code** | Options | Language for recognition (auto-detect, Russian, English, etc.) |
| **Format Specification** | Options | Choose to specify format using Audio Format codes or MIME Types |
| **Audio Format** | Options | Yandex Cloud audio format (LPCM, OGG Opus, MP3) - shown when Format Specification is "Audio Format" |
| **MIME Type** | Options | Standard MIME type (audio/wav, audio/ogg, audio/mpeg, etc.) - shown when Format Specification is "MIME Type" |

**Operations:**

- **Recognize Audio** - start asynchronous audio transcription
  - Returns operation ID for polling
  - Supports audio files stored in Yandex Object Storage
  
- **Get Recognition Results** - retrieve transcription results with auto-polling
  - Automatically polls until completion
  - Handles "operation not ready" race condition
  - Configurable polling interval and max attempts
  - Optional partial results on timeout

**Supported Languages:**

- Automatic Detection
- Russian (ru-RU)
- English (en-US)
- German (de-DE)
- French (fr-FR)
- Spanish (es-ES)
- Italian (it-IT)
- Polish (pl-PL)
- Turkish (tr-TR)
- And many more (16 languages total)

**Audio Formats:**

The node supports two ways to specify audio format:

*Via Audio Format (Yandex Cloud format codes):*

- **LPCM** - Linear PCM with configurable sample rate (8000, 16000, 48000 Hz)
- **OGG Opus** - Compressed Ogg Opus format
- **MP3** - Standard MP3 format

*Via MIME Type (standard MIME types, automatically mapped to Yandex formats):*

- **audio/wav, audio/pcm, audio/x-pcm** - Maps to LPCM
- **audio/ogg, audio/opus** - Maps to OGG Opus
- **audio/mpeg, audio/mp3** - Maps to MP3

**Recognition Options:**

- **Audio Channel Count** - number of audio channels (1-8)
- **Sample Rate** - for LPCM format (8000, 16000, 48000 Hz)
- **Profanity Filter** - filter out profane language
- **Literature Text** - use literary text normalization

**Polling Options (Get Results):**

- **Poll Interval** - time between polling attempts (1-60 seconds, default 5)
- **Max Attempts** - maximum polling attempts (1-300, default 60)
- **Return Partial Results** - return incomplete results on timeout

**Recognition Process:**

1. Upload audio file to Yandex Object Storage
2. Start recognition with audio URL and parameters
3. Receive operation ID
4. Poll for results (auto-retry on "not ready" errors)
5. Get transcribed text with confidence scores

**Returned data (Recognize):**

- `success` - operation start status
- `operationId` - ID for polling results
- `audioUrl` - URL of audio file
- `model` - recognition model used (general)
- `languageCode` - selected language
- `status` - operation status (RUNNING)

**Returned data (Get Results):**

- `success` - completion status
- `operationId` - operation ID
- `status` - DONE or RUNNING
- `text` - full transcribed text
- `channelTag` - audio channel identifier
- `finalResults` - detailed results with alternatives
- `attemptsUsed` - number of polling attempts

**Authentication:** Service account JSON via `yandexCloudAuthorizedApi` with automatic IAM token generation. Uses gRPC streaming for efficient data transfer. Automatically handles race conditions when operation data is not immediately available. The node is ideal for creating voice-controlled interfaces, meeting transcription, call center analytics, subtitle generation, accessibility features, and any applications requiring accurate speech-to-text conversion in multiple languages with async processing support.

---

## Yandex Cloud Translate

**Node for text translation using Yandex Cloud Translate API, providing high-quality neural machine translation for 100+ languages.** Supports automatic language detection, custom glossaries, HTML translation, and spell checking before translation.

| Parameter | Type | Description |
|----------|-----|----------|
| **Resource** | Options | Text or Language |
| **Operation** | Options | Translate, Detect Language, or List |
| **Folder ID** | String | Folder ID (default from credentials) |

**Resources and operations:**

- **Text** - text translation and language detection
  - **Translate** - translate text to target language with optional glossary
  - **Detect Language** - automatically detect the language of text
- **Language** - supported languages management
  - **List** - get all supported languages

**Translation parameters:**

- `texts` - text to translate (multiline, supports multiple texts separated by newlines)
- `sourceLanguageCode` - source language (leave empty for auto-detection)
- `targetLanguageCode` - target language (required)
- `format` - text format (Plain Text or HTML)
- `speller` - enable spell checking before translation
- `model` - custom translation model ID (optional)
- `glossary` - custom glossary terms for precise translation

**Glossary configuration:**

Custom terminology dictionary for accurate translation of specific terms:

- `sourceText` - term in source language
- `translatedText` - term in target language
- `exact` - use exact word matching

**Language Detection:**

- `text` - text for language detection
- `languageCodeHints` - comma-separated language codes to prioritize (e.g., en,ru,es)

**Supported Languages:**

100+ languages including: Russian, English, German, French, Spanish, Italian, Portuguese, Polish, Turkish, Chinese, Japanese, Korean, Arabic, Hebrew, Hindi, and many more. Full list available via List Languages operation.

**API Limits:**

- Maximum 10,000 characters per request
- Multiple texts can be translated in single request
- Supports batch translation via newline-separated input

**Returned data (Translate):**

- `success` - translation status
- `sourceLanguageCode` - source language (auto-detected if not specified)
- `targetLanguageCode` - target language
- `translations` - array of translation results
  - `text` - translated text
  - `detectedLanguageCode` - detected source language

**Returned data (Detect Language):**

- `success` - detection status
- `text` - analyzed text
- `languageCode` - detected language code

**Returned data (List Languages):**

- Array of supported languages with:
  - `code` - language code (ISO 639-1)
  - `name` - language name

**Use cases:**

- Multi-language content localization
- Real-time chat translation
- Document translation workflows
- User-generated content translation
- Customer support in multiple languages
- API response localization
- Email and notification translation
- Website content translation

**Authentication:** Service account JSON via `yandexCloudAuthorizedApi` with automatic IAM token generation. Uses Yandex Cloud Translate API v2 with gRPC protocol for efficient communication. The node is ideal for building multilingual applications, automating content translation, creating translation pipelines, and integrating machine translation into business workflows with support for custom terminology and HTML content preservation.

---

## Yandex Cloud Workflows

**Node for starting workflow executions in Yandex Cloud Workflows, a serverless service for orchestrating cloud resources and microservices.** Allows integrating n8n workflows with Yandex Workflows, creating hybrid automations.

| Parameter | Type | Description |
|----------|-----|----------|
| **Resource** | Options | Workflow |
| **Operation** | Options | Start Execution |
| **Folder ID** | String | Folder ID with workflows |
| **Workflow** | Options | Select workflow from list or specify ID |
| **Input Data** | String (JSON) | Input data for workflow in JSON format |

**Launch process:**

1. Loading list of available workflows from specified folder
2. Validating input data (JSON correctness check)
3. Creating SDK client ExecutionServiceClient
4. Sending execution start request with specification of:
   - `workflowId` - workflow ID
   - `input.inputJson` - JSON string with input parameters
5. Getting execution ID

**Returned data:**

- `executionId` - unique execution ID
- `workflowId` - workflow ID
- `success` - launch status

**Usage examples:**

- Starting complex cloud function orchestration from n8n
- Data passing between n8n and Yandex Workflows
- Triggering long-running processes
- Integration with existing Workflows definitions

**Authentication:** Service account JSON via `yandexCloudAuthorizedApi` for creating SDK session. Automatically validates JSON before sending. Supports resource locator for convenient workflow selection with description display. The node is suitable for creating complex automations where n8n manages external integrations and APIs, while Yandex Workflows coordinates cloud resources (Functions, Containers, Compute), providing visual design of complex business processes with error handling, retry logic, and parallel task execution.

---

## Authentication Types

The package uses three types of credentials:

### yandexCloudGptApi

- API key for Foundation Models
- Folder ID
- Endpoint URL (optional)

### yandexCloudStaticApi

- Access Key ID
- Secret Access Key
- Used for S3-compatible services (Object Storage, Data Streams, Message Queue, Postbox)

### yandexCloudAuthorizedApi

- Service Account JSON
- Folder ID
- Used for services requiring IAM tokens (Functions, Containers, Compute, SpeechKit, Workflows)

---

## Common Features

All nodes in the package support:

- ✅ Continue on Fail - continue execution on errors
- ✅ Paired Items - maintain relationship between input and output items
- ✅ Resource Locators - convenient resource selection from lists or manual entry
- ✅ Expressions - use n8n expressions in all parameters
- ✅ Proxy Support - work via HTTP/HTTPS proxy (where applicable)
