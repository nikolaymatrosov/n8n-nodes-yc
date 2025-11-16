
# Cloud Logging Service, gRPC: LogIngestionService.Write

Статья создана

[![](https://storage.yandexcloud.net/cloud-www-assets/constructor/content-program/icons/yandexcloud.svg)](https://yandex.cloud/ru)

[Yandex Cloud](https://yandex.cloud/ru)

Обновлена  17 декабря 2024 г.

Write log entries to specified destination.

## [](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogIngestion/write#grpc-request)gRPC request

**rpc Write ([WriteRequest](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogIngestion/write#yandex.cloud.logging.v1.WriteRequest)) returns ([WriteResponse](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogIngestion/write#yandex.cloud.logging.v1.WriteResponse))**

## [](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogIngestion/write#yandex.cloud.logging.v1.WriteRequest)WriteRequest

```
{
  "destination": {
    // Includes only one of the fields `log_group_id`, `folder_id`
    "log_group_id": "string",
    "folder_id": "string"
    // end of the list of possible fields
  },
  "resource": {
    "type": "string",
    "id": "string"
  },
  "entries": [
    {
      "timestamp": "google.protobuf.Timestamp",
      "level": "Level",
      "message": "string",
      "json_payload": "google.protobuf.Struct",
      "stream_name": "string"
    }
  ],
  "defaults": {
    "level": "Level",
    "json_payload": "google.protobuf.Struct",
    "stream_name": "string"
  }
}

```

Field

Description

destination

**[Destination](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogIngestion/write#yandex.cloud.logging.v1.Destination)**

Required field. Log entries destination.

See  [Destination](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogIngestion/write#yandex.cloud.logging.v1.Destination)  for details.

resource

**[LogEntryResource](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogIngestion/write#yandex.cloud.logging.v1.LogEntryResource)**

Common resource (type, ID) specification for log entries.

entries[]

**[IncomingLogEntry](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogIngestion/write#yandex.cloud.logging.v1.IncomingLogEntry)**

List of log entries.

defaults

**[LogEntryDefaults](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogIngestion/write#yandex.cloud.logging.v1.LogEntryDefaults)**

Log entries defaults.

See  [LogEntryDefaults](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogIngestion/write#yandex.cloud.logging.v1.LogEntryDefaults)  for details.

## [](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogIngestion/write#yandex.cloud.logging.v1.Destination)Destination

Field

Description

log_group_id

**string**

Entry should be written to log group resolved by ID.

Includes only one of the fields  `log_group_id`,  `folder_id`.

Entry destination.

folder_id

**string**

Entry should be written to default log group for the folder.

Includes only one of the fields  `log_group_id`,  `folder_id`.

Entry destination.

## [](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogIngestion/write#yandex.cloud.logging.v1.LogEntryResource)LogEntryResource

Log entry resource specification.

May be used either by services and by user.

Field

Description

type

**string**

Resource type, i.e.,  `serverless.function`

id

**string**

Resource ID, i.e., ID of the function producing logs.

## [](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogIngestion/write#yandex.cloud.logging.v1.IncomingLogEntry)IncomingLogEntry

Field

Description

timestamp

**[google.protobuf.Timestamp](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#timestamp)**

Required field. Timestamp of the entry.

level

enum  **Level**

Entry severity.

See  [LogLevel.Level](https://yandex.cloud/ru/docs/logging/api-ref/grpc/Export/run#yandex.cloud.logging.v1.LogLevel.Level)  for details.

- `LEVEL_UNSPECIFIED`: Default log level.

    Equivalent to not specifying log level at all.

- `TRACE`: Trace log level.

    Possible use case: verbose logging of some business logic.

- `DEBUG`: Debug log level.

    Possible use case: debugging special cases in application logic.

- `INFO`: Info log level.

    Mostly used for information messages.

- `WARN`: Warn log level.

    May be used to alert about significant events.

- `ERROR`: Error log level.

    May be used to alert about errors in infrastructure, logic, etc.

- `FATAL`: Fatal log level.

    May be used to alert about unrecoverable failures and events.

message

**string**

Entry text message.

json_payload

**[google.protobuf.Struct](https://developers.google.com/protocol-buffers/docs/reference/csharp/class/google/protobuf/well-known-types/struct)**

Entry annotation.

stream_name

**string**

Entry stream name.

## [](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogIngestion/write#yandex.cloud.logging.v1.LogEntryDefaults)LogEntryDefaults

Field

Description

level

enum  **Level**

Default entry severity.  
Will be applied if entry level is unspecified.

See  [LogLevel.Level](https://yandex.cloud/ru/docs/logging/api-ref/grpc/Export/run#yandex.cloud.logging.v1.LogLevel.Level)  for details.

- `LEVEL_UNSPECIFIED`: Default log level.

    Equivalent to not specifying log level at all.

- `TRACE`: Trace log level.

    Possible use case: verbose logging of some business logic.

- `DEBUG`: Debug log level.

    Possible use case: debugging special cases in application logic.

- `INFO`: Info log level.

    Mostly used for information messages.

- `WARN`: Warn log level.

    May be used to alert about significant events.

- `ERROR`: Error log level.

    May be used to alert about errors in infrastructure, logic, etc.

- `FATAL`: Fatal log level.

    May be used to alert about unrecoverable failures and events.

json_payload

**[google.protobuf.Struct](https://developers.google.com/protocol-buffers/docs/reference/csharp/class/google/protobuf/well-known-types/struct)**

Default entry annotation.  
Will be merged with entry annotation.  
Any conflict will be resolved in favor of entry own annotation.

stream_name

**string**

Entry stream name.

## [](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogIngestion/write#yandex.cloud.logging.v1.WriteResponse)WriteResponse

```
{
  "errors": "map<int64, google.rpc.Status>"
}

```

Field

Description

errors

**object**  (map<**int64**,  **[google.rpc.Status](https://cloud.google.com/tasks/docs/reference/rpc/google.rpc#status)**>)

The error result of the operation in case of failure or cancellation.

# Cloud Logging Service, gRPC: LogReadingService.Read

Статья создана

[![](https://storage.yandexcloud.net/cloud-www-assets/constructor/content-program/icons/yandexcloud.svg)](https://yandex.cloud/ru)

[Yandex Cloud](https://yandex.cloud/ru)

Обновлена  26 ноября 2024 г.

Read log entries from the specified log group.

## [](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogReading/read#grpc-request)gRPC request

**rpc Read ([ReadRequest](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogReading/read#yandex.cloud.logging.v1.ReadRequest)) returns ([ReadResponse](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogReading/read#yandex.cloud.logging.v1.ReadResponse))**

## [](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogReading/read#yandex.cloud.logging.v1.ReadRequest)ReadRequest

```
{
  // Includes only one of the fields `page_token`, `criteria`
  "page_token": "string",
  "criteria": {
    "log_group_id": "string",
    "resource_types": [
      "string"
    ],
    "resource_ids": [
      "string"
    ],
    "since": "google.protobuf.Timestamp",
    "until": "google.protobuf.Timestamp",
    "levels": [
      "Level"
    ],
    "filter": "string",
    "stream_names": [
      "string"
    ],
    "page_size": "int64",
    "max_response_size": "int64"
  }
  // end of the list of possible fields
}

```

Field

Description

page_token

**string**

Page token. To get the next page of results, set  `page_token`  to the  
[ReadResponse.next_page_token](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogReading/read#yandex.cloud.logging.v1.ReadResponse)  or  [ReadResponse.previous_page_token](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogReading/read#yandex.cloud.logging.v1.ReadResponse)  returned by a previous read request.

Includes only one of the fields  `page_token`,  `criteria`.

Read selector.

criteria

**[Criteria](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogReading/read#yandex.cloud.logging.v1.Criteria)**

Read criteria.

See  [Criteria](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogReading/read#yandex.cloud.logging.v1.Criteria)  for details.

Includes only one of the fields  `page_token`,  `criteria`.

Read selector.

## [](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogReading/read#yandex.cloud.logging.v1.Criteria)Criteria

Read criteria. Should be used in initial  [ReadRequest](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogReading/read#yandex.cloud.logging.v1.ReadRequest).

Field

Description

log_group_id

**string**

Required field. ID of the log group to return.

To get a log group ID make a  [LogGroupService.List](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogGroup/list#List)  request.

resource_types[]

**string**

List of resource types to limit log entries to.

Empty list disables filter.

resource_ids[]

**string**

List of resource IDs to limit log entries to.

Empty list disables filter.

since

**[google.protobuf.Timestamp](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#timestamp)**

Lower bound of log entries timestamps.

until

**[google.protobuf.Timestamp](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#timestamp)**

Upper bound of log entries timestamps.

levels[]

enum  **Level**

List of log levels to limit log entries to.

Empty list disables filter.

- `LEVEL_UNSPECIFIED`: Default log level.

    Equivalent to not specifying log level at all.

- `TRACE`: Trace log level.

    Possible use case: verbose logging of some business logic.

- `DEBUG`: Debug log level.

    Possible use case: debugging special cases in application logic.

- `INFO`: Info log level.

    Mostly used for information messages.

- `WARN`: Warn log level.

    May be used to alert about significant events.

- `ERROR`: Error log level.

    May be used to alert about errors in infrastructure, logic, etc.

- `FATAL`: Fatal log level.

    May be used to alert about unrecoverable failures and events.

filter

**string**

Filter expression. For details about filtering, see  [documentation](https://yandex.cloud/ru/docs/logging/concepts/filter).

stream_names[]

**string**

List of stream names to limit log entries to.

Empty list disables filter.

page_size

**int64**

The maximum number of results per page to return.

max_response_size

**int64**

Limits response to maximum size in bytes. Prevents gRPC resource exhaustion.

Default value for max response size is 3.5 MiB

## [](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogReading/read#yandex.cloud.logging.v1.ReadResponse)ReadResponse

```
{
  "log_group_id": "string",
  "entries": [
    {
      "uid": "string",
      "resource": {
        "type": "string",
        "id": "string"
      },
      "timestamp": "google.protobuf.Timestamp",
      "ingested_at": "google.protobuf.Timestamp",
      "saved_at": "google.protobuf.Timestamp",
      "level": "Level",
      "message": "string",
      "json_payload": "google.protobuf.Struct",
      "stream_name": "string"
    }
  ],
  "next_page_token": "string",
  "previous_page_token": "string"
}

```

Field

Description

log_group_id

**string**

Log group ID the read was performed from.

entries[]

**[LogEntry](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogReading/read#yandex.cloud.logging.v1.LogEntry)**

List of matching log entries.

next_page_token

**string**

Token for getting the next page of the log entries.

After getting log entries initially with  [Criteria](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogReading/read#yandex.cloud.logging.v1.Criteria), you can use  `next_page_token`  as the value  
for the  [ReadRequest.page_token](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogReading/read#yandex.cloud.logging.v1.ReadRequest)  parameter in the next read request.

Each subsequent page will have its own  `next_page_token`  to continue paging through the results.

previous_page_token

**string**

Token for getting the previous page of the log entries.

After getting log entries initially with  [Criteria](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogReading/read#yandex.cloud.logging.v1.Criteria), you can use  `previous_page_token`  as the value  
for the  [ReadRequest.page_token](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogReading/read#yandex.cloud.logging.v1.ReadRequest)  parameter in the next read request.

Each subsequent page will have its own  `next_page_token`  to continue paging through the results.

## [](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogReading/read#yandex.cloud.logging.v1.LogEntry)LogEntry

Field

Description

uid

**string**

Unique entry ID.

Useful for logs deduplication.

resource

**[LogEntryResource](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogReading/read#yandex.cloud.logging.v1.LogEntryResource)**

Entry resource specification.

May contain information about source service and resource ID.  
Also may be provided by the user.

timestamp

**[google.protobuf.Timestamp](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#timestamp)**

Timestamp of the entry.

ingested_at

**[google.protobuf.Timestamp](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#timestamp)**

Entry ingestion time observed by  [LogIngestionService](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogIngestion/).

saved_at

**[google.protobuf.Timestamp](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#timestamp)**

Entry save time.

Entry is ready to be read since this moment.

level

enum  **Level**

Entry severity.

See  [LogLevel.Level](https://yandex.cloud/ru/docs/logging/api-ref/grpc/Export/run#yandex.cloud.logging.v1.LogLevel.Level)  for details.

- `LEVEL_UNSPECIFIED`: Default log level.

    Equivalent to not specifying log level at all.

- `TRACE`: Trace log level.

    Possible use case: verbose logging of some business logic.

- `DEBUG`: Debug log level.

    Possible use case: debugging special cases in application logic.

- `INFO`: Info log level.

    Mostly used for information messages.

- `WARN`: Warn log level.

    May be used to alert about significant events.

- `ERROR`: Error log level.

    May be used to alert about errors in infrastructure, logic, etc.

- `FATAL`: Fatal log level.

    May be used to alert about unrecoverable failures and events.

message

**string**

Entry text message.

json_payload

**[google.protobuf.Struct](https://developers.google.com/protocol-buffers/docs/reference/csharp/class/google/protobuf/well-known-types/struct)**

Entry annotation.

stream_name

**string**

Entry stream name.

## [](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogReading/read#yandex.cloud.logging.v1.LogEntryResource)LogEntryResource

Log entry resource specification.

May be used either by services and by user.

Field

Description

type

**string**

Resource type, i.e.,  `serverless.function`

id

**string**

Resource ID, i.e., ID of the function producing logs.

# Cloud Logging Service, gRPC: LogGroupService.List

Статья создана

[![](https://storage.yandexcloud.net/cloud-www-assets/constructor/content-program/icons/yandexcloud.svg)](https://yandex.cloud/ru)

[Yandex Cloud](https://yandex.cloud/ru)

Обновлена  17 декабря 2024 г.

Retrieves the list of log groups in the specified folder.

## [](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogGroup/list#grpc-request)gRPC request

**rpc List ([ListLogGroupsRequest](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogGroup/list#yandex.cloud.logging.v1.ListLogGroupsRequest)) returns ([ListLogGroupsResponse](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogGroup/list#yandex.cloud.logging.v1.ListLogGroupsResponse))**

## [](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogGroup/list#yandex.cloud.logging.v1.ListLogGroupsRequest)ListLogGroupsRequest

```
{
  "folder_id": "string",
  "page_size": "int64",
  "page_token": "string",
  "filter": "string"
}

```

Field

Description

folder_id

**string**

Required field. Folder ID of the log groups to return.

To get a folder ID make a  [yandex.cloud.resourcemanager.v1.FolderService.List](https://yandex.cloud/ru/docs/resource-manager/api-ref/grpc/Folder/list#List)  request.

page_size

**int64**

The maximum number of results per page to return. If the number of available  
results is larger than  `page_size`, the service returns a  [ListLogGroupsResponse.next_page_token](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogGroup/list#yandex.cloud.logging.v1.ListLogGroupsResponse)  
that can be used to get the next page of results in subsequent list requests.

Default value: 100.

page_token

**string**

Page token. To get the next page of results, set  `page_token`  to the  
[ListLogGroupsResponse.next_page_token](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogGroup/list#yandex.cloud.logging.v1.ListLogGroupsResponse)  returned by a previous list request.

filter

**string**

A filter expression that filters log groups listed in the response.

The expression must specify:

1. The field name. Currently filtering can only be applied to the  [LogGroup.name](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogGroup/list#yandex.cloud.logging.v1.LogGroup)  field.
2. An  `=`  operator.
3. The value in double quotes (`"`). Must be 3-63 characters long and match the regular expression  `[a-z][-a-z0-9]{1,61}[a-z0-9]`.  
    Example of a filter:  `name=my-log-group`.

## [](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogGroup/list#yandex.cloud.logging.v1.ListLogGroupsResponse)ListLogGroupsResponse

```
{
  "groups": [
    {
      "id": "string",
      "folder_id": "string",
      "cloud_id": "string",
      "created_at": "google.protobuf.Timestamp",
      "name": "string",
      "description": "string",
      "labels": "map<string, string>",
      "status": "Status",
      "retention_period": "google.protobuf.Duration",
      "data_stream": "string"
    }
  ],
  "next_page_token": "string"
}

```

Field

Description

groups[]

**[LogGroup](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogGroup/list#yandex.cloud.logging.v1.LogGroup)**

List of log groups in the specified folder.

next_page_token

**string**

Token for getting the next page of the list. If the number of results is greater than  
the specified  [ListLogGroupsRequest.page_size](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogGroup/list#yandex.cloud.logging.v1.ListLogGroupsRequest), use  `next_page_token`  as the value  
for the  [ListLogGroupsRequest.page_token](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogGroup/list#yandex.cloud.logging.v1.ListLogGroupsRequest)  parameter in the next list request.

Each subsequent page will have its own  `next_page_token`  to continue paging through the results.

## [](https://yandex.cloud/ru/docs/logging/api-ref/grpc/LogGroup/list#yandex.cloud.logging.v1.LogGroup)LogGroup

Field

Description

id

**string**

Log group ID.

folder_id

**string**

Log group folder ID.

cloud_id

**string**

Log group cloud ID.

created_at

**[google.protobuf.Timestamp](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#timestamp)**

Log group creation time.

name

**string**

Log group name.

description

**string**

Log group description.

labels

**object**  (map<**string**,  **string**>)

Log group labels.

status

enum  **Status**

Status of the log group.

- `STATUS_UNSPECIFIED`: Unknown status.

    Should never occur.

- `CREATING`: Log group is creating.

- `ACTIVE`: Log group is ready to accept messages,

- `DELETING`: Log group is being deleted.

    No messages will be accepted.

- `ERROR`: Log group is in failed state.

retention_period

**[google.protobuf.Duration](https://developers.google.com/protocol-buffers/docs/reference/csharp/class/google/protobuf/well-known-types/duration)**

Log group entry retention period.

Entries will be present in group during this period.

data_stream

**string**

Data stream name
