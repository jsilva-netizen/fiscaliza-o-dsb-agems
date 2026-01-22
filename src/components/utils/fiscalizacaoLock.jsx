/**
 * Helper para verificar e bloquear edições em fiscalizações finalizadas
 * Deve ser usado em todas as mutations que modificam dados de uma fiscalização
 */
export const checkFiscalizacaoFinalized = async (base44, fiscalizacaoId) => {
    if (!fiscalizacaoId) return; // sem ID, passa
    
    const fiscalizacoes = await base44.entities.Fiscalizacao.filter({ id: fiscalizacaoId });
    const fiscalizacao = fiscalizacoes[0];
    
    if (fiscalizacao?.status === 'finalizada') {
        throw new Error('Não é possível modificar uma fiscalização finalizada. Todos os dados estão bloqueados para manter a integridade do processo.');
    }
};

/**
 * Variante que recebe a fiscalização já carregada (para evitar queries redundantes)
 */
export const checkFiscalizacaoFinalizedDirect = (fiscalizacao) => {
    if (fiscalizacao?.status === 'finalizada') {
        throw new Error('Não é possível modificar uma fiscalização finalizada. Todos os dados estão bloqueados para manter a integridade do processo.');
    }
};