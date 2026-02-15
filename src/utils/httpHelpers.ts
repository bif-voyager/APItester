import { KeyValue } from '../types'

// Helper function to get default headers based on HTTP method
export const getDefaultHeadersForMethod = (method: string): KeyValue[] => {
    const baseHeaders: KeyValue[] = [
        { key: 'User-Agent', value: 'APIClient/1.0', enabled: true },
        { key: 'Accept', value: '*/*', enabled: true },
        { key: 'Accept-Encoding', value: 'gzip, deflate, br', enabled: true },
        { key: 'Connection', value: 'keep-alive', enabled: true },
    ]

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return [
            { key: 'Content-Type', value: 'application/json', enabled: true },
            ...baseHeaders,
        ]
    }

    return baseHeaders
}
