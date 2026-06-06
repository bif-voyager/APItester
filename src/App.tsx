import { useState, useEffect, useMemo, useRef } from 'react'

// Remove handleLogin entirely since it was only for Guest mode which is removed.
// We can just rely on Supabase Auth state listener.

import Sidebar from './components/Sidebar'
import RequestEditor from './components/RequestEditor'
import ResponseViewer from './components/ResponseViewer'
import AuthPage from './components/AuthPage'
import RunnerConfiguration, { RunnerConfig } from './components/RunnerConfiguration'
import ConfirmDialog, { ConfirmDialogProps } from './components/ConfirmDialog'
import SaveRequestDialog from './components/SaveRequestDialog'
import BulkResultsCharts from './components/BulkResultsCharts'
import { db, useUserEnvironments, useUserCollections, useUserRequests } from './db/db'
import { buildCollectionTree, uiRequestToDbRequest, saveCollectionToDb } from './db/dbConverters'
import type { Collection, CollectionItem, Request, Environment, EnvironmentVariable, HistoryItem, Tab, RunResult } from './types'
import {
    generateId,
    // findItemInTree,
    // deleteItemFromTree,
    // renameItemInTree,
    // addRequestToTree,
    // addFolderToTree,
    // moveItemInTree,
    // addItemToTreeAtPosition,
    // toggleExpandInTree,
} from './utils/collectionTreeHelpers'

import { getDefaultHeadersForMethod } from './utils/httpHelpers'
import { supabase } from './supabaseClient'
import { sendViaExecutor, sendBulkViaExecutor } from './services/requestExecutor'

