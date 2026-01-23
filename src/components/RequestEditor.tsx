import { useState } from 'react'
import { Request, KeyValue } from '../types'
import EditableJsonViewer from './EditableJsonViewer'
import MethodDropdown from './MethodDropdown'

interface RequestEditorProps {
    request: Request | null
    onSendRequest: (request: Request) => void
    onUpdateRequest: (request: Request) => void
}

export default function RequestEditor({
    request,
    onSendRequest,
    onUpdateRequest
}: RequestEditorProps) {
    const [activeTab, setActiveTab] = useState('params')
    const [openDropdown, setOpenDropdown] = useState<number | null>(null)

    const commonHeaders = [
        'Accept', 'Accept-Charset', 'Accept-Encoding', 'Accept-Language',
        'Authorization', 'Cache-Control', 'Content-Type', 'Content-Length',
        'Content-Encoding', 'Cookie', 'Host', 'Origin', 'Referer',
        'User-Agent', 'X-Requested-With', 'X-API-Key', 'X-Auth-Token'
    ]

    if (!request) {
        return (
            <div className="flex-1 flex items-center justify-center text-text-tertiary">
                <div className="text-center">
                    <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <p className="text-lg">Select a request or create a new one</p>
                </div>
            </div>
        )
    }

    const updateRequest = (updates: Partial<Request>) => {
        onUpdateRequest({ ...request, ...updates })
    }

    const addRow = (field: 'params' | 'headers') => {
        const newRow: KeyValue = { key: '', value: '', enabled: true }
        updateRequest({
            [field]: [...request[field], newRow]
        })
    }

    const updateRow = (field: 'params' | 'headers', index: number, updates: Partial<KeyValue>) => {
        const newArray = [...request[field]]
        newArray[index] = { ...newArray[index], ...updates }
        updateRequest({ [field]: newArray })
    }

    const deleteRow = (field: 'params' | 'headers', index: number) => {
        const newArray = request[field].filter((_, i) => i !== index)
        updateRequest({ [field]: newArray })
    }

    const tabs = [
        { id: 'params', label: 'Params' },
        { id: 'headers', label: 'Headers' },
        { id: 'body', label: 'Body' },
    ]

    return (
        <div className="flex-1 flex flex-col p-4">
            {/* URL Bar */}
            <div className="flex gap-2 mb-4">
                <MethodDropdown
                    value={request.method}
                    onChange={(method) => updateRequest({ method })}
                />

                <input
                    type="text"
                    value={request.url}
                    onChange={(e) => updateRequest({ url: e.target.value })}
                    placeholder="Enter request URL (e.g., https://jsonplaceholder.typicode.com/users)"
                    className="flex-1 px-4 py-2 bg-bg-tertiary border border-gray-600 rounded focus:outline-none focus:border-accent-secondary text-sm"
                />

                <button
                    onClick={() => onSendRequest(request)}
                    className="px-6 py-2 bg-accent-primary hover:bg-orange-600 text-white rounded font-medium transition-colors flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send
                </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-700 flex gap-6 mb-4">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`pb-2 font-medium text-sm border-b-2 transition-colors ${activeTab === tab.id
                            ? 'border-accent-secondary text-text-primary'
                            : 'border-transparent text-text-secondary hover:text-text-primary'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'params' && (
                    <div className="space-y-2">
                        <p className="text-sm font-medium mb-3">Query Parameters</p>
                        {request.params.map((param, index) => (
                            <div key={index} className="flex gap-2 items-center">
                                <input
                                    type="checkbox"
                                    checked={param.enabled !== false}
                                    onChange={(e) => updateRow('params', index, { enabled: e.target.checked })}
                                    className="w-4 h-4 rounded border-gray-600 bg-bg-primary text-accent-primary focus:ring-accent-primary focus:ring-offset-0 focus:ring-2 cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={param.key}
                                    onChange={(e) => updateRow('params', index, { key: e.target.value })}
                                    placeholder="Key"
                                    className={`flex-1 px-3 py-2 bg-bg-primary border border-gray-600 rounded focus:outline-none focus:border-accent-secondary text-sm ${param.enabled === false ? 'opacity-50' : ''}`}
                                    disabled={param.enabled === false}
                                />
                                <input
                                    type="text"
                                    value={param.value}
                                    onChange={(e) => updateRow('params', index, { value: e.target.value })}
                                    placeholder="Value"
                                    className={`flex-[2] px-3 py-2 bg-bg-primary border border-gray-600 rounded focus:outline-none focus:border-accent-secondary text-sm ${param.enabled === false ? 'opacity-50' : ''}`}
                                    disabled={param.enabled === false}
                                />
                                <button
                                    onClick={() => deleteRow('params', index)}
                                    className="p-2 hover:bg-bg-tertiary rounded text-text-tertiary hover:text-red-400"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={() => addRow('params')}
                            className="text-sm text-accent-secondary hover:text-accent-primary flex items-center gap-1 mt-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Parameter
                        </button>
                    </div>
                )}

                {activeTab === 'headers' && (
                    <div className="space-y-2">
                        <p className="text-sm font-medium mb-3">Headers</p>
                        {request.headers.map((header, index) => (
                            <div key={index} className="flex gap-2 items-center">
                                <input
                                    type="checkbox"
                                    checked={header.enabled !== false}
                                    onChange={(e) => updateRow('headers', index, { enabled: e.target.checked })}
                                    className="w-4 h-4 rounded border-gray-600 bg-bg-primary text-accent-primary focus:ring-accent-primary focus:ring-offset-0 focus:ring-2 cursor-pointer"
                                />

                                {/* Custom dropdown for header name */}
                                <div className="flex-1 relative">
                                    <div className="flex">
                                        <input
                                            type="text"
                                            value={header.key}
                                            onChange={(e) => updateRow('headers', index, { key: e.target.value })}
                                            onFocus={() => setOpenDropdown(index)}
                                            onBlur={() => setTimeout(() => setOpenDropdown(null), 200)}
                                            placeholder="Header name"
                                            className={`flex-1 px-3 py-2 bg-bg-primary border border-gray-600 rounded-l focus:outline-none focus:border-accent-secondary text-sm ${header.enabled === false ? 'opacity-50' : ''}`}
                                            disabled={header.enabled === false}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setOpenDropdown(openDropdown === index ? null : index)}
                                            className={`px-2 bg-bg-primary border-y border-r border-gray-600 rounded-r hover:bg-bg-tertiary ${header.enabled === false ? 'opacity-50' : ''}`}
                                            disabled={header.enabled === false}
                                        >
                                            <svg className="w-4 h-4 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    </div>

                                    {/* Dropdown menu */}
                                    {openDropdown === index && (
                                        <div className="absolute z-10 w-full mt-1 bg-bg-secondary border border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto">
                                            {commonHeaders
                                                .filter(h => h.toLowerCase().includes(header.key.toLowerCase()))
                                                .map((headerName) => (
                                                    <button
                                                        key={headerName}
                                                        type="button"
                                                        onClick={() => {
                                                            updateRow('headers', index, { key: headerName })
                                                            setOpenDropdown(null)
                                                        }}
                                                        className="w-full text-left px-3 py-2 hover:bg-bg-tertiary text-sm transition-colors"
                                                    >
                                                        {headerName}
                                                    </button>
                                                ))}
                                        </div>
                                    )}
                                </div>

                                <input
                                    type="text"
                                    value={header.value}
                                    onChange={(e) => updateRow('headers', index, { value: e.target.value })}
                                    placeholder="Value"
                                    className={`flex-[2] px-3 py-2 bg-bg-primary border border-gray-600 rounded focus:outline-none focus:border-accent-secondary text-sm ${header.enabled === false ? 'opacity-50' : ''}`}
                                    disabled={header.enabled === false}
                                />
                                <button
                                    onClick={() => deleteRow('headers', index)}
                                    className="p-2 hover:bg-bg-tertiary rounded text-text-tertiary hover:text-red-400"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        ))}

                        <button
                            onClick={() => addRow('headers')}
                            className="text-sm text-accent-secondary hover:text-accent-primary flex items-center gap-1 mt-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Header
                        </button>
                    </div>
                )}


                {activeTab === 'body' && (
                    <div>
                        <p className="text-sm font-medium mb-3">Request Body (JSON)</p>
                        <div className="w-full h-64 bg-bg-primary border border-gray-600 rounded overflow-hidden">
                            <EditableJsonViewer
                                value={request.body}
                                onChange={(newValue) => updateRequest({ body: newValue })}
                                placeholder={'{\n  "key": "value"\n}'}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
