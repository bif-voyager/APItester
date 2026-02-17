import Dexie, { Table } from 'dexie'
import { v4 as uuidv4 } from 'uuid'
import { DBCollection, DBRequest, DBEnvironment } from './supabase'

// Define local interfaces that match DB interfaces but for Dexie
// We reuse the exported types from supabase.ts as the "Contract"

class DexieUserDatabase extends Dexie {
    collections!: Table<DBCollection, string>
    requests!: Table<DBRequest, string>
    environments!: Table<DBEnvironment, string>

    constructor() {
        super('ApiClientGuestDB')
        this.version(1).stores({
            collections: 'id, user_id, parent_id',
            requests: 'id, collection_id, user_id',
            environments: 'id, user_id'
        })
    }
}

const db = new DexieUserDatabase()

// --- Adapter Methods ---

export const dexieDb = {
    // --- Collections ---
    getCollections: async (userId: string): Promise<DBCollection[]> => {
        return await db.collections.where('user_id').equals(userId).toArray()
    },

    getCollection: async (userId: string, collectionId: string): Promise<DBCollection | null> => {
        const col = await db.collections.get(collectionId)
        return col && col.user_id === userId ? col : null
    },

    createCollection: async (userId: string, name: string, parentId: string | null = null): Promise<string> => {
        const id = uuidv4()
        const newCol: DBCollection = {
            id,
            user_id: userId,
            name,
            parent_id: parentId,
            is_expanded: true,
            created_at: new Date().toISOString()
        }
        await db.collections.add(newCol)
        return id
    },

    updateCollection: async (userId: string, collectionId: string, updates: Partial<DBCollection>): Promise<void> => {
        // Verify ownership
        const col = await db.collections.get(collectionId)
        if (col && col.user_id === userId) {
            await db.collections.update(collectionId, updates)
        }
    },

    deleteCollection: async (userId: string, collectionId: string): Promise<void> => {
        // Recursive delete not automatic in Dexie, must implement
        const col = await db.collections.get(collectionId)
        if (col && col.user_id === userId) {
            await deleteCollectionRecursive(collectionId)
        }
    },

    // --- Requests ---
    getRequests: async (userId: string, collectionId?: string): Promise<DBRequest[]> => {
        let collection = db.requests.where('user_id').equals(userId)
        if (collectionId) {
            collection = collection.filter(r => r.collection_id === collectionId)
        }
        return await collection.toArray()
    },

    getRequest: async (userId: string, requestId: string): Promise<DBRequest | null> => {
        const req = await db.requests.get(requestId)
        return req && req.user_id === userId ? req : null
    },

    createRequest: async (userId: string, request: Omit<DBRequest, 'id' | 'user_id' | 'created_at'>): Promise<string> => {
        const id = uuidv4()
        const newReq: DBRequest = {
            id,
            user_id: userId,
            created_at: new Date().toISOString(),
            ...request
        }
        await db.requests.add(newReq)
        return id
    },

    updateRequest: async (userId: string, requestId: string, updates: Partial<DBRequest>): Promise<void> => {
        const req = await db.requests.get(requestId)
        if (req && req.user_id === userId) {
            await db.requests.update(requestId, updates)
        }
    },

    deleteRequest: async (userId: string, requestId: string): Promise<void> => {
        const req = await db.requests.get(requestId)
        if (req && req.user_id === userId) {
            await db.requests.delete(requestId)
        }
    },

    // --- Environments ---
    getEnvironments: async (userId: string): Promise<DBEnvironment[]> => {
        return await db.environments.where('user_id').equals(userId).toArray()
    },

    createEnvironment: async (userId: string, name: string, variables: any): Promise<string> => {
        const id = uuidv4()
        const newEnv: DBEnvironment = {
            id,
            user_id: userId,
            name,
            variables,
            created_at: new Date().toISOString()
        }
        await db.environments.add(newEnv)
        return id
    },

    updateEnvironment: async (userId: string, envId: string, updates: Partial<DBEnvironment>): Promise<void> => {
        const env = await db.environments.get(envId)
        if (env && env.user_id === userId) {
            await db.environments.update(envId, updates)
        }
    },

    deleteEnvironment: async (userId: string, envId: string): Promise<void> => {
        const env = await db.environments.get(envId)
        if (env && env.user_id === userId) {
            await db.environments.delete(envId)
        }
    }
}

// Optimization: Recursive delete helper
async function deleteCollectionRecursive(collectionId: string) {
    // 1. Delete all requests in this collection
    const requests = await db.requests.where('collection_id').equals(collectionId).toArray()
    await db.requests.bulkDelete(requests.map(r => r.id))

    // 2. Find all child collections
    const children = await db.collections.where('parent_id').equals(collectionId).toArray()

    // 3. Recurse
    for (const child of children) {
        await deleteCollectionRecursive(child.id)
    }

    // 4. Delete self
    await db.collections.delete(collectionId)
}
