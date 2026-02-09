import { useEffect } from 'react';
import { NotificationService } from './NotificationService.js';
import { SyncService } from './SyncService';

/**
 * Componente que escuta mensagens do Service Worker
 * e integra com o sistema de notificações
 */
export default function NotificationListener() {
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        // Listener para mensagens do Service Worker
        const handleMessage = async (event) => {
            const { type, data } = event.data;

            switch (type) {
                case 'sync-started':
                    NotificationService.showSyncNotification('started');
                    break;

                case 'sync-success':
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    NotificationService.showSyncNotification('success', { 
                        count: data?.itemCount || 1 
                    });
                    break;

                case 'sync-error':
                    NotificationService.showSyncNotification('error', { 
                        message: data?.message || 'Erro desconhecido' 
                    });
                    break;

                case 'offline-mode':
                    NotificationService.showSyncNotification('offline');
                    break;

                case 'pending-items':
                    NotificationService.showPendingDataNotification(data?.count || 0);
                    break;
            }
        };

        navigator.serviceWorker.addEventListener('message', handleMessage);

        // Listener para clique em notificação
        navigator.serviceWorker.ready.then(registration => {
            const originalShowNotification = registration.showNotification.bind(registration);
            
            registration.showNotification = function(title, options = {}) {
                const newOptions = {
                    ...options,
                    actions: [
                        ...(options.actions || [])
                    ]
                };
                return originalShowNotification(title, newOptions);
            };
        });

        return () => {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
        };
    }, []);

    return null; // Componente invisível
}