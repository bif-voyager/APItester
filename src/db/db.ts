
import Dexie, { type EntityTable } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';

// --- Database Schema Types ---

export interface User {
    id: number;
    username: string; // unique
    passwordHash: string;
    settings?: {
        theme?: 'light' | 'dark';
        zoom?: number;
        [key: string]: any;
    };
}

export interface DBCollection {
    id: number;
    ownerId: number; // Foreign Key -> users.id
    name: string;
    parentId: number | null; // For nested folders
    isExpanded?: boolean;
}

export interface DBRequest {
    id: number;
    ownerId: number; // Foreign Key -> users.id
    collectionId?: number; // Optional, can be standalone or in collection
    name: string;
    method: string;
    url: string;
    headers?: Array<{ key: string; value: string; enabled?: boolean }>;
    body?: string;
    params?: Array<{ key: string; value: string; enabled?: boolean }>;
    auth?: {
        type: 'none' | 'bearer' | 'basic';
        bearerToken?: string;
        basicUsername?: string;
        basicPassword?: string;
    };
}

export interface DBEnvironment {
    id: number;
    ownerId: number; // Foreign Key -> users.id
    name: string;
    variables: Record<string, string> | Array<{ key: string; value: string; enabled: boolean }>; // Flexible structure based on usage
}

// --- Database Class ---

export class UserDatabase extends Dexie {
    users!: EntityTable<User, 'id'>;
    collections!: EntityTable<DBCollection, 'id'>;
    requests!: EntityTable<DBRequest, 'id'>;
    environments!: EntityTable<DBEnvironment, 'id'>;

    constructor() {
        super('ApiClientDB');

        // Schema Declaration
        // Note: ownerId is indexed in all tenant-specific tables for performance
        this.version(1).stores({
            users: '++id, &username',
            collections: '++id, ownerId, parentId',
            requests: '++id, ownerId, collectionId',
            environments: '++id, ownerId'
        });
    }

    // --- User Wrapper Methods ---

    /**
     * Creates a new user.
     */
    async createUser(username: string, passwordHash: string): Promise<number> {
        return await this.users.add({
            username,
            passwordHash,
            settings: { theme: 'dark' } // Default settings
        });
    }

    /**
     * Finds a user by username.
     */
    async getUser(username: string): Promise<User | undefined> {
        return await this.users.where('username').equals(username).first();
    }


    // --- Tenant-Isolated Wrapper Methods ---
    // These methods enforce `ownerId` to ensure data isolation.

    /**
     * Retrieves all collections for a specific user.
     */
    async getCollections(userId: number): Promise<DBCollection[]> {
        return await this.collections.where('ownerId').equals(userId).toArray();
    }

    /**
     * Creates a new collection for a specific user.
     */
    async createCollection(userId: number, name: string, parentId: number | null = null): Promise<number> {
        return await this.collections.add({
            ownerId: userId,
            name,
            parentId: parentId
        } as DBCollection);
    }

    /**
     * Retrieves all standalone requests (or all requests) for a specific user.
     */
    async getRequests(userId: number, collectionId?: number): Promise<DBRequest[]> {
        let query = this.requests.where('ownerId').equals(userId);

        if (collectionId !== undefined) {
            // If collectionId is provided, filter further by it.
            // Using logic: Dexie compound index or manual filter after ownerId index use.
            // Simple approach: filter in memory after fetching by owner or compound index if defined.
            // We defined stores as 'ownerId, collectionId', so we can use compound query if supported or simple filter.
            // For now, simple filter is safe and correct.
            return (await query.toArray()).filter(req => req.collectionId === collectionId);
        }

        return await query.toArray();
    }

    /**
     * Creates a new request for a specific user.
     */
    async createRequest(userId: number, data: Omit<DBRequest, 'id' | 'ownerId'>): Promise<number> {
        return await this.requests.add({
            ...data,
            ownerId: userId
        } as DBRequest);
    }

