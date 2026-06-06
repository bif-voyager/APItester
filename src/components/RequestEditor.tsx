import { useState, useRef, useEffect } from 'react'
import { Request, KeyValue } from '../types'
import EditableJsonViewer from './EditableJsonViewer'
import MethodDropdown from './MethodDropdown'
import { getDefaultHeadersForMethod } from '../utils/httpHelpers'

interface RequestEditorProps {
    request: Request | null
    onSendRequest: (request: Request) => void
    onUpdateRequest: (request: Request) => void
    onBulkSend?: (request: Request, concurrency: number) => void
}

export default function RequestEditor({
    request,
    onSendRequest,
    onUpdateRequest,
    onBulkSend
}: RequestEditorProps) {
    const [activeTab, setActiveTab] = useState('params')
    const [openDropdown, setOpenDropdown] = useState<number | null>(null)
    const [urlFocused, setUrlFocused] = useState(false)
    const [showBulkPopover, setShowBulkPopover] = useState(false)
    const [bulkCount, setBulkCount] = useState(10)
    const bulkPopoverRef = useRef<HTMLDivElement>(null)

    // Close bulk popover on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (bulkPopoverRef.current && !bulkPopoverRef.current.contains(e.target as Node)) {
                setShowBulkPopover(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

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



    // Handler for method changes - updates headers automatically
    const handleMethodChange = (newMethod: string) => {
        const oldMethod = request.method
        const methodsWithBody = ['POST', 'PUT', 'PATCH', 'DELETE']
        const hadBody = methodsWithBody.includes(oldMethod)
        const hasBody = methodsWithBody.includes(newMethod)

        // Only update headers if switching between body/no-body methods
        if (hadBody !== hasBody) {
            updateRequest({
                method: newMethod,
                headers: getDefaultHeadersForMethod(newMethod)
            })
        } else {
            updateRequest({ method: newMethod })
        }
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
        const newArray = request[field].filter((_: KeyValue, i: number) => i !== index)
        updateRequest({ [field]: newArray })
    }

    const tabs = [
        { id: 'params', label: 'Params' },
        { id: 'auth', label: 'Auth' },
        { id: 'headers', label: 'Headers' },
        { id: 'body', label: 'Body' },
    ]

    return (
        <div className="flex-1 flex flex-col p-4">
            {/* URL Bar */}
            <div className="flex gap-2 mb-4">
                <MethodDropdown
                    value={request.method}
                    onChange={handleMethodChange}
                />

                {/* URL Input with variable highlighting */}
                <div className="flex-1 relative">
                    {/* Highlight overlay - shows all text with colored variables, hidden during selection */}
                    {!urlFocused && (
                        <div
                            className="absolute inset-0 px-4 py-2 text-sm pointer-events-none overflow-hidden whitespace-nowrap flex items-center"
                            aria-hidden="true"
                        >
                            {request.url.split(/(\{[^}]+\})/).map((part, i) =>
                                part.match(/^\{[^}]+\}$/) ? (
                                    <span key={i} className="text-orange-400">{part}</span>
                                ) : (
                                    <span key={i} className="text-text-primary">{part}</span>
                                )
                            )}
                        </div>
                    )}
                    {/* Input - transparent text when overlay visible, normal text when focused */}
                    <input
                        type="text"
                        value={request.url}
                        onChange={(e) => updateRequest({ url: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') onSendRequest(request) }}
                        onFocus={() => setUrlFocused(true)}
                        onBlur={() => setUrlFocused(false)}
                        placeholder="Enter request URL (e.g., {baseUrl}/users)"
                        className={`w-full px-4 py-2 bg-bg-tertiary border border-gray-600 rounded focus:outline-none focus:border-accent-secondary text-sm caret-white ${urlFocused ? 'text-text-primary' : 'text-transparent'}`}
                    />
                </div>

                <button
                    onClick={() => onSendRequest(request)}
                    className="px-6 py-2 bg-accent-primary hover:bg-orange-600 text-white rounded font-medium transition-colors flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send
                </button>

                {/* Bulk Send Button */}
                {onBulkSend && (
                    <div className="relative" ref={bulkPopoverRef}>
                        <button
                            onClick={() => setShowBulkPopover(!showBulkPopover)}
                            className={`px-3 py-2 rounded font-medium transition-colors flex items-center gap-1.5 text-sm ${showBulkPopover
                                ? 'bg-purple-600 text-white'
                                : 'bg-purple-600/20 text-purple-400 hover:bg-purple-600/40 border border-purple-500/40 hover:border-purple-500/70'
                                }`}
                            title="Bulk Send — fire N concurrent requests"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Bulk
                        </button>

                        {/* Popover */}
                        {showBulkPopover && (
                            <div className="absolute right-0 top-full mt-2 w-64 bg-bg-secondary border border-gray-600 rounded-lg shadow-2xl z-50 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    <span className="text-sm font-bold text-text-primary">Concurrent Requests</span>
                                </div>
                                <p className="text-xs text-text-tertiary mb-3">
                                    Fire N copies of this request simultaneously
                                </p>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        max="500"
                                        value={bulkCount}
                                        onChange={(e) => setBulkCount(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                onBulkSend(request, bulkCount)
                                                setShowBulkPopover(false)
                                            }
                                        }}
                                        className="flex-1 px-3 py-1.5 bg-bg-primary border border-gray-600 rounded text-sm focus:outline-none focus:border-purple-500 text-center"
                                        autoFocus
                                    />
                                    <button
                                        onClick={() => {
                                            onBulkSend(request, bulkCount)
                                            setShowBulkPopover(false)
                                        }}
                                        className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium transition-colors flex items-center gap-1"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        Go
                                    </button>
                                </div>
                                <div className="flex gap-1.5 mt-2">
                                    {[10, 50, 100, 200].map(n => (
                                        <button
                                            key={n}
                                            onClick={() => setBulkCount(n)}
                                            className={`flex-1 py-1 text-xs rounded transition-colors ${bulkCount === n
                                                ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
                                                : 'bg-bg-tertiary text-text-tertiary hover:text-text-secondary hover:bg-bg-primary'
                                                }`}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
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

                {activeTab === 'auth' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2 text-text-secondary">Auth Type</label>
                            <select
                                value={request.auth?.type || 'none'}
                                onChange={(e) => updateRequest({
                                    auth: { ...request.auth, type: e.target.value as any }
                                })}
                                className="w-full px-3 py-2 bg-bg-primary border border-gray-600 rounded focus:outline-none focus:border-accent-secondary text-sm"
                            >
                                <option value="none">No Auth</option>
                                <option value="bearer">Bearer Token</option>
                                <option value="basic">Basic Auth</option>
                            </select>
                        </div>

                        {request.auth?.type === 'bearer' && (
                            <div>
                                <label className="block text-sm font-medium mb-2 text-text-secondary">Token</label>
                                <input
                                    type="text"
                                    value={request.auth.bearerToken || ''}
                                    onChange={(e) => updateRequest({
                                        auth: { ...request.auth, type: 'bearer', bearerToken: e.target.value }
                                    })}
                                    placeholder="Enter Bearer Token"
                                    className="w-full px-3 py-2 bg-bg-primary border border-gray-600 rounded focus:outline-none focus:border-accent-secondary text-sm"
                                />
                            </div>
                        )}

                        {request.auth?.type === 'basic' && (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-text-secondary">Username</label>
                                    <input
                                        type="text"
                                        value={request.auth.basicUsername || ''}
                                        onChange={(e) => updateRequest({
                                            auth: { ...request.auth, type: 'basic', basicUsername: e.target.value }
                                        })}
                                        placeholder="Username"
                                        className="w-full px-3 py-2 bg-bg-primary border border-gray-600 rounded focus:outline-none focus:border-accent-secondary text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-text-secondary">Password</label>
                                    <input
                                        type="password"
                                        value={request.auth.basicPassword || ''}
                                        onChange={(e) => updateRequest({
                                            auth: { ...request.auth, type: 'basic', basicPassword: e.target.value }
                                        })}
                                        placeholder="Password"
                                        className="w-full px-3 py-2 bg-bg-primary border border-gray-600 rounded focus:outline-none focus:border-accent-secondary text-sm"
                                    />
                                </div>
                            </div>
                        )}
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
