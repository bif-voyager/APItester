import type { Request, Response, KeyValue, BulkResponse } from '../types'

const EXECUTOR_URL = import.meta.env.VITE_EXECUTOR_URL || 'http://localhost:8080'

/**
 * Payload sent to the Go backend executor.
 */
interface ExecutorPayload {
    method: string
    url: string
    headers: { key: string; value: string; enabled: boolean }[]
    params: { key: string; value: string; enabled: boolean }[]
    body?: { mode: string; content: string }
    timeoutMs: number
    followRedirects: boolean
    maxRedirects: number
}

/**
 * Response structure returned by the Go backend.
 */
interface ExecutorResult {
    ok: boolean
    status?: number
    statusText?: string
    headers?: Record<string, string>
    body?: string
    contentType?: string
    sizeBytes?: number
    durationMs: number
    finalUrl?: string
    redirectCount?: number
    truncated?: boolean
    error?: {
        type: string
        message: string
    }
}

/**
 * Build the executor payload from a Request and a variable substitution function.
 * Auth headers are injected into the headers array.
 */
function buildPayload(
    request: Request,
    substituteVariables: (text: string) => string
): ExecutorPayload {
    // Process URL
    let rawUrl = substituteVariables(request.url).trim()
    if (rawUrl && !rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
        rawUrl = 'https://' + rawUrl
    }

    // Process headers
    const headers: { key: string; value: string; enabled: boolean }[] = request.headers.map(h => ({
        key: substituteVariables(h.key),
        value: substituteVariables(h.value),
        enabled: h.enabled !== false,
    }))

    // Add auth header
    if (request.auth) {
        if (request.auth.type === 'bearer' && request.auth.bearerToken) {
            headers.push({
                key: 'Authorization',
                value: `Bearer ${substituteVariables(request.auth.bearerToken)}`,
                enabled: true,
            })
        } else if (request.auth.type === 'basic' && request.auth.basicUsername) {
            const credentials = btoa(
                `${substituteVariables(request.auth.basicUsername)}:${substituteVariables(request.auth.basicPassword || '')}`
            )
            headers.push({
                key: 'Authorization',
                value: `Basic ${credentials}`,
                enabled: true,
            })
        }
    }

    // Process params
    const params = request.params
        .filter((p: KeyValue) => p.enabled !== false && p.key)
        .map((p: KeyValue) => ({
            key: substituteVariables(p.key),
            value: substituteVariables(p.value),
            enabled: true,
        }))

    // Process body
    let body: { mode: string; content: string } | undefined
    if (request.method !== 'GET' && request.method !== 'HEAD' && request.body) {
        body = {
            mode: 'raw',
            content: substituteVariables(request.body),
        }
    }

    return {
        method: request.method,
        url: rawUrl,
        headers,
        params,
        body,
        timeoutMs: 15000,
        followRedirects: true,
        maxRedirects: 5,
    }
}

/**
 * Convert backend ExecutorResult to the frontend Response type.
 */
function toResponse(result: ExecutorResult): Response {
    if (!result.ok && result.error) {
        return {
            error: true,
            message: result.error.message,
            time: result.durationMs,
        }
    }

    // Parse JSON body if possible
    let parsedBody: any = result.body
    if (result.body) {
        try {
            parsedBody = JSON.parse(result.body)
        } catch {
            // keep as string
        }
    }

    return {
        status: result.status,
        statusText: result.statusText,
        headers: result.headers,
        body: parsedBody,
        time: result.durationMs,
    }
}

/**
 * Send a request via the Go backend executor.
 * This is the single entry point used by both sendRequest and executeRunner.
 */
export async function sendViaExecutor(
    request: Request,
    substituteVariables: (text: string) => string
): Promise<Response> {
    if (!request.url.trim()) {
        return { error: true, message: 'Invalid URL' }
    }

    const payload = buildPayload(request, substituteVariables)

    try {
        const res = await fetch(`${EXECUTOR_URL}/v1/requests/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })

        if (!res.ok) {
            const text = await res.text()
            return {
                error: true,
                message: `Backend error: ${res.status} ${text}`,
            }
        }

        const result: ExecutorResult = await res.json()
        return toResponse(result)
    } catch (error: any) {
        // Backend is not running or network error
        if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
            return {
                error: true,
                message: 'Backend не запущен. Запустите Go backend: cd backend && go run ./cmd/apitester-executor',
            }
        }
        return {
            error: true,
            message: error.message || 'Unknown error',
        }
    }
}

/**
 * Send N concurrent copies of the same request via the Go backend bulk endpoint.
 */
export async function sendBulkViaExecutor(
    request: Request,
    concurrency: number,
    substituteVariables: (text: string) => string
): Promise<BulkResponse> {
    if (!request.url.trim()) {
        return {
            ok: false,
            totalRequests: 0,
            results: [],
            totalTimeMs: 0,
            error: { type: 'invalid_url', message: 'Invalid URL' },
        }
    }

    const payload = buildPayload(request, substituteVariables)

    try {
        const res = await fetch(`${EXECUTOR_URL}/v1/requests/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                request: payload,
                concurrency,
            }),
        })

        if (!res.ok) {
            const text = await res.text()
            return {
                ok: false,
                totalRequests: 0,
                results: [],
                totalTimeMs: 0,
                error: { type: 'backend_error', message: `Backend error: ${res.status} ${text}` },
            }
        }

        return await res.json()
    } catch (error: any) {
        if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
            return {
                ok: false,
                totalRequests: 0,
                results: [],
                totalTimeMs: 0,
                error: { type: 'network_error', message: 'Backend не запущен. Запустите Go backend: cd backend && go run ./cmd/apitester-executor' },
            }
        }
        return {
            ok: false,
            totalRequests: 0,
            results: [],
            totalTimeMs: 0,
            error: { type: 'unknown', message: error.message || 'Unknown error' },
        }
    }
}
