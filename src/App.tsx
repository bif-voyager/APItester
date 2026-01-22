import { useState } from 'react'
import Sidebar from './components/Sidebar'
import RequestEditor from './components/RequestEditor'
import ResponseViewer from './components/ResponseViewer'
import { Collection, Request } from './types'

function App() {
    // Load from localStorage on mount
    const [collections, setCollections] = useState<Collection[]>(() => {
        const saved = localStorage.getItem('api-client-collections')
        return saved ? JSON.parse(saved) : []
    })
    const [currentRequest, setCurrentRequest] = useState<Request | null>(null)
    const [currentCollectionId, setCurrentCollectionId] = useState<string | null>(null)
    const [response, setResponse] = useState<any>(null)

    // Save to localStorage whenever collections change
    const updateCollections = (newCollections: Collection[]) => {
        setCollections(newCollections)
        localStorage.setItem('api-client-collections', JSON.stringify(newCollections))
    }

    const addCollection = (name: string) => {
        const newCollection: Collection = {
            id: crypto.randomUUID(),
            name,
            requests: []
        }
        updateCollections([...collections, newCollection])
    }

    const deleteCollection = (collectionId: string) => {
        if (confirm('Delete this collection and all its requests?')) {
            updateCollections(collections.filter(c => c.id !== collectionId))
            if (currentCollectionId === collectionId) {
                setCurrentRequest(null)
                setCurrentCollectionId(null)
            }
        }
    }

    const renameCollection = (collectionId: string, newName: string) => {
        updateCollections(collections.map(col =>
            col.id === collectionId ? { ...col, name: newName } : col
        ))
    }

    const addRequest = (collectionId: string) => {
        const newRequest: Request = {
            id: crypto.randomUUID(),
            name: 'Untitled Request',
            method: 'GET',
            url: '',
            params: [],
            headers: [],
            body: ''
        }

        updateCollections(collections.map(col =>
            col.id === collectionId
                ? { ...col, requests: [...col.requests, newRequest] }
                : col
        ))

        setCurrentRequest(newRequest)
        setCurrentCollectionId(collectionId)
    }

    const importRequest = (collectionId: string, requestData: Partial<Request>) => {
        const newRequest: Request = {
            id: crypto.randomUUID(),
            name: requestData.name || requestData.url?.split('/').pop() || 'Imported Request',
            method: requestData.method || 'GET',
            url: requestData.url || '',
            params: requestData.params || [],
            headers: requestData.headers || [],
            body: requestData.body || ''
        }

        updateCollections(collections.map(col =>
            col.id === collectionId
                ? { ...col, requests: [...col.requests, newRequest] }
                : col
        ))

        setCurrentRequest(newRequest)
        setCurrentCollectionId(collectionId)
    }

    const deleteRequest = (collectionId: string, requestId: string) => {
        if (confirm('Delete this request?')) {
            updateCollections(collections.map(col =>
                col.id === collectionId
                    ? { ...col, requests: col.requests.filter(r => r.id !== requestId) }
                    : col
            ))
            if (currentRequest?.id === requestId) {
                setCurrentRequest(null)
            }
        }
    }

    const renameRequest = (collectionId: string, requestId: string, newName: string) => {
        updateCollections(collections.map(col =>
            col.id === collectionId
                ? {
                    ...col,
                    requests: col.requests.map(req =>
                        req.id === requestId ? { ...req, name: newName } : req
                    )
                }
                : col
        ))
        if (currentRequest?.id === requestId) {
            setCurrentRequest({ ...currentRequest, name: newName })
        }
    }

    const selectRequest = (request: Request, collectionId: string) => {
        setCurrentRequest(request)
        setCurrentCollectionId(collectionId)
        setResponse(null)
    }

    const updateRequest = (updatedRequest: Request) => {
        setCurrentRequest(updatedRequest)

        // Sync changes back to collection
        updateCollections(collections.map(col => ({
            ...col,
            requests: col.requests.map(req =>
                req.id === updatedRequest.id ? updatedRequest : req
            )
        })))
    }

    const sendRequest = async (request: Request) => {
        try {
            setResponse({ loading: true })

            // Build URL with params (only enabled ones)
            const url = new URL(request.url)
            request.params
                .filter(param => param.enabled !== false && param.key)
                .forEach(param => {
                    url.searchParams.append(param.key, param.value)
                })

            // Build headers (only enabled ones)
            const headers: Record<string, string> = {}
            request.headers
                .filter(header => header.enabled !== false && header.key)
                .forEach(header => {
                    headers[header.key] = header.value
                })

            // Make request
            const startTime = performance.now()
            const response = await fetch(url.toString(), {
                method: request.method,
                headers,
                body: request.method !== 'GET' && request.body ? request.body : undefined
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
                time: elapsed
            })
        } catch (error: any) {
            setResponse({
                error: true,
                message: error.message
            })
        }
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
                <button className="p-2 hover:bg-bg-tertiary rounded">
                    <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
            </div>

            {/* Main Content */}
            <div className="flex w-full pt-14">
                <Sidebar
                    collections={collections}
                    currentRequestId={currentRequest?.id}
                    onAddCollection={addCollection}
                    onDeleteCollection={deleteCollection}
                    onRenameCollection={renameCollection}
                    onAddRequest={addRequest}
                    onImportRequest={importRequest}
                    onDeleteRequest={deleteRequest}
                    onRenameRequest={renameRequest}
                    onSelectRequest={selectRequest}
                />

                <div className="flex-1 flex flex-col">
                    <RequestEditor
                        request={currentRequest}
                        onSendRequest={sendRequest}
                        onUpdateRequest={updateRequest}
                    />

                    <div className="border-t border-gray-700" />

                    <ResponseViewer response={response} />
                </div>
            </div>
        </div>
    )
}

export default App
