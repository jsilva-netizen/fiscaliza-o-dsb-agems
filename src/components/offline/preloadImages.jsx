import React from 'react';
import { cacheImage, getCachedImage } from './offlineStorage';

// Pre-carregar imagens em background
export const preloadImages = async (urls) => {
    if (!urls || urls.length === 0) return;
    
    const uniqueUrls = [...new Set(urls)];
    
    // Carregar em lotes de 3 por vez
    const batchSize = 3;
    for (let i = 0; i < uniqueUrls.length; i += batchSize) {
        const batch = uniqueUrls.slice(i, i + batchSize);
        await Promise.allSettled(
            batch.map(async (url) => {
                try {
                    // Verificar se já está em cache
                    const cached = await getCachedImage(url);
                    if (cached) return;
                    
                    // Baixar e cachear
                    const response = await fetch(url);
                    const blob = await response.blob();
                    await cacheImage(url, blob);
                } catch (error) {
                    console.error('Error preloading image:', url, error);
                }
            })
        );
    }
};

// Hook para pre-carregar imagens de uma fiscalização
export const usePreloadFiscalizacaoImages = (fiscalizacao, unidades) => {
    React.useEffect(() => {
        const loadImages = async () => {
            const urls = [];
            
            // Coletar URLs de fotos de unidades
            unidades?.forEach(unidade => {
                if (unidade.fotos_unidade) {
                    unidade.fotos_unidade.forEach(foto => {
                        const url = typeof foto === 'string' ? foto : foto.url;
                        if (url) urls.push(url);
                    });
                }
            });
            
            // Pre-carregar em background
            if (urls.length > 0) {
                setTimeout(() => preloadImages(urls), 1000);
            }
        };
        
        if (fiscalizacao && unidades) {
            loadImages();
        }
    }, [fiscalizacao?.id, unidades?.length]);
};

export default preloadImages;