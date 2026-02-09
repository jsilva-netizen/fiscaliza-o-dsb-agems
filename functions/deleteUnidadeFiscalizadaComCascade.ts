import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { unidade_id } = await req.json();

        if (!unidade_id) {
            return Response.json({ error: 'unidade_id é obrigatório' }, { status: 400 });
        }

        // Buscar a unidade
        const unidade = await base44.asServiceRole.entities.UnidadeFiscalizada.get(unidade_id);
        if (!unidade) {
            return Response.json({ error: 'Unidade não encontrada' }, { status: 404 });
        }

        // Buscar a fiscalização
        const fiscalizacao = await base44.asServiceRole.entities.Fiscalizacao.get(unidade.fiscalizacao_id);
        if (!fiscalizacao) {
            return Response.json({ error: 'Fiscalização não encontrada' }, { status: 404 });
        }

        // Verificar se a fiscalização está finalizada
        if (fiscalizacao.status === 'finalizada') {
            return Response.json({ 
                error: 'Não é possível excluir unidades de uma fiscalização finalizada' 
            }, { status: 403 });
        }

        // Verificar permissões: admin ou fiscal que criou a fiscalização
        const isAdmin = user.role === 'admin';
        const isFiscalCriador = fiscalizacao.fiscal_email === user.email;

        if (!isAdmin && !isFiscalCriador) {
            return Response.json({ 
                error: 'Você não tem permissão para excluir esta unidade' 
            }, { status: 403 });
        }

        // 1. Buscar e excluir todos os registros relacionados à unidade
        const [respostas, constatacoesManuais, ncs, determinacoes, recomendacoes, fotos] = await Promise.all([
            base44.asServiceRole.entities.RespostaChecklist.filter({ unidade_fiscalizada_id: unidade_id }),
            base44.asServiceRole.entities.ConstatacaoManual.filter({ unidade_fiscalizada_id: unidade_id }),
            base44.asServiceRole.entities.NaoConformidade.filter({ unidade_fiscalizada_id: unidade_id }),
            base44.asServiceRole.entities.Determinacao.filter({ unidade_fiscalizada_id: unidade_id }),
            base44.asServiceRole.entities.Recomendacao.filter({ unidade_fiscalizada_id: unidade_id }),
            base44.asServiceRole.entities.FotoEvidencia.filter({ unidade_fiscalizada_id: unidade_id })
        ]);

        // Excluir todos os registros encontrados
        const deletePromises = [];
        
        for (const resposta of respostas) {
            deletePromises.push(base44.asServiceRole.entities.RespostaChecklist.delete(resposta.id));
        }
        for (const constatacao of constatacoesManuais) {
            deletePromises.push(base44.asServiceRole.entities.ConstatacaoManual.delete(constatacao.id));
        }
        for (const nc of ncs) {
            deletePromises.push(base44.asServiceRole.entities.NaoConformidade.delete(nc.id));
        }
        for (const det of determinacoes) {
            deletePromises.push(base44.asServiceRole.entities.Determinacao.delete(det.id));
        }
        for (const rec of recomendacoes) {
            deletePromises.push(base44.asServiceRole.entities.Recomendacao.delete(rec.id));
        }
        for (const foto of fotos) {
            deletePromises.push(base44.asServiceRole.entities.FotoEvidencia.delete(foto.id));
        }

        await Promise.all(deletePromises);

        // 2. Excluir a unidade
        await base44.asServiceRole.entities.UnidadeFiscalizada.delete(unidade_id);

        // 3. Buscar todas as unidades restantes da fiscalização, ordenadas por data de criação
        const unidadesRestantes = await base44.asServiceRole.entities.UnidadeFiscalizada.filter(
            { fiscalizacao_id: fiscalizacao.id },
            'created_date'
        );

        // 4. Recalcular numeração para todas as unidades restantes
        let contatacaoGlobal = 0;
        let ncGlobal = 0;
        let determinacaoGlobal = 0;
        let recomendacaoGlobal = 0;

        for (const unidadeRestante of unidadesRestantes) {
            // Buscar todas as constatações manuais desta unidade
            const constatacoesManuais = await base44.asServiceRole.entities.ConstatacaoManual.filter(
                { unidade_fiscalizada_id: unidadeRestante.id },
                'ordem'
            );

            // Atualizar numeração das constatações manuais
            for (const constatacao of constatacoesManuais) {
                contatacaoGlobal++;
                const novoNumero = `C${contatacaoGlobal}`;
                
                if (constatacao.numero_constatacao !== novoNumero) {
                    await base44.asServiceRole.entities.ConstatacaoManual.update(constatacao.id, {
                        numero_constatacao: novoNumero
                    });
                }

                // Se gera NC, atualizar NC e determinação associadas
                if (constatacao.gera_nc) {
                    ncGlobal++;
                    determinacaoGlobal++;

                    const novoNumeroNC = `NC${ncGlobal}`;
                    const novoNumeroDet = `D${determinacaoGlobal}`;

                    // Buscar NC associada (se existir)
                    const ncs = await base44.asServiceRole.entities.NaoConformidade.filter({
                        unidade_fiscalizada_id: unidadeRestante.id,
                        resposta_checklist_id: null // NC de constatação manual
                    });

                    // Procurar a NC que corresponde a esta constatação manual
                    const nc = ncs.find(n => n.descricao?.includes(constatacao.descricao?.substring(0, 50)));
                    
                    if (nc && nc.numero_nc !== novoNumeroNC) {
                        await base44.asServiceRole.entities.NaoConformidade.update(nc.id, {
                            numero_nc: novoNumeroNC
                        });

                        // Atualizar determinação associada
                        const determinacoes = await base44.asServiceRole.entities.Determinacao.filter({
                            nao_conformidade_id: nc.id
                        });

                        if (determinacoes.length > 0) {
                            await base44.asServiceRole.entities.Determinacao.update(determinacoes[0].id, {
                                numero_determinacao: novoNumeroDet
                            });
                        }
                    }
                }
            }

            // Buscar respostas de checklist desta unidade
            const respostas = await base44.asServiceRole.entities.RespostaChecklist.filter(
                { unidade_fiscalizada_id: unidadeRestante.id }
            );

            // Atualizar numeração das respostas de checklist
            for (const resposta of respostas) {
                contatacaoGlobal++;
                const novoNumero = `C${contatacaoGlobal}`;
                
                if (resposta.numero_constatacao !== novoNumero) {
                    await base44.asServiceRole.entities.RespostaChecklist.update(resposta.id, {
                        numero_constatacao: novoNumero
                    });
                }

                // Se gera NC, atualizar NC e determinação
                if (resposta.gera_nc && resposta.resposta === 'NAO') {
                    ncGlobal++;
                    determinacaoGlobal++;

                    const novoNumeroNC = `NC${ncGlobal}`;
                    const novoNumeroDet = `D${determinacaoGlobal}`;

                    // Buscar NC associada
                    const ncs = await base44.asServiceRole.entities.NaoConformidade.filter({
                        resposta_checklist_id: resposta.id
                    });

                    if (ncs.length > 0) {
                        await base44.asServiceRole.entities.NaoConformidade.update(ncs[0].id, {
                            numero_nc: novoNumeroNC
                        });

                        // Atualizar determinação associada
                        const determinacoes = await base44.asServiceRole.entities.Determinacao.filter({
                            nao_conformidade_id: ncs[0].id
                        });

                        if (determinacoes.length > 0) {
                            await base44.asServiceRole.entities.Determinacao.update(determinacoes[0].id, {
                                numero_determinacao: novoNumeroDet
                            });
                        }
                    }
                }
            }

            // Buscar recomendações desta unidade
            const recomendacoes = await base44.asServiceRole.entities.Recomendacao.filter(
                { unidade_fiscalizada_id: unidadeRestante.id }
            );

            // Atualizar numeração das recomendações
            for (const recomendacao of recomendacoes) {
                recomendacaoGlobal++;
                const novoNumero = `R${recomendacaoGlobal}`;
                
                if (recomendacao.numero_recomendacao !== novoNumero) {
                    await base44.asServiceRole.entities.Recomendacao.update(recomendacao.id, {
                        numero_recomendacao: novoNumero
                    });
                }
            }
        }

        return Response.json({ 
            success: true,
            message: 'Unidade excluída e numeração atualizada com sucesso',
            totais: {
                constatacoes: contatacaoGlobal,
                ncs: ncGlobal,
                determinacoes: determinacaoGlobal,
                recomendacoes: recomendacaoGlobal
            }
        });

    } catch (error) {
        console.error('Erro ao excluir unidade:', error);
        return Response.json({ 
            error: error.message || 'Erro ao excluir unidade' 
        }, { status: 500 });
    }
});