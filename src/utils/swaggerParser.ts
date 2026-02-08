import { Request, CollectionItem, Collection } from '../types';
import { generateId } from './collectionTreeHelpers';

export interface SwaggerSpec {
    swagger?: string;
    openapi?: string;
    info?: {
        title?: string;
        description?: string;
        version?: string;
    };
    host?: string;
    basePath?: string;
    servers?: Array<{ url: string }>;
    paths?: Record<string, Record<string, SwaggerOperation>>;
    definitions?: Record<string, any>;
    components?: {
        schemas?: Record<string, any>;
    };
}

interface SwaggerOperation {
    summary?: string;
    description?: string;
    operationId?: string;
    tags?: string[];
    parameters?: SwaggerParameter[];
    produces?: string[];
    consumes?: string[];
    requestBody?: {
        content?: Record<string, { schema?: any; example?: any }>;
    };
}

interface SwaggerParameter {
    name: string;
    in: 'query' | 'header' | 'path' | 'body' | 'formData';
    description?: string;
    required?: boolean;
    schema?: any;
    type?: string;
    default?: any;
    example?: any;
}

export interface ParsedSwaggerResult {
    success: boolean;
    collection?: Collection;
    error?: string;
}

/**
 * Generate example value from JSON schema
 */
function generateExampleFromSchema(schema: any, spec: SwaggerSpec): any {
    if (!schema) return {};

    // Handle $ref
    if (schema.$ref) {
        const refPath = schema.$ref.replace('#/definitions/', '').replace('#/components/schemas/', '');
        const refSchema = spec.definitions?.[refPath] || spec.components?.schemas?.[refPath];
        if (refSchema) {
            return generateExampleFromSchema(refSchema, spec);
        }
        return {};
    }

    // Handle example
    if (schema.example !== undefined) return schema.example;
    if (schema.default !== undefined) return schema.default;

    // Handle by type
    switch (schema.type) {
        case 'object':
            const obj: Record<string, any> = {};
            if (schema.properties) {
                for (const [key, propSchema] of Object.entries(schema.properties as Record<string, any>)) {
                    obj[key] = generateExampleFromSchema(propSchema, spec);
                }
            }
            return obj;
        case 'array':
            return [generateExampleFromSchema(schema.items || {}, spec)];
        case 'string':
            if (schema.enum?.length) return schema.enum[0];
            if (schema.format === 'date-time') return new Date().toISOString();
            if (schema.format === 'date') return new Date().toISOString().split('T')[0];
            if (schema.format === 'email') return 'user@example.com';
            if (schema.format === 'uri') return 'https://example.com';
            return schema.example || 'string';
        case 'integer':
        case 'number':
            return schema.example || 0;
        case 'boolean':
            return schema.example || false;
        default:
            return schema.example || null;
    }
}

/**
 * Detect if input is Swagger/OpenAPI JSON
 */
export function isSwaggerSpec(input: string): boolean {
    try {
        const parsed = JSON.parse(input.trim());
        return parsed.swagger || parsed.openapi || parsed.paths;
    } catch {
        return false;
    }
}

/**
 * Helper to find or create a folder in the tree
 */
function findOrCreateFolder(items: CollectionItem[], folderName: string): CollectionItem & { type: 'folder'; children: CollectionItem[] } {
    let folder = items.find(item => item.type === 'folder' && item.name === folderName);
    if (!folder) {
        folder = {
            id: generateId(),
            name: folderName,
            type: 'folder',
            children: [],
            isExpanded: false,
        };
        items.push(folder);
    }
    return folder as CollectionItem & { type: 'folder'; children: CollectionItem[] };
}

/**
 * Insert a request into a nested folder structure based on path segments
 */
function insertIntoTree(
    items: CollectionItem[],
    pathSegments: string[],
    requestItem: CollectionItem
): void {
    if (pathSegments.length === 0) {
        items.push(requestItem);
        return;
    }

    const [firstSegment, ...restSegments] = pathSegments;
    const folder = findOrCreateFolder(items, firstSegment);

    if (restSegments.length === 0) {
        // Add request directly to this folder
        folder.children.push(requestItem);
    } else {
        // Recurse into next folder level
        insertIntoTree(folder.children, restSegments, requestItem);
    }
}

