import { useRef, useEffect } from 'react';

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    onRename: () => void;
    onDelete: () => void;
    onAddRequest: () => void;
    onAddFolder: () => void;
    onRunCollection?: () => void;
}

export default function ContextMenu({
    x,
    y,
    onClose,
    onRename,
    onDelete,
    onAddRequest,
    onAddFolder,
    onRunCollection,
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
            {onRunCollection && (
                <>
                    <button
                        onClick={() => { onRunCollection(); onClose(); }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-bg-tertiary transition-colors text-green-400 flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                        Run Collection
                    </button>
                    <div className="border-t border-gray-700 my-1"></div>
                </>
            )}
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
