// Sistema de armazenamento offline usando IndexedDB

const DB_NAME = 'agems_fiscalizacao_offline';
const DB_VERSION = 2;

const STORES = {
    PENDING_OPERATIONS: 'pending_operations',
    CACHED_DATA: 'cached_data',
    PHOTOS: 'photos',
    IMAGE_CACHE: 'image_cache'
};

let db = null;

// Inicializar banco de dados
const initDB = () => {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            // Store para operações pendentes
            if (!database.objectStoreNames.contains(STORES.PENDING_OPERATIONS)) {
                const opStore = database.createObjectStore(STORES.PENDING_OPERATIONS, { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                opStore.createIndex('timestamp', 'timestamp', { unique: false });
                opStore.createIndex('entity', 'entity', { unique: false });
            }

            // Store para dados em cache
            if (!database.objectStoreNames.contains(STORES.CACHED_DATA)) {
                const cacheStore = database.createObjectStore(STORES.CACHED_DATA, { 
                    keyPath: 'key' 
                });
                cacheStore.createIndex('entity', 'entity', { unique: false });
            }

            // Store para fotos
            if (!database.objectStoreNames.contains(STORES.PHOTOS)) {
                database.createObjectStore(STORES.PHOTOS, { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
            }

            // Store para cache de imagens (blob)
            if (!database.objectStoreNames.contains(STORES.IMAGE_CACHE)) {
                const imageStore = database.createObjectStore(STORES.IMAGE_CACHE, { 
                    keyPath: 'url' 
                });
                imageStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
};

// Adicionar operação pendente
export const addPendingOperation = async (operation) => {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.PENDING_OPERATIONS], 'readwrite');
        const store = transaction.objectStore(STORES.PENDING_OPERATIONS);
        
        const request = store.add({
            ...operation,
            timestamp: new Date().toISOString(),
            status: 'pending'
        });

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

// Obter todas as operações pendentes
export const getPendingOperations = async () => {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.PENDING_OPERATIONS], 'readonly');
        const store = transaction.objectStore(STORES.PENDING_OPERATIONS);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
};

// Remover operação pendente
export const removePendingOperation = async (id) => {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.PENDING_OPERATIONS], 'readwrite');
        const store = transaction.objectStore(STORES.PENDING_OPERATIONS);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// Salvar dados em cache
export const cacheData = async (key, entity, data) => {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.CACHED_DATA], 'readwrite');
        const store = transaction.objectStore(STORES.CACHED_DATA);
        
        const request = store.put({
            key,
            entity,
            data,
            timestamp: new Date().toISOString()
        });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// Obter dados do cache
export const getCachedData = async (key) => {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.CACHED_DATA], 'readonly');
        const store = transaction.objectStore(STORES.CACHED_DATA);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result?.data || null);
        request.onerror = () => reject(request.error);
    });
};

// Salvar foto offline
export const savePhotoOffline = async (photoData) => {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.PHOTOS], 'readwrite');
        const store = transaction.objectStore(STORES.PHOTOS);
        
        const request = store.add({
            ...photoData,
            timestamp: new Date().toISOString()
        });

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

// Obter fotos offline
export const getOfflinePhotos = async () => {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.PHOTOS], 'readonly');
        const store = transaction.objectStore(STORES.PHOTOS);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
};

// Remover foto offline
export const removeOfflinePhoto = async (id) => {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.PHOTOS], 'readwrite');
        const store = transaction.objectStore(STORES.PHOTOS);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// Marcar operação como em processamento
export const markOperationProcessing = async (id) => {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.PENDING_OPERATIONS], 'readwrite');
        const store = transaction.objectStore(STORES.PENDING_OPERATIONS);
        const getRequest = store.get(id);
        
        getRequest.onsuccess = () => {
            const operation = getRequest.result;
            if (operation) {
                operation.status = 'processing';
                const updateRequest = store.put(operation);
                updateRequest.onsuccess = () => resolve();
                updateRequest.onerror = () => reject(updateRequest.error);
            } else {
                resolve();
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
};

// Atualizar status da operação
export const updateOperationStatus = async (id, status, error = null) => {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.PENDING_OPERATIONS], 'readwrite');
        const store = transaction.objectStore(STORES.PENDING_OPERATIONS);
        const getRequest = store.get(id);
        
        getRequest.onsuccess = () => {
            const operation = getRequest.result;
            if (operation) {
                operation.status = status;
                operation.error = error;
                operation.lastAttempt = new Date().toISOString();
                const updateRequest = store.put(operation);
                updateRequest.onsuccess = () => resolve();
                updateRequest.onerror = () => reject(updateRequest.error);
            } else {
                resolve();
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
};

// Limpar todos os dados offline (após sincronização completa)
export const clearOfflineData = async () => {
    const database = await initDB();
    return Promise.all([
        new Promise((resolve, reject) => {
            const transaction = database.transaction([STORES.PENDING_OPERATIONS], 'readwrite');
            const request = transaction.objectStore(STORES.PENDING_OPERATIONS).clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        }),
        new Promise((resolve, reject) => {
            const transaction = database.transaction([STORES.PHOTOS], 'readwrite');
            const request = transaction.objectStore(STORES.PHOTOS).clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        })
    ]);
};

// Obter contagem de operações pendentes
export const getPendingOperationsCount = async () => {
    const operations = await getPendingOperations();
    return operations.filter(op => op.status === 'pending').length;
};

// ===========================
// Image Cache Management
// ===========================

export const cacheImage = async (url, blob) => {
    try {
        const database = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORES.IMAGE_CACHE], 'readwrite');
            const store = transaction.objectStore(STORES.IMAGE_CACHE);
            
            const request = store.put({
                url,
                blob,
                timestamp: Date.now()
            });

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error caching image:', error);
        return false;
    }
};

export const getCachedImage = async (url) => {
    try {
        const database = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORES.IMAGE_CACHE], 'readonly');
            const store = transaction.objectStore(STORES.IMAGE_CACHE);
            const request = store.get(url);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error getting cached image:', error);
        return null;
    }
};

export const clearOldImageCache = async (maxAge = 7 * 24 * 60 * 60 * 1000) => {
    try {
        const database = await initDB();
        const transaction = database.transaction([STORES.IMAGE_CACHE], 'readwrite');
        const store = transaction.objectStore(STORES.IMAGE_CACHE);
        const index = store.index('timestamp');
        
        const cutoffTime = Date.now() - maxAge;
        const range = IDBKeyRange.upperBound(cutoffTime);
        
        return new Promise((resolve, reject) => {
            const request = index.openCursor(range);
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error clearing old image cache:', error);
    }
};