import { supabase } from '../supabaseClient'

// --- Types ---

export interface DBCollection {
    id: string
    user_id: string
    name: string
    parent_id: string | null
    is_expanded?: boolean
    created_at?: string
}

export interface DBRequest {
    id: string
    user_id: string
    collection_id?: string
    name: string
    method: string
    url: string
    headers?: any
    body?: any
    params?: any
    auth?: any
    created_at?: string
}

export interface DBEnvironment {
    id: string
    user_id: string
    name: string
    variables: any
    created_at?: string
}

// --- Database Service ---

export const supabaseDb = {
    // --- Users ---
    // Supabase Auth handles users. We don't need explicit user tables unless we store profile data.
    // The app uses `getUser` to find ID by name. Supabase uses `supabase.auth.getUser()`.

    // --- Collections ---

    async getCollections(userId: string): Promise<DBCollection[]> {
        const { data, error } = await supabase
            .from('collections')
            .select('*')
            .eq('user_id', userId)

        if (error) throw error
        return data || []
    },

    async getCollection(userId: string, collectionId: string): Promise<DBCollection | null> {
        const { data, error } = await supabase
            .from('collections')
            .select('*')
            .eq('id', collectionId)
            .eq('user_id', userId)
            .single()

        if (error) return null
        return data
    },

    async createCollection(userId: string, name: string, parentId: string | null = null): Promise<string> {
        // We let Supabase generate UUID or we can generate it here.
        // If we want to return the ID immediately without fetching, we might wait for response.
        const { data, error } = await supabase
            .from('collections')
            .insert({
                user_id: userId,
                name,
                parent_id: parentId,
                is_expanded: true
            })
            .select('id')
            .single()

        if (error) throw error
        return data.id
    },

    // Delete Collection (Recursive via Cascade)
    async deleteCollection(userId: string, collectionId: string): Promise<void> {
        const { error } = await supabase
            .from('collections')
            .delete()
            .eq('id', collectionId)
            .eq('user_id', userId) // Security check

        if (error) throw error
    },

    // Update Collection
    async updateCollection(userId: string, collectionId: string, updates: Partial<DBCollection>): Promise<void> {
        // Map camelCase to snake_case if necessary, or just use snake_case in DBCollection interface
        // The DBCollection interface above uses user_id, parent_id.
        // But the UI wraps it?
        // Let's assume updates keys match DB columns for simplicity or map them.

        // We only really update `name` and `is_expanded`.
        const dbUpdates: any = {}
        if (updates.name !== undefined) dbUpdates.name = updates.name
        if (updates.is_expanded !== undefined) dbUpdates.is_expanded = updates.is_expanded

        const { error } = await supabase
            .from('collections')
            .update(dbUpdates)
            .eq('id', collectionId)
            .eq('user_id', userId)

        if (error) throw error
    },

    // --- Requests ---

    async getRequests(userId: string, collectionId?: string): Promise<DBRequest[]> {
        let query = supabase.from('requests').select('*').eq('user_id', userId)

        if (collectionId) {
            query = query.eq('collection_id', collectionId)
        }

        const { data, error } = await query
        if (error) throw error
        return data || []
    },

    async getRequest(userId: string, requestId: string): Promise<DBRequest | null> {
        const { data, error } = await supabase
            .from('requests')
            .select('*')
            .eq('id', requestId)
            .eq('user_id', userId)
            .single()

        if (error) return null
        return data
    },

    async createRequest(userId: string, requestData: Omit<DBRequest, 'id' | 'user_id'>): Promise<string> {
        const { data, error } = await supabase
            .from('requests')
            .insert({
                ...requestData,
                user_id: userId
            })
            .select('id')
            .single()

        if (error) throw error
        return data.id
    },

    async updateRequest(userId: string, requestId: string, updates: Partial<DBRequest>): Promise<void> {
        const { error } = await supabase
            .from('requests')
            .update(updates)
            .eq('id', requestId)
            .eq('user_id', userId)

        if (error) throw error
    },

    async deleteRequest(userId: string, requestId: string): Promise<void> {
        const { error } = await supabase
            .from('requests')
            .delete()
            .eq('id', requestId)
            .eq('user_id', userId)

        if (error) throw error
    },

    // --- Environments ---

    async getEnvironments(userId: string): Promise<DBEnvironment[]> {
        const { data, error } = await supabase
            .from('environments')
            .select('*')
            .eq('user_id', userId)
        if (error) throw error
        return data || []
    },

    async createEnvironment(userId: string, name: string, variables: any): Promise<string> {
        const { data, error } = await supabase
            .from('environments')
            .insert({
                user_id: userId,
                name,
                variables
            })
            .select('id')
            .single()

        if (error) throw error
        return data.id
    },

    async deleteEnvironment(userId: string, envId: string): Promise<void> {
        const { error } = await supabase
            .from('environments')
            .delete()
            .eq('id', envId)
            .eq('user_id', userId)

        if (error) throw error
    },

    async updateEnvironment(userId: string, envId: string, updates: Partial<DBEnvironment>): Promise<void> {
        const { error } = await supabase
            .from('environments')
            .update(updates)
            .eq('id', envId)
            .eq('user_id', userId)

        if (error) throw error
    }
}
