import { useState, useEffect } from 'react';

export function useSyncStatus() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncError, setSyncError] = useState(null);

  useEffect(() => {
    // Listener para eventos de sync
    const handleSyncStarted = () => setIsSyncing(true);
    const handleSyncSuccess = (event) => {
      setIsSyncing(false);
      setSyncError(null);
      setLastSyncTime(new Date());
      setPendingCount(0);
    };
    const handleSyncError = (event) => {
      setIsSyncing(false);
      setSyncError(event.detail?.message || 'Erro na sincronização');
    };
    const handlePendingChange = (event) => {
      setPendingCount(event.detail?.count || 0);
    };

    window.addEventListener('sync-started', handleSyncStarted);
    window.addEventListener('sync-success', handleSyncSuccess);
    window.addEventListener('sync-error', handleSyncError);
    window.addEventListener('pending-count-change', handlePendingChange);

    // Carregue dados do localStorage ao inicializar
    const lastSync = localStorage.getItem('lastSyncTime');
    if (lastSync) setLastSyncTime(new Date(lastSync));

    return () => {
      window.removeEventListener('sync-started', handleSyncStarted);
      window.removeEventListener('sync-success', handleSyncSuccess);
      window.removeEventListener('sync-error', handleSyncError);
      window.removeEventListener('pending-count-change', handlePendingChange);
    };
  }, []);

  return {
    pendingCount,
    isSyncing,
    lastSyncTime,
    syncError,
    hasPending: pendingCount > 0
  };
}