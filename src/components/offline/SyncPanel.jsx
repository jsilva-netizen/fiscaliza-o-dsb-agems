import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle2, Loader2, Download, Upload } from 'lucide-react';
import DataService from '@/functions/dataService';
import db from '@/functions/offlineDb';

export default function SyncPanel({ isOpen, onClose }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);

  // Atualiza contagem de pendentes e status online
  useEffect(() => {
    const updateStatus = async () => {
      setIsOnline(navigator.onLine);
      try {
        const status = await DataService.getSyncStatus();
        setPendingCount(status.pendingCount);
        setFailedCount(status.failedCount);
      } catch (error) {
        console.error('Erro ao atualizar status:', error);
      }
    };

    updateStatus();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOpen]);

  /**
   * Download de dados de referência
   */
  const handleDownload = async () => {
    if (!isOnline) {
      setDownloadStatus({ type: 'error', message: 'Sem conexão de internet' });
      return;
    }

    setIsDownloading(true);
    setDownloadStatus(null);
    setDownloadProgress(0);

    try {
      const result = await DataService.downloadAllReferenceData();

      setDownloadProgress(100);
      if (result.failed.length === 0) {
        setDownloadStatus({
          type: 'success',
          message: `✓ ${result.success.length} tabelas baixadas com sucesso`,
        });
      } else {
        setDownloadStatus({
          type: 'warning',
          message: `⚠ ${result.success.length} sucesso, ${result.failed.length} falharam`,
        });
      }
    } catch (error) {
      setDownloadStatus({
        type: 'error',
        message: `✗ Erro: ${error.message}`,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  /**
   * Upload de dados pendentes
   */
  const handleUpload = async () => {
    if (!isOnline) {
      setUploadStatus({ type: 'error', message: 'Sem conexão de internet' });
      return;
    }

    if (pendingCount === 0) {
      setUploadStatus({
        type: 'info',
        message: 'Nenhum dado pendente para enviar',
      });
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);
    setUploadProgress(0);

    try {
      const result = await DataService.uploadPendingData();

      const totalProcessed = result.success + result.failed;
      setUploadProgress((result.success / totalProcessed) * 100 || 0);

      if (result.failed === 0) {
        setUploadStatus({
          type: 'success',
          message: `✓ ${result.success} itens sincronizados com sucesso`,
        });
        // Atualiza contagem
        const pending = await db.syncQueue.where('status').equals('pending').toArray();
        setPendingCount(pending.length);
      } else {
        setUploadStatus({
          type: 'warning',
          message: `⚠ ${result.success} sucesso, ${result.failed} falharam`,
        });
      }
    } catch (error) {
      setUploadStatus({
        type: 'error',
        message: `✗ Erro: ${error.message}`,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sincronização Offline</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status de Conexão */}
          <Alert
            className={isOnline ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}
          >
            <AlertCircle className={`h-4 w-4 ${isOnline ? 'text-green-600' : 'text-amber-600'}`} />
            <AlertDescription className={isOnline ? 'text-green-800' : 'text-amber-800'}>
              {isOnline ? '✓ Conectado à internet' : '⚠ Modo offline'}
            </AlertDescription>
          </Alert>

          {/* Contadores */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-red-50 p-3 rounded border border-red-200">
              <p className="text-red-600 font-semibold">{pendingCount}</p>
              <p className="text-red-700 text-xs">pendentes</p>
            </div>
            <div className="bg-orange-50 p-3 rounded border border-orange-200">
              <p className="text-orange-600 font-semibold">{failedCount}</p>
              <p className="text-orange-700 text-xs">falhados</p>
            </div>
          </div>

          {/* Download Dados */}
          <div className="space-y-2">
            <Button
              onClick={handleDownload}
              disabled={!isOnline || isDownloading}
              className="w-full gap-2"
              variant="outline"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Baixando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Baixar Dados do Servidor
                </>
              )}
            </Button>
            {isDownloading && (
              <Progress value={downloadProgress} className="h-2" />
            )}
            {downloadStatus && (
              <Alert className={`bg-${downloadStatus.type}-50 border-${downloadStatus.type}-200`}>
                <AlertDescription className={`text-${downloadStatus.type}-800`}>
                  {downloadStatus.message}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Upload Dados */}
          <div className="space-y-2">
            <Button
              onClick={handleUpload}
              disabled={!isOnline || isUploading || pendingCount === 0}
              className="w-full gap-2"
              variant="outline"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Enviar Pendentes ({pendingCount})
                </>
              )}
            </Button>
            {isUploading && (
              <Progress value={uploadProgress} className="h-2" />
            )}
            {uploadStatus && (
              <Alert className={`bg-${uploadStatus.type}-50 border-${uploadStatus.type}-200`}>
                <AlertDescription className={`text-${uploadStatus.type}-800`}>
                  {uploadStatus.message}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Mensagem offline */}
          {!isOnline && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Conecte-se à internet para sincronizar dados
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}