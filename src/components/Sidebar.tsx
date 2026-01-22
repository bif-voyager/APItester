import { Collection, Request } from '../types'
import { useState } from 'react'

interface SidebarProps {
    collections: Collection[]
    currentRequestId?: string
    onAddCollection: (name: string) => void
    onDeleteCollection: (collectionId: string) => void
    onRenameCollection: (collectionId: string, newName: string) => void
    onAddRequest: (collectionId: string) => void
    onDeleteRequest: (collectionId: string, requestId: string) => void
    onRenameRequest: (collectionId: string, requestId: string, newName: string) => void
    onSelectRequest: (request: Request, collectionId: string) => void
}

export default function Sidebar({
    collections,
    currentRequestId,
    onAddCollection,
    onDeleteCollection,
    onRenameCollection,
    onAddRequest,
    onDeleteRequest,
    onRenameRequest,
    onSelectRequest
}: SidebarProps) {
    const [editingCollection, setEditingCollection] = useState<string | null>(null)
    const [editingRequest, setEditingRequest] = useState<string | null>(null)
    const [editName, setEditName] = useState('')

    const handleAddCollection = () => {
        const name = prompt('Collection name:')
        if (name?.trim()) onAddCollection(name.trim())
    }

    const startEditCollection = (id: string, currentName: string) => {
        setEditingCollection(id)
        setEditName(currentName)
    }

    const saveCollectionName = (id: string) => {
        if (editName.trim()) {
            onRenameCollection(id, editName.trim())
        }
        setEditingCollection(null)
    }

    const startEditRequest = (id: string, currentName: string) => {
        setEditingRequest(id)
        setEditName(currentName)
    }

    const saveRequestName = (collectionId: string, requestId: string) => {
        if (editName.trim()) {
            onRenameRequest(collectionId, requestId, editName.trim())
        }
        setEditingRequest(null)
    }

    const getMethodColor = (method: string) => {
        const colors: Record<string, string> = {
            GET: 'bg-green-500',
            POST: 'bg-orange-500',
            PUT: 'bg-blue-500',
            DELETE: 'bg-red-500',
        }
        return colors[method] || 'bg-gray-500'
    }

    return (
        <div className="w-72 bg-bg-secondary border-r border-gray-700 flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-bold">Collections</h2>
                <button
                    onClick={handleAddCollection}
                    className="p-2 hover:bg-accent-primary/20 rounded border border-accent-primary/50 transition-all duration-200 hover:border-accent-primary group"
                    title="New Collection"
                >
                    <svg className="w-4 h-4 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            </div>

            {/* Collections List */}
            <div className="flex-1 overflow-y-auto p-2">
                {collections.length === 0 ? (
                    <div className="text-center text-text-tertiary mt-8 px-4">
                        <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <p className="text-sm">No collections yet</p>
                        <p className="text-xs mt-2 opacity-70">Click + to create one</p>
                    </div>
                ) : (
                    collections.map((collection) => (
                        <div key={collection.id} className="mb-3 bg-bg-primary/30 rounded-lg p-2">
                            {/* Collection Header */}
                            <div className="flex items-center gap-2 p-2 rounded hover:bg-bg-tertiary/50 group">
                                <svg className="w-4 h-4 text-accent-secondary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                </svg>

                                {editingCollection === collection.id ? (
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onBlur={() => saveCollectionName(collection.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') saveCollectionName(collection.id)
                                            if (e.key === 'Escape') setEditingCollection(null)
                                        }}
                                        className="flex-1 px-2 py-1 bg-bg-tertiary border border-accent-secondary rounded text-sm focus:outline-none"
                                        autoFocus
                                    />
                                ) : (
                                    <>
                                        <span
                                            className="font-semibold text-sm flex-1 cursor-pointer"
                                            onDoubleClick={() => startEditCollection(collection.id, collection.name)}
                                        >
                                            {collection.name}
                                        </span>
                                        <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                                            <button
                                                onClick={() => startEditCollection(collection.id, collection.name)}
                                                className="p-1 hover:bg-bg-primary rounded"
                                                title="Rename"
                                            >
                                                <svg className="w-3 h-3 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => onDeleteCollection(collection.id)}
                                                className="p-1 hover:bg-red-500/20 rounded"
                                                title="Delete Collection"
                                            >
                                                <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Requests */}
                            <div className="ml-2 mt-1 space-y-1">
                                {collection.requests.map((request) => (
                                    <div
                                        key={request.id}
                                        className={`flex items-center gap-2 p-2 rounded transition-all duration-150 group ${currentRequestId === request.id
                                                ? 'bg-accent-secondary/20 border border-accent-secondary/40'
                                                : 'hover:bg-bg-tertiary/50 border border-transparent'
                                            }`}
                                    >
                                        <button
                                            onClick={() => onSelectRequest(request, collection.id)}
                                            className="flex items-center gap-2 flex-1 min-w-0"
                                        >
                                            <span className={`${getMethodColor(request.method)} text-white text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0`}>
                                                {request.method}
                                            </span>

                                            {editingRequest === request.id ? (
                                                <input
                                                    type="text"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    onBlur={() => saveRequestName(collection.id, request.id)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') saveRequestName(collection.id, request.id)
                                                        if (e.key === 'Escape') setEditingRequest(null)
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="flex-1 px-2 py-1 bg-bg-tertiary border border-accent-secondary rounded text-xs focus:outline-none"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span
                                                    className="text-sm text-text-secondary group-hover:text-text-primary truncate"
                                                    onDoubleClick={(e) => {
                                                        e.stopPropagation()
                                                        startEditRequest(request.id, request.name)
                                                    }}
                                                >
                                                    {request.name}
                                                </span>
                                            )}
                                        </button>

                                        <div className="opacity-0 group-hover:opacity-100 flex gap-1 flex-shrink-0">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    startEditRequest(request.id, request.name)
                                                }}
                                                className="p-1 hover:bg-bg-primary rounded"
                                                title="Rename"
                                            >
                                                <svg className="w-3 h-3 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onDeleteRequest(collection.id, request.id)
                                                }}
                                                className="p-1 hover:bg-red-500/20 rounded"
                                                title="Delete"
                                            >
                                                <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* Add Request Button */}
                                <button
                                    onClick={() => onAddRequest(collection.id)}
                                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-accent-primary/10 text-text-tertiary hover:text-accent-primary transition-all duration-150 border border-dashed border-transparent hover:border-accent-primary/30"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    <span className="text-xs font-medium">New Request</span>
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
