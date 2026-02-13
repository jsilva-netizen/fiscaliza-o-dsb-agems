/**
 * Calcula a próxima numeração contínua entre unidades da mesma fiscalização
 * Usa backend function para evitar múltiplas chamadas HTTP
 */
export async function calcularProximaNumeracao(fiscalizacaoId, unidadeAtualId, base44) {
    try {
        const { data } = await base44.functions.invoke('calcularNumeracao', {
            fiscalizacao_id: fiscalizacaoId,
            unidade_atual_id: unidadeAtualId
        });

        if (!data.success) {
            throw new Error(data.error || 'Erro ao calcular numeração');
        }

        return data.contadores;
    } catch (error) {
        console.error('Erro ao calcular numeração:', error);
        // Fallback: retornar contadores zerados
        return { C: 0, NC: 0, D: 0, R: 0 };
    }
}

/**
 * Gera números sequenciais para a unidade atual
 */
export function gerarNumeroConstatacao(contadores) {
    return `C${contadores.C + 1}`;
}

export function gerarNumeroNC(contadores) {
    return `NC${contadores.NC + 1}`;
}

export function gerarNumeroDeterminacao(contadores) {
    return `D${contadores.D + 1}`;
}

export function gerarNumeroRecomendacao(contadores) {
    return `R${contadores.R + 1}`;
}