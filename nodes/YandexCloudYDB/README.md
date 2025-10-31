## Yandex Cloud YDB Node

The YDB node allows you to interact with Yandex Database (YDB), a distributed SQL database, directly from your n8n workflows.

### Features

- Execute YQL (Yandex Query Language) queries
- Parameterized queries for secure data handling
- Automatic JSON to YDB type conversion
- Multiple result set handling
- Flexible return modes

### Prerequisites

1. **Yandex Cloud Account** with YDB database
2. **Service Account** with appropriate permissions (e.g., `ydb.editor`)
3. **Service Account JSON Key** configured in n8n credentials

### Configuration

The YDB node uses a dual credential approach, separating authentication from connection parameters for better security and reusability.

#### Required Credentials

You need to configure **both** credential types:

**1. Yandex Cloud Service Account Credentials** (`yandexCloudAuthorizedApi`)

Contains your service account authentication:

**Setup:**
1. Go to **Credentials** → **New**
2. Select **Yandex Cloud Authorized API**
3. Fill in:
   - **Service Account JSON**: Your service account key
   - **Folder ID**: (optional) Default folder ID
4. Save the credential

**2. YDB Connection Parameters** (`yandexCloudYdbApi`)

Contains YDB-specific connection details:

**Setup:**
1. Go to **Credentials** → **New**
2. Select **Yandex Cloud YDB API**
3. Fill in:
   - **Endpoint**: `grpcs://ydb.serverless.yandexcloud.net:2135`
   - **Database**: `/ru-central1/b1gxxxxxxxxxx/etnxxxxxxxxxx`
4. Save the credential

#### Usage

- Add YDB node to workflow
- Select your **Yandex Cloud Authorized API** credential
- Select your **Yandex Cloud YDB API** credential
- Write your query
- Done!

#### Benefits of Dual Credential Approach

- **Security**: Service account JSON separated from connection parameters
- **Reusability**: Use one service account with multiple databases
- **Flexibility**: Easily switch between dev/staging/prod databases
- **Clarity**: Clear separation of authentication vs connection concerns
- **Multi-environment**: Create one YDB credential per environment (dev/prod)


### Usage Examples

#### Example 1: Simple Query

Execute a simple SELECT query to retrieve all users:

**Configuration:**
- **Resource**: Query
- **Operation**: Execute
- **YQL Query**:
  ```sql
  SELECT id, name, email, created_at
  FROM users
  WHERE active = true
  ORDER BY created_at DESC
  LIMIT 10
  ```
- **Return Mode**: First Result Set

**Output:**
```json
{
  "rows": [
    {"id": 1, "name": "Alice", "email": "alice@example.com", "created_at": "2025-10-29T10:00:00Z"},
    {"id": 2, "name": "Bob", "email": "bob@example.com", "created_at": "2025-10-29T09:30:00Z"}
  ],
  "rowCount": 2
}
```

---

#### Example 2: Parameterized Query (Secure)

Use parameterized queries to safely pass dynamic values from previous nodes:

**Configuration:**
- **Resource**: Query
- **Operation**: Execute with Parameters
- **YQL Query**:
  ```sql
  SELECT * FROM orders
  WHERE user_id = $userId
    AND order_date >= $startDate
    AND status = $status
  ```
- **Query Parameters**:
  | Name | Value |
  |------|-------|
  | `userId` | `{{ $json.user_id }}` |
  | `startDate` | `2025-01-01` |
  | `status` | `completed` |
- **Return Mode**: First Result Set

**Input from previous node:**
```json
{
  "user_id": 12345
}
```

**Output:**
```json
{
  "rows": [
    {"order_id": 1001, "user_id": 12345, "total": 99.99, "status": "completed"},
    {"order_id": 1005, "user_id": 12345, "total": 149.50, "status": "completed"}
  ],
  "rowCount": 2
}
```

---

#### Example 3: Insert Data from Workflow

Insert data collected from previous nodes into YDB:

**Configuration:**
- **Operation**: Execute with Parameters
- **YQL Query**:
  ```sql
  UPSERT INTO users (id, name, email, created_at)
  VALUES ($id, $name, $email, CurrentUtcTimestamp())
  ```
- **Query Parameters**:
  | Name | Value |
  |------|-------|
  | `id` | `{{ $json.id }}` |
  | `name` | `{{ $json.name }}` |
  | `email` | `{{ $json.email }}` |
- **Return Mode**: First Result Set

**Input from previous node:**
```json
{
  "id": 123,
  "name": "Charlie",
  "email": "charlie@example.com"
}
```

---

#### Example 4: Batch Insert from Array

Insert multiple records using AS_TABLE:

**Configuration:**
- **Operation**: Execute
- **YQL Query**:
  ```sql
  UPSERT INTO products
  SELECT * FROM AS_TABLE($rows)
  ```
- **Query Parameters**:
  | Name | Value |
  |------|-------|
  | `rows` | `{{ $json.products }}` (array of objects) |

