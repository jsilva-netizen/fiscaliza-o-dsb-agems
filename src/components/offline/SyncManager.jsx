import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { 
    getPendingOperations, 
    removePendingOperation,
    markOperationProcessing,
    updateOperationStatus,
    getOfflinePhotos,
    removeOfflinePhoto 
} from './offlineStorage';

// Hook para gerenciar sincronização automática
export function useSyncManager() {
    const queryClient = useQueryClient();
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
    const [lastSyncError, setLastSyncError] = useState(null);
    const syncIntervalRef = useRef(null);
    const syncInProgressRef = useRef(false);

    // Monitora status online/offline
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            // Inicia sincronização imediata ao ficar online
            setTimeout(() => syncPendingOperations(), 1000);
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Sincronização automática periódica quando online
    useEffect(() => {
        if (isOnline) {
            // Sincroniza imediatamente
            syncPendingOperations();
            
            // Configura sincronização periódica a cada 30 segundos
            syncIntervalRef.current = setInterval(() => {
                syncPendingOperations();
            }, 30000);
        }

        return () => {
            if (syncIntervalRef.current) {
                clearInterval(syncIntervalRef.current);
            }
        };
    }, [isOnline]);

    const syncPendingOperations = async () => {
        // Evita múltiplas sincronizações simultâneas
        if (syncInProgressRef.current || !navigator.onLine) return;

        try {
            syncInProgressRef.current = true;
            setIsSyncing(true);
            setLastSyncError(null);

            const operations = await getPendingOperations();
            const pendingOps = operations.filter(op => op.status === 'pending');
            
            if (pendingOps.length === 0) {
                setIsSyncing(false);
                syncInProgressRef.current = false;
                return;
            }

            setSyncProgress({ current: 0, total: pendingOps.length });

            // Ordena por prioridade (maior prioridade primeiro)
            pendingOps.sort((a, b) => (b.priority || 0) - (a.priority || 0));

            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < pendingOps.length; i++) {
                const op = pendingOps[i];
                setSyncProgress({ current: i + 1, total: pendingOps.length });

                try {
                    await markOperationProcessing(op.id);
                    await executeOperation(op);
                    await removePendingOperation(op.id);
                    successCount++;
                } catch (err) {
                    console.error('Erro ao sincronizar operação:', err);
                    await updateOperationStatus(op.id, 'error', err.message);
                    errorCount++;
                }
            }

            // Sincroniza fotos offline
            await syncOfflinePhotos();

            // Invalida todas as queries para recarregar dados
            if (successCount > 0) {
                queryClient.invalidateQueries();
            }

            if (errorCount > 0) {
                setLastSyncError(`${errorCount} operação(ões) falharam`);
            }

        } catch (err) {
            console.error('Erro na sincronização:', err);
            setLastSyncError(err.message);
        } finally {
            setIsSyncing(false);
            syncInProgressRef.current = false;
            setSyncProgress({ current: 0, total: 0 });
        }
    };

    const executeOperation = async (operation) => {
        const { entity, operation: opType, data, id } = operation;

        switch (opType) {
            case 'create':
                await base44.entities[entity].create(data);
                break;
            case 'update':
                await base44.entities[entity].update(id, data);
                break;
            case 'delete':
                await base44.entities[entity].delete(id);
                break;
            default:
                throw new Error(`Operação desconhecida: ${opType}`);
        }
    };

    const syncOfflinePhotos = async () => {
        const photos = await getOfflinePhotos();
        for (const photo of photos) {
            try {
                // Upload da foto se ainda não foi feita
                if (photo.needsUpload && photo.blob) {
                    const { file_url } = await base44.integrations.Core.UploadFile({ 
                        file: photo.blob 
                    });
                    photo.url = file_url;
                }
                await removeOfflinePhoto(photo.id);
            } catch (err) {
                console.error('Erro ao sincronizar foto:', err);
            }
        }
    };

    return {
        isOnline,
        isSyncing,
        syncProgress,
        lastSyncError,
        syncNow: syncPendingOperations
    };
}

// Componente Provider para sincronização global
export default function SyncManager({ children }) {
    useSyncManager();
    return children;
}