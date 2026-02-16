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
    auth?: Auth
}

export type AuthType = 'none' | 'bearer' | 'basic'

export interface Auth {
    type: AuthType
    bearerToken?: string
    basicUsername?: string
    basicPassword?: string
}

export interface CollectionItem {
    id: string
    name: string
    type: 'folder' | 'request'
    children?: CollectionItem[]
    request?: Request
    isExpanded?: boolean
    parentId?: string | null
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

export interface EnvironmentVariable {
    key: string
    value: string
    enabled: boolean
}

export interface Environment {
    id: string
    name: string
    variables: EnvironmentVariable[]
}

export interface HistoryItem {
    id: string
    timestamp: number
    request: Request
    response?: {
        status?: number
        statusText?: string
        time?: number
    }
}

export interface RunResult {
    request: Request
    status: 'pending' | 'running' | 'passed' | 'failed'
    responseStatus?: number
    responseTime?: number
    error?: string
    iteration?: number
}

export interface Tab {
    id: string
    type: 'request' | 'run'
    title: string
    requestId?: string
    collectionId?: string
    request?: Request
    response?: Response | null
    runResults?: RunResult[]
    runCollectionName?: string
    lastRunnerConfig?: {
        config: any
        requests: any
    }
}
