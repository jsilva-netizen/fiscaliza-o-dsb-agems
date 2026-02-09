import { useState, useEffect, useCallback } from 'react';
import { NotificationService } from '@/components/offline/NotificationService';

/**
 * Hook para gerenciar notificações push do app
 */
export function usePushNotifications() {
  const [permission, setPermission] = useState(
    'Notification' in window ? Notification.permission : 'unsupported'
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Setup listener de mensagens do SW
    NotificationService.setupMessageListener();

    // Restaurar permissão salva
    const saved = localStorage.getItem('notificationPermission');
    if (saved && saved !== permission) {
      setPermission(saved);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (permission !== 'unsupported' && permission !== 'denied') {
      const result = await NotificationService.requestPermission();
      setPermission(result);
      return result;
    }
    return permission;
  }, [permission]);

  const showNotification = useCallback(async (type, data) => {
    if (permission === 'granted') {
      await NotificationService.showSyncNotification(type, data);
    }
  }, [permission]);

  const checkStorage = useCallback(async () => {
    return await NotificationService.checkStorageSpace();
  }, []);

  return {
    permission,
    isSupported: permission !== 'unsupported',
    isEnabled: permission === 'granted',
    isDenied: permission === 'denied',
    isLoading,
    requestPermission,
    showNotification,
    checkStorage
  };
}