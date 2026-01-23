import { useState, useRef, useEffect } from 'react';

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    onRename: () => void;
    onDelete: () => void;
    onAddRequest: () => void;
    onAddFolder: () => void;
}

export default function ContextMenu({
    x,
    y,
    onClose,
    onRename,
    onDelete,
    onAddRequest,
    onAddFolder,
}: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            className="fixed bg-bg-secondary border border-gray-600 rounded shadow-lg py-1 z-50 min-w-[180px]"
            style={{ top: `${y}px`, left: `${x}px` }}
        >
            <button
                onClick={() => { onRename(); onClose(); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-bg-tertiary transition-colors text-text-primary"
            >
                Rename
            </button>
            <button
                onClick={() => { onDelete(); onClose(); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-bg-tertiary transition-colors text-red-400"
            >
                Delete
            </button>
            <div className="border-t border-gray-700 my-1"></div>
            <button
                onClick={() => { onAddRequest(); onClose(); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-bg-tertiary transition-colors text-text-primary"
            >
                Add Request
            </button>
            <button
                onClick={() => { onAddFolder(); onClose(); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-bg-tertiary transition-colors text-text-primary"
            >
                Add Folder
            </button>
        </div>
    );
}
