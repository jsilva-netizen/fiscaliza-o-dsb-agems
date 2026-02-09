import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DataService from '@/functions/dataService';
import SyncPanel from './SyncPanel';

export default function OfflineSyncButton() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Atualiza status online/offline
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Atualiza contagem de pendentes
    const updatePendingCount = async () => {
      try {
        if (DataService && typeof DataService.getSyncStatus === 'function') {
          const status = await DataService.getSyncStatus();
          setPendingCount(status.pendingCount);
        }
      } catch (error) {
        console.error('Erro ao contar pendentes:', error);
      }
    };

    // Atualiza inicial e a cada 5 segundos
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000);

    // Listener para eventos de sincronização
    const handleSyncComplete = () => updatePendingCount();
    window.addEventListener('data-service:sync-complete', handleSyncComplete);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('data-service:sync-complete', handleSyncComplete);
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(true)}
          className="relative hover:bg-gray-100"
          title={isOnline ? 'Online' : 'Offline'}
        >
          {isOnline ? (
            <Cloud className="w-5 h-5 text-blue-500" />
          ) : (
            <CloudOff className="w-5 h-5 text-amber-500" />
          )}
        </Button>

        {/* Badge de pendentes */}
        {pendingCount > 0 && (
          <Badge
            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 h-6 w-6 flex items-center justify-center p-0 text-xs font-bold"
          >
            {pendingCount}
          </Badge>
        )}
      </div>

      {/* Modal SyncPanel */}
      <SyncPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}