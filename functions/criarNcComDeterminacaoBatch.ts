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

        // Processar cada resposta sequencialmente
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

            // Criar RespostaChecklist
            const resposta = await base44.entities.RespostaChecklist.create({
                unidade_fiscalizada_id,
                item_checklist_id,
                pergunta: perguntaFormatada,
                resposta: resposta_value,
                gera_nc: resposta_value === 'NAO' && !!texto_nc,
                numero_constatacao,
                observacao: ''
            });

            let resultado = {
                success: true,
                item_checklist_id,
                resposta: {
                    id: resposta.id,
                    numero_constatacao
                }
            };

            // Se gera NC
            if (resposta_value === 'NAO' && texto_nc) {
                const descricaoNC = `A Constatação ${numero_constatacao} não cumpre o disposto no ${artigo_portaria};`;

                const nc = await base44.entities.NaoConformidade.create({
                    unidade_fiscalizada_id,
                    resposta_checklist_id: resposta.id,
                    numero_nc,
                    artigo_portaria,
                    descricao: descricaoNC
                });

                resultado.nc = {
                    id: nc.id,
                    numero_nc
                };

                // Criar Determinação se houver
                if (texto_determinacao) {
                    const hoje = new Date();
                    const data_limite = new Date(hoje);
                    data_limite.setDate(data_limite.getDate() + prazo_dias);
                    const data_limite_str = data_limite.toISOString().split('T')[0];

                    const descricaoDeterminacao = `Para sanar a ${numero_nc} ${texto_determinacao}`;

                    const det = await base44.entities.Determinacao.create({
                        unidade_fiscalizada_id,
                        nao_conformidade_id: nc.id,
                        numero_determinacao,
                        descricao: descricaoDeterminacao,
                        prazo_dias,
                        data_limite: data_limite_str,
                        status: 'pendente'
                    });

                    resultado.determinacao = {
                        id: det.id,
                        numero_determinacao,
                        data_limite: data_limite_str
                    };
                }
                // Criar Recomendação se houver
                else if (texto_recomendacao) {
                    const rec = await base44.entities.Recomendacao.create({
                        unidade_fiscalizada_id,
                        numero_recomendacao,
                        descricao: texto_recomendacao,
                        origem: 'checklist'
                    });

                    resultado.recomendacao = {
                        id: rec.id,
                        numero_recomendacao
                    };
                }
            }

            resultados.push(resultado);
        }

        return Response.json({ 
            success: true, 
            processados: resultados.length,
            resultados 
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});