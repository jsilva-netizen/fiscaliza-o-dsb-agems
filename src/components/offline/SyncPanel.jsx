import React, { useState, useEffect } from 'react';
import { useSyncManager } from '@/components/offline/useSyncManager';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  WifiOff,
  Wifi,
  RefreshCw,
  Clock,
  Activity
} from 'lucide-react';

/**
 * Painel completo de sincronização com histórico e configurações
 */
export default function SyncPanel({ open = false, onOpenChange = () => {} }) {
  const syncStatus = useSyncManager();
  const [syncHistory, setSyncHistory] = useState([]);

  useEffect(() => {
    loadSyncHistory();
  }, []);

  const loadSyncHistory = async () => {
    try {
      // Carregar histórico de localStorage (persistência básica)
      const history = localStorage.getItem('syncHistory');
      if (history) {
        setSyncHistory(JSON.parse(history));
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Sincronização de Dados
          </DialogTitle>
          <DialogDescription>
            Gerencie a sincronização de seus dados offline para o banco online
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="status" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>

          {/* TAB 1: STATUS */}
          <TabsContent value="status" className="space-y-4">
            {/* Status Online/Offline */}
            <div className="flex items-center gap-3 p-4 rounded-lg border">
              {navigator.onLine ? (
                <>
                  <Wifi className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">Online</p>
                    <p className="text-sm text-gray-600">Conectado ao banco de dados</p>
                  </div>
                </>
              ) : (
                <>
                  <WifiOff className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="font-medium text-yellow-900">Modo Offline</p>
                    <p className="text-sm text-gray-600">Dados salvos localmente</p>
                  </div>
                </>
              )}
            </div>

            {/* Último Sync */}
            {syncStatus.lastSyncTime && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 border">
                <Clock className="h-5 w-5 text-gray-600" />
                <div>
                  <p className="font-medium text-gray-900">Última sincronização</p>
                  <p className="text-sm text-gray-600">
                    {syncStatus.lastSyncTime.toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            )}

            {/* Itens Pendentes */}
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <h4 className="font-medium text-sm mb-3 text-blue-900">Itens Pendentes</h4>
              {syncStatus.hasPending ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Total de itens</span>
                    <Badge className="bg-blue-600">{syncStatus.pendingCount}</Badge>
                  </div>
                  <Progress value={50} className="h-2" />
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm">Todos os dados sincronizados</span>
                </div>
              )}
            </div>

            {/* Erro de Sync */}
            {syncStatus.lastError && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-red-900 text-sm">Erro na última sincronização</h4>
                    <p className="text-sm text-red-700 mt-1">{syncStatus.lastError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Botões de Ação */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={() => syncStatus.manualSync()}
                disabled={!navigator.onLine || syncStatus.isSyncing}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {syncStatus.isSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sincronizar Agora
                  </>
                )}
              </Button>
              {syncStatus.hasErrors && (
                <Button
                  onClick={() => syncStatus.retryFailed()}
                  disabled={syncStatus.isSyncing}
                  variant="outline"
                  className="flex-1"
                >
                  Tentar Novamente
                </Button>
              )}
            </div>
          </TabsContent>

          {/* TAB 2: HISTÓRICO */}
          <TabsContent value="history" className="space-y-3">
            {syncHistory.length > 0 ? (
              <div className="space-y-2">
                {syncHistory.slice(0, 20).map((entry, idx) => (
                  <div key={idx} className="p-3 rounded-lg border flex items-start gap-3">
                    {entry.status === 'success' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {entry.status === 'success' ? '✓' : '✗'} {entry.timestamp}
                      </p>
                      {entry.details && (
                        <p className="text-xs text-gray-600 mt-1">{entry.details}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum histórico de sincronização</p>
              </div>
            )}
          </TabsContent>

          {/* TAB 3: CONFIGURAÇÕES */}
          <TabsContent value="settings" className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <span className="text-gray-700">Sincronização automática ao conectar</span>
                <Badge className="bg-green-600">Ativada</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <span className="text-gray-700">Notificações push</span>
                <Badge className="bg-green-600">Ativadas</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <span className="text-gray-700">Background Sync</span>
                <Badge className="bg-green-600">Ativado</Badge>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}