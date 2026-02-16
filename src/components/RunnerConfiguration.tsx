import { useState, useEffect } from 'react'
import { Collection, Request, CollectionItem } from '../types'
import { getAllRequestsFromItems, findItemInTree } from '../utils/collectionTreeHelpers'

export interface RunnerConfig {
    iterations: number
    delay: number
}

interface RunnerConfigurationProps {
    isOpen: boolean
    onClose: () => void
    onRun: (config: RunnerConfig, requests: Request[]) => void
    collections: Collection[]
    initialItems?: CollectionItem[] // specific items to run (e.g. from context menu)
}

export default function RunnerConfiguration({
    isOpen,
    onClose,
    onRun,
    collections,
    initialItems
}: RunnerConfigurationProps) {
    const [selectedRequests, setSelectedRequests] = useState<Request[]>([])
    const [iterations, setIterations] = useState(1)
    const [delay, setDelay] = useState(0)
    const [isDragOver, setIsDragOver] = useState(false)

    // Load initial items when opening
    useEffect(() => {
        if (isOpen && initialItems) {
            const requests = getAllRequestsFromItems(initialItems)
            setSelectedRequests(requests)
        } else if (isOpen && !initialItems) {
            // Reset if opening empty
            setSelectedRequests([])
        }
    }, [isOpen, initialItems])

    if (!isOpen) return null

    const handleRun = () => {
        onRun({ iterations, delay }, selectedRequests)
        onClose()
    }

    // Drag and Drop Handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)

        const sourceId = e.dataTransfer.getData('sourceId')
        const collectionId = e.dataTransfer.getData('collectionId')
        const type = e.dataTransfer.getData('type')
        const dragIndex = e.dataTransfer.getData('runner/index')

        // Handle Reordering
        if (dragIndex) {
            // We need to know where we dropped it. 
            // The drop target for reordering is the individual item, not the container.
            // But if we drop on the container, maybe append? 
            // Actually, for reordering, we usually drop ON another item.
            // If we drop here (container), it means we dragged a runner item to the value space?
            // Let's rely on item-level drop for reordering.
            return
        }

        if (!collectionId) return

        // 1. Find Collection
        const collection = collections.find(c => c.id === collectionId)
        if (!collection) return

        let requestsToAdd: Request[] = []

        if (type === 'full-collection') {
            // Dragged the entire collection
            requestsToAdd = getAllRequestsFromItems(collection.items)
        } else if (sourceId) {
            // Dragged an item/folder
            const item = findItemInTree(collection.items, sourceId)
            if (item) {
                if (item.type === 'request' && item.request) {
                    requestsToAdd = [item.request]
                } else if (item.type === 'folder') {
                    requestsToAdd = getAllRequestsFromItems([item])
                }
            }
        }

        // Add unique requests
        setSelectedRequests(prev => {
            const newReqs = [...prev]
            requestsToAdd.forEach(req => {
                // Allow duplicates? Users might want to run same request twice? 
                // Postman allows duplicates in runner.
                // The current implementation prevented it.
                // If I click "Add", I expect it to add.
                // But dragging the same thing twice?
                // Let's allow duplicates for now as it gives more flexibility, 
                // but if we use ID for key, we need unique keys.
                // We should probably generate a temporary ID or just use index for key in loop.
                // For now, keep unique constraint to avoid React key issues unless we wrap them.
                if (!newReqs.find(r => r.id === req.id)) {
                    newReqs.push(req)
                }
            })
            return newReqs
        })
    }

    const removeRequest = (id: string) => {
        setSelectedRequests(prev => prev.filter(r => r.id !== id))
    }

    // Reordering Handlers
    const handleItemDragStart = (e: React.DragEvent, index: number) => {
        e.dataTransfer.setData('runner/index', index.toString())
        e.dataTransfer.effectAllowed = 'move'
    }

    const handleItemDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault()
        e.stopPropagation() // Prevent container drop

        const dragIndexStr = e.dataTransfer.getData('runner/index')
        if (!dragIndexStr) return

        const fromIndex = parseInt(dragIndexStr)
        if (isNaN(fromIndex) || fromIndex === targetIndex) return

        setSelectedRequests(prev => {
            const newReqs = [...prev]
            const [moved] = newReqs.splice(fromIndex, 1)
            newReqs.splice(targetIndex, 0, moved)
            return newReqs
        })
    }

    return (
        <div className="w-[400px] border-l border-gray-700 bg-bg-secondary flex flex-col h-full shadow-xl transition-all duration-300 ease-in-out">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-bg-tertiary/30">
                <h3 className="font-bold flex items-center gap-2">
                    <svg className="w-5 h-5 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Collection Runner
                </h3>
                <button
                    onClick={onClose}
                    className="text-text-tertiary hover:text-text-primary p-1 rounded hover:bg-bg-tertiary"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Drop Zone */}
                <div
                    className={`flex-1 m-4 border-2 border-dashed rounded-lg transition-colors overflow-hidden flex flex-col ${isDragOver ? 'border-accent-primary bg-accent-primary/5' : 'border-gray-700 bg-bg-primary/50'
                        }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {selectedRequests.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-text-tertiary p-4 text-center">
                            <svg className="w-10 h-10 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <p className="text-sm">Drag requests or folders here</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            <div className="flex justify-between items-center mb-2 px-1">
                                <span className="text-xs font-bold text-text-secondary">{selectedRequests.length} Requests</span>
                                <button onClick={() => setSelectedRequests([])} className="text-xs text-red-400 hover:text-red-300">Clear</button>
                            </div>
                            {selectedRequests.map((req, idx) => (
                                <div
                                    key={req.id}
                                    className="flex items-center gap-2 p-2 rounded bg-bg-tertiary group text-xs cursor-grab active:cursor-grabbing hover:bg-bg-tertiary/80 transition-colors"
                                    draggable={true}
                                    onDragStart={(e) => handleItemDragStart(e, idx)}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => handleItemDrop(e, idx)}
                                >
                                    <span className="text-text-tertiary w-4 text-right font-mono select-none">{idx + 1}</span>
                                    <span className={`font-bold px-1 rounded w-10 text-center select-none ${req.method === 'GET' ? 'bg-green-500/20 text-green-400' :
                                        req.method === 'POST' ? 'bg-orange-500/20 text-orange-400' :
                                            req.method === 'PUT' ? 'bg-blue-500/20 text-blue-400' :
                                                req.method === 'DELETE' ? 'bg-red-500/20 text-red-400' :
                                                    'bg-purple-500/20 text-purple-400'
                                        }`}>{req.method}</span>
                                    <span className="flex-1 truncate select-none">{req.name}</span>
                                    <button
                                        onClick={() => removeRequest(req.id)}
                                        className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-400"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Configuration */}
                <div className="px-4 pb-4 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">
                            Iterations
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min="1"
                                value={iterations}
                                onChange={(e) => setIterations(Math.max(1, parseInt(e.target.value) || 1))}
                                className="flex-1 px-2 py-1 bg-bg-primary border border-gray-600 rounded focus:border-accent-primary outline-none text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">
                            Delay (ms)
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min="0"
                                value={delay}
                                onChange={(e) => setDelay(Math.max(0, parseInt(e.target.value) || 0))}
                                className="flex-1 px-2 py-1 bg-bg-primary border border-gray-600 rounded focus:border-accent-primary outline-none text-sm"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleRun}
                        disabled={selectedRequests.length === 0}
                        className={`w-full py-2 rounded font-medium transition-colors ${selectedRequests.length > 0
                            ? 'bg-accent-primary hover:bg-orange-600 text-white'
                            : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        Run Collection
                    </button>
                </div>
            </div>
        </div>
    )
}
