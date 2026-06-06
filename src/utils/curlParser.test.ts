import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseCurl } from './curlParser'

describe('parseCurl', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('rejects input that is not a cURL command', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined)

        expect(parseCurl('GET https://api.example.com/users')).toBeNull()
    })

    it('extracts query parameters and removes them from the URL', () => {
        const request = parseCurl('curl "https://api.example.com/users?limit=10&active=true"')

        expect(request).toMatchObject({
            method: 'GET',
            url: 'https://api.example.com/users',
            name: 'GET users',
            params: [
                { key: 'limit', value: '10', enabled: true },
                { key: 'active', value: 'true', enabled: true },
            ],
        })
    })

    it('infers POST and JSON content type from a JSON body', () => {
        const request = parseCurl(
            `curl 'https://api.example.com/users' --data '{"name":"Simon","active":true}'`
        )

        expect(request?.method).toBe('POST')
        expect(request?.body).toBe(JSON.stringify({ name: 'Simon', active: true }, null, 2))
        expect(request?.headers).toContainEqual({
            key: 'Content-Type',
            value: 'application/json',
            enabled: true,
        })
    })

    it('extracts bearer authentication from the Authorization header', () => {
        const request = parseCurl(
            `curl 'https://api.example.com/profile' -H 'Authorization: Bearer secret-token'`
        )

        expect(request?.auth).toEqual({
            type: 'bearer',
            bearerToken: 'secret-token',
        })
        expect(request?.headers).toEqual([])
    })

    it('extracts basic authentication from the user option', () => {
        const request = parseCurl(
            `curl 'https://api.example.com/profile' --user 'demo:password'`
        )

        expect(request?.auth).toEqual({
            type: 'basic',
            basicUsername: 'demo',
            basicPassword: 'password',
        })
    })
})
