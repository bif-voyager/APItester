# API Tester — Request Executor Backend

Серверный модуль выполнения HTTP-запросов для API Tester. Заменяет внешний CORS-proxy (`corsproxy.io`) на собственный backend.

## Запуск

```bash
cd backend
go run ./cmd/apitester-executor
```

Backend запустится на `http://localhost:8080`.

## Конфигурация

Переменные окружения (все необязательные, есть defaults):

| Переменная | Default | Описание |
|---|---|---|
| `PORT` | `8080` | Порт сервера |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:4173` | Разрешённые origins для CORS |
| `DEFAULT_TIMEOUT_MS` | `15000` | Таймаут запроса по умолчанию |
| `MAX_RESPONSE_BODY_BYTES` | `5242880` (5 MB) | Максимальный размер ответа |
| `MAX_REDIRECTS` | `5` | Максимальное число редиректов |

## API

### `GET /health`

```json
{"ok": true, "service": "apitester-executor", "version": "1.0.0"}
```

### `POST /v1/requests/send`

Принимает описание HTTP-запроса, выполняет его и возвращает результат.

**Request:**
```json
{
  "method": "GET",
  "url": "https://api.example.com/users",
  "headers": [{"key": "Authorization", "value": "Bearer token", "enabled": true}],
  "params": [{"key": "page", "value": "1", "enabled": true}],
  "body": {"mode": "raw", "content": "{\"name\":\"Ivan\"}"},
  "timeoutMs": 15000,
  "followRedirects": true,
  "maxRedirects": 5
}
```

**Response:**
```json
{
  "ok": true,
  "status": 200,
  "statusText": "200 OK",
  "headers": {"content-type": "application/json"},
  "body": "{\"id\":1,\"name\":\"Ivan\"}",
  "contentType": "application/json",
  "sizeBytes": 24,
  "durationMs": 318,
  "finalUrl": "https://api.example.com/users?page=1",
  "redirectCount": 0,
  "truncated": false
}
```

## Сборка

```bash
cd backend
go build -o apitester-executor.exe ./cmd/apitester-executor
```
