import { Collection, CollectionItem, Request } from '../types'
import { DBCollection, DBRequest } from '../db/db'

// Convert DBRequest to UI Request
export const dbRequestToUiRequest = (dbReq: DBRequest): Request => {
    return {
        id: dbReq.id,
        name: dbReq.name,
        method: dbReq.method,
        url: dbReq.url,
        params: dbReq.params || [],
        headers: dbReq.headers || [],
        body: dbReq.body || '',
        auth: dbReq.auth || { type: 'none' }
    }
}

// Convert UI Request to DBRequest (for saving)
// Note: ID generation is handled by DB for new items or we generate UUIDs
export const uiRequestToDbRequest = (req: Request, ownerId: string, collectionId?: string): Omit<DBRequest, 'id'> => {
    return {
        user_id: ownerId,
        collection_id: collectionId,
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
    const collectionsMap = new Map<string, DBCollection>()
    const itemsByParentId = new Map<string, CollectionItem[]>()
    const rootCollections: Collection[] = []

    // Helper to get or create items array for a parent
    const getItemsList = (parentId: string) => {
        if (!itemsByParentId.has(parentId)) {
            itemsByParentId.set(parentId, [])
        }
        return itemsByParentId.get(parentId)!
    }

    // Index collections
    dbCollections.forEach(col => collectionsMap.set(col.id, col))

    // Process Requests first (leaf nodes)
    // Process Requests first (leaf nodes)
    dbRequests.forEach(req => {
        if (req.collection_id) {
            const uiReq = dbRequestToUiRequest(req)
            const item: CollectionItem = {
                id: uiReq.id,
                name: uiReq.name,
                type: 'request',
                request: uiReq
            }
            getItemsList(req.collection_id).push(item)
        }
    })

    // Process Collections (Folders and Roots)
    // We need to process them in an order that ensures children are attached to parents.
    // However, since we are building a map of *items* by parent ID, we can just process all, 
    // and then link them up.

    // First, convert all DBCollections to Items or Root Collections
    const processedCollections = new Map<string, Collection | CollectionItem>()

    // Sort by name for now, or use created_at if available
    const sortedCollections = [...dbCollections].sort((a, b) => a.name.localeCompare(b.name))

    sortedCollections.forEach(col => {
        // We don't know the nesting depth yet, but we know its parentId.
        // We'll populate its 'items' from the map we built.
        const children = itemsByParentId.get(col.id) || []

        // Use default isExpanded=true for now
        // Use default isExpanded=true for now
        // const isExpanded = true

        if (col.parent_id === null) {
            // Root Collection
            const rootCol: Collection = {
                id: col.id,
                name: col.name,
                items: children, // Will be populated with requests, but sub-folders need to be added
                isExpanded: col.is_expanded
            }
            rootCollections.push(rootCol)
            processedCollections.set(col.id, rootCol)
        } else {
            // Sub-folder
            const folderItem: CollectionItem = {
                id: col.id,
                name: col.name,
                type: 'folder',
                children: children,
                isExpanded: col.is_expanded,
                parentId: col.parent_id
            }
            getItemsList(col.parent_id).push(folderItem)
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
        if (col.parent_id !== null) {
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

    const idToObj = new Map<string, any>()

    // Initialize objects
    dbCollections.forEach(col => {
        if (col.parent_id === null) {
            idToObj.set(col.id, {
                id: col.id,
                name: col.name,
                items: [],
                isExpanded: col.is_expanded ?? false
            } as Collection)
        } else {
            idToObj.set(col.id, {
                id: col.id,
                name: col.name,
                type: 'folder',
                children: [],
                isExpanded: col.is_expanded ?? false,
                parentId: col.parent_id
            } as CollectionItem)
        }
    })

    // Link Requests
    dbRequests.forEach(req => {
        if (req.collection_id && idToObj.has(req.collection_id)) {
            const parent = idToObj.get(req.collection_id)
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
        if (col.parent_id !== null) {
            const child = idToObj.get(col.id)
            if (col.parent_id && idToObj.has(col.parent_id)) {
                const parent = idToObj.get(col.parent_id)
                if (parent.items) parent.items.push(child)
                else if (parent.children) parent.children.push(child)
            }
        }
    })

    // Extract Roots
    return dbCollections
        .filter(c => c.parent_id === null)
        .map(c => idToObj.get(c.id) as Collection)
        .sort((a, b) => a.name.localeCompare(b.name))
}

// Helper to recursively save a UI Collection to DB
import { db } from './db'

export const saveCollectionToDb = async (userId: string, collection: Collection) => {
    // 1. Create Root Collection
    const rootId = await db.createCollection(userId, collection.name, null)

    // 2. Process Items recursively
    const processItems = async (items: CollectionItem[], parentId: string) => {
        for (const item of items) {
            if (item.type === 'folder') {
                const folderId = await db.createCollection(userId, item.name, parentId) || ''
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
