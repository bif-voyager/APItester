import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export interface AlertModalProps {
    isOpen: boolean
    title: string
    message: string
    type?: 'success' | 'error' | 'info'
    onClose: () => void
}

export default function AlertModal({
    isOpen,
    title,
    message,
    type = 'info',
    onClose,
}: AlertModalProps) {
    const buttonRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        if (isOpen) {
            buttonRef.current?.focus()
        }
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleEsc)
        return () => window.removeEventListener('keydown', handleEsc)
    }, [isOpen, onClose])

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={onClose}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="bg-bg-secondary border border-gray-700 rounded-lg p-6 w-[400px] max-w-[90vw] shadow-2xl relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Icon based on type */}
                        <div className="flex items-start gap-4">
                            <div className={`mt-1 p-2 rounded-full ${type === 'success' ? 'bg-green-500/10 text-green-500' :
                                    type === 'error' ? 'bg-red-500/10 text-red-500' :
                                        'bg-blue-500/10 text-blue-500'
                                }`}>
                                {type === 'success' && (
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                                {type === 'error' && (
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                )}
                                {type === 'info' && (
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                )}
                            </div>

                            <div className="flex-1">
                                <h3 className="text-lg font-semibold mb-2 text-text-primary">{title}</h3>
                                <p className="text-sm text-text-secondary mb-6 leading-relaxed">{message}</p>

                                <div className="flex justify-end">
                                    <button
                                        ref={buttonRef}
                                        onClick={onClose}
                                        className={`px-6 py-2 rounded font-medium text-white transition-colors shadow-lg ${type === 'success' ? 'bg-green-600 hover:bg-green-700' :
                                                type === 'error' ? 'bg-red-600 hover:bg-red-700' :
                                                    'bg-accent-primary hover:bg-orange-600'
                                            }`}
                                    >
                                        Okay
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
