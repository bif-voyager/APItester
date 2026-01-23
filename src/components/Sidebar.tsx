import { Collection, Request } from '../types'
import { useState } from 'react'
import { parseCurl } from '../utils/curlParser'
import CollectionTreeItem from './CollectionTreeItem'
import ContextMenu from './ContextMenu'

interface SidebarProps {
    collections: Collection[]
    currentRequestId?: string | null
    onAddCollection: (name: string) => void
    onDeleteCollection: (collectionId: string) => void
    onRenameCollection: (collectionId: string, newName: string) => void
    onToggleCollectionExpand: (collectionId: string) => void
    onAddRequest: (collectionId: string, parentId?: string) => void
    onImportRequest: (collectionId: string, requestData: Partial<Request>) => void
    onAddFolder: (collectionId: string, parentId: string | null) => string | null
    onMoveItem: (collectionId: string, sourceItemId: string, targetItemId: string | null) => void
    onDeleteItem: (collectionId: string, itemId: string) => void
    onRenameItem: (collectionId: string, itemId: string, newName: string) => void
    onToggleItemExpand: (collectionId: string, itemId: string) => void
    onSelectRequest: (request: Request, requestId: string, collectionId: string) => void
}

export default function Sidebar({
    collections,
    currentRequestId,
    onAddCollection,
    onDeleteCollection,
    onRenameCollection,
    onToggleCollectionExpand,
    onAddRequest,
    onImportRequest,
    onAddFolder,
    onDeleteItem,
    onRenameItem,
    onToggleItemExpand,
    onSelectRequest,
    onMoveItem,
}: SidebarProps) {
    const [editingCollection, setEditingCollection] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    const [editingItemId, setEditingItemId] = useState<string | null>(null)
    const [showImportModal, setShowImportModal] = useState(false)
    const [showNewCollectionModal, setShowNewCollectionModal] = useState(false)
    const [newCollectionName, setNewCollectionName] = useState('')
    const [curlInput, setCurlInput] = useState('')
    const [selectedCollectionId, setSelectedCollectionId] = useState<string>('')
    const [collectionContextMenu, setCollectionContextMenu] = useState<{
        collectionId: string
        x: number
        y: number
    } | null>(null)

    const handleAddCollection = () => {
        setNewCollectionName('')
        setShowNewCollectionModal(true)
    }

    const createCollection = () => {
        if (newCollectionName.trim()) {
            onAddCollection(newCollectionName.trim())
            setShowNewCollectionModal(false)
            setNewCollectionName('')
        }
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

    return (
        <div className="w-72 bg-bg-secondary border-r border-gray-700 flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-bold">Collections</h2>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleAddCollection}
                        className="flex-1 px-3 py-2 hover:bg-accent-primary/20 rounded border border-accent-primary/50 transition-all duration-200 hover:border-accent-primary text-sm font-medium text-accent-primary"
                        title="New Collection"
                    >
                        + New
                    </button>
                    <button
                        onClick={() => {
                            setShowImportModal(true)
                            setCurlInput('')
                            setSelectedCollectionId(collections[0]?.id || '')
                        }}
                        className="flex-1 px-3 py-2 hover:bg-accent-secondary/20 rounded border border-accent-secondary/50 transition-all duration-200 hover:border-accent-secondary text-sm font-medium text-accent-secondary"
                        title="Import from cURL"
                    >
                        📥 Import
                    </button>
                </div>
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
                                {/* Expand/Collapse Arrow */}
                                <button
                                    onClick={() => onToggleCollectionExpand(collection.id)}
                                    className="p-0.5 hover:bg-bg-primary rounded flex-shrink-0"
                                >
                                    <svg
                                        className={`w-3 h-3 text-text-tertiary transition-transform ${collection.isExpanded ? 'rotate-90' : ''
                                            }`}
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                </button>

                                {/* Collection Icon */}
                                <svg className="w-4 h-4 text-accent-secondary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                </svg>

                                {/* Collection Name */}
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
                                            {/* Quick Add Button */}
                                            <button
                                                onClick={() => onAddRequest(collection.id)}
                                                className="p-1 hover:bg-bg-primary rounded"
                                                title="Add Request"
                                            >
                                                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                </svg>
                                            </button>
                                            {/* Three-dots Menu */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setCollectionContextMenu({
                                                        collectionId: collection.id,
                                                        x: e.clientX,
                                                        y: e.clientY,
                                                    })
                                                }}
                                                className="p-1 hover:bg-bg-primary rounded"
                                                title="More options"
                                            >
                                                <svg className="w-4 h-4 text-text-tertiary" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Collection Items (Tree) */}
                            {collection.isExpanded && (
                                <div className="ml-2 mt-1">
                                    {collection.items.map((item) => (
                                        <CollectionTreeItem
                                            key={item.id}
                                            item={item}
                                            collectionId={collection.id}
                                            level={0}
                                            currentRequestId={currentRequestId || undefined}
                                            editingItemId={editingItemId}
                                            onMoveItem={onMoveItem}
                                            onStartEdit={(itemId) => setEditingItemId(itemId)}
                                            onStopEdit={() => setEditingItemId(null)}
                                            onSelectRequest={(req, reqId) => onSelectRequest(req, reqId, collection.id)}
                                            onToggleExpand={(itemId) => onToggleItemExpand(collection.id, itemId)}
                                            onRename={(itemId, newName) => onRenameItem(collection.id, itemId, newName)}
                                            onDelete={(itemId) => onDeleteItem(collection.id, itemId)}
                                            onAddRequest={(parentId) => onAddRequest(collection.id, parentId)}
                                            onAddFolder={(parentId) => {
                                                const folderId = onAddFolder(collection.id, parentId)
                                                if (folderId) setEditingItemId(folderId)
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Collection Context Menu */}
            {collectionContextMenu && (
                <ContextMenu
                    x={collectionContextMenu.x}
                    y={collectionContextMenu.y}
                    onClose={() => setCollectionContextMenu(null)}
                    onRename={() => {
                        const col = collections.find(c => c.id === collectionContextMenu.collectionId)
                        if (col) {
                            startEditCollection(collectionContextMenu.collectionId, col.name)
                        }
                        setCollectionContextMenu(null)
                    }}
                    onDelete={() => {
                        onDeleteCollection(collectionContextMenu.collectionId)
                        setCollectionContextMenu(null)
                    }}
                    onAddRequest={() => {
                        onAddRequest(collectionContextMenu.collectionId)
                        setCollectionContextMenu(null)
                    }}
                    onAddFolder={() => {
                        const folderId = onAddFolder(collectionContextMenu.collectionId, null)
                        if (folderId) setEditingItemId(folderId)
                        setCollectionContextMenu(null)
                    }}
                />
            )}

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowImportModal(false)}>
                    <div className="bg-bg-secondary border border-gray-700 rounded-lg p-6 w-[600px] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <span>📥</span> Import from cURL
                        </h3>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Target Collection
                            </label>
                            <select
                                value={selectedCollectionId}
                                onChange={(e) => setSelectedCollectionId(e.target.value)}
                                className="w-full px-3 py-2 bg-bg-tertiary border border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-accent-secondary"
                            >
                                {collections.length === 0 && (
                                    <option value="">No collections available</option>
                                )}
                                {collections.map((col) => (
                                    <option key={col.id} value={col.id}>{col.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Paste cURL Command
                            </label>
                            <textarea
                                value={curlInput}
                                onChange={(e) => setCurlInput(e.target.value)}
                                placeholder={`curl -X POST https://api.example.com/users \\\\\n  -H "Content-Type: application/json" \\\\\n  -d '{"name": "John"}'`}
                                className="w-full h-40 px-3 py-2 bg-bg-tertiary border border-gray-700 rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent-secondary resize-none"
                            />
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowImportModal(false)}
                                className="px-4 py-2 border border-text-tertiary/30 rounded hover:bg-bg-tertiary transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (!selectedCollectionId) {
                                        alert('Please select a collection first')
                                        return
                                    }

                                    const parsed = parseCurl(curlInput)
                                    if (parsed && parsed.url) {
                                        onImportRequest(selectedCollectionId, parsed)
                                        setShowImportModal(false)
                                        setCurlInput('')
                                    } else {
                                        alert('Failed to parse cURL command. Please check the format.')
                                    }
                                }}
                                className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/80 text-white rounded transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!curlInput.trim() || !selectedCollectionId || collections.length === 0}
                            >
                                Import
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* New Collection Modal */}
            {showNewCollectionModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowNewCollectionModal(false)}>
                    <div className="bg-bg-secondary border border-gray-700 rounded-lg p-6 w-[500px] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <svg className="w-6 h-6 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                            Create New Collection
                        </h3>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Collection Name
                            </label>
                            <input
                                type="text"
                                value={newCollectionName}
                                onChange={(e) => setNewCollectionName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') createCollection()
                                    if (e.key === 'Escape') setShowNewCollectionModal(false)
                                }}
                                placeholder="My API Collection"
                                className="w-full px-3 py-2 bg-bg-tertiary border border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowNewCollectionModal(false)}
                                className="px-4 py-2 border border-text-tertiary/30 rounded hover:bg-bg-tertiary transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createCollection}
                                disabled={!newCollectionName.trim()}
                                className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/80 text-white rounded transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
