import { Collection, Request, CollectionItem, Tab } from '../types'
import { useState } from 'react'
import { parseCurl } from '../utils/curlParser'
import { isSwaggerSpec, parseSwagger } from '../utils/swaggerParser'
import CollectionTreeItem from './CollectionTreeItem'
import ContextMenu from './ContextMenu'

interface SidebarProps {
    collections: Collection[]
    currentRequestId?: string | null
    onAddCollection: (name: string) => void
    onAddFullCollection: (collection: Collection) => void
    onDeleteCollection: (collectionId: string) => void
    onRenameCollection: (collectionId: string, newName: string) => void
    onToggleCollectionExpand: (collectionId: string) => void
    onAddRequest: (collectionId: string, parentId?: string) => void
    onImportRequest: (collectionId: string, request: Partial<Request>) => void | Promise<void>
    onAddFolder: (collectionId: string, parentId: string | null) => string | null | Promise<string | null>
    onMoveItem: (collectionId: string, sourceItemId: string, targetItemId: string | null, sourceCollectionId: string | null) => void
    onDeleteItem: (collectionId: string, itemId: string) => void
    onRenameItem: (collectionId: string, itemId: string, newName: string) => void
    onToggleItemExpand: (collectionId: string, itemId: string) => void
    onSelectRequest: (request: Request, requestId: string, collectionId: string) => void
    onRunCollection: (collectionId: string) => void
    onExportCollection?: (collectionId: string) => void
    onNewBlankRequest?: () => void
    standaloneRequests?: Request[]
    onSelectStandaloneRequest?: (request: Request) => void
    onDeleteStandaloneRequest?: (requestId: string) => void
    onRenameStandaloneRequest?: (requestId: string, newName: string) => void
    user?: { name: string; email?: string } | null
    onLogout?: () => void
    openTabs?: Tab[]
}