/**
 * Parse Swagger 2.0 or OpenAPI 3.0 spec into a Collection with hierarchical folders
 */
export function parseSwagger(input: string): ParsedSwaggerResult {
    try {
        const spec: SwaggerSpec = JSON.parse(input.trim());

        if (!spec.paths) {
            return { success: false, error: 'No paths found in spec' };
        }

        // Determine base URL
        let baseUrl = '';
        if (spec.swagger && spec.host) {
            // Swagger 2.0
            const scheme = 'https';
            baseUrl = `${scheme}://${spec.host}${spec.basePath || ''}`;
        } else if (spec.openapi && spec.servers?.length) {
            // OpenAPI 3.0
            baseUrl = spec.servers[0].url;
        }

        // Build hierarchical tree by path structure
        const items: CollectionItem[] = [];

        for (const [path, methods] of Object.entries(spec.paths)) {
            for (const [method, operation] of Object.entries(methods)) {
                if (!['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method)) {
                    continue;
                }

                const request: Request = {
                    id: generateId(),
                    name: operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`,
                    method: method.toUpperCase() as Request['method'],
                    url: `${baseUrl}${path}`,
                    params: [],
                    headers: [],
                    body: '',
                };

                // Extract parameters
                if (operation.parameters) {
                    for (const param of operation.parameters) {
                        if (param.in === 'query') {
                            request.params.push({
                                key: param.name,
                                value: param.default || param.example || param.schema?.default || param.schema?.example || '',
                                enabled: true,
                            });
                        } else if (param.in === 'header' && param.name.toLowerCase() !== 'content-type') {
                            request.headers.push({
                                key: param.name,
                                value: param.default || param.example || param.schema?.default || param.schema?.example || '',
                                enabled: param.required || false,
                            });
                        } else if (param.in === 'path') {
                            // Replace path params with placeholder
                            request.url = request.url.replace(`{${param.name}}`, `{${param.name}}`);
                        } else if (param.in === 'body' && param.schema) {
                            // Swagger 2.0 body parameter
                            try {
                                const bodyExample = generateExampleFromSchema(param.schema, spec);
                                request.body = JSON.stringify(bodyExample, null, 2);
                            } catch {
                                request.body = '{}';
                            }
                        }
                    }
                }

                // OpenAPI 3.0 requestBody
                if (operation.requestBody?.content) {
                    const contentTypes = Object.keys(operation.requestBody.content);
                    const jsonType = contentTypes.find(ct => ct.includes('json')) || contentTypes[0];
                    if (jsonType && operation.requestBody.content[jsonType]) {
                        const mediaType = operation.requestBody.content[jsonType];
                        if (mediaType.schema) {
                            try {
                                const bodyExample = mediaType.example || generateExampleFromSchema(mediaType.schema, spec);
                                request.body = JSON.stringify(bodyExample, null, 2);
                            } catch {
                                request.body = '{}';
                            }
                        }
                    }
                }

                // Add Content-Type for requests with body
                if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
                    const hasContentType = request.headers.some(h => h.key.toLowerCase() === 'content-type');
                    if (!hasContentType) {
                        request.headers.unshift({
                            key: 'Content-Type',
                            value: 'application/json',
                            enabled: true,
                        });
                    }
                }

                // Add Accept header
                if (operation.produces?.length) {
                    request.headers.push({
                        key: 'Accept',
                        value: operation.produces[0],
                        enabled: true,
                    });
                }

                const requestItem: CollectionItem = {
                    id: generateId(),
                    name: request.name,
                    type: 'request',
                    request,
                };

                // Parse path into segments: /pet/{petId}/uploadImage → ['pet', '{petId}', 'uploadImage']
                const pathSegments = path.split('/').filter(seg => seg.length > 0);

                // Insert into tree structure
                insertIntoTree(items, pathSegments, requestItem);
            }
        }

        // Create collection
        const collection: Collection = {
            id: generateId(),
            name: spec.info?.title || 'Imported API',
            items,
            isExpanded: false,
        };

        return { success: true, collection };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

