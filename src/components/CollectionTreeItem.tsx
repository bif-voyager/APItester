import { useState } from 'react';
import { CollectionItem, Request } from '../types';
import ContextMenu from './ContextMenu';

interface CollectionTreeItemProps {
    item: CollectionItem;
    collectionId: string;
    level: number;
    currentRequestId?: string;
    onSelectRequest: (request: Request, collectionId: string) => void;
    onToggleExpand: (itemId: string) => void;
    onRename: (itemId: string, newName: string) => void;
    onDelete: (itemId: string) => void;
    onAddRequest: (parentId: string) => void;
    onAddFolder: (parentId: string) => void;
}

export default function CollectionTreeItem({
    item,
    collectionId,
    level,
    currentRequestId,
    onSelectRequest,
    onToggleExpand,
    onRename,
    onDelete,
    onAddRequest,
    onAddFolder,
}: CollectionTreeItemProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(item.name);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

    const indent = level * 16;

    const handleSaveRename = () => {
        if (editName.trim() && editName !== item.name) {
            onRename(item.id, editName.trim());
        }
        setIsEditing(false);
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

    if (item.type === 'folder') {
        return (
            <>
                <div
                    className="flex items-center gap-1 p-2 rounded hover:bg-bg-tertiary/50 group relative"
                    style={{ paddingLeft: `${indent + 8}px` }}
                >
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
                                    setIsEditing(false);
                                }
                            }}
                            className="flex-1 px-2 py-1 bg-bg-tertiary border border-accent-secondary rounded text-sm focus:outline-none"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <span
                            className="text-sm flex-1 cursor-pointer"
                            onDoubleClick={() => setIsEditing(true)}
                        >
                            {item.name}
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
                        {item.children.map((child) => (
                            <CollectionTreeItem
                                key={child.id}
                                item={child}
                                collectionId={collectionId}
                                level={level + 1}
                                currentRequestId={currentRequestId}
                                onSelectRequest={onSelectRequest}
                                onToggleExpand={onToggleExpand}
                                onRename={onRename}
                                onDelete={onDelete}
                                onAddRequest={onAddRequest}
                                onAddFolder={onAddFolder}
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
                        onRename={() => setIsEditing(true)}
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
                className={`flex items-center gap-2 p-2 rounded transition-all duration-150 group ${isActive
                        ? 'bg-accent-secondary/20 border border-accent-secondary/40'
                        : 'hover:bg-bg-tertiary/50 border border-transparent'
                    }`}
                style={{ paddingLeft: `${indent + 8}px` }}
            >
                <button
                    onClick={() => onSelectRequest(request, collectionId)}
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
                                    setIsEditing(false);
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
                                setIsEditing(true);
                            }}
                        >
                            {item.name}
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
                    onRename={() => setIsEditing(true)}
                    onDelete={() => onDelete(item.id)}
                    onAddRequest={() => onAddRequest(item.id)}
                    onAddFolder={() => onAddFolder(item.id)}
                />
            )}
        </>
    );
}
