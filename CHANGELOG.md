# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Yandex Cloud Lockbox** node for secure secret management
  - Secret CRUD operations: List, Get, Create, Update, Delete, Activate, Deactivate
  - Version management: List, Add, Schedule Destruction, Cancel Destruction
  - Payload retrieval: Get by ID or by folder+name lookup
  - Support for text and binary secrets (base64 encoding)
  - KMS encryption support for enhanced security
  - Deletion protection to prevent accidental removal
  - Resource locators for convenient secret and version selection
  - Comprehensive pagination support for list operations
  - Labels for secret organization and filtering
  - Version immutability and lifecycle management

### Changed

### Fixed

### Removed

## [0.9.2] - 2025-12-02

### Added

### Changed

- **YandexCloudSearch**
  - When XML format + `parseXml: true` (default): returns only `parsedData` (cleaner responses)
  - When XML format + `parseXml: false`: returns only `data` field with raw string
  - When HTML format: always returns only `data` field with raw string (parsing not applicable)
  - Parse errors automatically include `data` field with raw response for debugging

### Fixed

- **YandexCloudSearch**: Fixed Buffer serialization issue where responses were serialized as `{"type": "Buffer", "data": [...]}` instead of readable strings
- **YandexCloudSearch**: Fixed response bloat from always including both raw and parsed data

### Removed

## [0.9.1] - 2025-11-27

### Added

- **Yandex Cloud SDK Error Handling**: Comprehensive error handling utilities for Yandex Cloud SDK operations
  - New `YandexCloudSdkError` class for consistent SDK error representation
  - Automatic extraction of RequestId and ServerTraceId from SDK errors for debugging
  - Type guards for detecting SDK-specific error types (`isSdkError`, `isSdkStatusError`, `isGrpcStatusObject`)
  - `withSdkErrorHandling` utility function to wrap SDK calls with automatic error enrichment
  - Enhanced error messages with operation context and item index information
  - Comprehensive test coverage (30+ test cases) for error handling utilities
  - Applied consistent error handling across all SDK-based nodes: Compute, Containers, Functions, Logging, Search, SpeechKit, SpeechKitSTT, Translate, VisionOcr, Workflows, YDB, YandexART

- **YandexART Node Enhancements**:
  - Automatic prompt truncation to 1000 characters with warning messages
  - `truncatePrompt` utility function with comprehensive tests
  - Better user feedback when prompts exceed API limits

### Changed

- **Error Handling Improvements**: Updated error messages across multiple nodes to provide more specific and actionable feedback
  - YandexCloudContainers: Enhanced error messages for container operations
  - YandexCloudFunctions: Improved error context for function invocations and management
  - YandexCloudLogging: Better error feedback for log operations
  - YandexCloudSearch: More detailed error messages for search operations
  - YandexCloudSpeechKit: Enhanced error handling for text-to-speech operations
  - YandexCloudSpeechKitSTT: Improved error messages for speech recognition
  - YandexCloudTranslate: Better error context for translation operations
  - YandexCloudVisionOcr: Enhanced error feedback for OCR operations
  - YandexCloudWorkflows: Improved error messages for workflow operations
  - YandexCloudYDB: Enhanced IAM token retrieval error handling

- **Code Quality**: Consolidated error handling imports across all Yandex Cloud nodes for consistency
- **Documentation**: Updated CLAUDE.md with comprehensive error handling patterns (Section 6.4)

### Fixed

### Removed

## [0.9.0] - 2025-11-23

### Added

- **Yandex Cloud YandexART Node**: AI-powered image generation using Foundation Models API
  - Generate high-quality images from text descriptions with YandexART model
  - Support for negative prompts to specify unwanted elements in generated images
  - Multiple aspect ratio options: Square (1:1), Landscape (16:9, 21:9), Portrait (9:16, 9:21)
  - Output format selection: JPEG or PNG
  - Optional seed parameter for reproducible image generation
  - Asynchronous operation handling with automatic polling until completion
  - Configurable polling interval and maximum wait time
  - Option to return operation ID immediately without waiting
  - Returns generated images as binary data ready for download or further processing
  - Comprehensive error handling with detailed timeout and failure messages
  - First node in codebase to implement async operation polling pattern

### Changed

### Fixed

### Removed

## [0.8.5] - 2025-11-19

### Added

### Changed

### Fixed

- **Internal**: Refactored credential validation to use centralized `validateServiceAccountCredentials` utility across all nodes
  - Removed redundant `validateIAmCredentials` function from Vision OCR node
  - Improved consistency in credential validation logic

### Removed

## [0.8.4] - 2025-11-18

### Fixed

