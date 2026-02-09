import React from 'react';
import OfflineStatusBar from '@/components/offline/OfflineStatusBar';
import OfflineSyncButton from '@/components/offline/OfflineSyncButton';
import PushNotificationInitializer from '@/components/offline/PushNotificationInitializer';
import NotificationListener from '@/components/offline/NotificationListener';
import { useInitializeReferenceData } from '@/components/hooks/useInitializeReferenceData';

export default function Layout({ children, currentPageName }) {
    useInitializeReferenceData();
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
                <div className="fixed top-4 right-4 z-50">
                    <OfflineSyncButton />
                </div>
                {children}
            </>
        );
    }

    return (
        <>
            <PushNotificationInitializer />
            <NotificationListener />
            <OfflineStatusBar />
            <div className="fixed top-4 right-4 z-50">
                <OfflineSyncButton />
            </div>
            <div className="min-h-screen bg-gray-50">
                {children}
            </div>
        </>
    );
}