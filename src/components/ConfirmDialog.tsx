import { useEffect, useRef } from 'react'

export interface ConfirmDialogProps {
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
    onConfirm: () => void
    onCancel: () => void
}

export default function ConfirmDialog({
    title,
    message,
    confirmLabel = 'Delete',
    cancelLabel = 'Cancel',
    danger = true,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const cancelRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        cancelRef.current?.focus()
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel()
        }
        window.addEventListener('keydown', handleEsc)
        return () => window.removeEventListener('keydown', handleEsc)
    }, [onCancel])

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={onCancel}>
            <div
                className="bg-bg-secondary border border-gray-700 rounded-lg p-5 w-[380px] max-w-[90vw] shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-base font-semibold mb-2 text-text-primary">{title}</h3>
                <p className="text-sm text-text-secondary mb-5">{message}</p>
                <div className="flex justify-end gap-2">
                    <button
                        ref={cancelRef}
                        onClick={onCancel}
                        className="px-4 py-1.5 text-sm rounded bg-bg-tertiary hover:bg-gray-600 text-text-primary transition-colors"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-1.5 text-sm rounded text-white transition-colors ${danger
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-accent-primary hover:bg-orange-600'
                            }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
