import { useEffect } from 'react';
import DataService from '@/functions/dataService';
import { useOnlineStatus } from './useOnlineStatus';

/**
 * Hook que carrega automaticamente dados de referência no banco local
 * Executa uma vez ao montar o componente se estiver online
 */
export function useInitializeReferenceData() {
  const { isOnline } = useOnlineStatus();

  useEffect(() => {
    if (!isOnline) return;

    const loadReferenceData = async () => {
      try {
        console.log('[useInitializeReferenceData] Carregando dados de referência...');
        
        // Carrega cada tabela de referência
        await Promise.all([
          DataService.read('Municipio'),
          DataService.read('PrestadorServico'),
          DataService.read('TipoUnidade'),
          DataService.read('ItemChecklist'),
        ]);

        console.log('[useInitializeReferenceData] Dados de referência carregados com sucesso');
      } catch (error) {
        console.error('[useInitializeReferenceData] Erro ao carregar dados de referência:', error);
      }
    };

    loadReferenceData();
  }, [isOnline]);
}