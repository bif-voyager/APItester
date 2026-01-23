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
            const found = findItemInTree(item.children, itemId);
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
            item.children = deleteItemFromTree(item.children, itemId);
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
                children: renameItemInTree(item.children, itemId, newName),
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
                children: toggleExpandInTree(item.children, itemId),
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
                children: [...item.children, requestItem],
                isExpanded: true, // Auto-expand when adding
            };
        }
        if (item.type === 'folder') {
            return {
                ...item,
                children: addRequestToTree(item.children, parentId, request),
            };
        }
        return item;
    });
}

// Add folder to tree
export function addFolderToTree(
    items: CollectionItem[],
    parentId: string | null,
    folderName: string
): CollectionItem[] {
    const folderItem: CollectionItem = {
        id: generateId(),
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
                children: [...item.children, folderItem],
                isExpanded: true,
            };
        }
        if (item.type === 'folder') {
            return {
                ...item,
                children: addFolderToTree(item.children, parentId, folderName),
            };
        }
        return item;
    });
}

// Find all requests in tree (for backward compatibility)
export function getAllRequestsFromTree(items: CollectionItem[]): Request[] {
    const requests: Request[] = [];

    for (const item of items) {
        if (item.type === 'request') {
            requests.push(item.request);
        } else if (item.type === 'folder') {
            requests.push(...getAllRequestsFromTree(item.children));
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
            return item.request;
        }
        if (item.type === 'folder') {
            const found = findRequestInTree(item.children, requestId);
            if (found) return found;
        }
    }
    return null;
}
