import { describe, expect, it } from 'vitest'
import { getDefaultHeadersForMethod } from './httpHelpers'

describe('getDefaultHeadersForMethod', () => {
    it('returns common headers for GET requests', () => {
        const headers = getDefaultHeadersForMethod('GET')

        expect(headers).toHaveLength(4)
        expect(headers).toContainEqual({
            key: 'Accept',
            value: '*/*',
            enabled: true,
        })
        expect(headers.some(header => header.key === 'Content-Type')).toBe(false)
    })

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
        'adds a JSON content type for %s requests',
        method => {
            const headers = getDefaultHeadersForMethod(method)

            expect(headers[0]).toEqual({
                key: 'Content-Type',
                value: 'application/json',
                enabled: true,
            })
        }
    )

    it('returns a new array for every call', () => {
        const first = getDefaultHeadersForMethod('GET')
        const second = getDefaultHeadersForMethod('GET')

        first[0].value = 'changed'

        expect(second[0].value).toBe('APIClient/1.0')
    })
})
