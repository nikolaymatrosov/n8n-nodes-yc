# Yandex Cloud Logging Node

This node allows you to interact with Yandex Cloud Logging service in n8n workflows. It supports writing and reading log entries.

## Prerequisites

- Yandex Cloud account
- Service account with appropriate permissions for Cloud Logging
- Service account key (JSON format)

## Operations

### Log Entry Operations

#### Write
Write log entries to a Yandex Cloud log group.

**Parameters:**
- **Log Group**: Select from dropdown or enter log group ID manually
- **Entries**: Array of log entries with:
  - **Message** (required): Log message text
  - **Level**: Log level (TRACE, DEBUG, INFO, WARN, ERROR, FATAL)
  - **Timestamp**: Entry timestamp (ISO 8601 format). Defaults to current time.
  - **JSON Payload**: Additional structured data as JSON
  - **Stream Name**: Stream name for organizing logs
- **Additional Fields** (optional):
  - **Resource Type**: Type of resource producing logs (e.g., `serverless.function`)
  - **Resource ID**: ID of the resource producing logs
  - **Default Level**: Default log level for entries without specified level
  - **Default JSON Payload**: Default JSON merged with entry payloads
  - **Default Stream Name**: Default stream for entries without specified stream

**Example:**
```json
{
  "logGroupId": "e23abc45def67890ghij",
  "entries": [
    {
      "message": "Application started successfully",
      "level": "INFO",
      "timestamp": "2024-01-15T10:30:00Z",
      "jsonPayload": {
        "version": "1.0.0",
        "environment": "production"
      },
      "streamName": "application"
    },
    {
      "message": "Database connection established",
      "level": "INFO",
      "jsonPayload": {
        "host": "db.example.com",
        "database": "myapp"
      }
    }
  ]
}
```

#### Read
Read log entries from a Yandex Cloud log group with filtering options.

**Parameters:**
- **Log Group**: Select from dropdown or enter log group ID manually
- **Return All**: Toggle to return all results or limit to a specific number
- **Limit**: Maximum number of entries to return (when Return All is false)
- **Filters** (optional):
  - **Since**: Lower bound of log timestamps (ISO 8601)
  - **Until**: Upper bound of log timestamps (ISO 8601)
  - **Levels**: Filter by log levels (multi-select)
  - **Resource Types**: Comma-separated list of resource types
  - **Resource IDs**: Comma-separated list of resource IDs
  - **Stream Names**: Comma-separated list of stream names
  - **Filter Expression**: Advanced filter expression

**Example Filter:**
```json
{
  "since": "2024-01-15T00:00:00Z",
  "until": "2024-01-15T23:59:59Z",
  "levels": ["ERROR", "FATAL"],
  "resourceTypes": "serverless.function",
  "streamNames": "application"
}
```

**Output:**
Each log entry is returned as a separate item with fields:
- `uid`: Unique entry ID
- `message`: Log message
- `level`: Log level
- `timestamp`: Entry timestamp
- `resource`: Resource metadata (type, id)
- `jsonPayload`: Structured data
- `streamName`: Stream name
- `ingestedAt`: Ingestion timestamp
- `savedAt`: Save timestamp

## Use Cases

### 1. Application Logging
Send application logs to Yandex Cloud Logging for centralized monitoring:

**Workflow:**
1. Catch webhook with application events
2. Transform event data to log format
3. Use Yandex Cloud Logging node to write logs
4. Continue workflow processing

### 2. Error Monitoring
Read error logs and send notifications:

**Workflow:**
1. Schedule workflow to run every 5 minutes
2. Use Yandex Cloud Logging node to read ERROR/FATAL logs from last 5 minutes
3. If errors found, send notification via Telegram/Slack/Email
4. Store error summary in database

### 3. Log Analysis
Retrieve and analyze logs for specific time periods:

**Workflow:**
1. Use Yandex Cloud Logging node to read logs with time filters
2. Process logs with Function node
3. Generate statistics (error rate, request count, etc.)
4. Store results in database or send report

### 4. Multi-Source Logging
Aggregate logs from multiple sources:

**Workflow:**
1. Receive logs from different sources (webhook, API, schedule)
2. Normalize log format with Function node
3. Use Yandex Cloud Logging node to write to appropriate log groups
4. Query logs across all groups for comprehensive monitoring

## Error Handling

The node supports n8n's "Continue On Fail" mode:
- **Enabled**: Returns error object without stopping workflow
- **Disabled**: Throws error and stops workflow execution

Example error output (Continue On Fail enabled):
```json
{
  "error": "Log Group not found: e23abc45def67890ghij",
  "success": false
}
```

## Tips

1. **Timestamps**: Always use ISO 8601 format for timestamps (e.g., `2024-01-15T10:30:00Z`)

2. **JSON Payload**: Can be a JSON string or object. Invalid JSON strings are wrapped in `{"data": "string"}`

3. **Resource Locator**: Use dropdown for easy selection or manual ID entry for dynamic workflows

4. **Pagination**: Enable "Return All" to automatically fetch all pages when reading logs

5. **Filtering**: Combine multiple filters for precise log queries:
   ```json
   {
     "since": "2024-01-15T00:00:00Z",
     "levels": ["ERROR"],
     "resourceTypes": "serverless.function",
     "filter": "message: \"database\""
   }
   ```

6. **Defaults**: Use default fields to avoid repetition when writing multiple similar log entries

7. **Batch Writing**: Include multiple entries in a single write operation for better performance

8. **Stream Names**: Use stream names to organize logs by application component or feature

## Permissions Required

Your service account needs the following roles:
- `logging.writer` - for writing log entries
- `logging.reader` - for reading log entries

## Related Documentation

- [Yandex Cloud Logging Documentation](https://yandex.cloud/en/docs/logging/)
- [Log Ingestion API](https://yandex.cloud/en/docs/logging/api-ref/grpc/LogIngestion/)
- [Log Reading API](https://yandex.cloud/en/docs/logging/api-ref/grpc/LogReading/)
- [Log Groups API](https://yandex.cloud/en/docs/logging/api-ref/grpc/LogGroup/)
