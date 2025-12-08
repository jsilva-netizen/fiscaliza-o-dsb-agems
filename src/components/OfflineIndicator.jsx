import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Loader2, Cloud, CloudOff } from 'lucide-react';
import { useOfflineSync } from '@/utils/useOfflineSync';

export default function OfflineIndicator() {
    const { isOnline, isSyncing, pendingCount } = useOfflineSync();

    if (isOnline && !isSyncing && pendingCount === 0) {
        return null; // Não mostrar nada quando está tudo ok
    }

    return (
        <div className="fixed top-4 right-4 z-50">
            {!isOnline ? (
                <Badge className="bg-yellow-500 text-white flex items-center gap-2 px-3 py-2 shadow-lg">
                    <WifiOff className="h-4 w-4" />
                    <div className="text-xs">
                        <div className="font-semibold">Modo Offline</div>
                        {pendingCount > 0 && (
                            <div className="text-yellow-100">
                                {pendingCount} item(ns) pendente(s)
                            </div>
                        )}
                    </div>
                </Badge>
            ) : isSyncing ? (
                <Badge className="bg-blue-500 text-white flex items-center gap-2 px-3 py-2 shadow-lg animate-pulse">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <div className="text-xs">
                        <div className="font-semibold">Sincronizando...</div>
                        {pendingCount > 0 && (
                            <div className="text-blue-100">
                                {pendingCount} item(ns) restante(s)
                            </div>
                        )}
                    </div>
                </Badge>
            ) : pendingCount > 0 ? (
                <Badge className="bg-orange-500 text-white flex items-center gap-2 px-3 py-2 shadow-lg">
                    <Cloud className="h-4 w-4" />
                    <div className="text-xs">
                        <div className="font-semibold">Online</div>
                        <div className="text-orange-100">
                            {pendingCount} item(ns) para sincronizar
                        </div>
                    </div>
                </Badge>
            ) : null}
        </div>
    );
}