import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { unidade_fiscalizada_id, tipo_unidade_id } = await req.json();

        // 1. Buscar todas as respostas da unidade
        const todasRespostas = await base44.entities.RespostaChecklist.filter({
            unidade_fiscalizada_id
        }, 'created_date', 200);

        // 2. Buscar todos os itens do checklist
        const todosItens = await base44.entities.ItemChecklist.filter({
            tipo_unidade_id
        }, 'ordem', 100);

        // 3. Buscar e deletar NCs do checklist
        const ncsGeradasPorChecklist = await base44.entities.NaoConformidade.filter({
            unidade_fiscalizada_id
        });
        const ncsDoChecklist = ncsGeradasPorChecklist.filter(nc => nc.resposta_checklist_id);

        // Deletar NCs e suas determinações
        for (const nc of ncsDoChecklist) {
            const dets = await base44.entities.Determinacao.filter({
                nao_conformidade_id: nc.id
            });
            for (const det of dets) {
                await base44.entities.Determinacao.delete(det.id);
            }
            await base44.entities.NaoConformidade.delete(nc.id);
        }

        // Deletar recomendações do checklist
        const recsExistentes = await base44.entities.Recomendacao.filter({
            unidade_fiscalizada_id,
            origem: 'checklist'
        });
        for (const rec of recsExistentes) {
            await base44.entities.Recomendacao.delete(rec.id);
        }

        // 4. Buscar constatações manuais
        const constatacoesManuais = await base44.entities.ConstatacaoManual.filter({
            unidade_fiscalizada_id
        }, 'ordem', 100);

        // 5. Renumerar e recriar
        let contadorC = 1;
        let contadorNC = 1;
        let contadorD = 1;
        let contadorR = 1;

        // Arrays para operações em batch
        const respostasParaAtualizar = [];
        const ncsParaCriar = [];
        const determinacoesParaCriar = [];
        const recomendacoesParaCriar = [];
        const constatacoesManuaisParaAtualizar = [];

        // Processar respostas do checklist
        for (const resp of todasRespostas) {
            const itemResp = todosItens.find(it => it.id === resp.item_checklist_id);
            
            let temTextoConstatacao = false;
            if (resp.resposta === 'SIM' && itemResp?.texto_constatacao_sim?.trim()) {
                temTextoConstatacao = true;
            } else if (resp.resposta === 'NAO' && itemResp?.texto_constatacao_nao?.trim()) {
                temTextoConstatacao = true;
            }
            
            if ((resp.resposta === 'SIM' || resp.resposta === 'NAO') && temTextoConstatacao) {
                const numeroConstatacao = `C${contadorC}`;
                
                respostasParaAtualizar.push({
                    id: resp.id,
                    numero_constatacao: numeroConstatacao
                });

                contadorC++;

                if (itemResp?.gera_nc && resp.resposta === 'NAO') {
                    const numeroNC = `NC${contadorNC}`;
                    const numeroDet = `D${contadorD}`;
                    const numeroRec = `R${contadorR}`;

                    let ncDescricao = itemResp.texto_nc;
                    if (!ncDescricao || !ncDescricao.trim()) {
                        ncDescricao = `A constatação ${numeroConstatacao} não cumpre o disposto no ${itemResp.artigo_portaria || 'artigo não especificado'}.`;
                    }

                    // Armazenar NC para criar depois e guardar o ID temporário
                    const tempNcId = `temp_nc_${contadorNC}`;
                    ncsParaCriar.push({
                        tempId: tempNcId,
                        resposta_checklist_id: resp.id,
                        unidade_fiscalizada_id,
                        numero_nc: numeroNC,
                        artigo_portaria: itemResp.artigo_portaria || '',
                        descricao: ncDescricao,
                        fotos: []
                    });

                    const textoDet = itemResp.texto_determinacao || 'regularizar a situação identificada';
                    const textoFinalDet = `Para sanar a ${numeroNC} ${textoDet}. Prazo: 30 dias.`;
                    determinacoesParaCriar.push({
                        tempNcId,
                        unidade_fiscalizada_id,
                        numero_determinacao: numeroDet,
                        descricao: textoFinalDet,
                        prazo_dias: 30,
                        status: 'pendente'
                    });

                    if (itemResp.texto_recomendacao) {
                        recomendacoesParaCriar.push({
                            unidade_fiscalizada_id,
                            numero_recomendacao: numeroRec,
                            descricao: itemResp.texto_recomendacao,
                            origem: 'checklist'
                        });
                        contadorR++;
                    }

                    contadorNC++;
                    contadorD++;
                }
            }
        }

        // Processar constatações manuais
        for (const constManual of constatacoesManuais) {
            const numeroConstatacao = `C${contadorC}`;
            
            constatacoesManuaisParaAtualizar.push({
                id: constManual.id,
                numero_constatacao: numeroConstatacao,
                oldNumero: constManual.numero_constatacao
            });
            
            contadorC++;
        }

        // Executar atualizações
        for (const resp of respostasParaAtualizar) {
            await base44.entities.RespostaChecklist.update(resp.id, {
                numero_constatacao: resp.numero_constatacao
            });
        }

        // Criar NCs e mapear IDs
        const ncIdMap = {};
        for (const nc of ncsParaCriar) {
            const { tempId, ...ncData } = nc;
            const created = await base44.entities.NaoConformidade.create(ncData);
            ncIdMap[tempId] = created.id;
        }

        // Criar determinações com IDs reais das NCs
        for (const det of determinacoesParaCriar) {
            const { tempNcId, ...detData } = det;
            await base44.entities.Determinacao.create({
                ...detData,
                nao_conformidade_id: ncIdMap[tempNcId]
            });
        }

        // Criar recomendações
        for (const rec of recomendacoesParaCriar) {
            await base44.entities.Recomendacao.create(rec);
        }

        // Atualizar constatações manuais e suas NCs/Ds
        for (const constManual of constatacoesManuaisParaAtualizar) {
            await base44.entities.ConstatacaoManual.update(constManual.id, {
                numero_constatacao: constManual.numero_constatacao
            });
            
            // Se gera NC, procurar e renumerar
            const ncsAssociadas = await base44.entities.NaoConformidade.filter({
                unidade_fiscalizada_id
            });
            
            const ncManual = ncsAssociadas.find(nc => 
                !nc.resposta_checklist_id && 
                nc.descricao && 
                nc.descricao.includes(constManual.oldNumero)
            );
            
            if (ncManual) {
                const numeroNC = `NC${contadorNC}`;
                const numeroDet = `D${contadorD}`;
                
                await base44.entities.NaoConformidade.update(ncManual.id, {
                    numero_nc: numeroNC
                });
                
                const detsAssociadas = await base44.entities.Determinacao.filter({
                    nao_conformidade_id: ncManual.id
                });
                
                if (detsAssociadas.length > 0) {
                    await base44.entities.Determinacao.update(detsAssociadas[0].id, {
                        numero_determinacao: numeroDet
                    });
                }
                
                contadorNC++;
                contadorD++;
            }
        }

        // Renumerar recomendações manuais
        const recsManuais = await base44.entities.Recomendacao.filter({
            unidade_fiscalizada_id,
            origem: 'manual'
        }, 'created_date', 100);
        
        for (const recManual of recsManuais) {
            await base44.entities.Recomendacao.update(recManual.id, {
                numero_recomendacao: `R${contadorR}`
            });
            contadorR++;
        }

        return Response.json({
            success: true,
            contadores: {
                C: contadorC,
                NC: contadorNC,
                D: contadorD,
                R: contadorR
            }
        });

    } catch (error) {
        console.error('Erro ao renumerar:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});