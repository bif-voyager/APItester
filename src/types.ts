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

export type CollectionItem = {
    id: string
    name: string
    type: 'folder'
    children: CollectionItem[]
    isExpanded?: boolean
} | {
    id: string
    name: string
    type: 'request'
    request: Request
}

export interface Collection {
    id: string
    name: string
    items: CollectionItem[]
    isExpanded?: boolean
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
