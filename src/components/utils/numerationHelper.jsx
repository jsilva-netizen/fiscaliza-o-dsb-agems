/**
 * Calcula a próxima numeração contínua entre unidades da mesma fiscalização
 */
export async function calcularProximaNumeracao(fiscalizacaoId, unidadeAtualId, base44) {
    // Buscar todas as unidades dessa fiscalização, ordenadas por criação
    const todasUnidades = await base44.entities.UnidadeFiscalizada.filter(
        { fiscalizacao_id: fiscalizacaoId },
        'created_date',
        500
    );

    // Unidades anteriores (criadas antes da atual)
    const unidadeAtual = todasUnidades.find(u => u.id === unidadeAtualId);
    const unidadeAtualIndex = todasUnidades.findIndex(u => u.id === unidadeAtualId);
    const unidadesAnteriores = todasUnidades.slice(0, unidadeAtualIndex);

    let contadores = { C: 0, NC: 0, D: 0, R: 0 };

    // Contar registros de unidades anteriores
    if (unidadesAnteriores.length > 0) {
        const idsUnidadesAnteriores = unidadesAnteriores.map(u => u.id);

        const [respostas, ncs, determinacoes, recomendacoes] = await Promise.all([
            base44.entities.RespostaChecklist.list('created_date', 1000),
            base44.entities.NaoConformidade.list('created_date', 1000),
            base44.entities.Determinacao.list('created_date', 1000),
            base44.entities.Recomendacao.list('created_date', 1000)
        ]);

        contadores.C = respostas.filter(r => idsUnidadesAnteriores.includes(r.unidade_fiscalizada_id)).length;
        contadores.NC = ncs.filter(n => idsUnidadesAnteriores.includes(n.unidade_fiscalizada_id)).length;
        contadores.D = determinacoes.filter(d => idsUnidadesAnteriores.includes(d.unidade_fiscalizada_id)).length;
        contadores.R = recomendacoes.filter(r => idsUnidadesAnteriores.includes(r.unidade_fiscalizada_id)).length;
    }

    return contadores;
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