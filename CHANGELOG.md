# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
