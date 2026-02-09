import React, { useState } from 'react';
import { useSyncManager } from './useSyncManager';
import { Button } from "@/components/ui/button";
import { 
    WifiOff, Wifi, AlertCircle, Loader2, 
    RefreshCw, X, ChevronDown
} from 'lucide-react';
import SyncPanel from './SyncPanel';

export default function OfflineStatusBar() {
    const syncStatus = useSyncManager();
    const [showPanel, setShowPanel] = useState(false);

    if (syncStatus.isConnected && !syncStatus.hasPending) {
        return null; // Sem problemas, não mostra nada
    }

    const isError = syncStatus.syncError && !syncStatus.isSyncing;
    const isPending = syncStatus.hasPending && !syncStatus.isSyncing;

    let bgColor = 'bg-gray-100';
    let icon = <Wifi className="h-4 w-4 text-green-600" />;
    let message = 'Conectado';

    if (!syncStatus.isConnected) {
        bgColor = 'bg-yellow-50 border-yellow-200';
        icon = <WifiOff className="h-4 w-4 text-yellow-600" />;
        message = 'Modo Offline - Dados salvos localmente';
    } else if (isError) {
        bgColor = 'bg-red-50 border-red-200';
        icon = <AlertCircle className="h-4 w-4 text-red-600" />;
        message = `Erro na sincronização (${syncStatus.pendingCount} pendente)`;
    } else if (isPending) {
        bgColor = 'bg-blue-50 border-blue-200';
        icon = <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
        message = `${syncStatus.pendingCount} item${syncStatus.pendingCount !== 1 ? 's' : ''} aguardando sincronização`;
    } else if (syncStatus.isSyncing) {
        bgColor = 'bg-blue-50 border-blue-200';
        icon = <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
        message = 'Sincronizando...';
    }

    return (
        <>
            <div className={`border-b ${bgColor} transition-all`}>
                <div className="max-w-7xl mx-auto px-4 py-2">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            {icon}
                            <span className="text-sm font-medium truncate text-gray-700">
                                {message}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setShowPanel(!showPanel)}
                                className="h-7"
                            >
                                <ChevronDown className={`h-4 w-4 transition-transform ${showPanel ? 'rotate-180' : ''}`} />
                            </Button>
                            {showPanel && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setShowPanel(false)}
                                    className="h-7"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {showPanel && (
                        <div className="mt-3 border-t pt-3">
                            <SyncPanel />
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}