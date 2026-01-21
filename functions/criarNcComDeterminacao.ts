import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { 
            unidade_fiscalizada_id,
            item_checklist_id,
            pergunta,
            artigo_portaria,
            texto_nc,
            texto_determinacao,
            texto_recomendacao,
            numero_constatacao,
            prazo_dias = 30
        } = await req.json();

        // 1. Criar RespostaChecklist (fonte da verdade para cada pergunta)
        const resposta = await base44.entities.RespostaChecklist.create({
            unidade_fiscalizada_id,
            item_checklist_id,
            pergunta,
            resposta: 'NAO',
            gera_nc: true,
            numero_constatacao,
            observacao: ''
        });

        // 2. Contar NCs para gerar número único
        const ncsAtuais = await base44.entities.NaoConformidade.filter({ unidade_fiscalizada_id }, null, 1000);
        const numeroNC = `NC${ncsAtuais.length + 1}`;

        // 3. Criar NC
        const descricaoNC = `A Constatação ${numero_constatacao} não cumpre o disposto no ${artigo_portaria};`;

        const nc = await base44.entities.NaoConformidade.create({
            unidade_fiscalizada_id,
            resposta_checklist_id: resposta.id,
            numero_nc: numeroNC,
            artigo_portaria,
            descricao: descricaoNC
        });

        let resultado = {
            success: true,
            resposta: {
                id: resposta.id,
                numero_constatacao
            },
            nc: {
                id: nc.id,
                numero_nc: numeroNC
            }
        };

        // 4. Se tem texto_determinacao, criar Determinação
        if (texto_determinacao) {
            const determinacoesAtuais = await base44.entities.Determinacao.filter({ unidade_fiscalizada_id }, null, 1000);
            const numeroD = `D${determinacoesAtuais.length + 1}`;

            const hoje = new Date();
            const data_limite = new Date(hoje);
            data_limite.setDate(data_limite.getDate() + prazo_dias);
            const data_limite_str = data_limite.toISOString().split('T')[0];

            const descricaoDeterminacao = `Para sanar a ${numeroNC} ${texto_determinacao}. Prazo: ${prazo_dias} dias.`;

            const det = await base44.entities.Determinacao.create({
                unidade_fiscalizada_id,
                nao_conformidade_id: nc.id,
                numero_determinacao: numeroD,
                descricao: descricaoDeterminacao,
                prazo_dias,
                data_limite: data_limite_str,
                status: 'pendente'
            });

            resultado.determinacao = {
                id: det.id,
                numero_determinacao: numeroD,
                data_limite: data_limite_str
            };
        }
        // 5. Se tem texto_recomendacao, criar Recomendação
        else if (texto_recomendacao) {
            // Buscar todas as recomendações da fiscalização para numeração contínua
            const unidade = await base44.entities.UnidadeFiscalizada.filter({ id: unidade_fiscalizada_id }).then(r => r[0]);
            const todasUnidades = await base44.entities.UnidadeFiscalizada.filter(
                { fiscalizacao_id: unidade.fiscalizacao_id },
                'created_date',
                500
            );
            const idsUnidades = todasUnidades.map(u => u.id);

            const todasRec = await base44.entities.Recomendacao.list('created_date', 1000);
            const recsDaFiscalizacao = todasRec.filter(r => idsUnidades.includes(r.unidade_fiscalizada_id));

            const numerosRec = recsDaFiscalizacao
                .map(r => parseInt(r.numero_recomendacao?.replace('R', '') || '0'))
                .filter(n => !isNaN(n));
            const proximoNumero = numerosRec.length > 0 ? Math.max(...numerosRec) + 1 : 1;

            const rec = await base44.entities.Recomendacao.create({
                unidade_fiscalizada_id,
                numero_recomendacao: `R${proximoNumero}`,
                descricao: texto_recomendacao,
                origem: 'checklist'
            });

            resultado.recomendacao = {
                id: rec.id,
                numero_recomendacao: `R${proximoNumero}`
            };
        }

        return Response.json(resultado);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});