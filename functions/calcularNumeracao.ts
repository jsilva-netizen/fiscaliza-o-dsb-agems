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

        // Solução otimizada: usar os totais já calculados e salvos em cada unidade
        // Reduz de 4*N requisições para ZERO requisições adicionais!
        // As unidades já têm total_constatacoes e total_ncs quando são finalizadas
        
        for (const unidade of unidadesAnteriores) {
            // Somar constatações (total já inclui checklist + manuais)
            contadores.C += unidade.total_constatacoes || 0;
            
            // Somar NCs
            contadores.NC += unidade.total_ncs || 0;
        }

        // Para D e R, precisamos contar pois não temos totais salvos na unidade
        // Mas fazemos sequencialmente para evitar rate limit
        const idsUnidadesAnteriores = unidadesAnteriores.map(u => u.id);
        
        for (const unidadeId of idsUnidadesAnteriores) {
            const determinacoes = await base44.asServiceRole.entities.Determinacao.filter(
                { unidade_fiscalizada_id: unidadeId }, 
                'created_date', 
                500
            );
            contadores.D += determinacoes.length;
            
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const recomendacoes = await base44.asServiceRole.entities.Recomendacao.filter(
                { unidade_fiscalizada_id: unidadeId }, 
                'created_date', 
                500
            );
            contadores.R += recomendacoes.length;
            
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        return Response.json({ success: true, contadores });

    } catch (error) {
        console.error('Erro ao calcular numeração:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});