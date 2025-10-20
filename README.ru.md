# Описание нод пакета n8n-nodes-yc

Пакет интеграций для работы с сервисами Yandex Cloud в n8n.

## Содержание

1. [Yandex Cloud GPT Chat Model](#yandex-cloud-gpt-chat-model)
2. [Yandex Cloud GPT](#yandex-cloud-gpt)
3. [Yandex Object Storage](#yandex-object-storage)
4. [Yandex Cloud Functions](#yandex-cloud-functions)
5. [Yandex Cloud Containers](#yandex-cloud-containers)
6. [Yandex Cloud Compute](#yandex-cloud-compute)
7. [Yandex Cloud Data Streams](#yandex-cloud-data-streams)
8. [Yandex Cloud Message Queue](#yandex-cloud-message-queue)
9. [Yandex Cloud Postbox](#yandex-cloud-postbox)
10. [Yandex Cloud SpeechKit](#yandex-cloud-speechkit)
11. [Yandex Cloud Workflows](#yandex-cloud-workflows)

---

## Yandex Cloud GPT Chat Model

**Нода для интеграции с Yandex Cloud Foundation Models API в качестве языковой модели для LangChain.** Эта нода является компонентом AI-цепочек и представляет собой Chat Model, совместимую с фреймворком LangChain. Предназначена для продвинутого использования в AI-агентах и цепочках обработки (AI Chain, AI Agent). Нода не имеет входов и выводит объект языковой модели, который можно подключать к другим AI-компонентам n8n.

| Параметр | Тип | Описание |
|----------|-----|----------|
| **Model** | Resource Locator | ID модели YandexGPT (например, `yandexgpt/latest`) |
| **Maximum Tokens** | Number | Максимальное количество токенов в ответе (до 8000) |
| **Temperature** | Number | Контроль случайности генерации (0-1, по умолчанию 0.6) |
| **Timeout** | Number | Таймаут запроса в миллисекундах (по умолчанию 60000) |
| **Max Retries** | Number | Максимальное количество повторных попыток (по умолчанию 2) |

**Аутентификация:** Использует API ключ через credentials `yandexCloudGptApi` с передачей folder ID в заголовке `x-folder-id`. Поддерживает настройку базового URL API (по умолчанию `https://api.studio.yandex-team.ru/v1`). Нода совместима с OpenAI API протоколом, что позволяет использовать стандартные LangChain инструменты. Идеально подходит для создания чат-ботов, RAG-систем и AI-агентов с использованием российских языковых моделей.

---

## Yandex Cloud GPT

**Нода для работы с Foundation Models API Yandex Cloud, предоставляющая прямой доступ к генеративным языковым моделям YandexGPT через REST API.** В отличие от Chat Model версии, эта нода работает как обычная трансформационная нода с входами и выходами Main-типа, позволяя отправлять запросы к API и получать JSON-ответы в контексте стандартного workflow.

| Параметр | Тип | Описание |
|----------|-----|----------|
| **Resource** | Options | Тип ресурса (Chat) |
| **Operation** | Options | Операция для выполнения |

**Ресурсы и операции:**
- **Chat** - работа с чат-функциональностью модели

**Аутентификация:** Использует API ключ через credentials `yandexCloudGptApi`. Поддерживает настройку базового URL и автоматическую обработку HTTP ошибок (ignoreHttpStatusErrors). Нода подходит для простых сценариев генерации текста, где не требуется сложная интеграция с LangChain, но нужна прямая работа с API Yandex Cloud для создания диалогов, генерации контента и обработки естественного языка в автоматизированных процессах.

---

## Yandex Object Storage

**Нода для полноценного управления объектным хранилищем Yandex Cloud, совместимым с Amazon S3 API.** Предоставляет исчерпывающий набор операций для работы как с bucket'ами (контейнерами), так и с объектами (файлами), используя AWS SDK для обеспечения максимальной совместимости и надежности.

| Параметр | Тип | Ресурсы | Операции |
|----------|-----|---------|----------|
| **Bucket** | Resource | Bucket | Create, Delete, Get, List, Set ACL, Set Versioning |
| **Object** | Resource | Object | Upload, Download, Copy, Move, Delete, Get, List, Set ACL, Get Presigned URL |

**Операции с Bucket:**
- **Create** - создание нового bucket с настройкой ACL
- **Delete** - удаление пустого bucket
- **Get** - получение информации о bucket (location, metadata)
- **List** - перечисление всех доступных bucket'ов
- **Set ACL** - настройка прав доступа (private, public-read, public-read-write, authenticated-read)
- **Set Versioning** - включение/отключение версионирования объектов

**Операции с Object:**
- **Upload** - загрузка из бинарных данных, текста или JSON с настройкой content-type, storage class (Standard/Cold/Ice) и метаданных
- **Download** - скачивание объекта в бинарный формат
- **Copy** - копирование между bucket'ами с сохранением метаданных
- **Move** - перемещение с автоматическим удалением источника
- **Delete** - удаление объекта
- **Get** - получение метаданных (size, content-type, ETag, версия)
- **List** - перечисление объектов с фильтрацией по префиксу и пагинацией (до 1000 объектов)
- **Set ACL** - настройка прав доступа на уровне объекта
- **Get Presigned URL** - генерация временных подписанных URL для безопасного доступа

**Аутентификация:** Использует статические ключи доступа (access key ID и secret access key) через credentials `yandexCloudStaticApi`. Поддерживает resource locator для удобного выбора bucket'ов из списка или ввода имени вручную. Нода идеально подходит для резервного копирования, хранения файлов пользователей, CDN-интеграций и организации data lake в облаке.

---

## Yandex Cloud Functions

**Нода для вызова serverless-функций в Yandex Cloud Functions через HTTP-эндпоинты.** Позволяет запускать облачные функции с передачей параметров и получением результатов выполнения, автоматически управляя аутентификацией через IAM-токены.

| Параметр | Тип | Описание |
|----------|-----|----------|
| **Folder ID** | String | ID папки для поиска функций (по умолчанию из credentials) |
| **Function** | Options | Выбор функции из списка или указание ID |
| **HTTP Method** | Options | GET или POST |
| **Request Body** | String (JSON) | Тело запроса для POST-метода |
| **Query Parameters** | Collection | Коллекция query-параметров (name/value) |
| **Headers** | Collection | Дополнительные HTTP-заголовки |

**Процесс выполнения:**
1. Автоматическая загрузка списка доступных функций из указанной папки через SDK
2. Получение IAM-токена из service account credentials
3. Формирование HTTP-запроса к эндпоинту `https://functions.yandexcloud.net/{functionId}`
4. Добавление заголовка Authorization с Bearer-токеном
5. Выполнение запроса и парсинг ответа (автоматическое определение JSON)

**Возвращаемые данные:**
- `statusCode` - HTTP статус ответа
- `headers` - заголовки ответа
- `body` - тело ответа (объект или строка)

**Аутентификация:** Использует service account JSON через credentials `yandexCloudAuthorizedApi` для автоматического получения IAM-токенов. Валидирует JSON-тело запроса перед отправкой. Нода идеально подходит для интеграции бизнес-логики, написанной на Python, Node.js, Go и других языках, в n8n workflows, обеспечивая возможность выполнения сложных вычислений и обработки данных в serverless-архитектуре.

---

## Yandex Cloud Containers

**Нода для вызова serverless-контейнеров в Yandex Cloud Serverless Containers, предоставляющая возможность запуска контейнеризированных приложений через HTTP.** Функционал аналогичен Yandex Cloud Functions, но работает с Docker-контейнерами, что позволяет использовать любые зависимости и окружения.

| Параметр | Тип | Описание |
|----------|-----|----------|
| **Folder ID** | String | ID папки для поиска контейнеров |
| **Container** | Options | Выбор контейнера из списка или указание ID |
| **HTTP Method** | Options | GET или POST |
| **Request Body** | String (JSON) | Тело запроса для POST-метода |
| **Query Parameters** | Collection | URL-параметры запроса |
| **Headers** | Collection | Пользовательские HTTP-заголовки |

**Процесс работы:**
1. Загрузка списка доступных контейнеров через SDK
2. Получение URL контейнера (поле `url`)
3. Генерация IAM-токена для аутентификации
4. Выполнение HTTP-запроса к URL контейнера
5. Обработка и возврат ответа

**Возвращаемые данные:**
- `statusCode` - HTTP код ответа
- `headers` - заголовки ответа
- `body` - тело ответа (автоматический парсинг JSON)

**Аутентификация:** Service account JSON с автоматическим получением IAM-токенов через `yandexCloudAuthorizedApi`. Поддерживает валидацию JSON перед отправкой. Отличается от Functions тем, что использует полные Docker-образы, что дает больше гибкости в выборе runtime, библиотек и системных зависимостей. Подходит для запуска ML-моделей, сложных приложений с множеством зависимостей и микросервисов в рамках n8n workflows.

---

## Yandex Cloud Compute

**Нода для управления виртуальными машинами в Yandex Compute Cloud, предоставляющая базовые операции запуска и остановки инстансов.** Использует официальный Yandex Cloud SDK для взаимодействия с Compute API.

| Параметр | Тип | Описание |
|----------|-----|----------|
| **Resource** | Options | Тип ресурса (Instance) |
| **Operation** | Options | Start или Stop |
| **Folder ID** | String | ID папки с виртуальными машинами |
| **Instance** | Options | Выбор VM из списка или указание ID |

**Операции:**
- **Start** - запуск остановленной виртуальной машины
- **Stop** - остановка работающей виртуальной машины

**Процесс выполнения:**
1. Парсинг service account JSON credentials
2. Создание SDK сессии с аутентификацией
3. Получение списка инстансов из указанной папки
4. Выполнение операции start/stop через InstanceServiceClient
5. Возврат информации об операции

**Возвращаемые данные:**
- `success` - статус выполнения
- `operation` - тип операции (start/stop)
- `instanceId` - ID виртуальной машины
- `operationId` - ID операции в Yandex Cloud
- `done` - завершена ли операция
- `metadata` - метаданные операции

**Аутентификация:** Service account JSON через `yandexCloudAuthorizedApi` с валидацией обязательных полей (serviceAccountId, accessKeyId, privateKey). Нода показывает статус VM при выборе из списка (RUNNING, STOPPED и т.д.). Идеально подходит для автоматизации управления инфраструктурой: запуск VM по расписанию, остановка для экономии средств, интеграция с мониторингом и системами оповещения.

---

## Yandex Cloud Data Streams

**Нода для работы с потоковой обработкой данных через Yandex Cloud Data Streams (YDS), совместимый с Apache Kafka и Amazon Kinesis API.** Обеспечивает высокопроизводительную передачу данных между приложениями с гарантией доставки и порядка сообщений.

| Параметр | Тип | Ресурсы | Операции |
|----------|-----|---------|----------|
| **Record** | Resource | Record | Put, Put Multiple |
| **Stream** | Resource | Stream | Describe, List |

**Операции с Record:**
- **Put** - отправка одной записи с выбором типа данных (String/JSON), указанием partition key и опциональных параметров (explicit hash key, sequence number)
- **Put Multiple** - пакетная отправка записей в двух режимах:
  - **Define Records** - ручное определение записей через UI
  - **Use Input Data** - автоматическое использование входящих элементов с маппингом полей

**Операции со Stream:**
- **Describe** - получение детальной информации о потоке (статус, retention period, shards, encryption)
- **List** - перечисление всех доступных потоков с лимитом

**Параметры отправки:**
- `streamName` - имя потока (формат: `/ru-central1/{folder-id}/{database-id}/{stream-name}`)
- `data` - данные для отправки (строка или JSON)
- `partitionKey` - ключ для определения shard'а
- `explicitHashKey` - явное указание hash для routing
- `dataField` - поле с данными при использовании input data
- `partitionKeyField` - поле с partition key

**Возвращаемые данные:**
- Для Put: `shardId`, `sequenceNumber`, `encryptionType`
- Для Put Multiple: `successCount`, `failedCount`, детальная информация по каждой записи
- Для Describe: полная информация о потоке, shards с hash ranges
- Для List: список имен потоков

**Аутентификация:** Статические ключи через `yandexCloudStaticApi`, использует Kinesis-совместимый endpoint. Поддерживает resource locator для удобного выбора потоков. Нода подходит для построения real-time аналитики, потоковой ETL-обработки, сбора логов и метрик, интеграции микросервисов с гарантией доставки сообщений и возможностью горизонтального масштабирования через sharding.

---

## Yandex Cloud Message Queue

**Нода для отправки сообщений в очереди Yandex Cloud Message Queue (YMQ), полностью совместимые с Amazon SQS API.** Предоставляет надежную асинхронную передачу сообщений между компонентами распределенных систем с поддержкой FIFO и стандартных очередей.

| Параметр | Тип | Описание |
|----------|-----|----------|
| **Resource** | Options | Message |
| **Operation** | Options | Send |
| **Queue** | Resource Locator | Выбор очереди из списка или указание URL |
| **Message Body** | String | Содержимое сообщения (до 256 KB) |

**Дополнительные поля:**
- **Delay Seconds** - задержка доставки сообщения (0-900 секунд)
- **Message Deduplication ID** - токен для дедупликации (обязателен для FIFO)
- **Message Group ID** - группировка сообщений (обязателен для FIFO)

**Message Attributes:**
Коллекция атрибутов сообщения с настройкой:
- `name` - имя атрибута
- `dataType` - тип данных (String, Number, Binary)
- `value` - значение атрибута

**Возвращаемые данные:**
- `messageId` - уникальный ID сообщения
- `md5OfMessageBody` - MD5 хеш тела сообщения
- `md5OfMessageAttributes` - MD5 хеш атрибутов
- `sequenceNumber` - порядковый номер (для FIFO)
- `success` - статус отправки
- `queueUrl` - URL очереди

**Аутентификация:** Статические ключи через `yandexCloudStaticApi`, использует endpoint `https://message-queue.api.cloud.yandex.net`. Поддерживает как стандартные очереди (at-least-once delivery, best-effort ordering), так и FIFO-очереди (exactly-once processing, strict ordering). Нода идеально подходит для построения event-driven архитектур, разделения монолитов на микросервисы, буферизации нагрузки между компонентами, обработки фоновых задач и обеспечения отказоустойчивости через асинхронную коммуникацию.

---

## Yandex Cloud Postbox

**Нода для отправки транзакционных email через Yandex Cloud Postbox, использующий Amazon SES v2 API.** Предоставляет надежную доставку писем с поддержкой HTML-шаблонов и переменных, с гарантированной репутацией IP-адресов Yandex Cloud.

| Параметр | Тип | Описание |
|----------|-----|----------|
| **Resource** | Options | Email |
| **Operation** | Options | Send |
| **Email Type** | Options | Simple или Template |
| **From Email** | String | Email отправителя (домен должен быть верифицирован) |
| **To Email** | String | Email получателя (можно несколько через запятую) |

**Simple Email (простой режим):**
- **Subject** - тема письма
- **HTML Body** - HTML-версия письма
- **Text Body** - текстовая версия для клиентов без HTML

**Template Email (шаблонный режим):**
- **Template Subject** - тема с переменными `{{variable}}`
- **Template HTML** - HTML-шаблон с плейсхолдерами
- **Template Text** - текстовая версия шаблона (опционально)
- **Template Data** - JSON-объект с данными для подстановки

**Процесс отправки:**
1. Парсинг списка получателей (разделение по запятой)
2. Формирование структуры Content (Simple или Template)
3. Подстановка переменных в шаблон (если используется)
4. Отправка через SES API с charset UTF-8
5. Получение Message ID

**Возвращаемые данные:**
- `messageId` - уникальный ID отправленного письма
- `success` - статус отправки
- `from` - адрес отправителя
- `to` - массив адресов получателей
- `subject` - тема письма
- `emailType` - тип письма (simple/template)

**Аутентификация:** Статические ключи через `yandexCloudStaticApi`, использует endpoint `https://postbox.cloud.yandex.net`. Требует предварительной верификации домена в Yandex Cloud. Поддерживает множественных получателей и шаблонизацию для персонализации. Нода подходит для отправки уведомлений, подтверждений регистрации, сброса паролей, отчетов, маркетинговых рассылок и любых транзакционных email с высокой доставляемостью и детальной аналитикой.

---

## Yandex Cloud SpeechKit

**Нода для синтеза речи (Text-to-Speech) с использованием Yandex SpeechKit API v3, предоставляющая высококачественную генерацию аудио из текста.** Поддерживает множество голосов, эмоциональные роли и гибкую настройку параметров синтеза.

| Параметр | Тип | Описание |
|----------|-----|----------|
| **Resource** | Options | Speech |
| **Operation** | Options | Synthesize |
| **Text** | String | Текст для синтеза (многострочный) |
| **Voice** | Options | Выбор голоса (Alena, Filipp, Jane, John, Masha, Omazh, Zahar) |
| **Role** | Options | Эмоциональная окраска (Neutral, Good, Evil) |

**Доступные голоса:**
- **Alena** - женский, русский
- **Filipp** - мужской, русский
- **Jane** - женский, русский/английский
- **John** - мужской, английский
- **Masha** - женский, русский
- **Omazh** - женский, русский
- **Zahar** - мужской, русский

**Форматы аудио:**

*Container (файлы в контейнере):*
- **WAV** - несжатый формат
- **MP3** - сжатый с потерями
- **OGG Opus** - открытый кодек

*Raw PCM (сырой аудиопоток):*
- Частоты дискретизации: 8000, 16000, 22050, 48000 Hz
- Кодировка: LINEAR16_PCM

**Дополнительные опции:**
- **Speed** - скорость речи (0.1 - 3.0, по умолчанию 1.0)
- **Volume** - громкость (-145 до 1)
- **Pitch Shift** - изменение тона голоса (-1000 до 1000 Hz)

**Процесс синтеза:**
1. Парсинг service account credentials
2. Создание SDK сессии
3. Подключение к TTS API (`tts.api.cloud.yandex.net:443`)
4. Потоковая генерация аудио chunks
5. Объединение chunks в итоговый файл
6. Подготовка бинарных данных с правильным MIME-типом

**Возвращаемые данные:**
- `success` - статус синтеза
- `text` - исходный текст
- `voice` - использованный голос
- `role` - эмоциональная роль
- `audioFormat` - формат аудио
- `audioSize` - размер файла в байтах
- Binary data - аудиофайл с расширением .wav/.mp3/.ogg/.raw

**Аутентификация:** Service account JSON через `yandexCloudAuthorizedApi` с автоматической генерацией IAM-токенов. Использует gRPC streaming для эффективной передачи аудио. Нода идеально подходит для создания голосовых помощников, озвучивания уведомлений, генерации аудиокниг, accessibility-решений, IVR-систем и любых приложений, требующих преобразования текста в естественную речь на русском и английском языках.

---

## Yandex Cloud Workflows

**Нода для запуска выполнения рабочих процессов в Yandex Cloud Workflows, serverless-сервисе для оркестрации облачных ресурсов и микросервисов.** Позволяет интегрировать n8n workflows с Yandex Workflows, создавая гибридные автоматизации.

| Параметр | Тип | Описание |
|----------|-----|----------|
| **Resource** | Options | Workflow |
| **Operation** | Options | Start Execution |
| **Folder ID** | String | ID папки с workflows |
| **Workflow** | Options | Выбор workflow из списка или указание ID |
| **Input Data** | String (JSON) | Входные данные для workflow в формате JSON |

**Процесс запуска:**
1. Загрузка списка доступных workflows из указанной папки
2. Валидация входных данных (проверка корректности JSON)
3. Создание SDK клиента ExecutionServiceClient
4. Отправка запроса на запуск выполнения с указанием:
   - `workflowId` - ID рабочего процесса
   - `input.inputJson` - JSON-строка с входными параметрами
5. Получение execution ID

**Возвращаемые данные:**
- `executionId` - уникальный ID запущенного выполнения
- `workflowId` - ID workflow
- `success` - статус запуска

**Примеры использования:**
- Запуск сложной оркестрации облачных функций из n8n
- Передача данных между n8n и Yandex Workflows
- Триггер long-running процессов
- Интеграция с существующими Workflows definitions

**Аутентификация:** Service account JSON через `yandexCloudAuthorizedApi` для создания SDK сессии. Автоматически валидирует JSON перед отправкой. Поддерживает resource locator для удобного выбора workflows с отображением описания. Нода подходит для создания комплексных автоматизаций, где n8n управляет внешними интеграциями и API, а Yandex Workflows координирует облачные ресурсы (Functions, Containers, Compute), обеспечивая визуальное проектирование сложных бизнес-процессов с обработкой ошибок, retry-логикой и параллельным выполнением задач.

---

## Типы аутентификации

В пакете используются три типа credentials:

### yandexCloudGptApi
- API ключ для Foundation Models
- Folder ID
- URL эндпоинта (опционально)

### yandexCloudStaticApi
- Access Key ID
- Secret Access Key
- Используется для S3-совместимых сервисов (Object Storage, Data Streams, Message Queue, Postbox)

### yandexCloudAuthorizedApi
- Service Account JSON
- Folder ID
- Используется для сервисов, требующих IAM-токены (Functions, Containers, Compute, SpeechKit, Workflows)

---

## Общие возможности

Все ноды в пакете поддерживают:
- ✅ Continue on Fail - продолжение выполнения при ошибках
- ✅ Paired Items - сохранение связи между входными и выходными элементами
- ✅ Resource Locators - удобный выбор ресурсов из списков или ручной ввод
- ✅ Expressions - использование n8n expressions во всех параметрах
- ✅ Proxy Support - работа через HTTP/HTTPS прокси (где применимо)

