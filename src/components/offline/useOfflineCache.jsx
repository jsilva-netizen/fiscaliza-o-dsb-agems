import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { cacheData, getCachedData } from './offlineStorage';

/**
 * Hook for managing offline cache of essential data
 * Automatically caches data and provides fallback when offline
 */
export default function useOfflineCache(key, fetchFn, ttlMinutes = 60) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [fromCache, setFromCache] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            setError(null);

            try {
                // Try to get from cache first
                const cachedData = await getCachedData(key);
                
                if (cachedData) {
                    setData(cachedData);
                    setFromCache(true);
                    setIsLoading(false);
                }

                // If online, fetch fresh data
                if (navigator.onLine) {
                    try {
                        const freshData = await fetchFn();
                        setData(freshData);
                        setFromCache(false);
                        
                        // Update cache
                        await cacheData(key, freshData, ttlMinutes);
                    } catch (fetchError) {
                        // If fetch fails but we have cache, use cache
                        if (!cachedData) {
                            setError(fetchError);
                        }
                    }
                } else if (!cachedData) {
                    // Offline and no cache
                    setError(new Error('Sem conexão e dados não disponíveis offline'));
                }
            } catch (err) {
                setError(err);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [key]);

    const refetch = async () => {
        setIsLoading(true);
        try {
            const freshData = await fetchFn();
            setData(freshData);
            setFromCache(false);
            await cacheData(key, freshData, ttlMinutes);
        } catch (err) {
            setError(err);
        } finally {
            setIsLoading(false);
        }
    };

    return {
        data,
        isLoading,
        error,
        fromCache,
        refetch
    };
}