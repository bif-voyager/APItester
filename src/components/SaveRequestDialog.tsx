import { useState } from 'react'
import { Collection, CollectionItem } from '../types'

interface SaveRequestDialogProps {
    requestName: string
    collections: Collection[]
    onSave: (collectionId: string | null, folderId: string | null) => void
    onCancel: () => void
}

interface FolderOption {
    id: string
    name: string
    level: number
}

function getFolders(items: CollectionItem[], level = 0): FolderOption[] {
    const folders: FolderOption[] = []
    for (const item of items) {
        if (item.type === 'folder') {
            folders.push({ id: item.id, name: item.name, level })
            folders.push(...getFolders(item.children, level + 1))
        }
    }
    return folders
}

export default function SaveRequestDialog({
    requestName,
    collections,
    onSave,
    onCancel,
}: SaveRequestDialogProps) {
    const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)

    const selectedCollection = collections.find(c => c.id === selectedCollectionId)
    const folders = selectedCollection ? getFolders(selectedCollection.items) : []

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={onCancel}
            onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
        >
            <div
                className="bg-bg-secondary border border-gray-700 rounded-lg shadow-2xl w-[420px] max-h-[70vh] flex flex-col animate-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-gray-700">
                    <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                        <svg className="w-5 h-5 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Save Request
                    </h3>
                    <p className="text-sm text-text-tertiary mt-1 truncate">
                        Saving "<span className="text-text-secondary">{requestName}</span>"
                    </p>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 overflow-y-auto space-y-3">
                    {/* Collection Selection */}
                    <div>
                        <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                            Collection
                        </label>
                        <div className="space-y-1 max-h-[200px] overflow-y-auto">
                            {/* No Collection option */}
                            <button
                                onClick={() => {
                                    setSelectedCollectionId(null)
                                    setSelectedFolderId(null)
                                }}
                                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${selectedCollectionId === null
                                        ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/40'
                                        : 'hover:bg-bg-tertiary text-text-secondary border border-transparent'
                                    }`}
                            >
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Without collection
                            </button>

                            {/* Collections */}
                            {collections.map(col => (
                                <button
                                    key={col.id}
                                    onClick={() => {
                                        setSelectedCollectionId(col.id)
                                        setSelectedFolderId(null)
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${selectedCollectionId === col.id
                                            ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/40'
                                            : 'hover:bg-bg-tertiary text-text-secondary border border-transparent'
                                        }`}
                                >
                                    <span className="flex-shrink-0">📁</span>
                                    <span className="truncate">{col.name}</span>
                                    <span className="ml-auto text-xs text-text-tertiary">{col.items.length}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Folder Selection (only when collection is selected) */}
                    {selectedCollectionId && folders.length > 0 && (
                        <div>
                            <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                                Folder <span className="font-normal">(optional)</span>
                            </label>
                            <div className="space-y-1 max-h-[150px] overflow-y-auto">
                                <button
                                    onClick={() => setSelectedFolderId(null)}
                                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${selectedFolderId === null
                                            ? 'bg-accent-secondary/20 text-accent-secondary border border-accent-secondary/40'
                                            : 'hover:bg-bg-tertiary text-text-secondary border border-transparent'
                                        }`}
                                >
                                    / Root
                                </button>
                                {folders.map(folder => (
                                    <button
                                        key={folder.id}
                                        onClick={() => setSelectedFolderId(folder.id)}
                                        className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center gap-1 ${selectedFolderId === folder.id
                                                ? 'bg-accent-secondary/20 text-accent-secondary border border-accent-secondary/40'
                                                : 'hover:bg-bg-tertiary text-text-secondary border border-transparent'
                                            }`}
                                        style={{ paddingLeft: `${folder.level * 16 + 12}px` }}
                                    >
                                        <span className="flex-shrink-0">📂</span>
                                        <span className="truncate">{folder.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-700 flex justify-end gap-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm text-text-secondary hover:bg-bg-tertiary rounded transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(selectedCollectionId, selectedFolderId)}
                        className="px-4 py-2 text-sm bg-accent-primary text-white rounded hover:brightness-110 transition-all font-medium"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    )
}
