import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import RequestEditor from './components/RequestEditor'
import ResponseViewer from './components/ResponseViewer'
import { Collection, Request, CollectionItem, KeyValue, Environment } from './types'
import {
    generateId,
    addRequestToTree,
    addFolderToTree,
    deleteItemFromTree,
    renameItemInTree,
    toggleExpandInTree,
    moveItemInTree,
    getAllRequestsFromItems,
} from './utils/collectionTreeHelpers'

// Helper function to get default headers based on HTTP method
const getDefaultHeadersForMethod = (method: string): KeyValue[] => {
    const baseHeaders: KeyValue[] = [
        { key: 'User-Agent', value: 'APIClient/1.0', enabled: true },
        { key: 'Accept', value: '*/*', enabled: true },
        { key: 'Accept-Encoding', value: 'gzip, deflate, br', enabled: true },
        { key: 'Connection', value: 'keep-alive', enabled: true },
    ]

    // Methods that typically have a request body need Content-Type
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return [
            { key: 'Content-Type', value: 'application/json', enabled: true },
            ...baseHeaders,
        ]
    }

    return baseHeaders
}

function App() {
    // Load and migrate from localStorage on mount
    const [collections, setCollections] = useState<Collection[]>(() => {
        const saved = localStorage.getItem('api-client-collections')
        if (!saved) return []

        try {
            const parsed = JSON.parse(saved)
            // Migrate old format to new nested structure
            return parsed.map((col: any) => {
                if (col.requests && !col.items) {
                    // Old format - migrate
                    const items: CollectionItem[] = col.requests.map((req: Request) => ({
                        id: generateId(),
                        name: req.name,
                        type: 'request' as const,
                        request: req,
                    }))
                    return {
                        id: col.id,
                        name: col.name,
                        items,
                        isExpanded: true,
                    }
                }
                return col
            })
        } catch {
            return []
        }
    })

    const [currentRequest, setCurrentRequest] = useState<Request | null>(null)
    const [currentRequestId, setCurrentRequestId] = useState<string | null>(null)
    const [currentCollectionId, setCurrentCollectionId] = useState<string | null>(null)
    const [response, setResponse] = useState<any>(null)

    // Theme state - persisted to localStorage
    const [theme, setTheme] = useState<'dark' | 'light'>(() => {
        const saved = localStorage.getItem('api-client-theme')
        return (saved === 'light' ? 'light' : 'dark') as 'dark' | 'light'
    })

    // Apply theme data attribute to document
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('api-client-theme', theme)
    }, [theme])

    const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

    // Environments state - persisted to localStorage
    const [environments, setEnvironments] = useState<Environment[]>(() => {
        const saved = localStorage.getItem('api-client-environments')
        if (!saved) return []
        try {
            return JSON.parse(saved)
        } catch {
            return []
        }
    })
    const [currentEnvironmentId, setCurrentEnvironmentId] = useState<string | null>(() => {
        return localStorage.getItem('api-client-current-env') || null
    })
    const [showEnvModal, setShowEnvModal] = useState(false)
    const [isAddingEnv, setIsAddingEnv] = useState(false)
    const [newEnvName, setNewEnvName] = useState('')

    // Run Collection state
    interface RunResult {
        request: Request
        status: 'pending' | 'running' | 'passed' | 'failed'
        responseStatus?: number
        responseTime?: number
        error?: string
    }
    const [showRunModal, setShowRunModal] = useState(false)
    const [runningCollection, setRunningCollection] = useState<Collection | null>(null)
    const [runResults, setRunResults] = useState<RunResult[]>([])
    const [isRunning, setIsRunning] = useState(false)

    // Tabs state
    interface Tab {
        id: string
        type: 'request' | 'run'
        title: string
        request?: Request
        requestId?: string
        collectionId?: string
        runResults?: RunResult[]
        runCollectionName?: string
    }
    const [openTabs, setOpenTabs] = useState<Tab[]>([])
    const [activeTabId, setActiveTabId] = useState<string | null>(null)

    // Save environments to localStorage
    useEffect(() => {
        localStorage.setItem('api-client-environments', JSON.stringify(environments))
    }, [environments])

    useEffect(() => {
        if (currentEnvironmentId) {
            localStorage.setItem('api-client-current-env', currentEnvironmentId)
        } else {
            localStorage.removeItem('api-client-current-env')
        }
    }, [currentEnvironmentId])

    // Get current environment
    const currentEnvironment = environments.find(env => env.id === currentEnvironmentId) || null

    // Substitute {variables} in a string
    const substituteVariables = (text: string): string => {
        if (!currentEnvironment) return text
        let result = text
        for (const variable of currentEnvironment.variables) {
            if (variable.enabled) {
                const regex = new RegExp(`\\{${variable.key}\\}`, 'g')
                result = result.replace(regex, variable.value)
            }
        }
        return result
    }

    // Save to localStorage whenever collections change
    useEffect(() => {
        localStorage.setItem('api-client-collections', JSON.stringify(collections))
    }, [collections])

    const addCollection = (name: string) => {
        const newCollection: Collection = {
            id: generateId(),
            name,
            items: [],
            isExpanded: true,
        }
        setCollections([...collections, newCollection])
    }

    const deleteCollection = (collectionId: string) => {
        if (confirm('Delete this collection and all its items?')) {
            setCollections(collections.filter((c) => c.id !== collectionId))
            if (currentCollectionId === collectionId) {
                setCurrentRequest(null)
                setCurrentRequestId(null)
                setCurrentCollectionId(null)
            }
        }
    }

    const renameCollection = (collectionId: string, newName: string) => {
        setCollections(
            collections.map((col) =>
                col.id === collectionId ? { ...col, name: newName } : col
            )
        )
    }

    const addFullCollection = (collection: Collection) => {
        setCollections([...collections, collection])
    }

    const toggleCollectionExpand = (collectionId: string) => {
        setCollections(
            collections.map((col) =>
                col.id === collectionId ? { ...col, isExpanded: !col.isExpanded } : col
            )
        )
    }

    const addRequestToCollection = (collectionId: string, parentId?: string) => {
        const defaultMethod = 'GET'
        const newRequest: Request = {
            id: generateId(),
            name: 'Untitled Request',
            method: defaultMethod,
            url: '',
            params: [],
            headers: getDefaultHeadersForMethod(defaultMethod),
            body: '',
        }

        setCollections(
            collections.map((col) => {
                if (col.id === collectionId) {
                    return {
                        ...col,
                        isExpanded: true, // Auto-expand collection when adding
                        items: addRequestToTree(col.items, parentId || null, newRequest),
                    }
                }
                return col
            })
        )

        setCurrentRequest(newRequest)
        setCurrentRequestId(newRequest.id)
        setCurrentCollectionId(collectionId)
    }

    const importRequest = (collectionId: string, requestData: Partial<Request>) => {
        const newRequest: Request = {
            id: generateId(),
            name: requestData.name || requestData.url?.split('/').pop() || 'Imported Request',
            method: requestData.method || 'GET',
            url: requestData.url || '',
            params: requestData.params || [],
            headers: requestData.headers || [],
            body: requestData.body || '',
        }

        setCollections(
            collections.map((col) => {
                if (col.id === collectionId) {
                    return {
                        ...col,
                        items: addRequestToTree(col.items, null, newRequest),
                    }
                }
                return col
            })
        )

        setCurrentRequest(newRequest)
        setCurrentRequestId(newRequest.id)
        setCurrentCollectionId(collectionId)
    }

    const addFolder = (collectionId: string, parentId: string | null): string | null => {
        const folderId = generateId()
        const defaultName = 'New Folder'

        setCollections(
            collections.map((col) => {
                if (col.id === collectionId) {
                    return {
                        ...col,
                        isExpanded: true, // Auto-expand collection when adding
                        items: addFolderToTree(col.items, parentId, defaultName, folderId),
                    }
                }
                return col
            })
        )

        return folderId
    }

    const moveItem = (collectionId: string, sourceItemId: string, targetItemId: string | null) => {
        setCollections(
            collections.map((col) => {
                if (col.id === collectionId) {
                    return {
                        ...col,
                        items: moveItemInTree(col.items, sourceItemId, targetItemId),
                    }
                }
                return col
            })
        )
    }

    const deleteItem = (collectionId: string, itemId: string) => {
        if (confirm('Delete this item?')) {
            setCollections(
                collections.map((col) => {
                    if (col.id === collectionId) {
                        return {
                            ...col,
                            items: deleteItemFromTree(col.items, itemId),
                        }
                    }
                    return col
                })
            )

            if (currentRequestId === itemId) {
                setCurrentRequest(null)
                setCurrentRequestId(null)
            }
        }
    }

    const renameItem = (collectionId: string, itemId: string, newName: string) => {
        setCollections(
            collections.map((col) => {
                if (col.id === collectionId) {
                    return {
                        ...col,
                        items: renameItemInTree(col.items, itemId, newName),
                    }
                }
                return col
            })
        )

        // Update current request name if it's the one being renamed
        if (currentRequestId === itemId && currentRequest) {
            setCurrentRequest({ ...currentRequest, name: newName })
        }
    }

    const toggleItemExpand = (collectionId: string, itemId: string) => {
        setCollections(
            collections.map((col) => {
                if (col.id === collectionId) {
                    return {
                        ...col,
                        items: toggleExpandInTree(col.items, itemId),
                    }
                }
                return col
            })
        )
    }

    const selectRequest = (request: Request, requestId: string, collectionId: string) => {
        setCurrentRequest(request)
        setCurrentRequestId(requestId)
        setCurrentCollectionId(collectionId)
        setResponse(null)

        // Add or activate tab
        const tabId = `request-${requestId}`
        const existingTab = openTabs.find(t => t.id === tabId)
        if (!existingTab) {
            const newTab: Tab = {
                id: tabId,
                type: 'request',
                title: request.name,
                request,
                requestId,
                collectionId
            }
            setOpenTabs([...openTabs, newTab])
        }
        setActiveTabId(tabId)
    }

    const updateRequest = (updatedRequest: Request) => {
        setCurrentRequest(updatedRequest)

        // Sync changes back to collection
        if (currentCollectionId && currentRequestId) {
            setCollections(
                collections.map((col) => {
                    if (col.id === currentCollectionId) {
                        const updateInTree = (items: CollectionItem[]): CollectionItem[] => {
                            return items.map((item) => {
                                if (item.type === 'request' && item.id === currentRequestId) {
                                    return { ...item, request: updatedRequest }
                                }
                                if (item.type === 'folder') {
                                    return { ...item, children: updateInTree(item.children) }
                                }
                                return item
                            })
                        }
                        return { ...col, items: updateInTree(col.items) }
                    }
                    return col
                })
            )
        }
    }

    const sendRequest = async (request: Request) => {
        try {
            setResponse({ loading: true })

            // Build URL with params (only enabled ones)
            // Apply environment variable substitution
            const url = new URL(substituteVariables(request.url))
            request.params
                .filter((param) => param.enabled !== false && param.key)
                .forEach((param) => {
                    url.searchParams.append(
                        substituteVariables(param.key),
                        substituteVariables(param.value)
                    )
                })

            // Build headers (only enabled ones)
            const headers: Record<string, string> = {}
            request.headers
                .filter((header) => header.enabled !== false && header.key)
                .forEach((header) => {
                    headers[substituteVariables(header.key)] = substituteVariables(header.value)
                })

            // Add Authorization header
            if (request.auth) {
                if (request.auth.type === 'bearer' && request.auth.bearerToken) {
                    headers['Authorization'] = `Bearer ${substituteVariables(request.auth.bearerToken)}`
                } else if (request.auth.type === 'basic' && request.auth.basicUsername) {
                    const credentials = btoa(`${substituteVariables(request.auth.basicUsername)}:${substituteVariables(request.auth.basicPassword || '')}`)
                    headers['Authorization'] = `Basic ${credentials}`
                }
            }

            // Determine if we need a CORS proxy
            const targetUrl = url.toString()
            let fetchUrl = targetUrl

            // Use CORS proxy for cross-origin requests
            // corsproxy.io supports all HTTP methods including POST with body
            const isCrossOrigin = !targetUrl.startsWith(window.location.origin)
            if (isCrossOrigin) {
                fetchUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
            }

            // Apply substitution to body as well
            const requestBody = request.method !== 'GET' && request.body
                ? substituteVariables(request.body)
                : undefined

            // Make request
            const startTime = performance.now()
            const response = await fetch(fetchUrl, {
                method: request.method,
                headers,
                body: requestBody,
            })
            const elapsed = Math.round(performance.now() - startTime)

            const data = await response.text()
            let jsonData = null
            try {
                jsonData = JSON.parse(data)
            } catch (e) {
                jsonData = data
            }

            setResponse({
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                body: jsonData,
                time: elapsed,
            })
        } catch (error: any) {
            setResponse({
                error: true,
                message: error.message,
            })
        }
    }

    // Run all requests in a collection
    const runCollection = async (collection: Collection) => {
        const allRequests = getAllRequestsFromItems(collection.items)
        if (allRequests.length === 0) {
            alert('No requests in this collection')
            return
        }

        // Initialize results
        const initialResults: RunResult[] = allRequests.map(req => ({
            request: req,
            status: 'pending' as const,
        }))

        setRunResults(initialResults)
        setRunningCollection(collection)
        setIsRunning(true)

        // Create Run tab
        const tabId = `run-${Date.now()}`
        const runTab: Tab = {
            id: tabId,
            type: 'run',
            title: `Run: ${collection.name}`,
            runResults: initialResults,
            runCollectionName: collection.name
        }
        setOpenTabs(prev => [...prev, runTab])
        setActiveTabId(tabId)

        // Run requests sequentially
        for (let i = 0; i < allRequests.length; i++) {
            const request = allRequests[i]

            // Update status to running
            setRunResults(prev => prev.map((r, idx) =>
                idx === i ? { ...r, status: 'running' as const } : r
            ))

            try {
                // Build URL with substitution
                const url = new URL(substituteVariables(request.url))
                request.params
                    .filter((param) => param.enabled !== false && param.key)
                    .forEach((param) => {
                        url.searchParams.append(
                            substituteVariables(param.key),
                            substituteVariables(param.value)
                        )
                    })

                // Build headers
                const headers: Record<string, string> = {}
                request.headers
                    .filter((header) => header.enabled !== false && header.key)
                    .forEach((header) => {
                        headers[substituteVariables(header.key)] = substituteVariables(header.value)
                    })

                // Add auth if present
                if (request.auth) {
                    if (request.auth.type === 'bearer' && request.auth.bearerToken) {
                        headers['Authorization'] = `Bearer ${substituteVariables(request.auth.bearerToken)}`
                    } else if (request.auth.type === 'basic' && request.auth.basicUsername) {
                        const credentials = btoa(`${substituteVariables(request.auth.basicUsername)}:${substituteVariables(request.auth.basicPassword || '')}`)
                        headers['Authorization'] = `Basic ${credentials}`
                    }
                }

                // CORS proxy
                const targetUrl = url.toString()
                let fetchUrl = targetUrl
                const isCrossOrigin = !targetUrl.startsWith(window.location.origin)
                if (isCrossOrigin) {
                    fetchUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
                }

                const requestBody = request.method !== 'GET' && request.body
                    ? substituteVariables(request.body)
                    : undefined

                // Execute request
                const startTime = performance.now()
                const response = await fetch(fetchUrl, {
                    method: request.method,
                    headers,
                    body: requestBody,
                })
                const elapsed = Math.round(performance.now() - startTime)

                // Update result
                const passed = response.status >= 200 && response.status < 400
                setRunResults(prev => prev.map((r, idx) =>
                    idx === i ? {
                        ...r,
                        status: passed ? 'passed' : 'failed',
                        responseStatus: response.status,
                        responseTime: elapsed
                    } : r
                ))
            } catch (error: any) {
                setRunResults(prev => prev.map((r, idx) =>
                    idx === i ? {
                        ...r,
                        status: 'failed',
                        error: error.message
                    } : r
                ))
            }

            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100))
        }

        setIsRunning(false)
    }

    return (
        <div className="flex h-screen bg-bg-primary text-text-primary">
            {/* App Bar */}
            <div className="fixed top-0 left-0 right-0 h-14 bg-bg-secondary border-b border-gray-700 flex items-center justify-between px-4 z-10">
                <div className="flex items-center gap-3">
                    <svg className="w-7 h-7 text-accent-primary" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 9V5h2v4h4v2h-4v4H9v-4H5V9h4z" />
                    </svg>
                    <h1 className="text-xl font-bold">API Client</h1>
                </div>
                <div className="flex items-center gap-2">
                    {/* Environment Selector */}
                    <div className="flex items-center gap-1 bg-bg-tertiary rounded px-2 py-1">
                        <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.83 5.14a.75.75 0 011.06.02L10 9.42l4.11-4.26a.75.75 0 011.08 1.04l-4.58 4.75a.75.75 0 01-1.08 0L4.85 6.2a.75.75 0 01-.02-1.06z" clipRule="evenodd" />
                            <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75z" clipRule="evenodd" />
                        </svg>
                        <select
                            value={currentEnvironmentId || ''}
                            onChange={(e) => setCurrentEnvironmentId(e.target.value || null)}
                            className="bg-transparent border-none text-sm focus:outline-none cursor-pointer pr-6 text-text-primary"
                        >
                            <option value="">No Environment</option>
                            {environments.map((env) => (
                                <option key={env.id} value={env.id}>{env.name}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => setShowEnvModal(true)}
                            className="p-1 hover:bg-bg-primary rounded"
                            title="Manage Environments"
                        >
                            <svg className="w-4 h-4 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                            </svg>
                        </button>
                    </div>
                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="p-2 hover:bg-bg-tertiary rounded transition-colors"
                        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    >
                        {theme === 'dark' ? (
                            <svg className="w-5 h-5 text-text-secondary" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5 text-text-secondary" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                            </svg>
                        )}
                    </button>
                    {/* Settings */}
                    <button className="p-2 hover:bg-bg-tertiary rounded">
                        <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex w-full pt-14">
                <Sidebar
                    collections={collections}
                    currentRequestId={currentRequestId}
                    onAddCollection={addCollection}
                    onAddFullCollection={addFullCollection}
                    onDeleteCollection={deleteCollection}
                    onRenameCollection={renameCollection}
                    onToggleCollectionExpand={toggleCollectionExpand}
                    onAddRequest={addRequestToCollection}
                    onImportRequest={importRequest}
                    onAddFolder={addFolder}
                    onMoveItem={moveItem}
                    onDeleteItem={deleteItem}
                    onRenameItem={renameItem}
                    onToggleItemExpand={toggleItemExpand}
                    onSelectRequest={selectRequest}
                    onRunCollection={(collectionId) => {
                        const col = collections.find(c => c.id === collectionId)
                        if (col) runCollection(col)
                    }}
                />

                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Tabs Bar */}
                    {openTabs.length > 0 && (
                        <div className="bg-bg-secondary border-b border-gray-700 flex overflow-x-auto">
                            {openTabs.map((tab) => (
                                <div
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveTabId(tab.id)
                                        if (tab.type === 'request' && tab.request) {
                                            setCurrentRequest(tab.request)
                                            setCurrentRequestId(tab.requestId || null)
                                            setCurrentCollectionId(tab.collectionId || null)
                                        }
                                    }}
                                    className={`flex items-center gap-2 px-3 py-2 border-r border-gray-700 cursor-pointer min-w-[120px] max-w-[200px] group ${activeTabId === tab.id
                                        ? 'bg-bg-primary border-b-2 border-b-accent-secondary'
                                        : 'hover:bg-bg-tertiary'
                                        }`}
                                >
                                    {tab.type === 'request' && tab.request && (
                                        <span className={`text-xs font-bold flex-shrink-0 ${tab.request.method === 'GET' ? 'text-green-400' :
                                            tab.request.method === 'POST' ? 'text-orange-400' :
                                                tab.request.method === 'PUT' ? 'text-blue-400' :
                                                    tab.request.method === 'DELETE' ? 'text-red-400' :
                                                        'text-purple-400'
                                            }`}>
                                            {tab.request.method}
                                        </span>
                                    )}
                                    {tab.type === 'run' && (
                                        <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                    <span className="text-sm truncate flex-1">{tab.title}</span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            const newTabs = openTabs.filter(t => t.id !== tab.id)
                                            setOpenTabs(newTabs)
                                            if (activeTabId === tab.id) {
                                                if (newTabs.length > 0) {
                                                    const nextTab = newTabs[newTabs.length - 1]
                                                    setActiveTabId(nextTab.id)
                                                    if (nextTab.type === 'request' && nextTab.request) {
                                                        setCurrentRequest(nextTab.request)
                                                        setCurrentRequestId(nextTab.requestId || null)
                                                        setCurrentCollectionId(nextTab.collectionId || null)
                                                    }
                                                } else {
                                                    setActiveTabId(null)
                                                    setCurrentRequest(null)
                                                    setCurrentRequestId(null)
                                                }
                                            }
                                        }}
                                        className="p-0.5 rounded hover:bg-red-500/30 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Content Area */}
                    {activeTabId?.startsWith('run-') ? (
                        // Run Results View
                        <div className="flex-1 overflow-auto p-4">
                            {(() => {
                                const activeTab = openTabs.find(t => t.id === activeTabId)
                                if (!activeTab || activeTab.type !== 'run') return null
                                // Always use runResults state (updated during execution)
                                const results = runResults
                                return (
                                    <div className="max-w-4xl mx-auto">
                                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                            <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                            </svg>
                                            Run: {activeTab.runCollectionName}
                                        </h2>

                                        {/* Stats */}
                                        <div className="flex gap-4 mb-4 text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                                                <span>Passed: {results.filter(r => r.status === 'passed').length}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                                                <span>Failed: {results.filter(r => r.status === 'failed').length}</span>
                                            </div>
                                            <div className="text-text-secondary">
                                                Total Time: {results.reduce((acc, r) => acc + (r.responseTime || 0), 0)}ms
                                            </div>
                                        </div>

                                        {/* Progress */}
                                        <div className="w-full h-2 bg-bg-tertiary rounded overflow-hidden mb-4">
                                            <div
                                                className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-300"
                                                style={{ width: `${(results.filter(r => r.status !== 'pending').length / Math.max(results.length, 1)) * 100}%` }}
                                            ></div>
                                        </div>

                                        {/* Results List */}
                                        <div className="space-y-2">
                                            {results.map((result, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`flex items-center gap-3 p-3 rounded border ${result.status === 'passed' ? 'border-green-600/50 bg-green-900/20' :
                                                        result.status === 'failed' ? 'border-red-600/50 bg-red-900/20' :
                                                            result.status === 'running' ? 'border-blue-600/50 bg-blue-900/20' :
                                                                'border-gray-700 bg-bg-tertiary'
                                                        }`}
                                                >
                                                    {/* Status Icon */}
                                                    <div className="w-6 h-6 flex items-center justify-center">
                                                        {result.status === 'pending' && <div className="w-2 h-2 rounded-full bg-gray-500"></div>}
                                                        {result.status === 'running' && (
                                                            <svg className="w-5 h-5 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                        )}
                                                        {result.status === 'passed' && (
                                                            <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        )}
                                                        {result.status === 'failed' && (
                                                            <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                            </svg>
                                                        )}
                                                    </div>

                                                    {/* Method Badge */}
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${result.request.method === 'GET' ? 'bg-green-500/20 text-green-400' :
                                                        result.request.method === 'POST' ? 'bg-orange-500/20 text-orange-400' :
                                                            result.request.method === 'PUT' ? 'bg-blue-500/20 text-blue-400' :
                                                                result.request.method === 'DELETE' ? 'bg-red-500/20 text-red-400' :
                                                                    'bg-purple-500/20 text-purple-400'
                                                        }`}>
                                                        {result.request.method}
                                                    </span>

                                                    <span className="flex-1 text-sm truncate">{result.request.name}</span>

                                                    {result.responseStatus && (
                                                        <span className={`text-xs font-medium ${result.responseStatus >= 200 && result.responseStatus < 300 ? 'text-green-400' :
                                                            result.responseStatus >= 400 ? 'text-red-400' : 'text-yellow-400'
                                                            }`}>
                                                            {result.responseStatus}
                                                        </span>
                                                    )}

                                                    {result.responseTime !== undefined && (
                                                        <span className="text-xs text-text-secondary">{result.responseTime}ms</span>
                                                    )}

                                                    {result.error && (
                                                        <span className="text-xs text-red-400 truncate max-w-[150px]" title={result.error}>
                                                            {result.error}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })()}
                        </div>
                    ) : (
                        // Request Editor View
                        <>
                            <RequestEditor
                                request={currentRequest}
                                onSendRequest={sendRequest}
                                onUpdateRequest={updateRequest}
                            />

                            <div className="border-t border-gray-700" />

                            <ResponseViewer response={response} />
                        </>
                    )}
                </div>
            </div>

            {/* Environment Management Modal */}
            {showEnvModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowEnvModal(false)}>
                    <div className="bg-bg-secondary border border-gray-700 rounded-lg p-6 w-[700px] max-w-[90vw] max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                            </svg>
                            Manage Environments
                        </h3>

                        {/* Add New Environment */}
                        <div className="mb-4">
                            {isAddingEnv ? (
                                <div className="bg-bg-tertiary rounded-lg p-4 border border-gray-600">
                                    <label className="block text-sm font-medium text-text-secondary mb-2">
                                        Environment Name
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newEnvName}
                                            onChange={(e) => setNewEnvName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && newEnvName.trim()) {
                                                    const newEnv: Environment = {
                                                        id: generateId(),
                                                        name: newEnvName.trim(),
                                                        variables: [
                                                            { key: 'baseUrl', value: 'https://api.example.com', enabled: true }
                                                        ]
                                                    }
                                                    setEnvironments([...environments, newEnv])
                                                    setNewEnvName('')
                                                    setIsAddingEnv(false)
                                                }
                                                if (e.key === 'Escape') {
                                                    setNewEnvName('')
                                                    setIsAddingEnv(false)
                                                }
                                            }}
                                            placeholder="Production, Development, Staging..."
                                            className="flex-1 px-3 py-2 bg-bg-primary border border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            autoFocus
                                        />
                                        <button
                                            onClick={() => {
                                                if (newEnvName.trim()) {
                                                    const newEnv: Environment = {
                                                        id: generateId(),
                                                        name: newEnvName.trim(),
                                                        variables: [
                                                            { key: 'baseUrl', value: 'https://api.example.com', enabled: true }
                                                        ]
                                                    }
                                                    setEnvironments([...environments, newEnv])
                                                    setNewEnvName('')
                                                    setIsAddingEnv(false)
                                                }
                                            }}
                                            disabled={!newEnvName.trim()}
                                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Create
                                        </button>
                                        <button
                                            onClick={() => {
                                                setNewEnvName('')
                                                setIsAddingEnv(false)
                                            }}
                                            className="px-4 py-2 border border-gray-600 text-text-secondary rounded hover:bg-bg-primary transition-all text-sm"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsAddingEnv(true)}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-all text-sm font-medium"
                                >
                                    + New Environment
                                </button>
                            )}
                        </div>

                        {/* Environments List */}
                        {environments.length === 0 ? (
                            <div className="text-center text-text-tertiary py-8">
                                <svg className="w-12 h-12 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                <p>No environments yet</p>
                                <p className="text-xs mt-1">Create one to use variables like {'{baseUrl}'}</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {environments.map((env) => (
                                    <div key={env.id} className="bg-bg-tertiary rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${currentEnvironmentId === env.id ? 'bg-green-400' : 'bg-gray-500'}`} />
                                                <h4 className="font-semibold">{env.name}</h4>
                                                {currentEnvironmentId === env.id && (
                                                    <span className="text-xs bg-green-600/30 text-green-400 px-2 py-0.5 rounded">Active</span>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setCurrentEnvironmentId(env.id)}
                                                    className="px-2 py-1 text-xs bg-accent-secondary/20 text-accent-secondary rounded hover:bg-accent-secondary/30"
                                                >
                                                    Use
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`Delete environment "${env.name}"?`)) {
                                                            setEnvironments(environments.filter(e => e.id !== env.id))
                                                            if (currentEnvironmentId === env.id) {
                                                                setCurrentEnvironmentId(null)
                                                            }
                                                        }
                                                    }}
                                                    className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>

                                        {/* Variables Table */}
                                        <div className="bg-bg-primary rounded overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-bg-secondary">
                                                        <th className="p-2 text-left w-8"></th>
                                                        <th className="p-2 text-left">Variable</th>
                                                        <th className="p-2 text-left">Value</th>
                                                        <th className="p-2 w-12"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {env.variables.map((variable, varIndex) => (
                                                        <tr key={varIndex} className="border-t border-gray-700">
                                                            <td className="p-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={variable.enabled}
                                                                    onChange={(e) => {
                                                                        const newVars = [...env.variables]
                                                                        newVars[varIndex] = { ...variable, enabled: e.target.checked }
                                                                        setEnvironments(environments.map(e =>
                                                                            e.id === env.id ? { ...e, variables: newVars } : e
                                                                        ))
                                                                    }}
                                                                    className="w-4 h-4"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <input
                                                                    type="text"
                                                                    value={variable.key}
                                                                    onChange={(e) => {
                                                                        const newVars = [...env.variables]
                                                                        newVars[varIndex] = { ...variable, key: e.target.value }
                                                                        setEnvironments(environments.map(en =>
                                                                            en.id === env.id ? { ...en, variables: newVars } : en
                                                                        ))
                                                                    }}
                                                                    placeholder="variable_name"
                                                                    className="w-full bg-transparent border border-gray-600 rounded px-2 py-1 focus:outline-none focus:border-accent-secondary"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <input
                                                                    type="text"
                                                                    value={variable.value}
                                                                    onChange={(e) => {
                                                                        const newVars = [...env.variables]
                                                                        newVars[varIndex] = { ...variable, value: e.target.value }
                                                                        setEnvironments(environments.map(en =>
                                                                            en.id === env.id ? { ...en, variables: newVars } : en
                                                                        ))
                                                                    }}
                                                                    placeholder="value"
                                                                    className="w-full bg-transparent border border-gray-600 rounded px-2 py-1 focus:outline-none focus:border-accent-secondary font-mono text-xs"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <button
                                                                    onClick={() => {
                                                                        const newVars = env.variables.filter((_, i) => i !== varIndex)
                                                                        setEnvironments(environments.map(en =>
                                                                            en.id === env.id ? { ...en, variables: newVars } : en
                                                                        ))
                                                                    }}
                                                                    className="text-red-400 hover:text-red-300"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                    </svg>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            <button
                                                onClick={() => {
                                                    const newVars = [...env.variables, { key: '', value: '', enabled: true }]
                                                    setEnvironments(environments.map(en =>
                                                        en.id === env.id ? { ...en, variables: newVars } : en
                                                    ))
                                                }}
                                                className="w-full p-2 text-center text-sm text-accent-secondary hover:bg-bg-secondary transition-colors"
                                            >
                                                + Add Variable
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-end mt-4">
                            <button
                                onClick={() => setShowEnvModal(false)}
                                className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/80 text-white rounded transition-all font-medium"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Run Collection Modal */}
            {showRunModal && runningCollection && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => !isRunning && setShowRunModal(false)}>
                    <div className="bg-bg-secondary border border-gray-700 rounded-lg p-6 w-[700px] max-w-[90vw] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                </svg>
                                Run: {runningCollection.name}
                            </h3>
                            {!isRunning && (
                                <button onClick={() => setShowRunModal(false)} className="text-text-tertiary hover:text-text-primary">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Stats */}
                        <div className="flex gap-4 mb-4 text-sm">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                                <span>Passed: {runResults.filter(r => r.status === 'passed').length}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                                <span>Failed: {runResults.filter(r => r.status === 'failed').length}</span>
                            </div>
                            <div className="text-text-secondary">
                                Total Time: {runResults.reduce((acc, r) => acc + (r.responseTime || 0), 0)}ms
                            </div>
                        </div>

                        {/* Progress */}
                        <div className="w-full h-2 bg-bg-tertiary rounded overflow-hidden mb-4">
                            <div
                                className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-300"
                                style={{ width: `${(runResults.filter(r => r.status !== 'pending').length / runResults.length) * 100}%` }}
                            ></div>
                        </div>

                        {/* Results List */}
                        <div className="flex-1 overflow-y-auto space-y-2">
                            {runResults.map((result, idx) => (
                                <div
                                    key={idx}
                                    className={`flex items-center gap-3 p-3 rounded border ${result.status === 'passed' ? 'border-green-600/50 bg-green-900/20' :
                                        result.status === 'failed' ? 'border-red-600/50 bg-red-900/20' :
                                            result.status === 'running' ? 'border-blue-600/50 bg-blue-900/20' :
                                                'border-gray-700 bg-bg-tertiary'
                                        }`}
                                >
                                    {/* Status Icon */}
                                    <div className="w-6 h-6 flex items-center justify-center">
                                        {result.status === 'pending' && (
                                            <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                                        )}
                                        {result.status === 'running' && (
                                            <svg className="w-5 h-5 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        )}
                                        {result.status === 'passed' && (
                                            <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                        {result.status === 'failed' && (
                                            <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>

                                    {/* Method Badge */}
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${result.request.method === 'GET' ? 'bg-green-500/20 text-green-400' :
                                        result.request.method === 'POST' ? 'bg-orange-500/20 text-orange-400' :
                                            result.request.method === 'PUT' ? 'bg-blue-500/20 text-blue-400' :
                                                result.request.method === 'DELETE' ? 'bg-red-500/20 text-red-400' :
                                                    'bg-purple-500/20 text-purple-400'
                                        }`}>
                                        {result.request.method}
                                    </span>

                                    {/* Request Name */}
                                    <span className="flex-1 text-sm truncate">{result.request.name}</span>

                                    {/* Response Status */}
                                    {result.responseStatus && (
                                        <span className={`text-xs font-medium ${result.responseStatus >= 200 && result.responseStatus < 300 ? 'text-green-400' :
                                            result.responseStatus >= 400 ? 'text-red-400' : 'text-yellow-400'
                                            }`}>
                                            {result.responseStatus}
                                        </span>
                                    )}

                                    {/* Response Time */}
                                    {result.responseTime !== undefined && (
                                        <span className="text-xs text-text-secondary">{result.responseTime}ms</span>
                                    )}

                                    {/* Error */}
                                    {result.error && (
                                        <span className="text-xs text-red-400 truncate max-w-[150px]" title={result.error}>
                                            {result.error}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end mt-4 gap-2">
                            {!isRunning && (
                                <button
                                    onClick={() => runCollection(runningCollection)}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-all font-medium flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                                    </svg>
                                    Run Again
                                </button>
                            )}
                            <button
                                onClick={() => setShowRunModal(false)}
                                disabled={isRunning}
                                className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/80 text-white rounded transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isRunning ? 'Running...' : 'Close'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default App
