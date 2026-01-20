// Operação TRANSACIONAL para Resposta + NC + Determinação
// REQUER CONEXÃO ONLINE

export const criarRespostaComNCDeterminacao = async (params) => {
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

    // OBRIGATÓRIO: Verificar conexão
    if (!navigator.onLine) {
        throw new Error('Esta operação requer conexão com a internet');
    }

    // 1. ETAPA 1: Validar e preparar dados
    if (!item || !data.resposta) {
        throw new Error('Dados inválidos para criar resposta');
    }

    // 2. ETAPA 2: Gerar CONSTATAÇÃO sequencial
    let numeroConstatacao = null;
    if (data.resposta === 'SIM' || data.resposta === 'NAO') {
        const respostaExistente = respostasExistentes.find(r => r.item_checklist_id === itemId);
        if (respostaExistente?.numero_constatacao) {
            numeroConstatacao = respostaExistente.numero_constatacao;
        } else {
            // Buscar máximo real do banco
            const todasRespostas = await base44.entities.RespostaChecklist.filter(
                { unidade_fiscalizada_id: unidadeId },
                '-created_date',
                500
            );
            const numeros = todasRespostas
                .map(r => parseInt(r.numero_constatacao?.replace('C', '') || '0'))
                .filter(n => !isNaN(n) && n > 0);
            const proximo = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
            numeroConstatacao = `C${proximo}`;
        }
    }

    // 3. ETAPA 3: Salvar RESPOSTA
    const respostaExistente = respostasExistentes.find(r => r.item_checklist_id === itemId);
    let respostaId;

    const payloadResposta = {
        unidade_fiscalizada_id: unidadeId,
        item_checklist_id: itemId,
        pergunta: data.pergunta || item.pergunta,
        numero_constatacao: numeroConstatacao,
        resposta: data.resposta,
        observacao: data.observacao || null,
        gera_nc: item.gera_nc || false
    };

    if (respostaExistente) {
        await base44.entities.RespostaChecklist.update(
            respostaExistente.id,
            payloadResposta
        );
        respostaId = respostaExistente.id;
    } else {
        const respostaCriada = await base44.entities.RespostaChecklist.create(payloadResposta);
        respostaId = respostaCriada.id;
    }

    // 4. ETAPA 4: Validar estado após salvar resposta
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

    // 5. ETAPA 5: Gerenciar NC (criar ou deletar)
    const ncVinculada = ncsAtualizadas.find(nc => nc.resposta_checklist_id === respostaId);
    const deveExistirNC = (data.resposta === 'NAO' && item.gera_nc === true);

    if (deveExistirNC && !ncVinculada) {
        // Gerar número NC sequencial
        const numerosNC = ncsAtualizadas
            .map(n => parseInt(n.numero_nc?.replace('NC', '') || '0'))
            .filter(n => !isNaN(n) && n > 0);
        const proximoNumNC = numerosNC.length > 0 ? Math.max(...numerosNC) + 1 : 1;
        const numeroNC = `NC${proximoNumNC}`;

        const textoNC = item.texto_nc 
            ? `A Constatação ${numeroConstatacao} não cumpre o disposto no ${item.artigo_portaria || 'regulamento aplicável'}. ${item.texto_nc}`
            : `A Constatação ${numeroConstatacao} não cumpre o disposto no ${item.artigo_portaria || 'regulamento aplicável'}.`;

        // CRIAR NC (TRANSACTION POINT 1)
        let ncCriada;
        try {
            ncCriada = await base44.entities.NaoConformidade.create({
                unidade_fiscalizada_id: unidadeId,
                resposta_checklist_id: respostaId,
                numero_nc: numeroNC,
                artigo_portaria: item.artigo_portaria || '',
                descricao: textoNC,
                fotos: [],
                timestamp: new Date().toISOString() // Para detecção de colisão
            });
        } catch (err) {
            // Reversão: Deletar resposta se NC falhar
            if (!respostaExistente) {
                await base44.entities.RespostaChecklist.delete(respostaId);
            }
            throw new Error(`Falha ao criar NC: ${err.message}`);
        }

        // CRIAR DETERMINAÇÃO (TRANSACTION POINT 2)
        if (item.texto_determinacao) {
            const numerosDet = determinacoesAtualizadas
                .map(d => parseInt(d.numero_determinacao?.replace('D', '') || '0'))
                .filter(n => !isNaN(n) && n > 0);
            const proximoNumDet = numerosDet.length > 0 ? Math.max(...numerosDet) + 1 : 1;
            const numeroDet = `D${proximoNumDet}`;

            const textoDet = `Para sanar ${numeroNC}, ${item.texto_determinacao.charAt(0).toLowerCase()}${item.texto_determinacao.slice(1)}`;

            try {
                await base44.entities.Determinacao.create({
                    unidade_fiscalizada_id: unidadeId,
                    nao_conformidade_id: ncCriada.id,
                    numero_determinacao: numeroDet,
                    descricao: textoDet,
                    prazo_dias: 30,
                    status: 'pendente',
                    timestamp: new Date().toISOString()
                });
            } catch (err) {
                // Reversão: Deletar NC se D falhar (garante integridade)
                await base44.entities.NaoConformidade.delete(ncCriada.id);
                if (!respostaExistente) {
                    await base44.entities.RespostaChecklist.delete(respostaId);
                }
                throw new Error(`Falha ao criar Determinação: ${err.message}`);
            }
        }

        return { tipo: 'nc_criada', respostaId, numeroNC };

    } else if (!deveExistirNC && ncVinculada) {
        // Deletar DETERMINAÇÕES antes da NC (integridade referencial)
        const detsVinculadas = determinacoesAtualizadas.filter(
            d => d.nao_conformidade_id === ncVinculada.id
        );
        
        for (const det of detsVinculadas) {
            await base44.entities.Determinacao.delete(det.id);
        }

        // Deletar NC
        await base44.entities.NaoConformidade.delete(ncVinculada.id);

        return { tipo: 'nc_deletada', respostaId };
    }

    return { tipo: 'sem_nc', respostaId };
};