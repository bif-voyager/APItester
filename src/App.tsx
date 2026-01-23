import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import RequestEditor from './components/RequestEditor'
import ResponseViewer from './components/ResponseViewer'
import { Collection, Request, CollectionItem } from './types'
import {
    generateId,
    addRequestToTree,
    addFolderToTree,
    deleteItemFromTree,
    renameItemInTree,
    toggleExpandInTree,
    findRequestInTree,
} from './utils/collectionTreeHelpers'

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

    const toggleCollectionExpand = (collectionId: string) => {
        setCollections(
            collections.map((col) =>
                col.id === collectionId ? { ...col, isExpanded: !col.isExpanded } : col
            )
        )
    }

    const addRequestToCollection = (collectionId: string, parentId?: string) => {
        const newRequest: Request = {
            id: generateId(),
            name: 'Untitled Request',
            method: 'GET',
            url: '',
            params: [],
            headers: [],
            body: '',
        }

        setCollections(
            collections.map((col) => {
                if (col.id === collectionId) {
                    return {
                        ...col,
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

    const addFolder = (collectionId: string, parentId: string | null) => {
        const name = prompt('Folder name:')
        if (!name?.trim()) return

        setCollections(
            collections.map((col) => {
                if (col.id === collectionId) {
                    return {
                        ...col,
                        items: addFolderToTree(col.items, parentId, name.trim()),
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
            const url = new URL(request.url)
            request.params
                .filter((param) => param.enabled !== false && param.key)
                .forEach((param) => {
                    url.searchParams.append(param.key, param.value)
                })

            // Build headers (only enabled ones)
            const headers: Record<string, string> = {}
            request.headers
                .filter((header) => header.enabled !== false && header.key)
                .forEach((header) => {
                    headers[header.key] = header.value
                })

            // Make request
            const startTime = performance.now()
            const response = await fetch(url.toString(), {
                method: request.method,
                headers,
                body: request.method !== 'GET' && request.body ? request.body : undefined,
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
                    currentRequestId={currentRequestId}
                    onAddCollection={addCollection}
                    onDeleteCollection={deleteCollection}
                    onRenameCollection={renameCollection}
                    onToggleCollectionExpand={toggleCollectionExpand}
                    onAddRequest={addRequestToCollection}
                    onImportRequest={importRequest}
                    onAddFolder={addFolder}
                    onDeleteItem={deleteItem}
                    onRenameItem={renameItem}
                    onToggleItemExpand={toggleItemExpand}
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
