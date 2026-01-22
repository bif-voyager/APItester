export interface KeyValue {
    key: string
    value: string
    enabled?: boolean
}

export interface Request {
    id: string
    name: string
    method: string
    url: string
    params: KeyValue[]
    headers: KeyValue[]
    body: string
}

export interface Collection {
    id: string
    name: string
    requests: Request[]
}

export interface Response {
    status?: number
    statusText?: string
    headers?: Record<string, string>
    body?: any
    time?: number
    loading?: boolean
    error?: boolean
    message?: string
}
