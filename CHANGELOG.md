# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Yandex Cloud YDB Node**: Execute YQL queries and interact with Yandex Database (YDB)
  - Support for simple and parameterized queries
  - Multiple return modes (all result sets, first result set, first row only)
  - Automatic type conversion between JavaScript and YDB types
  - IAM authentication using Service Account JSON credentials
  - Full support for YDB's multi-result set queries
  - **Multiple credential type support**: Choose between `yandexCloudYdbApi` (endpoint/database in credentials) or `yandexCloudAuthorizedApi` (endpoint/database as node parameters)

- **Yandex Cloud YDB API Credentials**: New credential type for YDB
  - Includes Service Account JSON, Endpoint, and Database in one reusable credential
  - Better organization for users with multiple YDB databases
  - Backward compatible with existing `yandexCloudAuthorizedApi` credentials

## [0.4.0] - 2025-10-29

### Added
- Yandex Cloud Foundation Models node
- Object Storage URL support
