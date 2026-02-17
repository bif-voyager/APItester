import { useState, useEffect } from 'react'
import { supabaseDb, DBCollection, DBRequest, DBEnvironment } from './supabase'
import { dexieDb } from './dexie'

// Export Types (Re-export from supabase.ts to maintain import paths)
export type { DBCollection, DBRequest, DBEnvironment }

const isGuest = (userId: string) => userId === 'guest'

// --- Event Emitter for Supabase Updates ---
// Used to trigger re-fetches when data changes
const dbEvents = new EventTarget()
const triggerUpdate = () => dbEvents.dispatchEvent(new Event('update'))

// Export the DB instance with routing logic
export const db = {
    // --- Collections ---
    getCollections: (userId: string) => isGuest(userId) ? dexieDb.getCollections(userId) : supabaseDb.getCollections(userId),
    getCollection: (userId: string, collectionId: string) => isGuest(userId) ? dexieDb.getCollection(userId, collectionId) : supabaseDb.getCollection(userId, collectionId),
    createCollection: async (userId: string, name: string, parentId: string | null) => {
        const res = isGuest(userId) ? await dexieDb.createCollection(userId, name, parentId) : await supabaseDb.createCollection(userId, name, parentId)
        if (!isGuest(userId)) triggerUpdate()
        return res
    },
    updateCollection: async (userId: string, collectionId: string, updates: any) => {
        const res = isGuest(userId) ? await dexieDb.updateCollection(userId, collectionId, updates) : await supabaseDb.updateCollection(userId, collectionId, updates)
        if (!isGuest(userId)) triggerUpdate()
        return res
    },
    deleteCollection: async (userId: string, collectionId: string) => {
        const res = isGuest(userId) ? await dexieDb.deleteCollection(userId, collectionId) : await supabaseDb.deleteCollection(userId, collectionId)
        if (!isGuest(userId)) triggerUpdate()
        return res
    },

    // --- Requests ---
    getRequests: (userId: string, collectionId?: string) => isGuest(userId) ? dexieDb.getRequests(userId, collectionId) : supabaseDb.getRequests(userId, collectionId),
    getRequest: (userId: string, requestId: string) => isGuest(userId) ? dexieDb.getRequest(userId, requestId) : supabaseDb.getRequest(userId, requestId),
    createRequest: async (userId: string, request: any) => {
        const res = isGuest(userId) ? await dexieDb.createRequest(userId, request) : await supabaseDb.createRequest(userId, request)
        if (!isGuest(userId)) triggerUpdate()
        return res
    },
    updateRequest: async (userId: string, requestId: string, updates: any) => {
        const res = isGuest(userId) ? await dexieDb.updateRequest(userId, requestId, updates) : await supabaseDb.updateRequest(userId, requestId, updates)
        if (!isGuest(userId)) triggerUpdate()
        return res
    },
    deleteRequest: async (userId: string, requestId: string) => {
        const res = isGuest(userId) ? await dexieDb.deleteRequest(userId, requestId) : await supabaseDb.deleteRequest(userId, requestId)
        if (!isGuest(userId)) triggerUpdate()
        return res
    },

    // --- Environments ---
    getEnvironments: (userId: string) => isGuest(userId) ? dexieDb.getEnvironments(userId) : supabaseDb.getEnvironments(userId),
    createEnvironment: async (userId: string, name: string, variables: any) => {
        const res = isGuest(userId) ? await dexieDb.createEnvironment(userId, name, variables) : await supabaseDb.createEnvironment(userId, name, variables)
        if (!isGuest(userId)) triggerUpdate()
        return res
    },
    updateEnvironment: async (userId: string, envId: string, updates: any) => {
        const res = isGuest(userId) ? await dexieDb.updateEnvironment(userId, envId, updates) : await supabaseDb.updateEnvironment(userId, envId, updates)
        if (!isGuest(userId)) triggerUpdate()
        return res
    },
    deleteEnvironment: async (userId: string, envId: string) => {
        const res = isGuest(userId) ? await dexieDb.deleteEnvironment(userId, envId) : await supabaseDb.deleteEnvironment(userId, envId)
        if (!isGuest(userId)) triggerUpdate()
        return res
    },
}

