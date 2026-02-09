import React, { useState, useEffect } from 'react';
import { useSyncManager } from '@/components/offline/useSyncManager';
import { WifiOff, Wifi, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/**
 * Barra de status online/offline com indicador de sincronização
 * Aparece no topo de todas as páginas do fluxo de fiscalização
 */
export default function OfflineStatusBar() {
  const [showBar, setShowBar] = useState(!navigator.onLine);
  const syncStatus = useSyncManager();

  useEffect(() => {
    const handleOnline = () => setShowBar(false);
    const handleOffline = () => setShowBar(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Offline - mostrar barra amarela
  if (showBar && !navigator.onLine) {
    return (
      <div className="bg-yellow-500 text-white px-4 py-2 text-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4" />
          <span>Modo offline - Dados salvos localmente</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          Sem conexão
        </Badge>
      </div>
    );
  }

  // Online com itens pendentes - mostrar info discretamente
  if (navigator.onLine && syncStatus.hasPending) {
    return (
      <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          {syncStatus.isSyncing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-gray-700">Sincronizando... {syncStatus.syncProgress}%</span>
            </>
          ) : (
            <>
              <Wifi className="h-4 w-4 text-blue-600" />
              <span className="text-gray-700">{syncStatus.pendingCount} item(ns) para sincronizar</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-blue-600 text-white text-xs">
            {syncStatus.pendingCount}
          </Badge>
          {!syncStatus.isSyncing && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => syncStatus.manualSync()}
              className="text-xs h-6"
            >
              Sincronizar
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Online e sincronizado - não mostrar nada
  return null;
}