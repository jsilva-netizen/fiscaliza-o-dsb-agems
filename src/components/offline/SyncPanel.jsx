import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    RefreshCw, CheckCircle2, AlertCircle, Loader2, 
    Trash2, WifiOff, Wifi, Clock
} from 'lucide-react';
import { useSyncManager } from './useSyncManager';
import { SyncService } from './SyncService';
import { format } from 'date-fns';

export default function SyncPanel() {
    const syncStatus = useSyncManager();
    const [isClearing, setIsClearing] = useState(false);

    const handleManualSync = async () => {
        await syncStatus.manualSync();
    };

    const handleRetryFailed = async () => {
        await syncStatus.retryFailed();
    };

    const handleClearQueue = async () => {
        setIsClearing(true);
        try {
            await SyncService.clearSyncQueue();
            await syncStatus.manualSync();
        } finally {
            setIsClearing(false);
        }
    };

    return (
        <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Sincronização</CardTitle>
                    <Badge variant={syncStatus.isConnected ? "default" : "secondary"}>
                        {syncStatus.isConnected ? (
                            <><Wifi className="h-3 w-3 mr-1" /> Online</>
                        ) : (
                            <><WifiOff className="h-3 w-3 mr-1" /> Offline</>
                        )}
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Status Geral */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded-lg">
                        <p className="text-xs text-gray-500">Status</p>
                        <div className="flex items-center gap-2 mt-1">
                            {syncStatus.isSyncing ? (
                                <>
                                    <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                                    <span className="text-sm font-medium text-blue-600">Sincronizando...</span>
                                </>
                            ) : syncStatus.syncError ? (
                                <>
                                    <AlertCircle className="h-4 w-4 text-red-600" />
                                    <span className="text-sm font-medium text-red-600">Erro</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    <span className="text-sm font-medium text-green-600">Tudo sincronizado</span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="bg-white p-3 rounded-lg">
                        <p className="text-xs text-gray-500">Pendentes</p>
                        <div className="flex items-center gap-2 mt-1">
                            {syncStatus.hasPending ? (
                                <>
                                    <Clock className="h-4 w-4 text-yellow-600" />
                                    <span className="text-sm font-medium text-yellow-600">
                                        {syncStatus.pendingCount} item{syncStatus.pendingCount !== 1 ? 's' : ''}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="h-4 w-4 text-gray-400" />
                                    <span className="text-sm text-gray-500">Nenhum</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Último sincronismo */}
                {syncStatus.lastSyncTime && (
                    <div className="text-xs text-gray-500 flex items-center gap-2 bg-white p-2 rounded">
                        <Clock className="h-3 w-3" />
                        Última sincronização: {format(new Date(syncStatus.lastSyncTime), 'HH:mm:ss')}
                    </div>
                )}

                {/* Erro detalhado */}
                {syncStatus.syncError && (
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                        <p className="text-xs text-red-800 font-medium mb-2">Erro de sincronização:</p>
                        <p className="text-xs text-red-700">{syncStatus.syncError}</p>
                    </div>
                )}

                {/* Botões */}
                <div className="space-y-2">
                    <Button 
                        onClick={handleManualSync}
                        disabled={!syncStatus.isConnected || syncStatus.isSyncing}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        size="sm"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
                        Sincronizar Agora
                    </Button>

                    {syncStatus.syncError && (
                        <Button 
                            onClick={handleRetryFailed}
                            disabled={syncStatus.isSyncing}
                            variant="outline"
                            size="sm"
                            className="w-full"
                        >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Tentar Novamente
                        </Button>
                    )}

                    {syncStatus.hasPending && (
                        <Button 
                            onClick={handleClearQueue}
                            disabled={isClearing}
                            variant="outline"
                            size="sm"
                            className="w-full text-red-600 hover:text-red-700"
                        >
                            <Trash2 className={`h-4 w-4 mr-2 ${isClearing ? 'animate-spin' : ''}`} />
                            Limpar Fila
                        </Button>
                    )}
                </div>

                {/* Info */}
                <p className="text-xs text-gray-500 bg-white p-2 rounded">
                    {syncStatus.isConnected 
                        ? 'Dados serão sincronizados automaticamente a cada 5 minutos.'
                        : 'Quando estiver online, os dados pendentes serão sincronizados automaticamente.'
                    }
                </p>
            </CardContent>
        </Card>
    );
}