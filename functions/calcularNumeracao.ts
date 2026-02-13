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

        // Processar sequencialmente para evitar rate limit no backend
        let respostas = [];
        let ncs = [];
        let determinacoes = [];
        let recomendacoes = [];

        for (const unidadeId of idsUnidadesAnteriores) {
            // Buscar cada tipo de entidade sequencialmente com delay
            const unidadeRespostas = await base44.asServiceRole.entities.RespostaChecklist.filter(
                { unidade_fiscalizada_id: unidadeId }, 
                'created_date', 
                500
            );
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const unidadeNcs = await base44.asServiceRole.entities.NaoConformidade.filter(
                { unidade_fiscalizada_id: unidadeId }, 
                'created_date', 
                500
            );
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const unidadeDeterminacoes = await base44.asServiceRole.entities.Determinacao.filter(
                { unidade_fiscalizada_id: unidadeId }, 
                'created_date', 
                500
            );
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const unidadeRecomendacoes = await base44.asServiceRole.entities.Recomendacao.filter(
                { unidade_fiscalizada_id: unidadeId }, 
                'created_date', 
                500
            );

            respostas = [...respostas, ...unidadeRespostas];
            ncs = [...ncs, ...unidadeNcs];
            determinacoes = [...determinacoes, ...unidadeDeterminacoes];
            recomendacoes = [...recomendacoes, ...unidadeRecomendacoes];

            // Delay entre unidades
            await new Promise(resolve => setTimeout(resolve, 300));
        }

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