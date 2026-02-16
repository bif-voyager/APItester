import { Collection, CollectionItem, Request } from '../types'
import { DBCollection, DBRequest } from '../db/db'

// Convert DBRequest to UI Request
export const dbRequestToUiRequest = (dbReq: DBRequest): Request => {
    return {
        id: dbReq.id.toString(),
        name: dbReq.name,
        method: dbReq.method,
        url: dbReq.url,
        params: (dbReq.params || []).map(p => ({ ...p, enabled: p.enabled ?? true })),
        headers: (dbReq.headers || []).map(h => ({ ...h, enabled: h.enabled ?? true })),
        body: dbReq.body || '',
        auth: dbReq.auth ? {
            type: dbReq.auth.type,
            bearerToken: dbReq.auth.bearerToken,
            basicUsername: dbReq.auth.basicUsername,
            basicPassword: dbReq.auth.basicPassword
        } : { type: 'none' }
    }
}

// Convert UI Request to DBRequest (for saving)
// Note: ID generation is handled by DB for new items
export const uiRequestToDbRequest = (req: Request, ownerId: number, collectionId?: number): Omit<DBRequest, 'id'> => {
    return {
        ownerId,
        collectionId,
        name: req.name,
        method: req.method,
        url: req.url,
        params: req.params,
        headers: req.headers,
        body: req.body,
        auth: req.auth
    }
}

// Build Collection Tree from flat DB records
export const buildCollectionTree = (
    dbCollections: DBCollection[],
    dbRequests: DBRequest[]
): Collection[] => {
    const collectionsMap = new Map<number, DBCollection>()
    const itemsByParentId = new Map<number, CollectionItem[]>()
    const rootCollections: Collection[] = []

    // Helper to get or create items array for a parent
    const getItemsList = (parentId: number) => {
        if (!itemsByParentId.has(parentId)) {
            itemsByParentId.set(parentId, [])
        }
        return itemsByParentId.get(parentId)!
    }

    // Index collections
    dbCollections.forEach(col => collectionsMap.set(col.id, col))

    // Process Requests first (leaf nodes)
    dbRequests.forEach(req => {
        if (req.collectionId) {
            const uiReq = dbRequestToUiRequest(req)
            const item: CollectionItem = {
                id: uiReq.id,
                name: uiReq.name,
                type: 'request',
                request: uiReq
            }
            getItemsList(req.collectionId).push(item)
        }
    })

    // Process Collections (Folders and Roots)
    // We need to process them in an order that ensures children are attached to parents.
    // However, since we are building a map of *items* by parent ID, we can just process all, 
    // and then link them up.

    // First, convert all DBCollections to Items or Root Collections
    const processedCollections = new Map<number, Collection | CollectionItem>()

    // Sort by ID to ensure consistent order (temp solution for ordering)
    const sortedCollections = [...dbCollections].sort((a, b) => a.id - b.id)

    sortedCollections.forEach(col => {
        // We don't know the nesting depth yet, but we know its parentId.
        // We'll populate its 'items' from the map we built.
        const children = itemsByParentId.get(col.id) || []

        // Use default isExpanded=true for now
        const isExpanded = true

        if (col.parentId === null) {
            // Root Collection
            const rootCol: Collection = {
                id: col.id.toString(),
                name: col.name,
                items: children, // Will be populated with requests, but sub-folders need to be added
                isExpanded
            }
            rootCollections.push(rootCol)
            processedCollections.set(col.id, rootCol)
        } else {
            // Sub-folder
            const folderItem: CollectionItem = {
                id: col.id.toString(),
                name: col.name,
                type: 'folder',
                children: children,
                isExpanded
            }
            getItemsList(col.parentId).push(folderItem)
            processedCollections.set(col.id, folderItem)
        }
    })

    // The 'items' property of collections/folders currently only contains requests.
    // We need to ensure sub-folders are also included in their parent's items list.
    // We already pushed folders into 'itemsByParentId' in the loop above? 
    // No, we pushed requests into 'getItemsList'.
    // We need to push the folders into their parent's list too.

    // Let's re-iterate to link folders to parents
    sortedCollections.forEach(col => {
        if (col.parentId !== null) {
            // Ensure this folder is in its parent's list
            // Note: The parent might be a Root Collection or another Folder.
            // But we are building 'itemsByParentId' effectively?
            // Actually, the previous loop structure was slightly flawed for single-pass.

            // Let's verify:
            // 1. We populated itemsByParentId with REQUESTS.
            // 2. We created objects for COLLECTIONS.
            // 3. We didn't put sub-folders into the itemsByParentId lists of their parents yet.
        }
    })

    // Correct Approach:
    // 1. Map all DBCollections to mutable objects (either Collection or CollectionItem-folder) with empty items/children.
    // 2. Map all DBRequests to CollectionItem-request.
    // 3. Iterate Requests: add to parent's items.
    // 4. Iterate Collections (folders): add to parent's items/children.
    // 5. Roots are those with parentId null.

    const idToObj = new Map<number, any>()

    // Initialize objects
    dbCollections.forEach(col => {
        if (col.parentId === null) {
            idToObj.set(col.id, {
                id: col.id.toString(),
                name: col.name,
                items: [],
                isExpanded: col.isExpanded ?? false
            } as Collection)
        } else {
            idToObj.set(col.id, {
                id: col.id.toString(),
                name: col.name,
                type: 'folder',
                children: [],
                isExpanded: col.isExpanded ?? false
            } as CollectionItem)
        }
    })

    // Link Requests
    dbRequests.forEach(req => {
        if (req.collectionId && idToObj.has(req.collectionId)) {
            const parent = idToObj.get(req.collectionId)
            const uiReq = dbRequestToUiRequest(req)
            const item: CollectionItem = {
                id: uiReq.id,
                name: uiReq.name,
                type: 'request',
                request: uiReq
            }
            if (parent.items) parent.items.push(item)
            else if (parent.children) parent.children.push(item)
        }
    })

    // Link Sub-folders
    dbCollections.forEach(col => {
        if (col.parentId !== null) {
            const child = idToObj.get(col.id)
            if (col.parentId && idToObj.has(col.parentId)) {
                const parent = idToObj.get(col.parentId)
                if (parent.items) parent.items.push(child)
                else if (parent.children) parent.children.push(child)
            }
        }
    })

    // Extract Roots
    return dbCollections
        .filter(c => c.parentId === null)
        .map(c => idToObj.get(c.id) as Collection)
        .sort((a, b) => parseInt(a.id) - parseInt(b.id))
}

// Helper to recursively save a UI Collection to DB
import { db } from './db'

export const saveCollectionToDb = async (userId: number, collection: Collection) => {
    // 1. Create Root Collection
    const rootId = await db.createCollection(userId, collection.name, null)

    // 2. Process Items recursively
    const processItems = async (items: CollectionItem[], parentId: number) => {
        for (const item of items) {
            if (item.type === 'folder') {
                const folderId = await db.createCollection(userId, item.name, parentId) || 0
                await processItems(item.children || [], folderId)
            } else if (item.type === 'request' && item.request) {
                await db.createRequest(userId, uiRequestToDbRequest(item.request, userId, parentId))
            }
        }
    }

    if (collection.items) {
        await processItems(collection.items, rootId)
    }
}
