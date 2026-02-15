import { useState } from 'react';
import { CollectionItem, Request } from '../types';
import ContextMenu from './ContextMenu';

interface CollectionTreeItemProps {
    item: CollectionItem;
    collectionId: string;
    level: number;
    currentRequestId?: string;
    editingItemId?: string | null;
    onStartEdit?: (itemId: string) => void;
    onStopEdit?: () => void;
    onSelectRequest: (request: Request, requestId: string, collectionId: string) => void;
    onToggleExpand: (itemId: string) => void;
    onRename: (itemId: string, newName: string) => void;
    onDelete: (itemId: string) => void;
    onAddRequest: (parentId: string) => void;
    onAddFolder: (parentId: string | null) => void;
    onMoveItem: (collectionId: string, sourceItemId: string, targetItemId: string | null, sourceCollectionId: string | null) => void;
    searchTerm: string;
}

export default function CollectionTreeItem({
    item,
    collectionId,
    level,
    currentRequestId,
    editingItemId,
    onStartEdit,
    onStopEdit,
    onSelectRequest,
    onToggleExpand,
    onRename,
    onDelete,
    onAddRequest,
    onAddFolder,
    onMoveItem,
    searchTerm = '',
}: CollectionTreeItemProps) {
    const [editName, setEditName] = useState(item.name);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

    const indent = level * 16;

    // Use controlled editing from props or fallback to internal
    const isEditing = editingItemId === item.id;

    const handleSaveRename = () => {
        if (editName.trim() && editName !== item.name) {
            onRename(item.id, editName.trim());
        }
        if (onStopEdit) onStopEdit();
    };

    const getMethodColor = (method: string) => {
        const colors: Record<string, string> = {
            GET: 'bg-green-500',
            POST: 'bg-orange-500',
            PUT: 'bg-blue-500',
            DELETE: 'bg-red-500',
            PATCH: 'bg-purple-500',
        };
        return colors[method] || 'bg-gray-500';
    };

    const renderHighlightedText = (text: string) => {
        if (!searchTerm) return text;

        const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
        return parts.map((part, i) =>
            part.toLowerCase() === searchTerm.toLowerCase() ?
                <span key={i} className="bg-yellow-500/50 text-white rounded px-0.5">{part}</span> :
                part
        );
    };

    const [isDragOver, setIsDragOver] = useState(false);

    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('sourceId', item.id);
        e.dataTransfer.setData('collectionId', collectionId);
        e.dataTransfer.effectAllowed = 'move';
        e.stopPropagation();
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!isDragOver) setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const sourceId = e.dataTransfer.getData('sourceId');
        const sourceColId = e.dataTransfer.getData('collectionId');

        // Allow move if source is different or collection is different
        if (sourceId !== item.id) {
            // Pass sourceCollectionId as 4th argument if needed, or handle in App.tsx
            // Current signature: onMoveItem(collectionId, sourceItemId, targetItemId)
            // We need to change signature to support cross-collection
            onMoveItem(collectionId, sourceId, item.id, sourceColId || null);
        }
    };

    if (item.type === 'folder') {
        return (
            <>
                <div
                    className={`flex items-center gap-1 p-2 rounded group relative transition-colors ${isDragOver ? 'bg-accent-primary/20 border-2 border-accent-primary' : 'hover:bg-bg-tertiary/50 border-2 border-transparent'
                        }`}
                    style={{ paddingLeft: `${indent + 8}px` }}
                    draggable={!isEditing}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {/* Indent guide lines */}
                    {level > 0 && Array.from({ length: level }).map((_, idx) => (
                        <div
                            key={idx}
                            className="absolute top-0 bottom-0 w-px bg-gray-700/40"
                            style={{ left: `${idx * 16 + 8}px` }}
                        />
                    ))}

                    {/* Expand/Collapse Arrow */}
                    <button
                        onClick={() => onToggleExpand(item.id)}
                        className="p-0.5 hover:bg-bg-primary rounded flex-shrink-0"
                    >
                        <svg
                            className={`w-3 h-3 text-text-tertiary transition-transform ${item.isExpanded ? 'rotate-90' : ''
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

                    {/* Folder Icon */}
                    <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    </svg>

                    {/* Folder Name */}
                    {isEditing ? (
                        <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={handleSaveRename}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename();
                                if (e.key === 'Escape') {
                                    setEditName(item.name);
                                    if (onStopEdit) onStopEdit();
                                }
                            }}
                            className="flex-1 px-2 py-1 bg-bg-tertiary border border-accent-secondary rounded text-sm focus:outline-none"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <span
                            className="text-sm flex-1 cursor-pointer"
                            onDoubleClick={() => onStartEdit && onStartEdit(item.id)}
                        >
                            {renderHighlightedText(item.name)}
                        </span>
                    )}

                    {/* Three-dots Menu */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setContextMenu({ x: e.clientX, y: e.clientY });
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-bg-primary rounded flex-shrink-0"
                    >
                        <svg className="w-4 h-4 text-text-tertiary" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                    </button>
                </div>

                {/* Children */}
                {item.isExpanded && item.children && (
                    <div>
                        {[...item.children]
                            .sort((a, b) => {
                                // Requests first, then folders
                                if (a.type === 'request' && b.type === 'folder') return -1;
                                if (a.type === 'folder' && b.type === 'request') return 1;
                                return 0;
                            })
                            .map((child) => (
                                <CollectionTreeItem
                                    key={child.id}
                                    item={child}
                                    collectionId={collectionId}
                                    level={level + 1}
                                    currentRequestId={currentRequestId}
                                    editingItemId={editingItemId}
                                    onStartEdit={onStartEdit}
                                    onStopEdit={onStopEdit}
                                    onSelectRequest={onSelectRequest}
                                    onToggleExpand={onToggleExpand}
                                    onRename={onRename}
                                    onDelete={onDelete}
                                    onAddRequest={onAddRequest}
                                    onAddFolder={onAddFolder}
                                    onMoveItem={onMoveItem}
                                    searchTerm={searchTerm}
                                />
                            ))}
                    </div>
                )}

                {/* Context Menu */}
                {contextMenu && (
                    <ContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        onClose={() => setContextMenu(null)}
                        onRename={() => {
                            if (onStartEdit) onStartEdit(item.id);
                            setContextMenu(null);
                        }}
                        onDelete={() => onDelete(item.id)}
                        onAddRequest={() => onAddRequest(item.id)}
                        onAddFolder={() => onAddFolder(item.id)}
                    />
                )}
            </>
        );
    }

    // Request item
    const request = item.request;
    const isActive = currentRequestId === item.id;

    return (
        <>
            <div
                className={`flex items-center gap-2 p-2 rounded transition-all duration-150 group relative border-2 ${isDragOver
                    ? 'bg-accent-primary/20 border-accent-primary'
                    : isActive
                        ? 'bg-accent-secondary/20 border-accent-secondary/40'
                        : 'hover:bg-bg-tertiary/50 border-transparent'
                    }`}
                style={{ paddingLeft: `${indent + 8}px` }}
                draggable={!isEditing}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Indent guide lines */}
                {level > 0 && Array.from({ length: level }).map((_, idx) => (
                    <div
                        key={idx}
                        className="absolute top-0 bottom-0 w-px bg-gray-700/40"
                        style={{ left: `${idx * 16 + 8}px` }}
                    />
                ))}

                <button
                    onClick={() => onSelectRequest(request, item.id, collectionId)}
                    className="flex items-center gap-2 flex-1 min-w-0"
                >
                    <span className={`${getMethodColor(request.method)} text-white text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0`}>
                        {request.method}
                    </span>

                    {isEditing ? (
                        <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={handleSaveRename}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename();
                                if (e.key === 'Escape') {
                                    setEditName(item.name);
                                    if (onStopEdit) onStopEdit();
                                }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 px-2 py-1 bg-bg-tertiary border border-accent-secondary rounded text-xs focus:outline-none"
                            autoFocus
                        />
                    ) : (
                        <span
                            className="text-sm text-text-secondary group-hover:text-text-primary truncate"
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (onStartEdit) onStartEdit(item.id);
                            }}
                        >
                            {renderHighlightedText(item.name)}
                        </span>
                    )}
                </button>

                {/* Three-dots Menu */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setContextMenu({ x: e.clientX, y: e.clientY });
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-bg-primary rounded flex-shrink-0"
                >
                    <svg className="w-4 h-4 text-text-tertiary" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                </button>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    onRename={() => {
                        if (onStartEdit) onStartEdit(item.id);
                        setContextMenu(null);
                    }}
                    onDelete={() => onDelete(item.id)}
                    onAddRequest={() => onAddRequest(item.id)}
                    onAddFolder={() => onAddFolder(item.id)}
                />
            )}
        </>
    );
}