function App() {
    const [user, setUser] = useState<{ id: string; email?: string; name: string } | null>(null)

    useEffect(() => {
        // Initial Session Check
        import('./supabaseClient').then(({ supabase }) => {
            supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
                if (session?.user) {
                    const { user } = session
                    setUser({
                        id: user.id,
                        email: user.email,
                        name: user.user_metadata?.username || user.email || 'User'
                    })
                }
            })

            // Auth State Listener
            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
                if (session?.user) {
                    const { user } = session
                    setUser({
                        id: user.id,
                        email: user.email,
                        name: user.user_metadata?.username || user.email || 'User'
                    })
                } else {
                    setUser(null)
                }
            })

            return () => subscription.unsubscribe()
        })
    }, [])

    const dbEnvironments = useUserEnvironments(user?.id)

    const environments: Environment[] = (dbEnvironments || []).map(e => ({
        id: e.id.toString(),
        name: e.name,
        variables: (Array.isArray(e.variables)
            ? e.variables
            : Object.entries(e.variables).map(([k, v]) => ({ key: k, value: String(v), enabled: true }))
        ) as EnvironmentVariable[]
    }))

    // ...



    // DB Collections & Requests
    const dbCollections = useUserCollections(user?.id)
    const dbRequests = useUserRequests(user?.id)

    // --- Optimistic UI State for Expansions ---
    // We maintain a local set of expanded IDs to ensure instant UI reaction.
    // This overrides the DB state for the UI, while still syncing to DB in background.
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

    // Sync local state with DB state initially, but don't overwrite user interaction if possible.
    // Actually, simple approach: Initialize once, then trust local.
    // Or better: Merge DB state into local state when DB loads, but respect local toggles.
    // Let's rely on the DB as the source of truth, but "override" with a separate mechanism? 
    // No, standard optimistic UI: State = DB + Pending changes.
    // Simpler: Just use local state for the Tree, and sync to DB.

    // Effect to populate expandedIds from DB when loaded (only if empty to avoid reset?)
    // Or just use a merged view.

    // Update: Let's use a "Optimistic Override" approach.
    // We largely trust DB, but when user toggles, we update a local map that forces the state
    // until the DB confirms (or just stays local if we treat DB as persistence only).

    // Let's try: `collections` memo uses `expandedIds` to override `dbCollections`.

    useEffect(() => {
        if (dbCollections) {
            setExpandedIds(prev => {
                const next = new Set(prev)
                dbCollections.forEach(c => {
                    if (c.is_expanded) next.add(c.id)
                })
                return next
            })
        }
    }, [dbCollections])

    // Compute UI Collection Tree
    const collections = useMemo(() => {
        if (!dbCollections || !dbRequests) return []

        // Create a version of dbCollections with local expanded state
        const optimisticCollections = dbCollections.map(c => ({
            ...c,
            is_expanded: expandedIds.has(c.id)
        }))

        return buildCollectionTree(optimisticCollections, dbRequests)
    }, [dbCollections, dbRequests, expandedIds])

    const toggleCollectionExpand = async (collectionId: string) => {
        // 1. Instant UI Update
        const isCurrentlyExpanded = expandedIds.has(collectionId)
        const newExpandedState = !isCurrentlyExpanded

        setExpandedIds(prev => {
            const next = new Set(prev)
            if (newExpandedState) next.add(collectionId)
            else next.delete(collectionId)
            return next
        })

        // 2. Background DB Sync
        if (user?.id) {
            try {
                await db.updateCollection(user.id, collectionId, { is_expanded: newExpandedState })
            } catch (err) {
                console.error("Failed to sync expand state", err)
                // Revert on error? Maybe not needed for just expand/collapse
            }
        }
    }

    // Compute Standalone Requests (requests with no collectionId)
    const standaloneRequests = useMemo(() => {
        if (!dbRequests) return []
        return dbRequests
            .filter(r => !r.collection_id)
            .map(r => ({
                id: r.id.toString(),
                name: r.name,
                method: r.method,
                url: r.url,
                params: r.params || [],
                headers: r.headers || [],
                body: r.body || '',
                auth: r.auth ? { ...r.auth } : { type: 'none' as const }
            } as Request))
    }, [dbRequests])

    const [currentRequest, setCurrentRequest] = useState<Request | null>(null)
    const [currentRequestId, setCurrentRequestId] = useState<string | null>(null)
    const [currentCollectionId, setCurrentCollectionId] = useState<string | null>(null)

    // Theme state - persisted to localStorage
    const [theme, setTheme] = useState<'dark' | 'light'>(() => {
        const saved = localStorage.getItem('api-client-theme')
        return (saved === 'light' ? 'light' : 'dark') as 'dark' | 'light'
    })

    // Apply theme data attribute to document
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('api-client-theme', theme)
    }, [theme])

    const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')


    const [currentEnvironmentId, setCurrentEnvironmentId] = useState<string | null>(() => {
        return localStorage.getItem('api-client-env-id') || null
    })
    const [showEnvModal, setShowEnvModal] = useState(false)
    const [envDropdownOpen, setEnvDropdownOpen] = useState(false)
    const envDropdownRef = useRef<HTMLDivElement>(null)

    // Close env dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (envDropdownRef.current && !envDropdownRef.current.contains(event.target as Node)) {
                setEnvDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])
    const [isAddingEnv, setIsAddingEnv] = useState(false)
    const [newEnvName, setNewEnvName] = useState('')
    const [confirmDialog, setConfirmDialog] = useState<Omit<ConfirmDialogProps, 'onCancel'> | null>(null)
    const [showSaveDialog, setShowSaveDialog] = useState(false)

    // Run Collection state
    const [runResults, setRunResults] = useState<RunResult[]>([])
    const [showRunnerConfig, setShowRunnerConfig] = useState(false)
    const [runnerInitialItems, setRunnerInitialItems] = useState<CollectionItem[] | undefined>(undefined)


    // Tabs state
    const [openTabs, setOpenTabs] = useState<Tab[]>([])
    const [activeTabId, setActiveTabId] = useState<string | null>(null)

    // History state - persisted to localStorage
    const [history, setHistory] = useState<HistoryItem[]>(() => {
        const saved = localStorage.getItem('api-client-history')
        if (!saved) return []
        try {
            return JSON.parse(saved)
        } catch {
            return []
        }
    })
    const [showHistoryPanel, setShowHistoryPanel] = useState(false)

    // Save environments to localStorage
    useEffect(() => {
        localStorage.setItem('api-client-environments', JSON.stringify(environments))
    }, [environments])

    useEffect(() => {
        if (currentEnvironmentId) {
            localStorage.setItem('api-client-current-env', currentEnvironmentId)
        } else {
            localStorage.removeItem('api-client-current-env')
        }
    }, [currentEnvironmentId])

    // Get current environment
    const currentEnvironment = environments.find(env => env.id === currentEnvironmentId) || null

    // Substitute {variables} in a string
    const substituteVariables = (text: string): string => {
        if (!currentEnvironment) return text
        let result = text
        for (const variable of currentEnvironment.variables) {
            if (variable.enabled) {
                const regex = new RegExp(`\\{${variable.key}\\}`, 'g')
                result = result.replace(regex, variable.value)
            }
        }
        return result
    }

    // Ctrl+S to save request
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
                e.preventDefault()
                if (currentRequest) {
                    setShowSaveDialog(true)
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown, true)
        return () => window.removeEventListener('keydown', handleKeyDown, true)
    }, [currentRequest])

    const addCollection = async (name: string) => {
        if (user?.id) {
            await db.createCollection(user.id, name, null)
        }
    }

    const deleteCollection = (collectionId: string) => {
        setConfirmDialog({
            title: 'Delete Collection',
            message: 'Delete this collection and all its items?',
            onConfirm: async () => {
                if (user?.id) {
                    await db.deleteCollection(user.id, collectionId)
                    if (currentCollectionId === collectionId) {
                        setCurrentRequest(null)
                        setCurrentRequestId(null)
                        setCurrentCollectionId(null)
                    }
                }
                setConfirmDialog(null)
            },
        })
    }

    const renameCollection = async (collectionId: string, newName: string) => {
        if (user?.id) {
            await db.updateCollection(user.id, collectionId, { name: newName })
        }
    }

    const addFullCollection = async (collection: Collection) => {
        if (user?.id) {
            await saveCollectionToDb(user.id, collection)
        }
    }

    const addRequestToCollection = async (collectionId: string, parentId?: string) => {
        if (!user?.id) return
        const defaultMethod = 'GET'
        const targetId = parentId || collectionId

        const newRequestData = {
            name: 'Untitled Request',
            method: defaultMethod,
            url: '',
            params: [],
            headers: getDefaultHeadersForMethod(defaultMethod),
            body: '',
            auth: { type: 'none' as const }
        }

        const id = await db.createRequest(user.id, {
            ...newRequestData,
            collection_id: targetId
        })

        const newRequest = { ...newRequestData, id: id }
        setCurrentRequest(newRequest)
        setCurrentRequestId(newRequest.id)
        setCurrentCollectionId(collectionId)
    }

    const createStandaloneRequest = async () => {
        if (!user?.id) return
        const defaultMethod = 'GET'
        const newRequestData = {
            name: 'Untitled Request',
            method: defaultMethod,
            url: '',
            params: [],
            headers: getDefaultHeadersForMethod(defaultMethod),
            body: '',
            auth: { type: 'none' as const }
        }

        // Just create in memory first? Or DB?
        // Standalone requests are usually "scratchpad".
        // If we want them to persist in "Standalone" list, we should save with collectionId=undefined.
        // User expects to see it?
        // Original logic: `setStandaloneRequests` was called ONLY on save?
        // No, original logic: `setCurrentRequest(newRequest)`.
        // It did NOT add to `standaloneRequests` list until saved.
        // So we keep it in memory (state) until saved.

        const newRequest: Request = {
            ...newRequestData,
            id: generateId(), // UUID for temporary
        }

        // Don't add to sidebar list yet - only when saved
        setCurrentRequest(newRequest)
        setCurrentRequestId(newRequest.id)
        setCurrentCollectionId(null as any)

        const tabId = `tab-${newRequest.id}`
        const newTab: Tab = {
            id: tabId,
            type: 'request',
            title: newRequest.name,
            requestId: newRequest.id,
            request: newRequest
        }
        setOpenTabs(prev => [...prev, newTab])
        setActiveTabId(tabId)
    }


    const addFolder = async (collectionId: string, parentId: string | null): Promise<string | null> => {
        if (!user?.id) return null
        const defaultName = 'New Folder'
        const targetParentId = parentId || collectionId
        const id = await db.createCollection(user.id, defaultName, targetParentId)
        return id
    }

    const moveItem = async (collectionId: string, sourceItemId: string, targetItemId: string | null, sourceCollectionId: string | null) => {
        if (!user?.id) return

        // 1. If sourceCollectionId is null, it's a standalone request.
        if (!sourceCollectionId) {
            const requestToMove = standaloneRequests.find(r => r.id === sourceItemId)
            if (requestToMove) {
                let targetParentId = collectionId
                if (targetItemId) {
                    const targetCol = await db.getCollection(user.id, targetItemId)
                    if (targetCol) {
                        targetParentId = targetCol.id
                    } else {
                        const targetReq = await db.getRequest(user.id, targetItemId)
                        if (targetReq && targetReq.collection_id) {
                            targetParentId = targetReq.collection_id
                        }
                    }
                }

                // Update request
                await db.updateRequest(user.id, sourceItemId, { collection_id: targetParentId })
            }
            return
        }

        // 2. Intra-collection move or Inter-collection move
        let targetParentId = collectionId
        if (targetItemId) {
            const targetCol = await db.getCollection(user.id, targetItemId)
            if (targetCol) {
                targetParentId = targetCol.id
            } else {
                const targetReq = await db.getRequest(user.id, targetItemId)
                if (targetReq && targetReq.collection_id) {
                    targetParentId = targetReq.collection_id
                }
            }
        }

        // Find source item type
        const sourceCol = await db.getCollection(user.id, sourceItemId)
        if (sourceCol) {
            // Moving a folder
            await db.updateCollection(user.id, sourceItemId, { parent_id: targetParentId })
        } else {
            // Moving a request
            await db.updateRequest(user.id, sourceItemId, { collection_id: targetParentId })
        }
    }

    const deleteEnvironment = async (envId: string) => {
        if (!user?.id) return

        setConfirmDialog({
            title: 'Delete Environment',
            message: 'Are you sure you want to delete this environment?',
            onConfirm: async () => {
                await db.deleteEnvironment(user.id, envId)
                if (currentEnvironmentId === envId) {
                    setCurrentEnvironmentId(null)
                }
                setConfirmDialog(null)
            }
        })
    }
    const deleteItem = async (itemId: string, type: 'folder' | 'request') => {
        if (!user || !user.id) return

        setConfirmDialog({
            title: 'Delete Item',
            message: 'Delete this item?',
            onConfirm: async () => {
                if (user?.id) {
                    if (type === 'folder') {
                        await db.deleteCollection(user.id, itemId)
                    } else {
                        await db.deleteRequest(user.id, itemId)
                        // Close tab if open
                        setOpenTabs(prev => prev.filter(t => t.requestId !== itemId && t.request?.id !== itemId))
                    }
                    if (currentRequestId === itemId) {
                        setCurrentRequest(null)
                        setCurrentRequestId(null)
                    }
                }
                setConfirmDialog(null)
            },
        })
    }

    const renameItem = async (itemId: string, newName: string, type: 'folder' | 'request') => {
        if (!user || !user.id) return

        if (type === 'folder') {
            await db.updateCollection(user.id, itemId, { name: newName })
        } else {
            await db.updateRequest(user.id, itemId, { name: newName })
            if (currentRequestId === itemId && currentRequest) {
                setCurrentRequest({ ...currentRequest, name: newName })
            }

            // Update open tabs
            setOpenTabs(prev => prev.map(t =>
                (t.requestId === itemId || t.request?.id === itemId)
                    ? { ...t, title: newName, request: t.request ? { ...t.request, name: newName } : undefined }
                    : t
            ))
        }
    }

    const toggleItemExpand = async (itemId: string) => {
        if (!user || !user.id) return
        // Toggle expand in DB
        const col = await db.getCollection(user.id, itemId)
        if (col) {
            await db.updateCollection(user.id, itemId, { is_expanded: !col.is_expanded })
        }
    }

    const selectRequest = (request: Request, requestId: string, collectionId: string) => {
        // Construct tab ID first
        const tabId = `request-${requestId}`
        // Check if tab is already open with potentially unsaved changes
        const existingTab = openTabs.find(t => t.id === tabId)

        // Use existing tab's request state if available to preserve edits
        // Otherwise use the fresh request from DB/Sidebar
        const requestToUse = (existingTab && existingTab.request) ? existingTab.request : request

        setCurrentRequest(requestToUse)
        setCurrentRequestId(requestId)
        setCurrentCollectionId(collectionId)

        // Add tab if not exists
        if (!existingTab) {
            const newTab: Tab = {
                id: tabId,
                type: 'request',
                title: request.name,
                request: request,
                requestId,
                collectionId,
                response: null
            }
            setOpenTabs([...openTabs, newTab])
        }
        setActiveTabId(tabId)
    }

    const handleImportRequest = async (collectionId: string, requestData: Partial<Request>) => {
        if (!user?.id) return

        const newRequestData = {
            name: requestData.name || requestData.url?.split('/').pop() || 'Imported Request',
            method: requestData.method || 'GET',
            url: requestData.url || '',
            params: requestData.params || [],
            headers: requestData.headers || [],
            body: requestData.body || '',
            auth: requestData.auth || { type: 'none' as const }
        }

        if (collectionId) {
            const targetId = parseInt(collectionId)
            const id = await db.createRequest(user.id, {
                ...newRequestData,
                collection_id: targetId.toString()
            })

            const newRequest = { ...newRequestData, id: id.toString() }
            setCurrentRequest(newRequest)
            setCurrentRequestId(newRequest.id)
            setCurrentCollectionId(collectionId)

            // Add tab
            const tabId = `tab-${newRequest.id}`
            const newTab: Tab = {
                id: tabId,
                type: 'request',
                title: newRequest.name,
                requestId: newRequest.id,
                request: newRequest
            }
            setOpenTabs(prev => [...prev, newTab])
            setActiveTabId(tabId)
        }
    }

    const updateRequest = (updatedRequest: Request) => {
        // Only update current request state and open tabs.
        // Do NOT update `collections` or `standaloneRequests` state as they are derived from DB.
        // Persistence happens on Save (Ctrl+S) or explicit actions.

        setCurrentRequest(updatedRequest)

        // Sync tab title and request data
        setOpenTabs(prev =>
            prev.map(t =>
                (t.requestId === updatedRequest.id || t.request?.id === updatedRequest.id)
                    ? { ...t, title: updatedRequest.name, request: updatedRequest }
                    : t
            )
        )
    }

    const sendRequest = async (request: Request) => {
        // Find tab by requestId match (works for both standalone and collection tabs)
        const findTab = (t: Tab) => t.requestId === request.id || t.request?.id === request.id

        // Set loading state
        setOpenTabs(prev => prev.map(t =>
            findTab(t) ? { ...t, response: { loading: true } } : t
        ))

        // Send via Go backend executor
        const responseData = await sendViaExecutor(request, substituteVariables)

        // Update tab with response
        setOpenTabs(prev => prev.map(t =>
            findTab(t) ? { ...t, response: responseData } : t
        ))

        // Add to history (only if not an error)
        if (!responseData.error) {
            const historyItem: HistoryItem = {
                id: generateId(),
                timestamp: Date.now(),
                request: { ...request },
                response: {
                    status: responseData.status,
                    statusText: responseData.statusText,
                    time: responseData.time,
                }
            }
            setHistory(prev => [historyItem, ...prev])
        }
    }

    // Bulk send handler
    const sendBulkRequest = async (request: Request, concurrency: number) => {
        const tabId = `bulk-${Date.now()}`
        const bulkTab: Tab = {
            id: tabId,
            type: 'bulk',
            title: `⚡ Bulk ${concurrency}× ${request.method} ${request.name}`,
            bulkRequest: request,
            bulkConcurrency: concurrency,
            bulkResponse: null,
        }
        setOpenTabs(prev => [...prev, bulkTab])
        setActiveTabId(tabId)

        // Execute bulk request
        const result = await sendBulkViaExecutor(request, concurrency, substituteVariables)

        // Update tab with results
        setOpenTabs(prev => prev.map(t =>
            t.id === tabId ? { ...t, bulkResponse: result } : t
        ))
    }

    // Open Runner with specific collection
    const openRunnerWithCollection = (collection: Collection) => {
        setRunnerInitialItems(collection.items)
        setShowRunnerConfig(true)
    }

    // Execute Runner Logic
    const executeRunner = async (config: RunnerConfig, requests: Request[]) => {
        if (requests.length === 0) return

        // 1. Initialize Results (flattened for all iterations)
        const initialResults: RunResult[] = []

        for (let iter = 1; iter <= config.iterations; iter++) {
            for (const req of requests) {
                initialResults.push({
                    request: req,
                    status: 'pending' as const,
                    iteration: iter
                })
            }
        }

        setRunResults(initialResults)

        // 2. Check for existing Run tab to reuse
        const existingRunTab = openTabs.find(t => t.type === 'run')

        let tabId = existingRunTab ? existingRunTab.id : `run-${Date.now()}`

        const runTab: Tab = {
            id: tabId,
            type: 'run',
            title: `Runner: ${(config as any).collectionName || 'Sequence'}`,
            runResults: initialResults,
            runCollectionName: (config as any).collectionName || 'Runner Sequence',
            lastRunnerConfig: { config, requests }
        }

        if (existingRunTab) {
            setOpenTabs(prev => prev.map(t => t.id === tabId ? runTab : t))
        } else {
            setOpenTabs(prev => [...prev, runTab])
        }

        setActiveTabId(tabId)

        // 3. Execution Loop — uses the same sendViaExecutor as sendRequest
        for (let i = 0; i < initialResults.length; i++) {
            const resultItem = initialResults[i]
            const request = resultItem.request

            // Update status to running
            setRunResults(prev => prev.map((r, idx) =>
                idx === i ? { ...r, status: 'running' as const } : r
            ))

            // Use the unified executor service
            const response = await sendViaExecutor(request, substituteVariables)

            const status: 'passed' | 'failed' = (!response.error && response.status && response.status >= 200 && response.status < 300)
                ? 'passed'
                : 'failed'

            // Update result
            setRunResults(prev => prev.map((r, idx) =>
                idx === i ? {
                    ...r,
                    status,
                    responseStatus: response.status,
                    responseTime: response.time,
                    error: response.error ? response.message : undefined
                } : r
            ))

            // Delay handling (if not last item)
            if (config.delay > 0 && i < initialResults.length - 1) {
                await new Promise(resolve => setTimeout(resolve, config.delay))
            }
        }

    }

    const exportCollection = (collectionId: string) => {
        const collection = collections.find((c: Collection) => c.id === collectionId)
        if (!collection) return

        const dataStr = JSON.stringify(collection, null, 2)
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)

        const exportFileDefaultName = `${collection.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`

        const linkElement = document.createElement('a')
        linkElement.setAttribute('href', dataUri)
        linkElement.setAttribute('download', exportFileDefaultName)
        linkElement.click()
    }

    const handleLogout = async () => {
        if (user?.id === 'guest') {
            localStorage.removeItem('guest_session')
            setUser(null)
        } else {
            await supabase.auth.signOut()
        }
    }

    const handleAuth = async (username: string, mode: 'user' | 'guest', password?: string) => {
        // Prevent unused var warning
        void password

        if (mode === 'guest') {
            const guestUser = {
                id: 'guest',
                email: 'guest@local',
                name: username || 'Guest User'
            }
            localStorage.setItem('guest_session', JSON.stringify(guestUser))
            setUser(guestUser)
        }
        // User mode is handled by Supabase listener in useEffect
    }

    const updateEnvironmentVariable = async (envId: string, index: number, key: string, value: string, enabled: boolean) => {
        if (!user?.id) return
        const env = environments.find(e => e.id === envId)
        if (env) {
            const newVariables = [...env.variables]
            newVariables[index] = { key, value, enabled }
            await db.updateEnvironment(user.id, envId, { variables: newVariables })
        }
    }
    const handleSaveEnvironment = async () => {
        if (!user?.id) return

        if (isAddingEnv) {
            if (newEnvName) {
                const id = await db.createEnvironment(user.id, newEnvName, [])
                setNewEnvName('')
                setIsAddingEnv(false)
                setCurrentEnvironmentId(id)
            }
        } else if (currentEnvironment) {
            await db.updateEnvironment(user.id, currentEnvironment.id, {
                name: currentEnvironment.name,
                variables: currentEnvironment.variables
            })
        }
    }

    const removeEnvironmentVariable = async (envId: string, index: number) => {
        if (!user?.id) return
        const env = environments.find(e => e.id === envId)
        if (env) {
            const newVariables = env.variables.filter((_, i) => i !== index)
            await db.updateEnvironment(user.id, envId, { variables: newVariables })
        }
    }
    const addEnvironmentVariable = async (envId: string) => {
        if (!user?.id) return
        const env = environments.find(e => e.id === envId)
        if (env) {
            const newVariables = [...env.variables, { key: '', value: '', enabled: true }]
            await db.updateEnvironment(user.id, envId, { variables: newVariables })
        }
    }

    if (!user) {
        return (
            <div className={`h-screen w-screen flex flex-col overflow-hidden bg-bg-primary text-text-primary ${theme === 'light' ? 'light' : 'dark'}`} data-theme={theme}>
                <AuthPage onLogin={handleAuth} />
            </div>
        )
    }

    return (
        <div className={`h-screen w-screen flex bg-bg-primary text-text-primary ${theme === 'light' ? 'light' : 'dark'}`} data-theme={theme}>
            {/* App Bar */}
            <div className="fixed top-0 left-0 right-0 h-14 bg-bg-secondary border-b border-gray-700 flex items-center justify-between px-4 z-10">
                <div
                    className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => {
                        setCurrentRequest(null)
                        setCurrentRequestId(null)
                        setCurrentCollectionId(null)
                        setActiveTabId(null)
                    }}
                >
                    <svg className="w-7 h-7 text-accent-primary" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                    <h1 className="text-xl font-bold">API Client</h1>
                </div>
                <div className="flex items-center gap-2">
                    {/* Environment Selector */}
                    <div className="flex items-center gap-1 bg-bg-tertiary rounded px-2 py-1">
                        <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.83 5.14a.75.75 0 011.06.02L10 9.42l4.11-4.26a.75.75 0 011.08 1.04l-4.58 4.75a.75.75 0 01-1.08 0L4.85 6.2a.75.75 0 01-.02-1.06z" clipRule="evenodd" />
                            <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75z" clipRule="evenodd" />
                        </svg>
                        <div className="relative" ref={envDropdownRef}>
                            <button
                                onClick={() => setEnvDropdownOpen(prev => !prev)}
                                className="bg-transparent border-none text-sm focus:outline-none cursor-pointer text-text-primary flex items-center gap-1 px-1 py-0.5 hover:text-white transition-colors"
                            >
                                {currentEnvironmentId
                                    ? environments.find(e => String(e.id) === currentEnvironmentId)?.name || 'No Environment'
                                    : 'No Environment'}
                                <svg className={`w-3 h-3 text-text-tertiary transition-transform ${envDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {envDropdownOpen && (
                                <div className="absolute top-full right-0 mt-1 min-w-[160px] bg-bg-secondary border border-gray-600 rounded shadow-lg z-50 overflow-hidden">
                                    <button
                                        onClick={() => { setCurrentEnvironmentId(null); setEnvDropdownOpen(false); }}
                                        className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-bg-tertiary ${!currentEnvironmentId ? 'bg-bg-tertiary text-white' : 'text-text-secondary'}`}
                                    >
                                        No Environment
                                    </button>
                                    {environments.map((env) => (
                                        <button
                                            key={env.id}
                                            onClick={() => { setCurrentEnvironmentId(String(env.id)); setEnvDropdownOpen(false); }}
                                            className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-bg-tertiary ${currentEnvironmentId === String(env.id) ? 'bg-bg-tertiary text-white' : 'text-text-secondary'}`}
                                        >
                                            {env.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => setShowEnvModal(true)}
                            className="p-1 hover:bg-bg-primary rounded"
                            title="Manage Environments"
                        >
                            <svg className="w-4 h-4 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                            </svg>
                        </button>
                    </div>
                    {/* Collection Runner Button */}
                    <button
                        onClick={() => {
                            setRunnerInitialItems(undefined)
                            setShowRunnerConfig(prev => !prev)
                        }}
                        className="flex flex-col items-center justify-center p-1 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors group"
                        title="Collection Runner"
                    >
                        <div className="relative w-6 h-6 flex items-center justify-center">
                            {/* Square */}
                            <svg className="w-5 h-5 group-hover:text-accent-primary transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="4" ry="4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            {/* Triangle (Play) */}
                            <svg className="absolute w-2.5 h-2.5 ml-0.5 text-current group-hover:text-accent-primary transition-colors" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        </div>
                        <span className="text-[9px] leading-none font-medium mt-0.5 group-hover:text-accent-primary transition-colors">Runner</span>
                    </button>
                    {/* History Button */}
                    <button
                        onClick={() => setShowHistoryPanel(!showHistoryPanel)}
                        className={`p-2 hover:bg-bg-tertiary rounded transition-colors ${showHistoryPanel ? 'bg-bg-tertiary' : ''}`}
                        title="Request History"
                    >
                        <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </button>
                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="p-2 hover:bg-bg-tertiary rounded transition-colors"
                        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    >
                        {theme === 'dark' ? (
                            <svg className="w-5 h-5 text-text-secondary" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5 text-text-secondary" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                            </svg>
                        )}
                    </button>
                    {/* Settings */}
                    <button className="p-2 hover:bg-bg-tertiary rounded">
                        <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex w-full pt-14">
                <Sidebar
                    collections={collections}
                    currentRequestId={currentRequestId}
                    onAddCollection={addCollection}
                    onAddFullCollection={addFullCollection}
                    onDeleteCollection={deleteCollection}
                    onRenameCollection={renameCollection}
                    onToggleCollectionExpand={toggleCollectionExpand}
                    onAddRequest={addRequestToCollection}
                    onImportRequest={handleImportRequest}
                    onAddFolder={addFolder}
                    onMoveItem={moveItem}
                    onDeleteItem={async (_colId: string, itemId: string) => {
                        // Adapter: Try to find if it's a folder or request
                        // Since we don't have type info from Sidebar easily without changing everything, 
                        // let's try to find it in collections first.
                        if (user?.id) {
                            const col = await db.getCollection(user.id, itemId)
                            const type = col ? 'folder' : 'request'
                            deleteItem(itemId, type)
                        }
                    }}
                    onRenameItem={async (_colId: string, itemId: string, newName: string) => {
                        if (user?.id) {
                            const col = await db.getCollection(user.id, itemId)
                            const type = col ? 'folder' : 'request'
                            renameItem(itemId, newName, type)
                        }
                    }}
                    onToggleItemExpand={(_colId: string, itemId: string) => toggleItemExpand(itemId)}
                    onSelectRequest={selectRequest}
                    onRunCollection={(colId: string) => {
                        const col = collections.find((c: Collection) => c.id === colId)
                        if (col) openRunnerWithCollection(col)
                    }}
                    onExportCollection={exportCollection}
                    onNewBlankRequest={createStandaloneRequest}
                    onImportAsStandalone={(requestData: Partial<Request>) => {
                        const newRequest: Request = {
                            id: generateId(),
                            name: requestData.name || requestData.url?.split('/').pop() || 'Imported Request',
                            method: requestData.method || 'GET',
                            url: requestData.url || '',
                            params: requestData.params || [],
                            headers: requestData.headers || [],
                            body: requestData.body || '',
                            auth: requestData.auth || { type: 'none' as const },
                        }
                        setCurrentRequest(newRequest)
                        setCurrentRequestId(newRequest.id)
                        setCurrentCollectionId(null as any)
                        const tabId = `tab-${newRequest.id}`
                        const newTab: Tab = {
                            id: tabId,
                            type: 'request',
                            title: newRequest.name,
                            requestId: newRequest.id,
                            request: newRequest,
                        }
                        setOpenTabs(prev => [...prev, newTab])
                        setActiveTabId(tabId)
                    }}
                    standaloneRequests={standaloneRequests}
                    onSelectStandaloneRequest={(req: Request) => {
                        setCurrentRequest(req)
                        setCurrentRequestId(req.id)
                        setCurrentCollectionId(null as any)
                        const tabId = `tab-${req.id}`
                        const existing = openTabs.find((t: Tab) => t.id === tabId)
                        if (!existing) {
                            const newTab: Tab = {
                                id: tabId,
                                type: 'request',
                                title: req.name,
                                requestId: req.id,
                                collectionId: '',
                                request: req,
                            }
                            setOpenTabs(prev => [...prev, newTab])
                        }
                        setActiveTabId(tabId)
                    }}
                    onDeleteStandaloneRequest={async (reqId: string) => {
                        if (user?.id) {
                            await db.deleteRequest(user.id, reqId)
                        }
                        setOpenTabs(prev => prev.filter((t: Tab) => t.requestId !== reqId))
                    }}
                    onRenameStandaloneRequest={async (reqId: string, newName: string) => {
                        if (user?.id) {
                            await db.updateRequest(user.id, reqId, { name: newName })
                            // Also update tab title if open
                            setOpenTabs(prev => prev.map((t: Tab) =>
                                t.requestId === reqId ? { ...t, title: newName, request: t.request ? { ...t.request, name: newName } : undefined } : t
                            ))
                            // Update current request if it's the one being renamed
                            if (currentRequestId === reqId && currentRequest) {
                                setCurrentRequest({ ...currentRequest, name: newName })
                            }
                        }
                    }}
                    user={user}
                    onLogout={handleLogout}
                    openTabs={openTabs}
                />

                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Tabs Bar */}
                    {openTabs.length > 0 && (
                        <div className="bg-bg-secondary border-b border-gray-700 flex overflow-x-auto">
                            {openTabs.map((tab) => (
                                <div
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveTabId(tab.id)
                                        if (tab.type === 'request' && tab.request) {
                                            setCurrentRequest(tab.request)
                                            setCurrentRequestId(tab.requestId || null)
                                            setCurrentCollectionId(tab.collectionId || null)
                                        }
                                    }}
                                    className={`flex items-center gap-2 px-3 py-2 border-r border-gray-700 cursor-pointer min-w-[120px] max-w-[200px] group ${activeTabId === tab.id
                                        ? 'bg-bg-primary border-b-2 border-b-accent-secondary'
                                        : 'hover:bg-bg-tertiary'
                                        }`}
                                >
                                    {tab.type === 'request' && tab.request && (
                                        <span className={`text-xs font-bold flex-shrink-0 ${tab.request.method === 'GET' ? 'text-green-400' :
                                            tab.request.method === 'POST' ? 'text-orange-400' :
                                                tab.request.method === 'PUT' ? 'text-blue-400' :
                                                    tab.request.method === 'DELETE' ? 'text-red-400' :
                                                        'text-purple-400'
                                            }`}>
                                            {tab.request.method}
                                        </span>
                                    )}
                                    {tab.type === 'run' && (
                                        <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                    {tab.type === 'bulk' && (
                                        <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                    )}
                                    <span className="text-sm truncate flex-1">{tab.title}</span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            const newTabs = openTabs.filter(t => t.id !== tab.id)
                                            setOpenTabs(newTabs)
                                            if (activeTabId === tab.id) {
                                                if (newTabs.length > 0) {
                                                    const nextTab = newTabs[newTabs.length - 1]
                                                    setActiveTabId(nextTab.id)
                                                    if (nextTab.type === 'request' && nextTab.request) {
                                                        setCurrentRequest(nextTab.request)
                                                        setCurrentRequestId(nextTab.requestId || null)
                                                        setCurrentCollectionId(nextTab.collectionId || null)
                                                    }
                                                } else {
                                                    setActiveTabId(null)
                                                    setCurrentRequest(null)
                                                    setCurrentRequestId(null)
                                                }
                                            }
                                        }}
                                        className="p-0.5 rounded hover:bg-red-500/30 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Content Area */}
                    {!activeTabId ? (
                        // Empty State
                        <div className="flex-1 flex flex-col items-center justify-center text-text-tertiary opacity-30">
                            <svg className="w-24 h-24 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-xl font-medium">Select a request or create a new one</p>
                        </div>
                    ) : activeTabId?.startsWith('bulk-') ? (
                        // Bulk Results View
                        <div className="flex-1 overflow-auto p-4">
                            {(() => {
                                const activeTab = openTabs.find(t => t.id === activeTabId)
                                if (!activeTab || activeTab.type !== 'bulk') return null

                                const bulkRes = activeTab.bulkResponse

                                // Loading state
                                if (!bulkRes) {
                                    return (
                                        <div className="flex-1 flex flex-col items-center justify-center h-full min-h-[400px]">
                                            <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500/30 border-t-purple-500 mb-4"></div>
                                            <p className="text-lg font-medium text-text-secondary">Sending {activeTab.bulkConcurrency} concurrent requests...</p>
                                            <p className="text-sm text-text-tertiary mt-1">{activeTab.bulkRequest?.method} {activeTab.bulkRequest?.url}</p>
                                        </div>
                                    )
                                }

                                // Error state
                                if (!bulkRes.ok && bulkRes.error) {
                                    return (
                                        <div className="max-w-2xl mx-auto mt-8">
                                            <div className="bg-red-900/20 border border-red-700 rounded-lg p-6 text-center">
                                                <svg className="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                                </svg>
                                                <p className="text-red-300 font-mono text-sm">{bulkRes.error.message}</p>
                                            </div>
                                        </div>
                                    )
                                }

                                // Calculate stats
                                const results = bulkRes.results || []
                                const successCount = results.filter(r => r.ok).length
                                const failCount = results.length - successCount
                                const times = results.map(r => r.durationMs)
                                const minTime = times.length > 0 ? Math.min(...times) : 0
                                const maxTime = times.length > 0 ? Math.max(...times) : 0
                                const avgTime = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0
                                const totalBytes = results.reduce((a, r) => a + (r.sizeBytes || 0), 0)
                                const throughput = bulkRes.totalTimeMs > 0
                                    ? (results.length / (bulkRes.totalTimeMs / 1000)).toFixed(1)
                                    : '0'
                                const successRate = results.length > 0
                                    ? Math.round((successCount / results.length) * 100)
                                    : 0

                                return (
                                    <div className="max-w-5xl mx-auto">
                                        {/* Header */}
                                        <div className="flex items-center justify-between mb-6">
                                            <h2 className="text-xl font-bold flex items-center gap-2">
                                                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                </svg>
                                                Bulk: {results.length}× {activeTab.bulkRequest?.method} {activeTab.bulkRequest?.name}
                                            </h2>
                                            {activeTab.bulkRequest && activeTab.bulkConcurrency && (
                                                <button
                                                    onClick={() => sendBulkRequest(activeTab.bulkRequest!, activeTab.bulkConcurrency!)}
                                                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-colors flex items-center gap-1.5"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                    </svg>
                                                    Run Again
                                                </button>
                                            )}
                                        </div>

                                        {/* Stats Dashboard */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                                            <div className="bg-bg-tertiary rounded-lg p-4 border border-gray-700">
                                                <div className="text-xs text-text-tertiary uppercase font-bold tracking-wider mb-1">Success</div>
                                                <div className="text-2xl font-bold text-green-400">{successCount}</div>
                                                <div className="text-xs text-text-tertiary">{successRate}% rate</div>
                                            </div>
                                            <div className="bg-bg-tertiary rounded-lg p-4 border border-gray-700">
                                                <div className="text-xs text-text-tertiary uppercase font-bold tracking-wider mb-1">Failed</div>
                                                <div className="text-2xl font-bold text-red-400">{failCount}</div>
                                                <div className="text-xs text-text-tertiary">of {results.length} total</div>
                                            </div>
                                            <div className="bg-bg-tertiary rounded-lg p-4 border border-gray-700">
                                                <div className="text-xs text-text-tertiary uppercase font-bold tracking-wider mb-1">Avg Time</div>
                                                <div className="text-2xl font-bold text-blue-400">{avgTime}<span className="text-sm ml-0.5">ms</span></div>
                                                <div className="text-xs text-text-tertiary">{minTime}ms — {maxTime}ms</div>
                                            </div>
                                            <div className="bg-bg-tertiary rounded-lg p-4 border border-gray-700">
                                                <div className="text-xs text-text-tertiary uppercase font-bold tracking-wider mb-1">Throughput</div>
                                                <div className="text-2xl font-bold text-purple-400">{throughput}<span className="text-sm ml-0.5">req/s</span></div>
                                                <div className="text-xs text-text-tertiary">{bulkRes.totalTimeMs}ms total</div>
                                            </div>
                                        </div>

                                        {/* Success Rate Bar */}
                                        <div className="mb-6">
                                            <div className="flex justify-between text-xs text-text-tertiary mb-1">
                                                <span>Success Rate</span>
                                                <span>{successRate}%</span>
                                            </div>
                                            <div className="w-full h-3 bg-bg-tertiary rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${successRate === 100 ? 'bg-gradient-to-r from-green-500 to-green-400' :
                                                        successRate >= 80 ? 'bg-gradient-to-r from-green-500 to-yellow-400' :
                                                            successRate >= 50 ? 'bg-gradient-to-r from-yellow-500 to-orange-400' :
                                                                'bg-gradient-to-r from-red-500 to-red-400'
                                                        }`}
                                                    style={{ width: `${successRate}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        {/* Total Data */}
                                        <div className="flex gap-4 mb-4 text-xs text-text-tertiary">
                                            <span>Total data: {(totalBytes / 1024).toFixed(1)} KB</span>
                                        </div>

                                        {/* Results Table */}
                                        <div className="border border-gray-700 rounded-lg overflow-hidden mb-6">
                                            <div className="bg-bg-tertiary px-4 py-2 flex items-center gap-4 text-xs font-bold text-text-tertiary uppercase tracking-wider border-b border-gray-700">
                                                <span className="w-12 text-center">#</span>
                                                <span className="w-16 text-center">Status</span>
                                                <span className="flex-1">Response</span>
                                                <span className="w-20 text-right">Time</span>
                                                <span className="w-20 text-right">Size</span>
                                            </div>
                                            <div className="max-h-[400px] overflow-y-auto">
                                                {results.map((r, idx) => (
                                                    <div
                                                        key={idx}
                                                        className={`px-4 py-2 flex items-center gap-4 text-sm border-b border-gray-700/50 last:border-0 ${r.ok ? 'hover:bg-green-900/10' : 'hover:bg-red-900/10 bg-red-900/5'
                                                            }`}
                                                    >
                                                        <span className="w-12 text-center text-xs text-text-tertiary font-mono">{r.index + 1}</span>
                                                        <span className="w-16 text-center">
                                                            {r.ok ? (
                                                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${r.status >= 200 && r.status < 300 ? 'bg-green-500/20 text-green-400' :
                                                                    r.status >= 300 && r.status < 400 ? 'bg-blue-500/20 text-blue-400' :
                                                                        r.status >= 400 && r.status < 500 ? 'bg-orange-500/20 text-orange-400' :
                                                                            'bg-red-500/20 text-red-400'
                                                                    }`}>{r.status}</span>
                                                            ) : (
                                                                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">ERR</span>
                                                            )}
                                                        </span>
                                                        <span className="flex-1 text-xs truncate">
                                                            {r.ok ? (
                                                                <span className="text-text-secondary">{r.statusText}</span>
                                                            ) : (
                                                                <span className="text-red-400">{r.error}</span>
                                                            )}
                                                        </span>
                                                        <span className="w-20 text-right text-xs font-mono text-text-secondary">{r.durationMs}ms</span>
                                                        <span className="w-20 text-right text-xs font-mono text-text-tertiary">{r.sizeBytes ? `${(r.sizeBytes / 1024).toFixed(1)}K` : '—'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Charts */}
                                        <BulkResultsCharts results={results} totalTimeMs={bulkRes.totalTimeMs} />
                                    </div>
                                )
                            })()}
                        </div>
                    ) : activeTabId?.startsWith('run-') ? (
                        // Run Results View
                        <div className="flex-1 overflow-auto p-4">
                            {(() => {
                                const activeTab = openTabs.find(t => t.id === activeTabId)
                                if (!activeTab || activeTab.type !== 'run') return null
                                const results = runResults
                                return (
                                    <div className="max-w-4xl mx-auto">
                                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                            <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                            </svg>
                                            Run: {activeTab.runCollectionName}
                                        </h2>

                                        {activeTab.lastRunnerConfig && (
                                            <div className="flex justify-end mb-2">
                                                <button
                                                    onClick={() => executeRunner(activeTab.lastRunnerConfig!.config, activeTab.lastRunnerConfig!.requests)}
                                                    className="px-3 py-1.5 bg-accent-primary hover:bg-orange-600 text-white text-sm rounded transition-colors flex items-center gap-1"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                    </svg>
                                                    Run Again
                                                </button>
                                            </div>
                                        )}

                                        <div className="flex gap-4 mb-4 text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                                                <span>Passed: {results.filter(r => r.status === 'passed').length}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                                                <span>Failed: {results.filter(r => r.status === 'failed').length}</span>
                                            </div>
                                            <div className="text-text-secondary">
                                                Total Time: {results.reduce((acc, r) => acc + (r.responseTime || 0), 0)}ms
                                            </div>
                                        </div>

                                        <div className="w-full h-2 bg-bg-tertiary rounded overflow-hidden mb-4">
                                            <div
                                                className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-300"
                                                style={{ width: `${(results.filter(r => r.status !== 'pending').length / Math.max(results.length, 1)) * 100}%` }}
                                            ></div>
                                        </div>

                                        <div className="space-y-2">
                                            {results.map((result, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`flex items-center gap-3 p-3 rounded border ${result.status === 'passed' ? 'border-green-600/50 bg-green-900/20' :
                                                        result.status === 'failed' ? 'border-red-600/50 bg-red-900/20' :
                                                            result.status === 'running' ? 'border-blue-600/50 bg-blue-900/20' :
                                                                'border-gray-700 bg-bg-tertiary'
                                                        }`}
                                                >
                                                    <div className="w-6 h-6 flex items-center justify-center">
                                                        {result.status === 'pending' && <div className="w-2 h-2 rounded-full bg-gray-500"></div>}
                                                        {result.status === 'running' && (
                                                            <svg className="w-5 h-5 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                        )}
                                                        {result.status === 'passed' && (
                                                            <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        )}
                                                        {result.status === 'failed' && (
                                                            <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                            </svg>
                                                        )}
                                                    </div>

                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${result.request.method === 'GET' ? 'bg-green-500/20 text-green-400' :
                                                        result.request.method === 'POST' ? 'bg-orange-500/20 text-orange-400' :
                                                            result.request.method === 'PUT' ? 'bg-blue-500/20 text-blue-400' :
                                                                result.request.method === 'DELETE' ? 'bg-red-500/20 text-red-400' :
                                                                    'bg-purple-500/20 text-purple-400'
                                                        }`}>
                                                        {result.request.method}
                                                    </span>

                                                    <span className="flex-1 text-sm truncate">{result.request.name}</span>

                                                    {result.iteration && (
                                                        <span className="text-xs text-text-tertiary px-2">It. {result.iteration}</span>
                                                    )}
                                                    {result.responseStatus && (
                                                        <span className={`text-xs font-medium ${result.responseStatus >= 200 && result.responseStatus < 300 ? 'text-green-400' :
                                                            result.responseStatus >= 400 ? 'text-red-400' : 'text-yellow-400'
                                                            }`}>
                                                            {result.responseStatus}
                                                        </span>
                                                    )}
                                                    {result.responseTime !== undefined && (
                                                        <span className="text-xs text-text-secondary">{result.responseTime}ms</span>
                                                    )}
                                                    {result.error && (
                                                        <span className="text-xs text-red-400 truncate max-w-[150px]" title={result.error}>
                                                            {result.error}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })()}
                        </div>
                    ) : (
                        // Request Editor View
                        <>
                            <RequestEditor
                                request={currentRequest}
                                onSendRequest={sendRequest}
                                onUpdateRequest={updateRequest}
                                onBulkSend={sendBulkRequest}
                            />

                            <div className="border-t border-gray-700" />

                            <ResponseViewer response={(() => {
                                const activeTab = openTabs.find(t => t.id === activeTabId)
                                return activeTab?.response || null
                            })()} />
                        </>
                    )}
                </div>

                {/* Runner Configuration Panel */}
                <RunnerConfiguration
                    isOpen={showRunnerConfig}
                    onClose={() => setShowRunnerConfig(false)}
                    onRun={executeRunner}
                    collections={collections}
                    initialItems={runnerInitialItems}
                />
            </div>

            {/* History Panel */}
            {showHistoryPanel && (
                <div className="fixed top-14 right-0 w-96 h-[calc(100vh-3.5rem)] bg-bg-secondary border-l border-gray-700 shadow-xl z-40 flex flex-col">
                    <div className="flex items-center justify-between p-4 border-b border-gray-700">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <svg className="w-5 h-5 text-accent-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            History
                        </h3>
                        <div className="flex items-center gap-2">
                            {history.length > 0 && (
                                <button
                                    onClick={() => {
                                        setConfirmDialog({
                                            title: 'Clear History',
                                            message: 'Clear all history?',
                                            confirmLabel: 'Clear',
                                            onConfirm: () => {
                                                setHistory([])
                                                setConfirmDialog(null)
                                            },
                                        })
                                    }}
                                    className="p-1.5 text-text-tertiary hover:text-red-400 hover:bg-red-500/20 rounded transition-colors"
                                    title="Clear History"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            )}
                            <button
                                onClick={() => setShowHistoryPanel(false)}
                                className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {history.length === 0 ? (
                            <div className="p-8 text-center text-text-tertiary">
                                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p>No history yet</p>
                                <p className="text-sm mt-1">Send a request to see it here</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-700">
                                {history.map((item) => {
                                    const date = new Date(item.timestamp)
                                    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                                    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                    const isToday = new Date().toDateString() === date.toDateString()

                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => {
                                                // Create new request from history and open in new tab
                                                const newRequest: Request = {
                                                    ...item.request,
                                                    id: generateId(),
                                                    name: `${item.request.name} (from history)`,
                                                }
                                                setCurrentRequest(newRequest)
                                                setCurrentRequestId(null)
                                                setCurrentCollectionId(null)

                                                // Add tab
                                                const tabId = `history-${Date.now()}`
                                                const newTab: Tab = {
                                                    id: tabId,
                                                    type: 'request',
                                                    title: newRequest.name,
                                                    request: newRequest,
                                                }
                                                setOpenTabs(prev => [...prev, newTab])
                                                setActiveTabId(tabId)
                                                setShowHistoryPanel(false)
                                            }}
                                            className="p-3 hover:bg-bg-tertiary cursor-pointer transition-colors"
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${item.request.method === 'GET' ? 'bg-green-500/20 text-green-400' :
                                                    item.request.method === 'POST' ? 'bg-orange-500/20 text-orange-400' :
                                                        item.request.method === 'PUT' ? 'bg-blue-500/20 text-blue-400' :
                                                            item.request.method === 'DELETE' ? 'bg-red-500/20 text-red-400' :
                                                                'bg-purple-500/20 text-purple-400'
                                                    }`}>
                                                    {item.request.method}
                                                </span>
                                                {item.response?.status && (
                                                    <span className={`text-xs ${item.response.status >= 200 && item.response.status < 300 ? 'text-green-400' :
                                                        item.response.status >= 400 ? 'text-red-400' :
                                                            'text-yellow-400'
                                                        }`}>
                                                        {item.response.status}
                                                    </span>
                                                )}
                                                {item.response?.time && (
                                                    <span className="text-xs text-text-tertiary">{item.response.time}ms</span>
                                                )}
                                            </div>
                                            <div className="text-sm truncate text-text-primary mb-1" title={item.request.url}>
                                                {item.request.url}
                                            </div>
                                            <div className="text-xs text-text-tertiary">
                                                {isToday ? timeStr : `${dateStr} ${timeStr}`}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Environment Management Modal */}
            {showEnvModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowEnvModal(false)}>
                    <div className="bg-bg-secondary border border-gray-700 rounded-lg p-6 w-[700px] max-w-[90vw] max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                            </svg>
                            Manage Environments
                        </h3>

                        {/* Add New Environment */}
                        <div className="mb-4">
                            {isAddingEnv ? (
                                <div className="bg-bg-tertiary rounded-lg p-4 border border-gray-600">
                                    <label className="block text-sm font-medium text-text-secondary mb-2">
                                        Environment Name
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newEnvName}
                                            onChange={(e) => setNewEnvName(e.target.value)}
                                            onKeyDown={async (e) => {
                                                if (e.key === 'Enter' && newEnvName.trim()) {
                                                    handleSaveEnvironment()
                                                }
                                                if (e.key === 'Escape') {
                                                    setNewEnvName('')
                                                    setIsAddingEnv(false)
                                                }
                                            }}
                                            placeholder="Production, Development, Staging..."
                                            className="flex-1 px-3 py-2 bg-bg-primary border border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            autoFocus
                                        />
                                        <button
                                            onClick={handleSaveEnvironment}
                                            disabled={!newEnvName.trim()}
                                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Create
                                        </button>
                                        <button
                                            onClick={() => {
                                                setNewEnvName('')
                                                setIsAddingEnv(false)
                                            }}
                                            className="px-4 py-2 border border-gray-600 text-text-secondary rounded hover:bg-bg-primary transition-all text-sm"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsAddingEnv(true)}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-all text-sm font-medium"
                                >
                                    + New Environment
                                </button>
                            )}
                        </div>

                        {/* Environments List */}
                        {environments.length === 0 ? (
                            <div className="text-center text-text-tertiary py-8">
                                <svg className="w-12 h-12 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                <p>No environments yet</p>
                                <p className="text-xs mt-1">Create one to use variables like {'{baseUrl}'}</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {environments.map((env) => (
                                    <div key={env.id} className="bg-bg-tertiary rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${currentEnvironmentId === String(env.id) ? 'bg-green-400' : 'bg-gray-500'}`} />
                                                <h4 className="font-semibold">{env.name}</h4>
                                                {currentEnvironmentId === String(env.id) && (
                                                    <span className="text-xs bg-green-600/30 text-green-400 px-2 py-0.5 rounded">Active</span>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setCurrentEnvironmentId(String(env.id))}
                                                    className="px-2 py-1 text-xs bg-accent-secondary/20 text-accent-secondary rounded hover:bg-accent-secondary/30"
                                                >
                                                    Use
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        deleteEnvironment(env.id)
                                                    }}
                                                    className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>

                                        {/* Variables Table */}
                                        <div className="bg-bg-primary rounded overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-bg-secondary">
                                                        <th className="p-2 text-left w-8"></th>
                                                        <th className="p-2 text-left">Variable</th>
                                                        <th className="p-2 text-left">Value</th>
                                                        <th className="p-2 w-12"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {env.variables.map((variable, varIndex) => (
                                                        <tr key={varIndex} className="border-t border-gray-700">
                                                            <td className="p-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={variable.enabled}
                                                                    onChange={(e) => updateEnvironmentVariable(env.id, varIndex, variable.key, variable.value, e.target.checked)}
                                                                    className="w-4 h-4"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <input
                                                                    type="text"
                                                                    value={variable.key}
                                                                    onChange={(e) => updateEnvironmentVariable(env.id, varIndex, e.target.value, variable.value, variable.enabled)}
                                                                    placeholder="variable_name"
                                                                    className="w-full bg-transparent border border-gray-600 rounded px-2 py-1 focus:outline-none focus:border-accent-secondary"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <input
                                                                    type="text"
                                                                    value={variable.value}
                                                                    onChange={(e) => updateEnvironmentVariable(env.id, varIndex, variable.key, e.target.value, variable.enabled)}
                                                                    placeholder="value"
                                                                    className="w-full bg-transparent border border-gray-600 rounded px-2 py-1 focus:outline-none focus:border-accent-secondary font-mono text-xs"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <button
                                                                    onClick={() => removeEnvironmentVariable(env.id, varIndex)}
                                                                    className="text-red-400 hover:text-red-300"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                    </svg>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            <button
                                                onClick={() => addEnvironmentVariable(env.id)}
                                                className="w-full p-2 text-center text-sm text-accent-secondary hover:bg-bg-secondary transition-colors"
                                            >
                                                + Add Variable
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-end mt-4">
                            <button
                                onClick={() => setShowEnvModal(false)}
                                className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/80 text-white rounded transition-all font-medium"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}



            {/* Confirm Dialog */}
            {confirmDialog && (
                <ConfirmDialog
                    title={confirmDialog.title}
                    message={confirmDialog.message}
                    confirmLabel={confirmDialog.confirmLabel}
                    onConfirm={confirmDialog.onConfirm}
                    onCancel={() => setConfirmDialog(null)}
                />
            )}

            {/* Save Request Dialog */}
            {showSaveDialog && currentRequest && (
                <SaveRequestDialog
                    requestName={currentRequest.name}
                    collections={collections}
                    onCancel={() => setShowSaveDialog(false)}
                    onSave={async (collectionId: string | null, folderId: string | null) => {
                        if (!user?.id || !currentRequest) return

                        // Determine Target Parent
                        let targetCollectionId: string | undefined = undefined
                        if (collectionId) {
                            targetCollectionId = folderId || collectionId
                        }

                        // Check if existing (UUID)
                        const isExisting = currentRequest.id && currentRequest.id.length > 0

                        try {
                            if (isExisting) {
                                // Update existing request
                                await db.updateRequest(user.id, currentRequest.id, {
                                    ...uiRequestToDbRequest(currentRequest, user.id, targetCollectionId),
                                    collection_id: targetCollectionId,
                                    name: currentRequest.name // Ensure name is up to date
                                })
                            } else {
                                // Create new request
                                const newId = await db.createRequest(user.id, {
                                    ...uiRequestToDbRequest(currentRequest, user.id, targetCollectionId),
                                    collection_id: targetCollectionId
                                })

                                // Update current request to use new ID
                                const updated = { ...currentRequest, id: newId }
                                setCurrentRequest(updated)
                                setCurrentRequestId(updated.id)
                            }

                            if (collectionId) {
                                setCurrentCollectionId(collectionId)
                            } else {
                                setCurrentCollectionId(null as any)
                            }
                        } catch (e) {
                            console.error("Failed to save request", e)
                        }

                        setShowSaveDialog(false)
                    }}
                />
            )}

            {/* Run Collection Modal - Removed as redundant */}
        </div>
    )
}

export default App
