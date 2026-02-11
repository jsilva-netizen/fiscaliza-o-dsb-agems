import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { fiscalizacao_id } = await req.json();

        if (!fiscalizacao_id) {
            return Response.json({ error: 'fiscalizacao_id é obrigatório' }, { status: 400 });
        }

        // Buscar fiscalização e verificar permissão
        const fiscalizacao = await base44.asServiceRole.entities.Fiscalizacao.filter({ id: fiscalizacao_id });
        if (!fiscalizacao || fiscalizacao.length === 0) {
            return Response.json({ error: 'Fiscalização não encontrada' }, { status: 404 });
        }

        // Apenas o criador ou admin pode deletar
        const isAdmin = user.role === 'admin';
        const isCriador = fiscalizacao[0].created_by === user.email;
        
        if (!isAdmin && !isCriador) {
            return Response.json({ error: 'Apenas o criador ou administrador pode deletar esta fiscalização' }, { status: 403 });
        }

        // Buscar todas as unidades
        const unidades = await base44.asServiceRole.entities.UnidadeFiscalizada.filter({ 
            fiscalizacao_id 
        }, 'created_date', 500);

        // Coletar todos os IDs para deleção em massa
        const unidadeIds = unidades.map(u => u.id);

        if (unidadeIds.length > 0) {
            // Buscar todos os registros relacionados
            const [respostas, ncs, determinacoes, recomendacoes, fotos, constatacoesManuais] = await Promise.all([
                Promise.all(unidadeIds.map(id => 
                    base44.asServiceRole.entities.RespostaChecklist.filter({ unidade_fiscalizada_id: id }, 'created_date', 500)
                )).then(r => r.flat()),
                Promise.all(unidadeIds.map(id => 
                    base44.asServiceRole.entities.NaoConformidade.filter({ unidade_fiscalizada_id: id }, 'created_date', 500)
                )).then(r => r.flat()),
                Promise.all(unidadeIds.map(id => 
                    base44.asServiceRole.entities.Determinacao.filter({ unidade_fiscalizada_id: id }, 'created_date', 500)
                )).then(r => r.flat()),
                Promise.all(unidadeIds.map(id => 
                    base44.asServiceRole.entities.Recomendacao.filter({ unidade_fiscalizada_id: id }, 'created_date', 500)
                )).then(r => r.flat()),
                base44.asServiceRole.entities.FotoEvidencia.filter({ fiscalizacao_id }, 'created_date', 500),
                Promise.all(unidadeIds.map(id => 
                    base44.asServiceRole.entities.ConstatacaoManual.filter({ unidade_fiscalizada_id: id }, 'ordem', 500)
                )).then(r => r.flat())
            ]);

            // Deletar em lotes menores para evitar rate limit
            const deleteBatch = async (items, entityName) => {
                const batchSize = 20;
                for (let i = 0; i < items.length; i += batchSize) {
                    const batch = items.slice(i, i + batchSize);
                    await Promise.all(batch.map(item => 
                        base44.asServiceRole.entities[entityName].delete(item.id)
                    ));
                }
            };

            // Deletar em ordem (dependências primeiro)
            await deleteBatch(respostas, 'RespostaChecklist');
            await deleteBatch(determinacoes, 'Determinacao');
            await deleteBatch(recomendacoes, 'Recomendacao');
            await deleteBatch(ncs, 'NaoConformidade');
            await deleteBatch(constatacoesManuais, 'ConstatacaoManual');
            await deleteBatch(fotos, 'FotoEvidencia');
            await deleteBatch(unidades, 'UnidadeFiscalizada');
        }

        // Deletar a fiscalização
        await base44.asServiceRole.entities.Fiscalizacao.delete(fiscalizacao_id);

        return Response.json({ 
            success: true,
            message: 'Fiscalização deletada com sucesso'
        });

    } catch (error) {
        console.error('Erro ao deletar fiscalização:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});