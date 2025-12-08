import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { 
    getPendingOperations, 
    removePendingOperation,
    getOfflinePhotos,
    removeOfflinePhoto 
} from './offlineStorage';

export function useOfflineSync() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

    // Atualizar status online/offline
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Atualizar contagem de operações pendentes
    const updatePendingCount = useCallback(async () => {
        try {
            const operations = await getPendingOperations();
            const photos = await getOfflinePhotos();
            setPendingCount(operations.length + photos.length);
        } catch (err) {
            console.error('Erro ao atualizar contagem:', err);
        }
    }, []);

    // Sincronizar quando ficar online
    useEffect(() => {
        if (isOnline) {
            syncData();
        }
        updatePendingCount();
    }, [isOnline]);

    // Sincronizar dados pendentes
    const syncData = useCallback(async () => {
        if (!isOnline || isSyncing) return;

        setIsSyncing(true);
        try {
            // Sincronizar fotos primeiro
            const photos = await getOfflinePhotos();
            for (const photo of photos) {
                try {
                    // Converter base64 para blob e fazer upload
                    const response = await fetch(photo.base64);
                    const blob = await response.blob();
                    const file = new File([blob], `foto_${Date.now()}.jpg`, { type: 'image/jpeg' });
                    const { file_url } = await base44.integrations.Core.UploadFile({ file });
                    
                    // Criar entidade FotoEvidencia
                    await base44.entities.FotoEvidencia.create({
                        ...photo.data,
                        url: file_url
                    });

                    await removeOfflinePhoto(photo.id);
                } catch (err) {
                    console.error('Erro ao sincronizar foto:', err);
                }
            }

            // Sincronizar operações
            const operations = await getPendingOperations();
            for (const operation of operations) {
                try {
                    switch (operation.type) {
                        case 'create':
                            await base44.entities[operation.entity].create(operation.data);
                            break;
                        case 'update':
                            await base44.entities[operation.entity].update(operation.entityId, operation.data);
                            break;
                        case 'delete':
                            await base44.entities[operation.entity].delete(operation.entityId);
                            break;
                    }
                    await removePendingOperation(operation.id);
                } catch (err) {
                    console.error('Erro ao sincronizar operação:', err);
                }
            }

            await updatePendingCount();
        } catch (err) {
            console.error('Erro na sincronização:', err);
        } finally {
            setIsSyncing(false);
        }
    }, [isOnline, isSyncing, updatePendingCount]);

    // Clear all sync errors
    const clearErrors = useCallback(async () => {
        await clearSyncErrors();
        await updatePendingCount();
    }, [updatePendingCount]);

    return {
        isOnline,
        isSyncing,
        pendingCount,
        syncProgress,
        syncErrors,
        syncData,
        updatePendingCount,
        clearErrors
    };
}