    /**
     * Updates a request, ensuring it belongs to the user.
     */
    async updateRequest(userId: number, requestId: number, updates: Partial<DBRequest>): Promise<number> {
        // Verify ownership first
        const req = await this.requests.get(requestId);
        if (!req || req.ownerId !== userId) {
            throw new Error(`Access denied: User ${userId} cannot update request ${requestId}`);
        }
        return await this.requests.update(requestId, updates);
    }

    /**
     * Deletes a request, ensuring it belongs to the user.
     */
    async deleteRequest(userId: number, requestId: number): Promise<void> {
        // Verify ownership first
        const req = await this.requests.get(requestId);
        if (!req || req.ownerId !== userId) {
            throw new Error(`Access denied: User ${userId} cannot delete request ${requestId}`);
        }
        await this.requests.delete(requestId);
    }


    /**
     * Retrieves environments for a specific user.
     */
    async getEnvironments(userId: number): Promise<DBEnvironment[]> {
        return await this.environments.where('ownerId').equals(userId).toArray();
    }

    /**
     * Creates an environment for a specific user.
     */
    async createEnvironment(userId: number, name: string, variables: any): Promise<number> {
        return await this.environments.add({
            ownerId: userId,
            name,
            variables
        } as DBEnvironment);
    }

    /**
     * Recursively deletes a collection (or folder) and all its contents.
     */
    async deleteCollectionRecursive(userId: number, collectionId: number): Promise<void> {
        // 1. Get all child collections (folders)
        const children = await this.collections
            .where('ownerId').equals(userId)
            .and(c => c.parentId === collectionId)
            .toArray();

        // 2. Recursively delete children
        for (const child of children) {
            await this.deleteCollectionRecursive(userId, child.id);
        }

        // 3. Delete all requests in this collection
        // We have to scan requests for this collectionId since it's not indexed by [ownerId+collectionId] perfectly for delete
        // But we can filter.
        // Better: Index collectionId?
        // Current index: requests: '++id, ownerId, collectionId'
        // Yes, collectionId is indexed!
        const requests = await this.requests
            .where('collectionId').equals(collectionId)
            .toArray();

        const requestsToDelete = requests.filter(r => r.ownerId === userId).map(r => r.id);

        if (requestsToDelete.length > 0) {
            await this.requests.bulkDelete(requestsToDelete);
        }

        // 4. Delete the collection itself
        await this.collections.delete(collectionId);
    }
}

// Export a single instance of the database
export const db = new UserDatabase();


// --- React Hooks ---

/**
 * Hook to live-query collections for a specific user.
 * Returns undefined while loading, then an array of collections.
 */
export function useUserCollections(userId: number | null | undefined) {
    return useLiveQuery(
        () => {
            if (!userId) return [];
            return db.collections.where('ownerId').equals(userId).toArray();
        },
        [userId] // Dependency: re-run if userId changes
    );
}

/**
 * Hook to live-query requests for a specific user, optionally filtered by collection.
 */
export function useUserRequests(userId: number | null | undefined, collectionId?: number) {
    return useLiveQuery(
        async () => {
            if (!userId) return [];
            let collection = db.requests.where('ownerId').equals(userId);
            if (collectionId !== undefined) {
                // We need to filter by collectionId as well.
                // Since we don't have a compound index in the basic setup for [ownerId+collectionId] explicitly in query,
                // we do in-memory filtering which is fine for client-side valid sizes.
                const all = await collection.toArray();
                return all.filter(r => r.collectionId === collectionId);
            }
            return await collection.toArray();
        },
        [userId, collectionId]
    );
}

/**
 * Hook to live-query environments for a specific user.
 */
export function useUserEnvironments(userId: number | null | undefined) {
    return useLiveQuery(
        () => {
            if (!userId) return [];
            return db.environments.where('ownerId').equals(userId).toArray();
        },
        [userId]
    );
}
