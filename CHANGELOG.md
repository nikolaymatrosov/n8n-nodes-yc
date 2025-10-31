# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