**Input from previous node:**
```json
{
  "products": [
    {"id": 1, "name": "Widget A", "price": 10.99},
    {"id": 2, "name": "Widget B", "price": 15.99},
    {"id": 3, "name": "Widget C", "price": 20.99}
  ]
}
```

---

#### Example 5: Multiple Result Sets

Execute multiple queries and get all result sets:

**Configuration:**
- **Operation**: Execute
- **YQL Query**:
  ```sql
  SELECT COUNT(*) as total_users FROM users;
  SELECT COUNT(*) as total_orders FROM orders;
  SELECT COUNT(*) as total_products FROM products;
  ```
- **Return Mode**: All Result Sets

**Output:**
```json
{
  "resultSets": [
    [{"total_users": 1500}],
    [{"total_orders": 8234}],
    [{"total_products": 450}]
  ],
  "resultSetCount": 3,
  "totalRows": 3
}
```

---

#### Example 6: Get Single Value

Retrieve a single value (e.g., count, max, aggregate):

**Configuration:**
- **Operation**: Execute with Parameters
- **YQL Query**:
  ```sql
  SELECT MAX(order_date) as last_order
  FROM orders
  WHERE user_id = $userId
  ```
- **Query Parameters**:
  | Name | Value |
  |------|-------|
  | `userId` | `{{ $json.user_id }}` |
- **Return Mode**: First Row Only

**Output:**
```json
{
  "last_order": "2025-10-28T14:22:10Z"
}
```

---

#### Example 7: Data Transformation Pipeline

Combine with other n8n nodes for ETL workflows:

**Workflow:**
1. **HTTP Request** → Fetch data from external API
2. **Function** → Transform and validate data
3. **Yandex Cloud YDB** → Store in database
4. **Slack** → Send notification on success

**YDB Node Configuration:**
- **YQL Query**:
  ```sql
  UPSERT INTO analytics_events (event_id, user_id, event_type, data, timestamp)
  VALUES ($eventId, $userId, $eventType, $data, CurrentUtcTimestamp())
  ```

---

### Return Modes Explained

| Mode | Description | Use Case |
|------|-------------|----------|
| **All Result Sets** | Returns all result sets from the query | Multi-statement queries, statistics gathering |
| **First Result Set** | Returns only the first result set as an array | Standard SELECT queries |
| **First Row Only** | Returns only the first row as an object | Aggregates, single record lookups |

### Data Type Handling

The node automatically converts between JavaScript and YDB types:

| JavaScript Type | YDB Type | Example |
|----------------|----------|---------|
| `string` | `Text/String` | `"hello"` → `Text` |
| `number` (integer) | `Int32` | `42` → `Int32` |
| `number` (float) | `Double` | `3.14` → `Double` |
| `bigint` | `Int64` | `9007199254740991n` → `Int64` |
| `boolean` | `Bool` | `true` → `Bool` |
| `Date` | `Datetime` | `new Date()` → `Datetime` |
| `Array` | `List` | `[1, 2, 3]` → `List<Int32>` |
| `Object` | `Struct` | `{a: 1}` → `Struct<a:Int32>` |
| `null` | `Null/Optional` | `null` → `Optional` |

### Best Practices

1. **Use Parameterized Queries**: Always use parameters for dynamic values to prevent SQL injection
2. **Handle Errors**: Enable "Continue on Fail" for production workflows
3. **Optimize Queries**: Use indexes and appropriate WHERE clauses for large tables
4. **Batch Operations**: Use AS_TABLE for inserting multiple records efficiently
5. **Connection Pooling**: The node creates a new connection per execution (automatically managed)

### Troubleshooting

**Error: "Invalid service account JSON credentials"**
- Verify your Service Account JSON key is valid
- Ensure all required fields are present: `service_account_id`, `id`/`access_key_id`, `private_key`

**Error: "Both endpoint and database are required"**
- Check that both endpoint and database path are correctly configured
- Endpoint format: `grpcs://hostname:port`
- Database format: `/region/folder-id/database-id`

**Error: "Query syntax error"**
- Verify YQL syntax is correct
- Check parameter names match between query and parameter list
- Use YDB documentation for YQL reference

**Timeout or Connection Issues**
- Verify network connectivity to YDB endpoint
- Check Service Account has proper permissions
- Ensure database exists and is accessible

### Resources

- [YDB Documentation](https://ydb.tech/docs)
- [YQL Query Language Reference](https://ydb.tech/docs/yql/reference/)
- [YDB SDK Documentation](https://github.com/ydb-platform/ydb-nodejs-sdk)
- [Yandex Cloud Console](https://console.cloud.yandex.com/folders)

---

## Need Help?

- Report issues on [GitHub](https://github.com/nikolaymatrosov/n8n-nodes-yc/issues)
- Check [n8n Community](https://community.n8n.io/)
- Review [Yandex Cloud Documentation](https://cloud.yandex.com/docs)
