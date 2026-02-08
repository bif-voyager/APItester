import { Request } from '../types';

/**
 * Parses a cURL command and extracts request information
 * Handles single/double quotes, multiline JSON, auth, form-data, and various cURL formats
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
                    // Check for Authorization header and extract auth info
                    if (key.toLowerCase() === 'authorization') {
                        if (value.toLowerCase().startsWith('bearer ')) {
                            request.auth = {
                                type: 'bearer',
                                bearerToken: value.substring(7).trim(),
                            };
                        } else if (value.toLowerCase().startsWith('basic ')) {
                            // Decode basic auth if possible
                            try {
                                const decoded = atob(value.substring(6).trim());
                                const [username, password] = decoded.split(':');
                                request.auth = {
                                    type: 'basic',
                                    basicUsername: username,
                                    basicPassword: password || '',
                                };
                            } catch {
                                // Keep as header if decoding fails
                                request.headers!.push({ key, value, enabled: true });
                            }
                        } else {
                            request.headers!.push({ key, value, enabled: true });
                        }
                    } else {
                        request.headers!.push({ key, value, enabled: true });
                    }
                }
            }
        }

        // Extract Basic Auth (-u or --user)
        const userMatch = normalized.match(/(?:-u|--user)\s+['"]?([^'"\s]+)['"]?/);
        if (userMatch) {
            const [username, password] = userMatch[1].split(':');
            request.auth = {
                type: 'basic',
                basicUsername: username,
                basicPassword: password || '',
            };
        }

        // Extract cookies (-b or --cookie)
        const cookieMatch = normalized.match(/(?:-b|--cookie)\s+(['"])([^'"]+)\1/);
        if (cookieMatch) {
            request.headers!.push({ key: 'Cookie', value: cookieMatch[2], enabled: true });
        }

        // Extract form data (-F or --form) for multipart
        const formRegex = /(?:-F|--form)\s+(['"])([^'"]+)\1/g;
        const formData: string[] = [];
        let formMatch;
        while ((formMatch = formRegex.exec(normalized)) !== null) {
            formData.push(formMatch[2]);
        }

        if (formData.length > 0) {
            // Convert form data to JSON-like body for display
            const formBody: Record<string, string> = {};
            for (const item of formData) {
                const eqIndex = item.indexOf('=');
                if (eqIndex > -1) {
                    const key = item.substring(0, eqIndex);
                    const value = item.substring(eqIndex + 1).replace(/^@/, '[file] '); // Mark file uploads
                    formBody[key] = value;
                }
            }
            request.body = JSON.stringify(formBody, null, 2);

            // Add Content-Type header for multipart if not present
            const hasContentType = request.headers!.some(h => h.key.toLowerCase() === 'content-type');
            if (!hasContentType) {
                request.headers!.push({ key: 'Content-Type', value: 'multipart/form-data', enabled: true });
            }

            if (!methodMatch) {
                request.method = 'POST';
            }
        }

        // Extract body data (-d, --data, --data-raw, --data-binary, --data-urlencode)
        const dataRegex = /(?:-d|--data|--data-raw|--data-binary|--data-urlencode)\s+(['"])([\s\S]*?)\1/g;
        const dataMatches: string[] = [];
        let dataMatch;

        while ((dataMatch = dataRegex.exec(normalized)) !== null) {
            dataMatches.push(dataMatch[2]);
        }

        // Also try unquoted data (for simple key=value)
        const unquotedDataMatch = normalized.match(/(?:-d|--data)\s+([^\s'"]+)/);
        if (unquotedDataMatch && dataMatches.length === 0) {
            dataMatches.push(unquotedDataMatch[1]);
        }

        if (dataMatches.length > 0 && !formData.length) {
            let bodyContent = dataMatches.join('&');

            // Try to parse and prettify JSON
            try {
                const parsed = JSON.parse(bodyContent);
                request.body = JSON.stringify(parsed, null, 2);

                // Add Content-Type if not present
                const hasContentType = request.headers!.some(h => h.key.toLowerCase() === 'content-type');
                if (!hasContentType) {
                    request.headers!.push({ key: 'Content-Type', value: 'application/json', enabled: true });
                }
            } catch {
                // Check if it's URL-encoded form data
                if (bodyContent.includes('=') && !bodyContent.startsWith('{')) {
                    // URL-encoded form data - parse it
                    try {
                        const params = new URLSearchParams(bodyContent);
                        const formBody: Record<string, string> = {};
                        params.forEach((value, key) => {
                            formBody[key] = value;
                        });
                        request.body = JSON.stringify(formBody, null, 2);
                    } catch {
                        request.body = bodyContent;
                    }

                    const hasContentType = request.headers!.some(h => h.key.toLowerCase() === 'content-type');
                    if (!hasContentType) {
                        request.headers!.push({ key: 'Content-Type', value: 'application/x-www-form-urlencoded', enabled: true });
                    }
                } else {
                    request.body = bodyContent;
                }
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
                request.url = urlObj.origin + urlObj.pathname;
            } catch (e) {
                // Invalid URL, keep as is
            }
        }

        // Generate smart request name from URL
        if (request.url) {
            try {
                const urlObj = new URL(request.url);
                const pathParts = urlObj.pathname.split('/').filter(p => p);
                const lastPart = pathParts[pathParts.length - 1] || urlObj.hostname;
                request.name = `${request.method} ${lastPart}`;
            } catch {
                request.name = `${request.method} Request`;
            }
        }

        return request;
    } catch (error) {
        console.error('Failed to parse cURL:', error);
        return null;
    }
}