// --- React Hooks ---
import { useLiveQuery } from 'dexie-react-hooks'

/**
 * Hook to fetch collections for a specific user.
 * Supports Reactivity for Guest (Dexie) and Fetch for User (Supabase).
 */
export function useUserCollections(userId: string | undefined) {
    const isGuestUser = userId === 'guest'

    // Guest Mode: Reactive
    const guestData = useLiveQuery(
        () => isGuestUser ? dexieDb.getCollections(userId) : Promise.resolve([]),
        [userId, isGuestUser]
    )

    // User Mode: State-based fetching (Auto-refresh on update)
    const [supabaseData, setSupabaseData] = useState<DBCollection[]>([])

    useEffect(() => {
        if (!userId || isGuestUser) {
            setSupabaseData([])
            return
        }

        const fetchCollections = async () => {
            try {
                const data = await db.getCollections(userId)
                setSupabaseData(data)
            } catch (error) {
                console.error('Error fetching collections:', error)
            }
        }

        fetchCollections()

        // Listen for local updates
        const onUpdate = () => fetchCollections()
        dbEvents.addEventListener('update', onUpdate)

        return () => dbEvents.removeEventListener('update', onUpdate)
    }, [userId, isGuestUser])

    return isGuestUser ? (guestData || []) : supabaseData
}

/**
 * Hook to fetch requests for a specific user.
 */
export function useUserRequests(userId: string | undefined, collectionId?: string) {
    const isGuestUser = userId === 'guest'

    // Guest Mode: Reactive
    const guestData = useLiveQuery(
        () => isGuestUser ? dexieDb.getRequests(userId, collectionId) : Promise.resolve([]),
        [userId, collectionId, isGuestUser]
    )

    // User Mode: State-based fetching
    const [supabaseData, setSupabaseData] = useState<DBRequest[]>([])

    useEffect(() => {
        if (!userId || isGuestUser) {
            setSupabaseData([])
            return
        }

        const fetchRequests = async () => {
            try {
                const data = await db.getRequests(userId, collectionId)
                setSupabaseData(data)
            } catch (error) {
                console.error('Error fetching requests:', error)
            }
        }

        fetchRequests()

        const onUpdate = () => fetchRequests()
        dbEvents.addEventListener('update', onUpdate)

        return () => dbEvents.removeEventListener('update', onUpdate)
    }, [userId, collectionId, isGuestUser])

    return isGuestUser ? (guestData || []) : supabaseData
}

/**
 * Hook to fetch environments for a specific user.
 */
export function useUserEnvironments(userId: string | undefined) {
    const isGuestUser = userId === 'guest'

    // Guest Mode: Reactive
    const guestData = useLiveQuery(
        () => isGuestUser ? dexieDb.getEnvironments(userId) : Promise.resolve([]),
        [userId, isGuestUser]
    )

    // User Mode: State-based fetching
    const [supabaseData, setSupabaseData] = useState<DBEnvironment[]>([])

    useEffect(() => {
        if (!userId || isGuestUser) {
            setSupabaseData([])
            return
        }

        const fetchEnvironments = async () => {
            try {
                const data = await db.getEnvironments(userId)
                setSupabaseData(data)
            } catch (error) {
                console.error('Error fetching environments:', error)
            }
        }

        fetchEnvironments()

        const onUpdate = () => fetchEnvironments()
        dbEvents.addEventListener('update', onUpdate)

        return () => dbEvents.removeEventListener('update', onUpdate)
    }, [userId, isGuestUser])

    return isGuestUser ? (guestData || []) : supabaseData
}
