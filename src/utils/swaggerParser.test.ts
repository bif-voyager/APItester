import { describe, expect, it } from 'vitest'
import type { CollectionItem, Request } from '../types'
import { isSwaggerSpec, parseSwagger } from './swaggerParser'

function collectRequests(items: CollectionItem[]): Request[] {
    return items.flatMap(item => {
        if (item.type === 'request' && item.request) {
            return [item.request]
        }
        return collectRequests(item.children || [])
    })
}

describe('isSwaggerSpec', () => {
    it('detects OpenAPI and rejects arbitrary JSON', () => {
        expect(isSwaggerSpec('{"openapi":"3.0.0","paths":{}}')).toBeTruthy()
        expect(isSwaggerSpec('{"name":"not an api spec"}')).toBeFalsy()
        expect(isSwaggerSpec('not json')).toBe(false)
    })
})

describe('parseSwagger', () => {
    it('converts an OpenAPI operation into a request', () => {
        const result = parseSwagger(JSON.stringify({
            openapi: '3.0.0',
            info: { title: 'Users API' },
            servers: [{ url: 'https://api.example.com' }],
            paths: {
                '/users': {
                    post: {
                        summary: 'Create user',
                        parameters: [
                            { name: 'trace', in: 'header', required: true, example: 'abc' },
                        ],
                        requestBody: {
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            name: { type: 'string', example: 'Simon' },
                                            active: { type: 'boolean', default: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        }))

        expect(result.success).toBe(true)
        expect(result.collection?.name).toBe('Users API')

        const requests = collectRequests(result.collection?.items || [])
        expect(requests).toHaveLength(1)
        expect(requests[0]).toMatchObject({
            name: 'Create user',
            method: 'POST',
            url: 'https://api.example.com/users',
            body: JSON.stringify({ name: 'Simon', active: true }, null, 2),
        })
        expect(requests[0].headers).toContainEqual({
            key: 'Content-Type',
            value: 'application/json',
            enabled: true,
        })
        expect(requests[0].headers).toContainEqual({
            key: 'trace',
            value: 'abc',
            enabled: true,
        })
    })

    it('supports Swagger 2 host, base path, query parameters and response type', () => {
        const result = parseSwagger(JSON.stringify({
            swagger: '2.0',
            info: { title: 'Legacy API' },
            host: 'legacy.example.com',
            basePath: '/v1',
            paths: {
                '/items': {
                    get: {
                        produces: ['application/json'],
                        parameters: [
                            { name: 'limit', in: 'query', default: 25 },
                        ],
                    },
                },
            },
        }))

        const requests = collectRequests(result.collection?.items || [])
        expect(requests[0].url).toBe('https://legacy.example.com/v1/items')
        expect(requests[0].params).toContainEqual({
            key: 'limit',
            value: 25,
            enabled: true,
        })
        expect(requests[0].headers).toContainEqual({
            key: 'Accept',
            value: 'application/json',
            enabled: true,
        })
    })

    it('reports invalid JSON and specifications without paths', () => {
        expect(parseSwagger('not json')).toMatchObject({ success: false })
        expect(parseSwagger('{"openapi":"3.0.0"}')).toEqual({
            success: false,
            error: 'No paths found in spec',
        })
    })
})
