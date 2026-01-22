import { Response } from '../types'
import JsonViewer from './JsonViewer'

interface ResponseViewerProps {
    response: Response | null
}

export default function ResponseViewer({ response }: ResponseViewerProps) {
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
            <div className="flex-1 p-6">
                <div className="mb-4">
                    <h3 className="text-lg font-bold text-red-400">Error</h3>
                </div>
                <div className="bg-red-900/20 border border-red-800 rounded p-4">
                    <p className="text-red-300 font-mono text-sm">{response.message}</p>
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
        try {
            return JSON.stringify(data, null, 2)
        } catch {
            return String(data)
        }
    }

    return (
        <div className="flex-1 flex flex-col p-6">
            {/* Response Header */}
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold">Response</h3>
                <div className="flex items-center gap-4 text-sm">
                    <span className={`font-bold ${getStatusColor(response.status!)}`}>
                        {response.status} {response.statusText}
                    </span>
                    <span className="text-text-tertiary">|</span>
                    <span className="text-text-secondary">{response.time}ms</span>
                </div>
            </div>

            {/* Response Body */}
            <div className="flex-1 bg-bg-tertiary border border-gray-700 rounded overflow-hidden">
                <div className="h-full overflow-auto p-4">
                    <JsonViewer json={formatJson(response.body)} />
                </div>
            </div>
        </div>
    )
}
