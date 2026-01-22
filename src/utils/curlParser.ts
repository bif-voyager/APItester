import { Request } from '../types';

/**
 * Parses a cURL command and extracts request information
 * Handles single/double quotes, multiline JSON, and various cURL formats
 */
export function parseCurl(curlCommand: string): Partial<Request> | null {
    try {
        // Remove line continuations and normalize whitespace
        const normalized = curlCommand
            .replace(/\\\s*\n\s*/g, ' ')  // Remove backslash line continuations
            .replace(/\s+/g, ' ')           // Normalize whitespace
            .trim();

        // Check if it starts with curl
        if (!normalized.toLowerCase().startsWith('curl')) {
            throw new Error('Not a valid cURL command');
        }

        const request: Partial<Request> = {
            method: 'GET',
            url: '',
            headers: [],
            params: [],
            body: '',
        };

        // Extract URL - handle both quoted and unquoted, try multiple patterns
        // Pattern 1: URL in single or double quotes
        let urlMatch = normalized.match(/curl\s+['"]([^'"]+)['"]/);

        // Pattern 2: Look for http(s) URL anywhere
        if (!urlMatch) {
            const httpMatch = normalized.match(/(https?:\/\/[^\s'"]+)/);
            if (httpMatch) {
                request.url = httpMatch[1];
            }
        } else {
            request.url = urlMatch[1];
        }

        // Pattern 3: URL in quotes anywhere (fallback)
        if (!request.url) {
            const quotedUrl = normalized.match(/['"]https?:\/\/[^'"]+['"]/);
            if (quotedUrl) {
                request.url = quotedUrl[0].replace(/['"]/g, '');
            }
        }

        // Extract method (-X or --request), handle quotes
        const methodMatch = normalized.match(/(?:-X|--request)\s+['"]?([A-Z]+)['"]?/i);
        if (methodMatch) {
            request.method = methodMatch[1].toUpperCase() as Request['method'];
        }

        // Extract headers (-H or --header), handle both single and double quotes
        const headerRegex = /(?:-H|--header)\s+(['"])([^'"]+)\1/g;
        let headerMatch;
        while ((headerMatch = headerRegex.exec(normalized)) !== null) {
            const headerContent = headerMatch[2];
            const colonIndex = headerContent.indexOf(':');
            if (colonIndex > -1) {
                const key = headerContent.substring(0, colonIndex).trim();
                const value = headerContent.substring(colonIndex + 1).trim();
                if (key && value) {
                    request.headers!.push({ key, value, enabled: true });
                }
            }
        }

        // Extract body data (-d, --data, --data-raw, --data-binary)
        // This regex captures content between quotes, handling multiline JSON
        const dataRegex = /(?:-d|--data|--data-raw|--data-binary)\s+(['"])([\s\S]*?)\1/g;
        const dataMatches: string[] = [];
        let dataMatch;

        while ((dataMatch = dataRegex.exec(normalized)) !== null) {
            dataMatches.push(dataMatch[2]);
        }

        if (dataMatches.length > 0) {
            const bodyContent = dataMatches.join('&');

            // Try to parse and prettify JSON
            try {
                const parsed = JSON.parse(bodyContent);
                request.body = JSON.stringify(parsed, null, 2);
            } catch {
                // Not JSON, keep as is
                request.body = bodyContent;
            }

            // If we have data and no method specified, it's likely POST
            if (!methodMatch) {
                request.method = 'POST';
            }
        }

        // Parse query parameters from URL
        if (request.url) {
            try {
                const urlObj = new URL(request.url);
                const params: { key: string; value: string; enabled: boolean }[] = [];
                urlObj.searchParams.forEach((value, key) => {
                    params.push({ key, value, enabled: true });
                });
                request.params = params;

                // Remove query string from URL
                request.url = request.url.split('?')[0];
            } catch (e) {
                // Invalid URL, keep as is
            }
        }

        return request;
    } catch (error) {
        console.error('Failed to parse cURL:', error);
        return null;
    }
}