- **YDB Node**: Fixed "Channel credentials must be a ChannelCredentials object" error by properly formatting the connection string with `grpcs://` protocol prefix
- **Dependencies**: Fixed `@grpc/grpc-js` version conflicts between `@yandex-cloud/nodejs-sdk` (requires ^1.6.12) and `@ydbjs/core` (requires ^1.14.0) by:
  - Adding `@grpc/grpc-js@1.14.1` as a direct dependency
  - Using npm `resolutions` and `overrides` to force version 1.14.1 across all packages
  - Ensuring proper dependency deduplication to prevent nested module issues

## [0.8.0] - 2025-11-17

### Added

- **Yandex Cloud Logging Node**: Centralized log management with write and read operations
  - Write log entries with multiple entries per request, structured JSON payloads, and custom timestamps
  - Support for log levels (TRACE, DEBUG, INFO, WARN, ERROR, FATAL)
  - Stream names for log organization by application component
  - Resource metadata (type and ID) for log entry attribution
  - Default values for level, payload, and stream across multiple entries
  - Read log entries with comprehensive filtering options (time range, levels, resources, streams)
  - Advanced filter expressions for precise log queries
  - Automatic pagination support for large result sets
  - Resource locator with dropdown for easy log group selection
  - Comprehensive test coverage with 30+ test cases

### Changed

### Fixed

### Removed

## [0.7.0] - 2025-11-15

### Added

- **Yandex Cloud Vision OCR Node**: Optical character recognition for images and documents
  - Text recognition from JPEG, PNG, and PDF files (up to 10MB)
  - Automatic MIME type detection via magic bytes analysis
  - Multi-language support (50+ languages with ISO 639-1 codes, default: Russian and English)
  - Multiple OCR models: Page (default), Page Column Sort, Handwritten, Table, Markdown, Math Markdown
  - Template document recognition models: Passport, Driver License (Front/Back), Vehicle Registration (Front/Back), License Plates
  - Model-specific validation (e.g., license-plates requires explicit language specification)
  - Flexible output formats: Full Text Only, Structured Data (with coordinates), or Both
  - Structured data includes blocks, lines, words, tables, entities, and pictures with bounding boxes
  - Multi-page PDF support with automatic page combining
  - Table cell recognition with row/column indices and spanning
  - gRPC streaming for efficient data transfer
  - IAM authentication using Service Account JSON credentials

### Changed

### Fixed

### Removed

## [0.6.1] - 2025-11-14

### Added

### Changed

- **Yandex Cloud Foundation Models (Fomo) Node**: Simplified versioning to single version [1]
- **Schema Structure**: Updated schema organization to use package version (v0.6.1) instead of node version

### Fixed

### Removed

- **Yandex Cloud Foundation Models (Fomo) Node**: Removed wrong version 1.1
- **Schema Files**: Removed old schema versions (v1.0.0 and v1.1.0)

## [0.6.0] - 2025-11-02

### Added

- **Yandex Cloud Search Node**: Access Yandex Cloud Search API with web and AI-powered search
  - Web Search: Traditional search with extensive filtering (family mode, sorting, grouping, localization)
  - Generative Search: AI-powered answers with source attribution and streaming support
  - Automatic XML-to-JSON parsing for web search results
  - Multi-message conversation support for generative search
  - Server-side streaming for progressive generative responses
  - IAM authentication using Service Account JSON credentials

### Changed

### Fixed

### Removed

## [0.5.0] - 2025-10-31

### Added

- **Yandex Cloud YDB Node**: Execute YQL queries and interact with Yandex Database (YDB)
  - Support for simple and parameterized queries
  - Multiple return modes (all result sets, first result set, first row only)
  - Automatic type conversion between JavaScript and YDB types
  - IAM authentication using Service Account JSON credentials
  - Full support for YDB's multi-result set queries
  - **Dual credential approach**: Requires both `yandexCloudAuthorizedApi` (authentication) and `yandexCloudYdbApi` (connection parameters)

- **Yandex Cloud YDB API Credentials**: Credential type for YDB connection parameters
  - Contains only Endpoint and Database fields
  - Used in conjunction with `yandexCloudAuthorizedApi` for authentication
  - Enables separation of authentication from connection details
  - Allows easy switching between databases (dev/staging/prod)

### Changed

- **Breaking**: YDB node now requires both credential types instead of choosing between them
- **Breaking**: Removed `endpoint` and `database` node parameters (now provided via `yandexCloudYdbApi` credentials)
- **Breaking**: Removed `serviceAccountJson` field from `yandexCloudYdbApi` credentials (now provided via `yandexCloudAuthorizedApi`)
- Updated YDB node to simplify credential handling with clear separation of concerns

## [0.4.0] - 2025-10-29

### Added

- Yandex Cloud Foundation Models node
- Object Storage URL support
