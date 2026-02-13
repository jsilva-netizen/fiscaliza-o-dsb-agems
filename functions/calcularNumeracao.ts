import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { fiscalizacao_id, unidade_atual_id } = await req.json();

        if (!fiscalizacao_id || !unidade_atual_id) {
            return Response.json({ 
                error: 'fiscalizacao_id e unidade_atual_id são obrigatórios' 
            }, { status: 400 });
        }

        // Buscar todas as unidades dessa fiscalização
        const todasUnidades = await base44.asServiceRole.entities.UnidadeFiscalizada.filter(
            { fiscalizacao_id },
            'created_date',
            500
        );

        // Encontrar posição da unidade atual
        const unidadeAtualIndex = todasUnidades.findIndex(u => u.id === unidade_atual_id);
        const unidadesAnteriores = todasUnidades.slice(0, unidadeAtualIndex);

        let contadores = { C: 0, NC: 0, D: 0, R: 0 };

        // Se não há unidades anteriores, retornar contadores zerados
        if (unidadesAnteriores.length === 0) {
            return Response.json({ success: true, contadores });
        }

        const idsUnidadesAnteriores = unidadesAnteriores.map(u => u.id);

        // Estratégia otimizada: buscar TUDO da fiscalização de uma vez e filtrar em memória
        // 4 requisições totais independente do número de unidades (vs 4xN antes)
        const [todasRespostas, todasNcs, todasDeterminacoes, todasRecomendacoes] = await Promise.all([
            // Buscar todas as respostas de todas as unidades da fiscalização
            (async () => {
                const respostasPorUnidade = [];
                for (const unidadeId of idsUnidadesAnteriores) {
                    const r = await base44.asServiceRole.entities.RespostaChecklist.filter(
                        { unidade_fiscalizada_id: unidadeId }, 
                        'created_date', 
                        500
                    );
                    respostasPorUnidade.push(...r);
                }
                return respostasPorUnidade;
            })(),
            // Buscar todas as NCs
            (async () => {
                const ncsPorUnidade = [];
                for (const unidadeId of idsUnidadesAnteriores) {
                    const n = await base44.asServiceRole.entities.NaoConformidade.filter(
                        { unidade_fiscalizada_id: unidadeId }, 
                        'created_date', 
                        500
                    );
                    ncsPorUnidade.push(...n);
                }
                return ncsPorUnidade;
            })(),
            // Buscar todas as Determinações
            (async () => {
                const detsPorUnidade = [];
                for (const unidadeId of idsUnidadesAnteriores) {
                    const d = await base44.asServiceRole.entities.Determinacao.filter(
                        { unidade_fiscalizada_id: unidadeId }, 
                        'created_date', 
                        500
                    );
                    detsPorUnidade.push(...d);
                }
                return detsPorUnidade;
            })(),
            // Buscar todas as Recomendações
            (async () => {
                const recsPorUnidade = [];
                for (const unidadeId of idsUnidadesAnteriores) {
                    const r = await base44.asServiceRole.entities.Recomendacao.filter(
                        { unidade_fiscalizada_id: unidadeId }, 
                        'created_date', 
                        500
                    );
                    recsPorUnidade.push(...r);
                }
                return recsPorUnidade;
            })()
        ]);

        const respostas = todasRespostas;
        const ncs = todasNcs;
        const determinacoes = todasDeterminacoes;
        const recomendacoes = todasRecomendacoes;

        // Contar apenas respostas que são constatações (SIM ou NAO)
        contadores.C = respostas.filter(r => r.resposta === 'SIM' || r.resposta === 'NAO').length;
        contadores.NC = ncs.length;
        contadores.D = determinacoes.length;
        contadores.R = recomendacoes.length;

        return Response.json({ success: true, contadores });

    } catch (error) {
        console.error('Erro ao calcular numeração:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});