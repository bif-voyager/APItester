import { CollectionItem, Request } from '../types';

// Generate unique ID
export function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Find item in tree by ID
export function findItemInTree(
    items: CollectionItem[],
    itemId: string
): CollectionItem | null {
    for (const item of items) {
        if (item.id === itemId) return item;
        if (item.type === 'folder') {
            const found = findItemInTree(item.children || [], itemId);
            if (found) return found;
        }
    }
    return null;
}

// Delete item from tree
export function deleteItemFromTree(
    items: CollectionItem[],
    itemId: string
): CollectionItem[] {
    return items.filter((item) => {
        if (item.id === itemId) return false;
        if (item.type === 'folder') {
            item.children = deleteItemFromTree(item.children || [], itemId);
        }
        return true;
    });
}

// Rename item in tree
export function renameItemInTree(
    items: CollectionItem[],
    itemId: string,
    newName: string
): CollectionItem[] {
    return items.map((item) => {
        if (item.id === itemId) {
            return { ...item, name: newName };
        }
        if (item.type === 'folder') {
            return {
                ...item,
                children: renameItemInTree(item.children || [], itemId, newName),
            };
        }
        return item;
    });
}

// Toggle expand state
export function toggleExpandInTree(
    items: CollectionItem[],
    itemId: string
): CollectionItem[] {
    return items.map((item) => {
        if (item.id === itemId && item.type === 'folder') {
            return { ...item, isExpanded: !item.isExpanded };
        }
        if (item.type === 'folder') {
            return {
                ...item,
                children: toggleExpandInTree(item.children || [], itemId),
            };
        }
        return item;
    });
}

// Add request to folder or root
export function addRequestToTree(
    items: CollectionItem[],
    parentId: string | null,
    request: Request
): CollectionItem[] {
    const requestItem: CollectionItem = {
        id: generateId(),
        name: request.name,
        type: 'request',
        request,
    };

    if (!parentId) {
        return [...items, requestItem];
    }

    return items.map((item) => {
        if (item.id === parentId && item.type === 'folder') {
            return {
                ...item,
                children: [...(item.children || []), requestItem],
                isExpanded: true, // Auto-expand when adding
            };
        } else if (item.type === 'folder') {
            return {
                ...item,
                children: addRequestToTree(item.children || [], parentId, request),
            };
        }
        return item;
    });
}

// Add folder to tree
export function addFolderToTree(
    items: CollectionItem[],
    parentId: string | null,
    folderName: string,
    folderId?: string
): CollectionItem[] {
    const folderItem: CollectionItem = {
        id: folderId || generateId(),
        name: folderName,
        type: 'folder',
        children: [],
        isExpanded: true,
    };

    if (!parentId) {
        return [...items, folderItem];
    }

    return items.map((item) => {
        if (item.id === parentId && item.type === 'folder') {
            return {
                ...item,
                children: [...(item.children || []), folderItem],
                isExpanded: true,
            };
        }
        if (item.type === 'folder') {
            return {
                ...item,
                children: addFolderToTree(item.children || [], parentId, folderName, folderId),
            };
        }
        return item;
    });
}

// Find all requests in tree (for backward compatibility)
export function getAllRequestsFromTree(items: CollectionItem[]): Request[] {
    const requests: Request[] = [];

    for (const item of items) {
        if (item.type === 'request' && item.request) {
            requests.push(item.request);
        } else if (item.type === 'folder') {
            requests.push(...getAllRequestsFromTree(item.children || []));
        }
    }

    return requests;
}

// Find request by ID in tree
export function findRequestInTree(
    items: CollectionItem[],
    requestId: string
): Request | null {
    for (const item of items) {
        if (item.type === 'request' && item.id === requestId) {
            return item.request || null;
        }
        if (item.type === 'folder') {
            const found = findRequestInTree(item.children || [], requestId);
            if (found) return found;
        }
    }
    return null;
}

// Move item in tree
export function moveItemInTree(
    items: CollectionItem[],
    sourceId: string,
    targetId: string | null
): CollectionItem[] {
    // 1. Find the item components
    const itemToMove = findItemInTree(items, sourceId);
    if (!itemToMove) return items;

    // 2. Remove from old location
    const itemsWithoutSource = deleteItemFromTree(items, sourceId);

    // 3. Add to new location
    if (!targetId) {
        // Move to root
        return [...itemsWithoutSource, itemToMove];
    }

    // Check target type to decide between "Nest" (folder) or "Reorder" (sibling)
    const targetItem = findItemInTree(itemsWithoutSource, targetId);
    if (!targetItem) return itemsWithoutSource; // Target lost?

    if (targetItem.type === 'folder') {
        // Move INSIDE the folder
        return addExistingItemToTree(itemsWithoutSource, targetId, itemToMove);
    } else {
        // Move BEFORE the sibling (Request or other)
        return insertItemBeforeSibling(itemsWithoutSource, targetId, itemToMove);
    }
}

// Add item to tree at specific position (relative to targetId)
export function addItemToTreeAtPosition(
    items: CollectionItem[],
    itemToAdd: CollectionItem,
    targetId: string | null
): CollectionItem[] {
    if (!targetId) {
        return [...items, itemToAdd];
    }

    const targetItem = findItemInTree(items, targetId);
    if (!targetItem) return items;

    if (targetItem.type === 'folder') {
        return addExistingItemToTree(items, targetId, itemToAdd);
    } else {
        return insertItemBeforeSibling(items, targetId, itemToAdd);
    }
}

// Helper to add existing item to specific parent (Nesting)
export function addExistingItemToTree(
    items: CollectionItem[],
    parentId: string,
    itemToAdd: CollectionItem
): CollectionItem[] {
    return items.map((item) => {
        if (item.id === parentId && item.type === 'folder') {
            return {
                ...item,
                children: [...(item.children || []), itemToAdd],
                isExpanded: true,
            };
        }
        if (item.type === 'folder') {
            return {
                ...item,
                children: addExistingItemToTree(item.children || [], parentId, itemToAdd),
            };
        }
        return item;
    });
}

// Helper to insert item before a sibling (Reordering)
export function insertItemBeforeSibling(
    items: CollectionItem[],
    siblingId: string,
    itemToAdd: CollectionItem
): CollectionItem[] {
    // Check if sibling is in this list
    const siblingIndex = items.findIndex((item) => item.id === siblingId);
    if (siblingIndex !== -1) {
        const newItems = [...items];
        newItems.splice(siblingIndex, 0, itemToAdd);
        return newItems;
    }

    // Recurse into folders
    return items.map((item) => {
        if (item.type === 'folder') {
            return {
                ...item,
                children: insertItemBeforeSibling(item.children || [], siblingId, itemToAdd),
            };
        }
        return item;
    });
}

// Get all requests from collection items (recursive)
export function getAllRequestsFromItems(items: CollectionItem[]): Request[] {
    const requests: Request[] = [];

    for (const item of items) {
        if (item.type === 'request' && item.request) {
            requests.push(item.request);
        } else if (item.type === 'folder') {
            requests.push(...getAllRequestsFromItems(item.children || []));
        }
    }

    return requests;
}
