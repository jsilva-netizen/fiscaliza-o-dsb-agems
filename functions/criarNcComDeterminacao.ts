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

        // 2. Contar NCs em paralelo para gerar números únicos
        const [ncsAtuais, determinacoesAtuais] = await Promise.all([
            base44.entities.NaoConformidade.filter({ unidade_fiscalizada_id }, null, 1000),
            base44.entities.Determinacao.filter({ unidade_fiscalizada_id }, null, 1000)
        ]);
        
        const numeroNC = `NC${ncsAtuais.length + 1}`;
        const numeroD = `D${determinacoesAtuais.length + 1}`;

        // 3. Criar NC e calcular data_limite em paralelo
        const descricaoNC = `A Constatação ${numero_constatacao} não cumpre o disposto no ${artigo_portaria};`;
        
        const nc = await base44.entities.NaoConformidade.create({
            unidade_fiscalizada_id,
            resposta_checklist_id: resposta.id,
            numero_nc: numeroNC,
            artigo_portaria,
            descricao: descricaoNC
        });

        // 4. Calcular data_limite
        const hoje = new Date();
        const data_limite = new Date(hoje);
        data_limite.setDate(data_limite.getDate() + prazo_dias);
        const data_limite_str = data_limite.toISOString().split('T')[0];

        // 5. Criar Determinação vinculada à NC
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

        return Response.json({ 
            success: true,
            resposta: {
                id: resposta.id,
                numero_constatacao
            },
            nc: {
                id: nc.id,
                numero_nc: numeroNC
            },
            determinacao: {
                id: det.id,
                numero_determinacao: numeroD,
                data_limite: data_limite_str
            }
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});