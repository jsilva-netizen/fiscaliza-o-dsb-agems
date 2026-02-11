import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { respostas } = await req.json();

        if (!Array.isArray(respostas) || respostas.length === 0) {
            return Response.json({ error: 'Array de respostas vazio' }, { status: 400 });
        }

        const resultados = [];
        
        // Preparar dados para bulk operations
        const respostasParaCriar = [];
        const ncsParaCriar = [];
        const determinacoesParaCriar = [];
        const recomendacoesParaCriar = [];

        for (const respostaData of respostas) {
            const { 
                unidade_fiscalizada_id,
                item_checklist_id,
                pergunta,
                artigo_portaria,
                texto_nc,
                texto_determinacao,
                texto_recomendacao,
                numero_constatacao,
                numero_nc,
                numero_determinacao,
                numero_recomendacao,
                prazo_dias = 30,
                resposta_value
            } = respostaData;

            // Adicionar ';' ao final da pergunta se não existir
            let perguntaFormatada = pergunta;
            if (perguntaFormatada && !perguntaFormatada.trim().endsWith(';')) {
                perguntaFormatada = perguntaFormatada.trim() + ';';
            }

            respostasParaCriar.push({
                unidade_fiscalizada_id,
                item_checklist_id,
                pergunta: perguntaFormatada,
                resposta: resposta_value,
                gera_nc: resposta_value === 'NAO' && !!texto_nc,
                numero_constatacao,
                observacao: '',
                _metadata: { artigo_portaria, texto_nc, texto_determinacao, texto_recomendacao, numero_nc, numero_determinacao, numero_recomendacao, prazo_dias }
            });
        }

        // Criar todas as respostas de uma vez
        const respostasCriadas = await base44.asServiceRole.entities.RespostaChecklist.bulkCreate(respostasParaCriar.map(r => ({
            unidade_fiscalizada_id: r.unidade_fiscalizada_id,
            item_checklist_id: r.item_checklist_id,
            pergunta: r.pergunta,
            resposta: r.resposta,
            gera_nc: r.gera_nc,
            numero_constatacao: r.numero_constatacao,
            observacao: r.observacao
        })));

        // Preparar NCs, Determinações e Recomendações baseado nas respostas criadas
        for (let i = 0; i < respostasCriadas.length; i++) {
            const resposta = respostasCriadas[i];
            const metadata = respostasParaCriar[i]._metadata;
            const respostaOriginal = respostasParaCriar[i];
            
            resultados.push({
                success: true,
                item_checklist_id: respostaOriginal.item_checklist_id,
                resposta: {
                    id: resposta.id,
                    numero_constatacao: resposta.numero_constatacao
                }
            });

            // Verificar pela resposta original enviada, não pela resposta criada
            if (respostaOriginal.resposta === 'NAO' && metadata.texto_nc && metadata.texto_nc.trim()) {
                const descricaoNC = `A Constatação ${resposta.numero_constatacao} não cumpre o disposto no ${metadata.artigo_portaria};`;

                ncsParaCriar.push({
                    unidade_fiscalizada_id: resposta.unidade_fiscalizada_id,
                    resposta_checklist_id: resposta.id,
                    numero_nc: metadata.numero_nc,
                    artigo_portaria: metadata.artigo_portaria,
                    descricao: descricaoNC,
                    _index: i,
                    _metadata: metadata
                });
            }
        }

        // Criar todas as NCs de uma vez
        if (ncsParaCriar.length > 0) {
            const ncsCriadas = await base44.asServiceRole.entities.NaoConformidade.bulkCreate(ncsParaCriar.map(nc => ({
                unidade_fiscalizada_id: nc.unidade_fiscalizada_id,
                resposta_checklist_id: nc.resposta_checklist_id,
                numero_nc: nc.numero_nc,
                artigo_portaria: nc.artigo_portaria,
                descricao: nc.descricao
            })));

            // Preparar Determinações e Recomendações
            for (let i = 0; i < ncsCriadas.length; i++) {
                const nc = ncsCriadas[i];
                const metadata = ncsParaCriar[i]._metadata;
                const resultIndex = ncsParaCriar[i]._index;

                resultados[resultIndex].nc = {
                    id: nc.id,
                    numero_nc: nc.numero_nc
                };

                if (metadata.texto_determinacao) {
                    const hoje = new Date();
                    const data_limite = new Date(hoje);
                    data_limite.setDate(data_limite.getDate() + metadata.prazo_dias);
                    const data_limite_str = data_limite.toISOString().split('T')[0];

                    const descricaoDeterminacao = `Para sanar a ${nc.numero_nc} ${metadata.texto_determinacao}`;

                    determinacoesParaCriar.push({
                        unidade_fiscalizada_id: nc.unidade_fiscalizada_id,
                        nao_conformidade_id: nc.id,
                        numero_determinacao: metadata.numero_determinacao,
                        descricao: descricaoDeterminacao,
                        prazo_dias: metadata.prazo_dias,
                        data_limite: data_limite_str,
                        status: 'pendente',
                        _index: resultIndex,
                        _data_limite_str: data_limite_str
                    });
                } else if (metadata.texto_recomendacao) {
                    recomendacoesParaCriar.push({
                        unidade_fiscalizada_id: nc.unidade_fiscalizada_id,
                        numero_recomendacao: metadata.numero_recomendacao,
                        descricao: metadata.texto_recomendacao,
                        origem: 'checklist',
                        _index: resultIndex
                    });
                }
            }

            // Criar todas as Determinações de uma vez
            if (determinacoesParaCriar.length > 0) {
                const detsCriadas = await base44.asServiceRole.entities.Determinacao.bulkCreate(determinacoesParaCriar.map(d => ({
                    unidade_fiscalizada_id: d.unidade_fiscalizada_id,
                    nao_conformidade_id: d.nao_conformidade_id,
                    numero_determinacao: d.numero_determinacao,
                    descricao: d.descricao,
                    prazo_dias: d.prazo_dias,
                    data_limite: d.data_limite,
                    status: d.status
                })));

                for (let i = 0; i < detsCriadas.length; i++) {
                    const det = detsCriadas[i];
                    const resultIndex = determinacoesParaCriar[i]._index;
                    resultados[resultIndex].determinacao = {
                        id: det.id,
                        numero_determinacao: det.numero_determinacao,
                        data_limite: determinacoesParaCriar[i]._data_limite_str
                    };
                }
            }

            // Criar todas as Recomendações de uma vez
            if (recomendacoesParaCriar.length > 0) {
                const recsCriadas = await base44.asServiceRole.entities.Recomendacao.bulkCreate(recomendacoesParaCriar.map(r => ({
                    unidade_fiscalizada_id: r.unidade_fiscalizada_id,
                    numero_recomendacao: r.numero_recomendacao,
                    descricao: r.descricao,
                    origem: r.origem
                })));

                for (let i = 0; i < recsCriadas.length; i++) {
                    const rec = recsCriadas[i];
                    const resultIndex = recomendacoesParaCriar[i]._index;
                    resultados[resultIndex].recomendacao = {
                        id: rec.id,
                        numero_recomendacao: rec.numero_recomendacao
                    };
                }
            }
        }

        // Log para debug
        console.log('Batch processado:', {
            respostas_recebidas: respostas.length,
            respostas_criadas: respostasCriadas.length,
            ncs_para_criar: ncsParaCriar.length,
            determinacoes_criadas: determinacoesParaCriar.length,
            recomendacoes_criadas: recomendacoesParaCriar.length
        });

        return Response.json({ 
            success: true, 
            processados: resultados.length,
            total_ncs: ncsParaCriar.length,
            total_determinacoes: determinacoesParaCriar.length,
            total_recomendacoes: recomendacoesParaCriar.length,
            resultados 
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});