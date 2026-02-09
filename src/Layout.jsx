import React from 'react';
import OfflineStatusBar from '@/components/offline/OfflineStatusBar';
import OfflineSyncButton from '@/components/offline/OfflineSyncButton';
import PushNotificationInitializer from '@/components/offline/PushNotificationInitializer';
import NotificationListener from '@/components/offline/NotificationListener';

export default function Layout({ children, currentPageName }) {
    // Páginas que não precisam de layout (fullscreen)
    const fullscreenPages = [
        'Home', 
        'NovaFiscalizacao', 
        'ExecutarFiscalizacao', 
        'VistoriarUnidade',
        'AdicionarUnidade',
        'Municipios',
        'TiposUnidade',
        'Checklists',
        'Fiscalizacoes',
        'Relatorios'
    ];

    if (fullscreenPages.includes(currentPageName)) {
        return (
            <>
                <PushNotificationInitializer />
                <NotificationListener />
                <OfflineStatusBar />
                {children}
            </>
        );
    }

    return (
        <>
            <PushNotificationInitializer />
            <NotificationListener />
            <OfflineStatusBar />
            <div className="min-h-screen bg-gray-50">
                {children}
            </div>
        </>
    );
}