export default function Sidebar({
    collections,
    currentRequestId,
    onAddCollection,
    onAddFullCollection,
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
    onRunCollection,
    onExportCollection,
    onNewBlankRequest,
    standaloneRequests = [],
    onSelectStandaloneRequest,
    onDeleteStandaloneRequest,
    onRenameStandaloneRequest,
    user,
    onLogout,
    openTabs = [],
    onLogoClick,
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
    const [searchTerm, setSearchTerm] = useState('')
    const [editingStandaloneId, setEditingStandaloneId] = useState<string | null>(null)
    const [showAddCollectionMenu, setShowAddCollectionMenu] = useState(false)

    const filterCollections = (collections: Collection[], term: string): Collection[] => {
        if (!term) return collections

        const lowerTerm = term.toLowerCase()

        // Helper to filter items (recursive)
        const filterItems = (items: CollectionItem[]): CollectionItem[] => {
            return items
                .map((item): CollectionItem | null => {
                    // Request
                    if (item.type === 'request') {
                        if (item.name.toLowerCase().includes(lowerTerm)) {
                            return item
                        }
                        return null
                    }

                    // Folder
                    if (item.type === 'folder') {
                        const matchesSelf = item.name.toLowerCase().includes(lowerTerm)
                        const filteredChildren = item.children ? filterItems(item.children) : []

                        // Keep if matches self OR has matching children
                        if (matchesSelf || filteredChildren.length > 0) {
                            return {
                                ...item,
                                isExpanded: true, // Auto-expand to show matches
                                children: filteredChildren
                            }
                        }
                        return null
                    }
                    return null
                })
                .filter((item): item is CollectionItem => item !== null)
        }

        return collections
            .map((col): Collection | null => {
                const matchesSelf = col.name.toLowerCase().includes(lowerTerm)
                const filteredItems = filterItems(col.items)

                if (matchesSelf || filteredItems.length > 0) {
                    return {
                        ...col,
                        isExpanded: true, // Auto-expand
                        items: filteredItems
                    }
                }
                return null
            })
            .filter((col): col is Collection => col !== null)
    }

    const filteredCollections = filterCollections(collections, searchTerm)

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
                    <h2 className="text-lg font-bold" onClick={onLogoClick}>Collections</h2>
                    <div className="relative">
                        <button
                            onClick={() => setShowAddCollectionMenu(!showAddCollectionMenu)}
                            className="p-1 hover:bg-bg-tertiary rounded text-text-secondary hover:text-text-primary"
                            title="Add Collection"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                        {showAddCollectionMenu && (
                            <div className="absolute right-0 top-full mt-1 w-44 bg-bg-tertiary border border-gray-700 rounded shadow-xl z-20 py-1" style={{ marginRight: '-8px' }}>
                                <button
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-bg-primary"
                                    onClick={() => {
                                        handleAddCollection()
                                        setShowAddCollectionMenu(false)
                                    }}
                                >
                                    Blank Collection
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Search Input */}
                <div className="mb-3 relative">
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-bg-tertiary border border-gray-700 rounded px-2 py-1.5 pl-8 text-sm focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    />
                    <svg className="w-4 h-4 text-text-tertiary absolute left-2.5 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2 top-2 text-text-tertiary hover:text-text-primary"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            if (selectedCollectionId) {
                                onAddRequest(selectedCollectionId)
                            } else if (onNewBlankRequest) {
                                onNewBlankRequest()
                            } else if (collections.length > 0) {
                                onAddRequest(collections[0].id)
                            } else {
                                // No collections and no standalone handler
                            }
                        }}
                        className="flex-1 px-3 py-2 hover:bg-accent-primary/20 rounded border border-accent-primary/50 transition-all duration-200 hover:border-accent-primary text-sm font-medium text-accent-primary"
                        title="New Request"
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
            <div className="flex-1 overflow-y-auto p-2" onClick={() => setSelectedCollectionId('')}>
                {filteredCollections.length === 0 && standaloneRequests.length === 0 ? (
                    <div className="text-center text-text-tertiary mt-8 px-4">
                        <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <p className="text-sm">No collections yet</p>
                        <p className="text-xs mt-2 opacity-70">Click + to create one</p>
                    </div>
                ) : (
                    filteredCollections.map((collection) => (
                        <div key={collection.id} className="mb-3 bg-bg-primary/30 rounded-lg p-2">
                            {/* Collection Header */}
                            <div
                                className={`flex items-center gap-2 p-2 rounded hover:bg-bg-tertiary/50 group cursor-grab active:cursor-grabbing ${selectedCollectionId === collection.id ? 'bg-accent-primary/10 border border-accent-primary/30' : ''}`}
                                onClick={(e) => { e.stopPropagation(); setSelectedCollectionId(collection.id) }}
                                draggable={true}
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('collectionId', collection.id)
                                    // Use a special format or flag to indicate full collection drag if needed
                                    e.dataTransfer.setData('type', 'full-collection')
                                    e.dataTransfer.effectAllowed = 'copy'
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault()
                                    e.dataTransfer.dropEffect = 'move'
                                }}
                                onDrop={(e) => {
                                    e.preventDefault()
                                    const sourceId = e.dataTransfer.getData('sourceId')
                                    const sourceColId = e.dataTransfer.getData('collectionId')

                                    if (sourceId) {
                                        // Target is collection root (targetItemId = null)
                                        onMoveItem(collection.id, sourceId, null, sourceColId || null)
                                    }
                                }}
                            >
                                {/* Expand/Collapse Arrow */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation() // Prevent headers from collapsing when trying to drag? No, click is click.
                                        onToggleCollectionExpand(collection.id)
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()} // Prevent drag start on arrow
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
                                            className="font-bold flex-1 cursor-pointer"
                                            onDoubleClick={() => startEditCollection(collection.id, collection.name)}
                                        >
                                            {/* Highlight collection name if matches */}
                                            {searchTerm && collection.name.toLowerCase().includes(searchTerm.toLowerCase()) ?
                                                (() => {
                                                    const parts = collection.name.split(new RegExp(`(${searchTerm})`, 'gi'));
                                                    return parts.map((part, i) =>
                                                        part.toLowerCase() === searchTerm.toLowerCase() ?
                                                            <span key={i} className="bg-yellow-500/50 text-white rounded px-0.5">{part}</span> :
                                                            part
                                                    )
                                                })()
                                                : collection.name}
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
                            {
                                collection.isExpanded && (
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
                                                onAddFolder={async (parentId) => {
                                                    const folderId = await onAddFolder(collection.id, parentId)
                                                    if (folderId) setEditingItemId(folderId)
                                                }}
                                                searchTerm={searchTerm}
                                                openTabs={openTabs}
                                            />
                                        ))}
                                    </div>
                                )
                            }
                        </div>
                    ))
                )}

                {/* Standalone Requests (without collection) */}
                {standaloneRequests.map((req) => {
                    const isEditingSR = editingStandaloneId === req.id;
                    return (
                        <div
                            key={req.id}
                            className={`mb-1 flex items-center gap-2 p-2 rounded text-sm cursor-pointer group hover:bg-bg-tertiary/50 transition-all duration-150 border-2 ${currentRequestId === req.id ? 'bg-accent-secondary/20 border-accent-secondary/40' : 'border-transparent'}`}
                            onClick={() => !isEditingSR && onSelectStandaloneRequest?.(req)}
                            draggable={!isEditingSR}
                            onDragStart={(e) => {
                                e.dataTransfer.setData('sourceId', req.id)
                                e.dataTransfer.setData('collectionId', '') // Empty string for standalone
                                e.dataTransfer.effectAllowed = 'move'
                            }}
                        >
                            <span className={`font-bold text-[10px] px-1.5 py-0.5 rounded text-center select-none flex-shrink-0 ${req.method === 'GET' ? 'bg-green-500/20 text-green-400' :
                                req.method === 'POST' ? 'bg-orange-500/20 text-orange-400' :
                                    req.method === 'PUT' ? 'bg-blue-500/20 text-blue-400' :
                                        req.method === 'DELETE' ? 'bg-red-500/20 text-red-400' :
                                            'bg-purple-500/20 text-purple-400'
                                }`}>{req.method}</span>
                            {isEditingSR ? (
                                <input
                                    type="text"
                                    defaultValue={req.name}
                                    autoFocus
                                    className="flex-1 px-2 py-0.5 bg-bg-tertiary border border-accent-secondary rounded text-xs focus:outline-none"
                                    onBlur={(e) => {
                                        const newName = e.target.value.trim();
                                        if (newName && newName !== req.name) {
                                            onRenameStandaloneRequest?.(req.id, newName);
                                        }
                                        setEditingStandaloneId(null);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            (e.target as HTMLInputElement).blur();
                                        }
                                        if (e.key === 'Escape') {
                                            setEditingStandaloneId(null);
                                        }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <span
                                    className="flex-1 truncate text-text-secondary"
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        setEditingStandaloneId(req.id);
                                    }}
                                >{req.name}</span>
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); onDeleteStandaloneRequest?.(req.id) }}
                                className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-400 p-0.5"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Collection Context Menu */}
            {
                collectionContextMenu && (
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
                        onAddFolder={async () => {
                            const folderId = await onAddFolder(collectionContextMenu.collectionId, null)
                            if (folderId) setEditingItemId(folderId)
                            setCollectionContextMenu(null)
                        }}
                        onRunCollection={() => {
                            onRunCollection(collectionContextMenu.collectionId)
                            setCollectionContextMenu(null)
                        }}
                        onExportCollection={onExportCollection ? () => {
                            onExportCollection(collectionContextMenu.collectionId)
                            setCollectionContextMenu(null)
                        } : undefined}
                    />
                )
            }

            {/* Import Modal */}
            {
                showImportModal && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowImportModal(false)}>
                        <div className="bg-bg-secondary border border-gray-700 rounded-lg p-6 w-[650px] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <span>📥</span> Import
                            </h3>

                            {/* Format indicator */}
                            {curlInput.trim() && (
                                <div className="mb-3 flex items-center gap-2 text-sm">
                                    {isSwaggerSpec(curlInput) ? (
                                        <span className="px-2 py-1 bg-green-900/50 text-green-400 rounded">
                                            ✓ Swagger/OpenAPI detected
                                        </span>
                                    ) : curlInput.trim().toLowerCase().startsWith('curl') ? (
                                        <span className="px-2 py-1 bg-blue-900/50 text-blue-400 rounded">
                                            ✓ cURL command detected
                                        </span>
                                    ) : (
                                        <span className="px-2 py-1 bg-yellow-900/50 text-yellow-400 rounded">
                                            ⚠ Unknown format
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Target Collection - only for cURL */}
                            {(!curlInput.trim() || !isSwaggerSpec(curlInput)) && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-text-secondary mb-2">
                                        Target Collection <span className="text-text-tertiary">(optional for cURL)</span>
                                    </label>
                                    <select
                                        value={selectedCollectionId}
                                        onChange={(e) => setSelectedCollectionId(e.target.value)}
                                        className="w-full px-3 py-2 bg-bg-tertiary border border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-accent-secondary"
                                    >
                                        <option value="">-- Create new collection --</option>
                                        {collections.map((col) => (
                                            <option key={col.id} value={col.id}>{col.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-text-secondary mb-2">
                                    Paste cURL command or Swagger/OpenAPI JSON
                                </label>
                                <textarea
                                    value={curlInput}
                                    onChange={(e) => setCurlInput(e.target.value)}
                                    placeholder={`curl -X POST https://api.example.com/users \\
  -H "Content-Type: application/json" \\
  -d '{"name": "John"}'

--- or paste Swagger/OpenAPI JSON ---

{"swagger": "2.0", "info": {...}, "paths": {...}}`}
                                    className="w-full h-48 px-3 py-2 bg-bg-tertiary border border-gray-700 rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent-secondary resize-none"
                                />
                            </div>

                            <div className="border-t border-gray-700 pt-4 mt-2 mb-4">
                                <label className="block text-sm font-medium text-text-secondary mb-2">
                                    Or import from a JSON file
                                </label>
                                <label className="inline-flex items-center gap-2 px-4 py-2 bg-bg-tertiary border border-gray-600 rounded cursor-pointer hover:bg-bg-primary transition-colors text-sm">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    Choose File
                                    <input
                                        type="file"
                                        accept=".json"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            if (!file) return
                                            const reader = new FileReader()
                                            reader.onload = (event) => {
                                                try {
                                                    const data = JSON.parse(event.target?.result as string)
                                                    // Check if it's a valid collection
                                                    if (data.id && data.name && data.items) {
                                                        onAddFullCollection(data as Collection)
                                                        setShowImportModal(false)
                                                        setCurlInput('')
                                                    } else if (isSwaggerSpec(event.target?.result as string)) {
                                                        const result = parseSwagger(event.target?.result as string)
                                                        if (result.success && result.collection) {
                                                            onAddFullCollection(result.collection)
                                                            setShowImportModal(false)
                                                            setCurlInput('')
                                                        } else {
                                                            alert(`Failed to parse Swagger: ${result.error}`)
                                                        }
                                                    } else {
                                                        alert('Invalid collection file. Expected a JSON with id, name, and items fields.')
                                                    }
                                                } catch {
                                                    alert('Failed to parse JSON file.')
                                                }
                                            }
                                            reader.readAsText(file)
                                            e.target.value = ''
                                        }}
                                    />
                                </label>
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
                                        const input = curlInput.trim()
                                        if (!input) return

                                        // Try Swagger/OpenAPI
                                        if (isSwaggerSpec(input)) {
                                            const result = parseSwagger(input)
                                            if (result.success && result.collection) {
                                                onAddFullCollection(result.collection)
                                                setShowImportModal(false)
                                                setCurlInput('')
                                            } else {
                                                alert(`Failed to parse Swagger: ${result.error}`)
                                            }
                                            return
                                        }

                                        // Try cURL
                                        const parsed = parseCurl(input)
                                        if (parsed && parsed.url) {
                                            if (selectedCollectionId) {
                                                onImportRequest(selectedCollectionId, parsed)
                                            } else {
                                                // Create new collection with this request
                                                const requestName = parsed.name || parsed.url?.split('/').pop() || 'Imported Request'
                                                onAddCollection(requestName)
                                                alert('Collection created! Please select it and import again, or select an existing collection.')
                                            }
                                            setShowImportModal(false)
                                            setCurlInput('')
                                        } else {
                                            alert('Failed to parse. Please check the format (cURL or Swagger/OpenAPI JSON).')
                                        }
                                    }}
                                    className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/80 text-white rounded transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={!curlInput.trim()}
                                >
                                    Import
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* User Profile Section */}
            {user && (
                <div className="p-4 border-t border-gray-700 bg-bg-tertiary/30">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-accent-primary text-white`}>
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="overflow-hidden">
                                <div className="text-sm font-semibold truncate text-text-primary">{user.name}</div>
                                <div className="text-xs text-text-tertiary">{user.email}</div>
                            </div>
                        </div>
                        <button
                            onClick={onLogout}
                            className="p-1.5 text-text-secondary hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                            title="Logout"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* New Collection Modal */}
            {
                showNewCollectionModal && (
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
                )
            }
        </div >
    )
}
