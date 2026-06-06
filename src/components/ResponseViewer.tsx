import { Response } from '../types'
import JsonViewer from './JsonViewer'
import { useState } from 'react'

interface ResponseViewerProps {
    response: Response | null
}

export default function ResponseViewer({ response }: ResponseViewerProps) {
    const [searchText, setSearchText] = useState('')

    if (!response) {
        return (
            <div className="flex-1 flex items-center justify-center text-text-tertiary p-8">
                <div className="text-center">
                    <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p>Response will appear here</p>
                </div>
            </div>
        )
    }

    if (response.loading) {
        return (
            <div className="flex-1 flex items-center justify-center text-text-tertiary p-8">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div>
                    <p>Sending request...</p>
                </div>
            </div>
        )
    }

    if (response.error) {
        return (
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="flex flex-col items-center gap-5">
                    {/* Error message */}
                    <div className="bg-red-900/20 border border-red-800 rounded-lg px-6 py-3">
                        <p className="text-red-300 font-mono text-sm">{response.message}</p>
                    </div>
                    {/* Warning triangle */}
                    <svg className="w-24 h-24 text-bg-tertiary" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 16h2v2h-2zm0-6h2v4h-2z" />
                    </svg>
                </div>
            </div>
        )
    }

    const getStatusColor = (status: number) => {
        if (status >= 200 && status < 300) return 'text-green-400'
        if (status >= 300 && status < 400) return 'text-blue-400'
        if (status >= 400 && status < 500) return 'text-orange-400'
        return 'text-red-400'
    }

    const formatJson = (data: any) => {
        // If it's already a string (HTML, plain text), pass through directly
        if (typeof data === 'string') return data
        try {
            return JSON.stringify(data, null, 2)
        } catch {
            return String(data)
        }
    }

    return (
        <div className="flex-1 flex flex-col p-6 min-h-0 overflow-hidden">
            {/* Response Header */}
            <div className="mb-4 flex items-center justify-between gap-4 flex-shrink-0">
                <div className="flex items-center gap-4 flex-1">
                    <h3 className="text-lg font-bold">Response</h3>
                    {/* Search Input */}
                    <div className="relative flex-1 max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-4 w-4 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Search in response..."
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            className="w-full bg-bg-tertiary border border-gray-700 rounded-md py-1.5 pl-10 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-accent-primary focus:border-accent-primary transition-all placeholder-text-tertiary"
                        />
                        {searchText && (
                            <button
                                onClick={() => setSearchText('')}
                                className="absolute inset-y-0 right-0 pr-2 flex items-center text-text-tertiary hover:text-text-primary"
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 bg-bg-primary px-3 py-1 rounded border border-gray-700">
                        <span className={`text-lg font-bold ${getStatusColor(response.status!)}`}>
                            {response.status} {response.statusText}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-text-tertiary uppercase font-bold tracking-wider">Time:</span>
                        <span className="text-sm font-semibold text-text-secondary">{response.time} ms</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-text-tertiary uppercase font-bold tracking-wider">Size:</span>
                        <span className="text-sm font-semibold text-text-secondary">
                            {new TextEncoder().encode(JSON.stringify(response.body)).length} B
                        </span>
                    </div>
                </div>
            </div>

            {/* Response Body */}
            <div className="flex-1 min-h-0 bg-bg-tertiary border border-gray-700 rounded overflow-auto p-4">
                <JsonViewer json={formatJson(response.body)} searchText={searchText} />
            </div>
        </div>
    )
}
