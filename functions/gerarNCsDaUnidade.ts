import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { unidade_fiscalizada_id } = await req.json();

        if (!unidade_fiscalizada_id) {
            return Response.json({ error: 'unidade_fiscalizada_id obrigatório' }, { status: 400 });
        }

        // 1. Buscar todas as respostas do checklist
        const respostas = await base44.asServiceRole.entities.RespostaChecklist.filter({
            unidade_fiscalizada_id
        }, 'created_date', 200);

        // 2. Buscar itens do checklist para pegar configurações
        const idsItens = [...new Set(respostas.map(r => r.item_checklist_id))];
        const itensChecklist = await base44.asServiceRole.entities.ItemChecklist.filter({
            id: { $in: idsItens }
        });

        const itensMap = {};
        itensChecklist.forEach(item => {
            itensMap[item.id] = item;
        });

        // 3. Numerar constatações (SIM e NÃO com texto)
        let contadorC = 1;
        const respostasComNumero = [];
        
        for (const resposta of respostas) {
            if ((resposta.resposta === 'SIM' || resposta.resposta === 'NAO') && resposta.pergunta && resposta.pergunta.trim()) {
                const numeroConstatacao = `C${contadorC}`;
                respostasComNumero.push({
                    ...resposta,
                    numero_constatacao: numeroConstatacao
                });
                
                // Atualizar no banco
                await base44.asServiceRole.entities.RespostaChecklist.update(resposta.id, {
                    numero_constatacao: numeroConstatacao,
                    gera_nc: resposta.resposta === 'NAO' && itensMap[resposta.item_checklist_id]?.gera_nc
                });
                
                contadorC++;
            }
        }

        // 4. Criar NCs para respostas NAO que geram NC
        const ncsParaCriar = [];
        const determinacoesParaCriar = [];
        const recomendacoesParaCriar = [];
        let contadorNC = 1;
        let contadorD = 1;
        let contadorR = 1;

        for (const resposta of respostasComNumero) {
            const item = itensMap[resposta.item_checklist_id];
            if (!item) continue;

            if (resposta.resposta === 'NAO' && item.gera_nc && item.texto_nc && item.texto_nc.trim()) {
                const numeroNC = `NC${contadorNC}`;
                const descricaoNC = `A Constatação ${resposta.numero_constatacao} não cumpre o disposto no ${item.artigo_portaria};`;

                ncsParaCriar.push({
                    unidade_fiscalizada_id,
                    resposta_checklist_id: resposta.id,
                    numero_nc: numeroNC,
                    artigo_portaria: item.artigo_portaria,
                    descricao: descricaoNC,
                    _index: ncsParaCriar.length,
                    _item: item,
                    _numero_nc: numeroNC
                });

                contadorNC++;
            }
        }

        // 5. Criar NCs em batch
        let ncsCriadas = [];
        if (ncsParaCriar.length > 0) {
            ncsCriadas = await base44.asServiceRole.entities.NaoConformidade.bulkCreate(
                ncsParaCriar.map(nc => ({
                    unidade_fiscalizada_id: nc.unidade_fiscalizada_id,
                    resposta_checklist_id: nc.resposta_checklist_id,
                    numero_nc: nc.numero_nc,
                    artigo_portaria: nc.artigo_portaria,
                    descricao: nc.descricao
                }))
            );

            // 6. Preparar Determinações e Recomendações
            for (let i = 0; i < ncsCriadas.length; i++) {
                const nc = ncsCriadas[i];
                const item = ncsParaCriar[i]._item;

                if (item.texto_determinacao && item.texto_determinacao.trim()) {
                    const hoje = new Date();
                    const data_limite = new Date(hoje);
                    data_limite.setDate(data_limite.getDate() + (item.prazo_dias || 30));
                    const data_limite_str = data_limite.toISOString().split('T')[0];

                    const numeroDeterminacao = `D${contadorD}`;
                    const descricaoDeterminacao = `Para sanar a ${ncsParaCriar[i]._numero_nc} ${item.texto_determinacao}`;

                    determinacoesParaCriar.push({
                        unidade_fiscalizada_id,
                        nao_conformidade_id: nc.id,
                        numero_determinacao: numeroDeterminacao,
                        descricao: descricaoDeterminacao,
                        prazo_dias: item.prazo_dias || 30,
                        data_limite: data_limite_str,
                        status: 'pendente'
                    });

                    contadorD++;
                } else if (item.texto_recomendacao && item.texto_recomendacao.trim()) {
                    const numeroRecomendacao = `R${contadorR}`;

                    recomendacoesParaCriar.push({
                        unidade_fiscalizada_id,
                        numero_recomendacao: numeroRecomendacao,
                        descricao: item.texto_recomendacao,
                        origem: 'checklist'
                    });

                    contadorR++;
                }
            }

            // 7. Criar Determinações em batch
            if (determinacoesParaCriar.length > 0) {
                await base44.asServiceRole.entities.Determinacao.bulkCreate(determinacoesParaCriar);
            }

            // 8. Criar Recomendações em batch
            if (recomendacoesParaCriar.length > 0) {
                await base44.asServiceRole.entities.Recomendacao.bulkCreate(recomendacoesParaCriar);
            }
        }

        console.log('NC/D/R gerados:', {
            total_constatacoes: respostasComNumero.length,
            total_ncs: ncsCriadas.length,
            total_determinacoes: determinacoesParaCriar.length,
            total_recomendacoes: recomendacoesParaCriar.length
        });

        return Response.json({
            success: true,
            total_constatacoes: respostasComNumero.length,
            total_ncs: ncsCriadas.length,
            total_determinacoes: determinacoesParaCriar.length,
            total_recomendacoes: recomendacoesParaCriar.length
        });

    } catch (error) {
        console.error('Erro ao gerar NC/D/R:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});