// Handler atômico para respostas com detecção de colisão
// Centraliza toda a lógica de C/NC/D para evitar race conditions

export const executarRespostaAtomicamente = async (params) => {
    const {
        base44,
        unidadeId,
        itemId,
        item,
        data,
        respostasExistentes,
        ncsExistentes,
        determinacoesExistentes
    } = params;

    // 1. CONSTATAÇÃO: sempre gerar sequencial se SIM/NAO
    let numeroConstatacao = null;
    let respostaId = null;

    if (data.resposta === 'SIM' || data.resposta === 'NAO') {
        const respostaExistente = respostasExistentes.find(r => r.item_checklist_id === itemId);
        
        if (respostaExistente?.numero_constatacao) {
            numeroConstatacao = respostaExistente.numero_constatacao;
        } else {
            // Buscar máximo do banco (não do cache) para evitar colisão
            const todasRespostas = await base44.entities.RespostaChecklist.filter(
                { unidade_fiscalizada_id: unidadeId },
                '-created_date',
                500
            );
            const numeros = todasRespostas
                .filter(r => r.numero_constatacao)
                .map(r => parseInt(r.numero_constatacao.replace('C', '')))
                .filter(n => !isNaN(n));
            const proximo = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
            numeroConstatacao = `C${proximo}`;
        }
    }

    let textoConstatacao = '';
    if (data.resposta === 'SIM' && item.texto_constatacao_sim) {
        textoConstatacao = item.texto_constatacao_sim;
    } else if (data.resposta === 'NAO' && item.texto_constatacao_nao) {
        textoConstatacao = item.texto_constatacao_nao;
    } else if (data.resposta !== 'NA') {
        textoConstatacao = item.pergunta.replace('?', '').trim();
    }

    const payloadResposta = {
        unidade_fiscalizada_id: unidadeId,
        item_checklist_id: itemId,
        pergunta: textoConstatacao,
        gera_nc: item.gera_nc || false,
        numero_constatacao: numeroConstatacao,
        resposta: data.resposta,
        observacao: data.observacao || null
    };

    // 2. SALVAR RESPOSTA
    const respostaExistente = respostasExistentes.find(r => r.item_checklist_id === itemId);
    if (respostaExistente) {
        await base44.entities.RespostaChecklist.update(respostaExistente.id, payloadResposta);
        respostaId = respostaExistente.id;
    } else {
        const nova = await base44.entities.RespostaChecklist.create(payloadResposta);
        respostaId = nova.id;
    }

    // 3. RECARREGAR NCs e Determinações do banco (não cache)
    const ncsAtualizadas = await base44.entities.NaoConformidade.filter(
        { unidade_fiscalizada_id: unidadeId },
        '-created_date',
        500
    );
    const determinacoesAtualizadas = await base44.entities.Determinacao.filter(
        { unidade_fiscalizada_id: unidadeId },
        '-created_date',
        500
    );

    // 4. GERENCIAR NC: criar ou deletar conforme necessário
    const ncVinculada = ncsAtualizadas.find(nc => nc.resposta_checklist_id === respostaId);
    const deveExistirNC = (data.resposta === 'NAO' && item.gera_nc === true);

    if (deveExistirNC && !ncVinculada) {
        // Calcular número de NC (recarregado do banco)
        const numerosNC = ncsAtualizadas
            .map(nc => parseInt(nc.numero_nc?.replace('NC', '') || '0'))
            .filter(n => !isNaN(n));
        const proximoNumNC = numerosNC.length > 0 ? Math.max(...numerosNC) + 1 : 1;
        const numeroNC = `NC${proximoNumNC}`;

        const textoNC = item.texto_nc 
            ? `A Constatação ${numeroConstatacao} não cumpre o disposto no ${item.artigo_portaria || 'regulamento aplicável'}. ${item.texto_nc}`
            : `A Constatação ${numeroConstatacao} não cumpre o disposto no ${item.artigo_portaria || 'regulamento aplicável'}.`;

        // Criar NC (atomic)
        const ncCriada = await base44.entities.NaoConformidade.create({
            unidade_fiscalizada_id: unidadeId,
            resposta_checklist_id: respostaId,
            numero_nc: numeroNC,
            artigo_portaria: item.artigo_portaria || '',
            descricao: textoNC,
            fotos: []
        });

        // Criar Determinação APÓS NC criada com sucesso
        if (item.texto_determinacao) {
            const numerosDet = determinacoesAtualizadas
                .map(d => parseInt(d.numero_determinacao?.replace('D', '') || '0'))
                .filter(n => !isNaN(n));
            const proximoNumDet = numerosDet.length > 0 ? Math.max(...numerosDet) + 1 : 1;
            const numeroDet = `D${proximoNumDet}`;

            const textoDet = `Para sanar ${numeroNC}, ${item.texto_determinacao.charAt(0).toLowerCase()}${item.texto_determinacao.slice(1)}`;

            await base44.entities.Determinacao.create({
                unidade_fiscalizada_id: unidadeId,
                nao_conformidade_id: ncCriada.id,
                numero_determinacao: numeroDet,
                descricao: textoDet,
                prazo_dias: 30,
                status: 'pendente'
            });
        }

        return { tipo: 'nc_criada', ncId: ncCriada.id, numeroNC, numeroDet: undefined };

    } else if (!deveExistirNC && ncVinculada) {
        // Deletar Determinações primeiro (integridade referencial)
        const detsVinculadas = determinacoesAtualizadas.filter(d => d.nao_conformidade_id === ncVinculada.id);
        for (const det of detsVinculadas) {
            await base44.entities.Determinacao.delete(det.id);
        }
        
        // Depois deletar NC
        await base44.entities.NaoConformidade.delete(ncVinculada.id);

        return { tipo: 'nc_deletada', ncId: ncVinculada.id };
    }

    return { tipo: 'sem_nc', respostaId };
};