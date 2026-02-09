import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
    ArrowLeft, ClipboardCheck, Camera, AlertTriangle, FileText, 
    CheckCircle2, Loader2, Plus, Save, AlertCircle, Pencil, Trash2
} from 'lucide-react';
import ChecklistItem from '@/components/fiscalizacao/ChecklistItem';
import PhotoGrid from '@/components/fiscalizacao/PhotoGrid';
import ConstatacaoManualForm from '@/components/fiscalizacao/ConstatacaoManualForm';
import EditarNCModal from '@/components/fiscalizacao/EditarNCModal';
import { calcularProximaNumeracao, gerarNumeroConstatacao, gerarNumeroNC, gerarNumeroDeterminacao, gerarNumeroRecomendacao } from '@/components/utils/numerationHelper';

export default function VistoriarUnidade() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const urlParams = new URLSearchParams(window.location.search);
    const unidadeId = urlParams.get('id');
    const modoEdicao = urlParams.get('modo') === 'edicao';

    const [activeTab, setActiveTab] = useState('checklist');
    const [respostas, setRespostas] = useState({});
    const [fotos, setFotos] = useState([]);
    const [fotosParaSalvar, setFotosParaSalvar] = useState([]);
    const [showAddRecomendacao, setShowAddRecomendacao] = useState(false);
    const [novaRecomendacao, setNovaRecomendacao] = useState('');
    const [recomendacoesCache, setRecomendacoesCache] = useState(null);
    const [showConfirmaSemFotos, setShowConfirmaSemFotos] = useState(false);
    const [contadores, setContadores] = useState(null);
    const [contadoresCarregados, setContadoresCarregados] = useState(false);
    const [showAddConstatacao, setShowAddConstatacao] = useState(false);
    const [showEditarNC, setShowEditarNC] = useState(false);
    const [constatacaoParaNC, setConstatacaoParaNC] = useState(null);
    const [numerosParaNC, setNumerosParaNC] = useState(null);
    const [constatacaoParaEditar, setConstatacaoParaEditar] = useState(null);
    const [showConfirmaExclusao, setShowConfirmaExclusao] = useState(false);
    const [constatacaoParaExcluir, setConstatacaoParaExcluir] = useState(null);

    // Queries
    const { data: unidade, isLoading: loadingUnidade } = useQuery({
        queryKey: ['unidade', unidadeId],
        queryFn: () => base44.entities.UnidadeFiscalizada.filter({ id: unidadeId }).then(r => r[0]),
        enabled: !!unidadeId,
        staleTime: 30000,
        gcTime: 300000
    });

    const { data: fiscalizacao } = useQuery({
        queryKey: ['fiscalizacao', unidade?.fiscalizacao_id],
        queryFn: () => base44.entities.Fiscalizacao.filter({ id: unidade?.fiscalizacao_id }).then(r => r[0]),
        enabled: !!unidade?.fiscalizacao_id,
        staleTime: 60000,
        gcTime: 300000
    });

    const { data: itensChecklist = [] } = useQuery({
        queryKey: ['itensChecklist', unidade?.tipo_unidade_id],
        queryFn: () => base44.entities.ItemChecklist.filter({ tipo_unidade_id: unidade?.tipo_unidade_id }, 'ordem', 100),
        enabled: !!unidade?.tipo_unidade_id,
        staleTime: 60000,
        gcTime: 300000
    });

    const { data: respostasExistentes = [] } = useQuery({
        queryKey: ['respostas', unidadeId],
        queryFn: async () => {
            const result = await base44.entities.RespostaChecklist.filter({ unidade_fiscalizada_id: unidadeId }, 'created_date', 200);
            return Array.isArray(result) ? result : [];
        },
        enabled: !!unidadeId,
        staleTime: 30000,
        gcTime: 300000
    });

    const { data: ncsExistentes = [] } = useQuery({
        queryKey: ['ncs', unidadeId],
        queryFn: async () => {
            const result = await base44.entities.NaoConformidade.filter({ unidade_fiscalizada_id: unidadeId });
            return Array.isArray(result) ? result : [];
        },
        enabled: !!unidadeId,
        staleTime: 30000,
        gcTime: 300000
    });



    const { data: determinacoesExistentes = [] } = useQuery({
        queryKey: ['determinacoes', unidadeId],
        queryFn: async () => {
            const result = await base44.entities.Determinacao.filter({ unidade_fiscalizada_id: unidadeId });
            return Array.isArray(result) ? result : [];
        },
        enabled: !!unidadeId,
        staleTime: 30000,
        gcTime: 300000
    });

    const { data: recomendacoesExistentes = [] } = useQuery({
        queryKey: ['recomendacoes', unidadeId],
        queryFn: async () => {
            const result = await base44.entities.Recomendacao.filter({ unidade_fiscalizada_id: unidadeId });
            return Array.isArray(result) ? result : [];
        },
        enabled: !!unidadeId,
        staleTime: 30000,
        gcTime: 300000
    });

    const { data: constatacoesManuais = [] } = useQuery({
        queryKey: ['constatacoes-manuais', unidadeId],
        queryFn: async () => {
            const result = await base44.entities.ConstatacaoManual.filter({ unidade_fiscalizada_id: unidadeId }, 'ordem', 100);
            return Array.isArray(result) ? result : [];
        },
        enabled: !!unidadeId,
        staleTime: 30000,
        gcTime: 300000
    });

    useEffect(() => {
        if (unidade?.fotos_unidade) {
            const fotosCarregadas = unidade.fotos_unidade.map(foto => 
                typeof foto === 'string' ? { url: foto } : foto
            );
            setFotos(fotosCarregadas);
        }
    }, [unidade?.fotos_unidade]);

    // Carregar contadores apenas na primeira resposta do checklist
    useEffect(() => {
        const carregarContadoresNaPrimeiraResposta = async () => {
            // Se ainda não temos respostas, continua aguardando
            if (respostasExistentes.length === 0 || contadoresCarregados) return;

            // Primeira vez que teremos dados do banco, carrega contadores globais
            if (!contadoresCarregados) {
                const contadoresCalc = await calcularProximaNumeracao(unidade.fiscalizacao_id, unidadeId, base44);
                setContadores(contadoresCalc);
                setContadoresCarregados(true);
            }
        };
        
        if (unidade?.fiscalizacao_id && respostasExistentes.length > 0) {
            carregarContadoresNaPrimeiraResposta();
        }
    }, [unidade?.fiscalizacao_id, unidadeId, respostasExistentes.length, contadoresCarregados]);

    // Carregar respostas apenas uma vez
    useEffect(() => {
        if (respostasExistentes.length > 0) {
            const respostasMap = {};
            respostasExistentes.forEach(r => {
                respostasMap[r.item_checklist_id] = r;
            });
            setRespostas(respostasMap);
        }
    }, [respostasExistentes.length]);

    const salvarRespostaMutation = useMutation({
        mutationFn: async ({ itemId, data }) => {
            if (fiscalizacao?.status === 'finalizada' && !modoEdicao) {
                throw new Error('Não é possível modificar uma fiscalização finalizada');
            }
            const item = itensChecklist.find(i => i.id === itemId);
            if (!item) return;

            const resposta = respostasExistentes.find(r => r.item_checklist_id === itemId);
            const respostaAnterior = resposta?.resposta;
            const mudouResposta = respostaAnterior !== data.resposta;

            if (resposta?.id) {
                // Definir novo texto da constatação
                let textoConstatacao = data.resposta === 'SIM' 
                    ? item.texto_constatacao_sim 
                    : data.resposta === 'NAO' 
                        ? item.texto_constatacao_nao 
                        : null;
                
                // Se não houver texto configurado para a resposta, não gera constatação
                if (!textoConstatacao || !textoConstatacao.trim()) {
                    textoConstatacao = null;
                } else if (!textoConstatacao.trim().endsWith(';')) {
                    textoConstatacao = textoConstatacao.trim() + ';';
                }

                // Atualizar a resposta
                await base44.entities.RespostaChecklist.update(resposta.id, {
                    resposta: data.resposta,
                    observacao: data.observacao || '',
                    pergunta: textoConstatacao || ''
                });

                // Se mudou a resposta, renumerar tudo
                if (mudouResposta) {
                    // 1. Buscar todas as respostas da unidade (incluindo a que acabamos de atualizar)
                    const todasRespostas = await base44.entities.RespostaChecklist.filter({
                        unidade_fiscalizada_id: unidadeId
                    }, 'created_date', 200);

                    // 2. Buscar todos os itens do checklist para saber quais geram NC
                    const todosItens = await base44.entities.ItemChecklist.filter({
                        tipo_unidade_id: unidade.tipo_unidade_id
                    }, 'ordem', 100);

                    // 3. Deletar TODAS as NCs, Determinações e Recomendações existentes desta unidade
                    const ncsExistentes = await base44.entities.NaoConformidade.filter({
                        unidade_fiscalizada_id: unidadeId
                    });
                    
                    for (const nc of ncsExistentes) {
                        const dets = await base44.entities.Determinacao.filter({
                            nao_conformidade_id: nc.id
                        });
                        for (const det of dets) {
                            await base44.entities.Determinacao.delete(det.id);
                        }
                        await base44.entities.NaoConformidade.delete(nc.id);
                    }

                    // Deletar todas as Recomendações do checklist (origem: checklist)
                    const recsExistentes = await base44.entities.Recomendacao.filter({
                        unidade_fiscalizada_id: unidadeId,
                        origem: 'checklist'
                    });
                    for (const rec of recsExistentes) {
                        await base44.entities.Recomendacao.delete(rec.id);
                    }

                    // 4. Buscar constatações manuais para incluir na renumeração
                    const constatacoesManuaisParaRenumerar = await base44.entities.ConstatacaoManual.filter({
                        unidade_fiscalizada_id: unidadeId
                    }, 'ordem', 100);

                    // 5. Renumerar constatações e recriar NCs/Ds/Rs
                    let contadorC = 1;
                    let contadorNC = 1;
                    let contadorD = 1;
                    let contadorR = 1;

                    // Primeiro, renumerar respostas do checklist
                    for (const resp of todasRespostas) {
                        const itemResp = todosItens.find(it => it.id === resp.item_checklist_id);
                        
                        // Verificar se tem texto configurado para a resposta
                        let temTextoConstatacao = false;
                        if (resp.resposta === 'SIM' && itemResp?.texto_constatacao_sim?.trim()) {
                            temTextoConstatacao = true;
                        } else if (resp.resposta === 'NAO' && itemResp?.texto_constatacao_nao?.trim()) {
                            temTextoConstatacao = true;
                        }
                        
                        // Só numerar se for SIM ou NÃO E tiver texto configurado
                        if ((resp.resposta === 'SIM' || resp.resposta === 'NAO') && temTextoConstatacao) {
                            const numeroConstatacao = `C${contadorC}`;
                            
                            // Atualizar número da constatação
                            await base44.entities.RespostaChecklist.update(resp.id, {
                                numero_constatacao: numeroConstatacao
                            });

                            contadorC++;

                            // Se gera NC e resposta é NÃO, criar NC e Determinação
                            if (itemResp?.gera_nc && resp.resposta === 'NAO') {
                                const numeroNC = `NC${contadorNC}`;
                                const numeroDet = `D${contadorD}`;
                                const numeroRec = `R${contadorR}`;

                                // Criar NC com texto tratado
                                let ncDescricao = itemResp.texto_nc;
                                if (!ncDescricao || !ncDescricao.trim()) {
                                    ncDescricao = `A constatação ${numeroConstatacao} não cumpre o disposto no ${itemResp.artigo_portaria || 'artigo não especificado'}.`;
                                }

                                const nc = await base44.entities.NaoConformidade.create({
                                    unidade_fiscalizada_id: unidadeId,
                                    numero_nc: numeroNC,
                                    artigo_portaria: itemResp.artigo_portaria || '',
                                    descricao: ncDescricao,
                                    fotos: []
                                });

                                // Criar Determinação
                                const textoDet = itemResp.texto_determinacao || 'regularizar a situação identificada';
                                const textoFinalDet = `Para sanar a ${numeroNC} ${textoDet}. Prazo: 30 dias.`;
                                await base44.entities.Determinacao.create({
                                    unidade_fiscalizada_id: unidadeId,
                                    nao_conformidade_id: nc.id,
                                    numero_determinacao: numeroDet,
                                    descricao: textoFinalDet || '',
                                    prazo_dias: 30,
                                    status: 'pendente'
                                });

                                // Criar Recomendação se houver texto
                                if (itemResp.texto_recomendacao) {
                                    await base44.entities.Recomendacao.create({
                                        unidade_fiscalizada_id: unidadeId,
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

                    // Depois, renumerar constatações manuais
                    for (const constManual of constatacoesManuaisParaRenumerar) {
                        const numeroConstatacao = `C${contadorC}`;
                        await base44.entities.ConstatacaoManual.update(constManual.id, {
                            numero_constatacao: numeroConstatacao
                        });
                        contadorC++;
                    }

                    // Renumerar recomendações manuais (se existirem)
                    const recsManuais = await base44.entities.Recomendacao.filter({
                        unidade_fiscalizada_id: unidadeId,
                        origem: 'manual'
                    }, 'created_date', 100);
                    
                    for (const recManual of recsManuais) {
                        await base44.entities.Recomendacao.update(recManual.id, {
                            numero_recomendacao: `R${contadorR}`
                        });
                        contadorR++;
                    }

                    // Atualizar contadores locais
                    setContadores({
                        C: contadorC,
                        NC: contadorNC,
                        D: contadorD,
                        R: contadorR
                    });

                    // Forçar recarregamento dos dados após renumeração
                    await queryClient.invalidateQueries({ queryKey: ['respostas', unidadeId] });
                    await queryClient.invalidateQueries({ queryKey: ['constatacoes-manuais', unidadeId] });
                    await queryClient.invalidateQueries({ queryKey: ['ncs', unidadeId] });
                    await queryClient.invalidateQueries({ queryKey: ['determinacoes', unidadeId] });
                    await queryClient.invalidateQueries({ queryKey: ['recomendacoes', unidadeId] });
                }
            } else {
                // Buscar contagem REAL do banco para garantir numeração correta
                const respostasExistentesAgora = await base44.entities.RespostaChecklist.filter({
                    unidade_fiscalizada_id: unidadeId
                }, 'created_date', 200);
                
                const constatacoesManuaisExistentesAgora = await base44.entities.ConstatacaoManual.filter({
                    unidade_fiscalizada_id: unidadeId
                }, 'ordem', 100);
                
                const ncsExistentesAgora = await base44.entities.NaoConformidade.filter({
                    unidade_fiscalizada_id: unidadeId
                });
                
                const determinacoesExistentesAgora = await base44.entities.Determinacao.filter({
                    unidade_fiscalizada_id: unidadeId
                });

                // Contar apenas respostas SIM/NÃO que tenham texto configurado + constatações manuais
                const contadorC = respostasExistentesAgora.filter(r => {
                    if (r.resposta !== 'SIM' && r.resposta !== 'NAO') return false;
                    // Verificar se tem texto na pergunta (que é onde salvamos o texto da constatação)
                    return r.pergunta && r.pergunta.trim();
                }).length + constatacoesManuaisExistentesAgora.length + 1;
                
                const contadorNC = ncsExistentesAgora.length + 1;
                const contadorD = determinacoesExistentesAgora.length + 1;

                // Definir texto da constatação baseado na resposta
                let textoConstatacao = data.resposta === 'SIM' 
                    ? item.texto_constatacao_sim 
                    : data.resposta === 'NAO' 
                        ? item.texto_constatacao_nao 
                        : null;
                
                // Verificar se tem texto configurado
                const temTextoConstatacao = textoConstatacao && textoConstatacao.trim();
                
                // Adicionar ';' ao final se existir texto
                if (temTextoConstatacao && !textoConstatacao.trim().endsWith(';')) {
                    textoConstatacao = textoConstatacao.trim() + ';';
                } else if (!temTextoConstatacao) {
                    textoConstatacao = null;
                }

                // Só gerar número de constatação se tiver texto configurado
                const numeroConstatacao = temTextoConstatacao ? `C${contadorC}` : null;

                if (item.gera_nc && data.resposta === 'NAO') {
                    const numeroNC = `NC${contadorNC}`;
                    const numeroDeterminacao = `D${contadorD}`;
                    const numeroRecomendacao = `R${contadorNC}`; // Usa mesmo contador que NC
                    
                    // Usar backend function para criar Resposta + NC + D/R atomicamente
                    await base44.functions.invoke('criarNcComDeterminacao', {
                        unidade_fiscalizada_id: unidadeId,
                        item_checklist_id: itemId,
                        pergunta: textoConstatacao,
                        numero_constatacao: numeroConstatacao,
                        numero_nc: numeroNC,
                        numero_determinacao: numeroDeterminacao,
                        numero_recomendacao: numeroRecomendacao,
                        artigo_portaria: item.artigo_portaria,
                        texto_nc: item.texto_nc,
                        texto_determinacao: item.texto_determinacao,
                        texto_recomendacao: item.texto_recomendacao,
                        prazo_dias: item.prazo_dias || 30
                    });
                } else {
                    // Criar apenas a resposta se não gerar NC
                    await base44.entities.RespostaChecklist.create({
                        unidade_fiscalizada_id: unidadeId,
                        item_checklist_id: itemId,
                        pergunta: textoConstatacao,
                        resposta: data.resposta,
                        gera_nc: item.gera_nc,
                        numero_constatacao: numeroConstatacao,
                        observacao: data.observacao
                    });
                }
            }
            
            return { itemId, data };
        },
        onSuccess: ({ itemId, data }) => {
            // Atualizar estado local imediatamente para feedback instantâneo
            const respostaAtual = respostasExistentes.find(r => r.item_checklist_id === itemId);
            if (respostaAtual) {
                setRespostas(prev => ({
                    ...prev,
                    [itemId]: { 
                        ...respostaAtual, 
                        resposta: data.resposta, 
                        observacao: data.observacao,
                        pergunta: data.pergunta
                    }
                }));
            }
            
            // Invalidar queries - React Query faz refetch automaticamente
            queryClient.invalidateQueries({ queryKey: ['respostas', unidadeId] });
            queryClient.invalidateQueries({ queryKey: ['ncs', unidadeId] });
            queryClient.invalidateQueries({ queryKey: ['determinacoes', unidadeId] });
            queryClient.invalidateQueries({ queryKey: ['recomendacoes', unidadeId] });
        },
        onError: (err) => {
            alert(err.message);
        }
    });

     const salvarFotosMutation = useMutation({
         mutationFn: async (fotosData) => {
              // Salvar objetos completos com url e legenda
              const fotosCompletas = fotosData.map(f => {
                  if (typeof f === 'string') {
                      return { url: f, legenda: '' };
                  }
                  return { url: f.url, legenda: f.legenda || '' };
              });
              await base44.entities.UnidadeFiscalizada.update(unidadeId, {
                  fotos_unidade: fotosCompletas
              });
          },
          onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: ['unidade', unidadeId] });
              setFotosParaSalvar([]);
          }
      });

    const adicionarRecomendacaoMutation = useMutation({
        mutationFn: async (texto) => {
            if (fiscalizacao?.status === 'finalizada' && !modoEdicao) {
                throw new Error('Não é possível modificar uma fiscalização finalizada');
            }
            // Recarregar recomendações atuais da unidade para calcular o próximo número
            const recsUnidade = await base44.entities.Recomendacao.filter({ 
                unidade_fiscalizada_id: unidadeId 
            });

            // Calcular próximo número baseado em recomendações anteriores + recomendações desta unidade
            const proximoNumero = contadores.R + recsUnidade.length + 1;
            const numeroRecomendacao = `R${proximoNumero}`;

            await base44.entities.Recomendacao.create({
                unidade_fiscalizada_id: unidadeId,
                numero_recomendacao: numeroRecomendacao,
                descricao: texto,
                origem: 'manual'
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recomendacoes', unidadeId] });
            setNovaRecomendacao('');
            setShowAddRecomendacao(false);
        }
    });

    const adicionarConstatacaoManualMutation = useMutation({
        mutationFn: async (data) => {
            if (fiscalizacao?.status === 'finalizada' && !modoEdicao) {
                throw new Error('Não é possível modificar uma fiscalização finalizada');
            }

            // Se for edição, atualizar
            if (constatacaoParaEditar) {
                let descricaoFinal = data.descricao;
                if (descricaoFinal && !descricaoFinal.trim().endsWith(';')) {
                    descricaoFinal = descricaoFinal.trim() + ';';
                }

                await base44.entities.ConstatacaoManual.update(constatacaoParaEditar.id, {
                    descricao: descricaoFinal,
                    gera_nc: data.gera_nc
                });

                return { constatacao: { ...constatacaoParaEditar, descricao: descricaoFinal, gera_nc: data.gera_nc }, numeroConstatacao: constatacaoParaEditar.numero_constatacao };
            }

            // Se for nova constatação, criar
            const respostasComConstatacao = await base44.entities.RespostaChecklist.filter({
                unidade_fiscalizada_id: unidadeId
            }, 'created_date', 200);
            
            const constatacoesManuaisExistentes = await base44.entities.ConstatacaoManual.filter({
                unidade_fiscalizada_id: unidadeId
            }, 'ordem', 100);

            const totalConstatacoes = respostasComConstatacao.filter(r => 
                r.pergunta && r.pergunta.trim()
            ).length + constatacoesManuaisExistentes.length;

            const numeroConstatacao = `C${totalConstatacoes + 1}`;

            let descricaoFinal = data.descricao;
            if (descricaoFinal && !descricaoFinal.trim().endsWith(';')) {
                descricaoFinal = descricaoFinal.trim() + ';';
            }

            const constatacao = await base44.entities.ConstatacaoManual.create({
                unidade_fiscalizada_id: unidadeId,
                numero_constatacao: numeroConstatacao,
                descricao: descricaoFinal,
                gera_nc: data.gera_nc,
                ordem: Date.now()
            });

            const contadoresAtualizados = await calcularProximaNumeracao(unidade.fiscalizacao_id, unidadeId, base44);
            setContadores(contadoresAtualizados);

            return { constatacao, novosContadores: contadoresAtualizados, numeroConstatacao };
        },
        onSuccess: async ({ constatacao, novosContadores, numeroConstatacao }) => {
            queryClient.invalidateQueries({ queryKey: ['constatacoes-manuais', unidadeId] });
            setShowAddConstatacao(false);
            setConstatacaoParaEditar(null);

            // Se for edição, não abrir modal de NC
            if (constatacaoParaEditar) {
                return;
            }

            // Se gera NC e é nova constatação, abrir modal de edição
            if (constatacao.gera_nc) {
                // Buscar contagem REAL de NCs e Determinações do banco
                const ncsExistentesAgora = await base44.entities.NaoConformidade.filter({
                    unidade_fiscalizada_id: unidadeId
                });
                
                const determinacoesExistentesAgora = await base44.entities.Determinacao.filter({
                    unidade_fiscalizada_id: unidadeId
                });

                const recomendacoesExistentesAgora = await base44.entities.Recomendacao.filter({
                    unidade_fiscalizada_id: unidadeId
                });

                const numeroNC = `NC${ncsExistentesAgora.length + 1}`;
                const numeroDeterminacao = `D${determinacoesExistentesAgora.length + 1}`;
                const numeroRecomendacao = `R${recomendacoesExistentesAgora.length + 1}`;
                
                setConstatacaoParaNC(constatacao);
                setNumerosParaNC({
                    numeroNC,
                    numeroDeterminacao,
                    numeroRecomendacao,
                    numeroConstatacao
                });
                setShowEditarNC(true);
            }
        },
        onError: (err) => {
            alert(err.message);
        }
    });

    const excluirConstatacaoManualMutation = useMutation({
        mutationFn: async (constatacaoId) => {
            if (fiscalizacao?.status === 'finalizada' && !modoEdicao) {
                throw new Error('Não é possível modificar uma fiscalização finalizada');
            }

            const response = await base44.functions.invoke('deleteConstatacaoManualComCascade', {
                constatacao_manual_id: constatacaoId,
                unidade_fiscalizada_id: unidadeId
            });

            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['constatacoes-manuais', unidadeId] });
            queryClient.invalidateQueries({ queryKey: ['respostas', unidadeId] });
            queryClient.invalidateQueries({ queryKey: ['ncs', unidadeId] });
            queryClient.invalidateQueries({ queryKey: ['determinacoes', unidadeId] });
            queryClient.invalidateQueries({ queryKey: ['recomendacoes', unidadeId] });
            setShowConfirmaExclusao(false);
            setConstatacaoParaExcluir(null);
        },
        onError: (err) => {
            alert(err.message);
        }
    });

    const salvarNCMutation = useMutation({
        mutationFn: async (data) => {
            if (!constatacaoParaNC || !numerosParaNC) return;

            // Atualizar o texto da constatação manual
            let textoConstatacaoFinal = data.texto_constatacao;
            if (textoConstatacaoFinal && !textoConstatacaoFinal.trim().endsWith(';')) {
                textoConstatacaoFinal = textoConstatacaoFinal.trim() + ';';
            }
            await base44.entities.ConstatacaoManual.update(constatacaoParaNC.id, {
                descricao: textoConstatacaoFinal
            });

            let nc;
            // Se tem NC existente, atualizar; senão criar
            if (data.nc_id) {
                await base44.entities.NaoConformidade.update(data.nc_id, {
                    artigo_portaria: data.artigo_portaria,
                    descricao: data.texto_nc
                });
                nc = { id: data.nc_id };
            } else {
                nc = await base44.entities.NaoConformidade.create({
                    unidade_fiscalizada_id: unidadeId,
                    numero_nc: numerosParaNC.numeroNC,
                    artigo_portaria: data.artigo_portaria,
                    descricao: data.texto_nc,
                    fotos: []
                });
            }

            let incrementoD = 0;
            let incrementoR = 0;

            // Determinação: atualizar, criar ou deletar
            if (data.gera_determinacao && data.texto_determinacao) {
                const textoFinalDeterminacao = `Para sanar a ${numerosParaNC.numeroNC} ${data.texto_determinacao}. Prazo: 30 dias.`;
                
                if (data.determinacao_id) {
                    await base44.entities.Determinacao.update(data.determinacao_id, {
                        descricao: textoFinalDeterminacao
                    });
                } else {
                    await base44.entities.Determinacao.create({
                        unidade_fiscalizada_id: unidadeId,
                        nao_conformidade_id: nc.id,
                        numero_determinacao: numerosParaNC.numeroDeterminacao,
                        descricao: textoFinalDeterminacao,
                        prazo_dias: 30,
                        status: 'pendente'
                    });
                    incrementoD = 1;
                }
            } else if (data.determinacao_id && !data.gera_determinacao) {
                // Se tinha determinação mas agora não gera mais, deletar
                await base44.entities.Determinacao.delete(data.determinacao_id);
            }

            // Recomendação: atualizar, criar ou deletar
            if (data.gera_recomendacao && data.texto_recomendacao) {
                if (data.recomendacao_id) {
                    await base44.entities.Recomendacao.update(data.recomendacao_id, {
                        descricao: data.texto_recomendacao
                    });
                } else {
                    await base44.entities.Recomendacao.create({
                        unidade_fiscalizada_id: unidadeId,
                        numero_recomendacao: numerosParaNC.numeroRecomendacao,
                        descricao: data.texto_recomendacao,
                        origem: 'manual'
                    });
                    incrementoR = 1;
                }
            } else if (data.recomendacao_id && !data.gera_recomendacao) {
                // Se tinha recomendação mas agora não gera mais, deletar
                await base44.entities.Recomendacao.delete(data.recomendacao_id);
            }

            // Incrementar contadores apenas se criou novos
            if (incrementoD > 0 || incrementoR > 0) {
                setContadores(prev => ({
                    ...prev,
                    NC: data.nc_id ? prev.NC : prev.NC + 1,
                    D: prev.D + incrementoD,
                    R: prev.R + incrementoR
                }));
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['constatacoes-manuais', unidadeId] });
            queryClient.invalidateQueries({ queryKey: ['ncs', unidadeId] });
            queryClient.invalidateQueries({ queryKey: ['determinacoes', unidadeId] });
            queryClient.invalidateQueries({ queryKey: ['recomendacoes', unidadeId] });
            setShowEditarNC(false);
            setConstatacaoParaNC(null);
            setNumerosParaNC(null);
        },
        onError: (err) => {
            alert(err.message);
        }
    });

    const finalizarUnidadeMutation = useMutation({
    mutationFn: async () => {
         // Recarregar dados do banco para contagens precisas
         const respostasAtuais = await base44.entities.RespostaChecklist.filter({ 
             unidade_fiscalizada_id: unidadeId 
         });
         const ncsAtuais = await base44.entities.NaoConformidade.filter({ 
             unidade_fiscalizada_id: unidadeId 
         });

         const totalConstatacoes = respostasAtuais.filter(r => 
             r.resposta === 'SIM' || r.resposta === 'NAO'
         ).length;

         // Salvar objetos completos com url e legenda
         const fotosCompletas = fotos.map(f => {
             if (typeof f === 'string') {
                 return { url: f, legenda: '' };
             }
             return { url: f.url, legenda: f.legenda || '' };
         });
         await base44.entities.UnidadeFiscalizada.update(unidadeId, {
             status: 'finalizada',
             fotos_unidade: fotosCompletas,
             total_constatacoes: totalConstatacoes,
             total_ncs: ncsAtuais.length
         });
         },
        onSuccess: () => {
             queryClient.invalidateQueries({ queryKey: ['unidades-fiscalizacao'] });
             navigate(createPageUrl('ExecutarFiscalizacao') + `?id=${unidade.fiscalizacao_id}`);
         },
         onError: (err) => {
             alert(err.message);
         }
     });

    const salvarAlteracoesMutation = useMutation({
        mutationFn: async () => {
            // Recarregar dados do banco para contagens precisas
            const respostasAtuais = await base44.entities.RespostaChecklist.filter({ 
                unidade_fiscalizada_id: unidadeId 
            });
            const ncsAtuais = await base44.entities.NaoConformidade.filter({ 
                unidade_fiscalizada_id: unidadeId 
            });

            const totalConstatacoes = respostasAtuais.filter(r => 
                r.resposta === 'SIM' || r.resposta === 'NAO'
            ).length;

            // Salvar objetos completos com url e legenda
            const fotosCompletas = fotos.map(f => {
                if (typeof f === 'string') {
                    return { url: f, legenda: '' };
                }
                return { url: f.url, legenda: f.legenda || '' };
            });
            
            await base44.entities.UnidadeFiscalizada.update(unidadeId, {
                fotos_unidade: fotosCompletas,
                total_constatacoes: totalConstatacoes,
                total_ncs: ncsAtuais.length
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['unidades-fiscalizacao'] });
            queryClient.invalidateQueries({ queryKey: ['unidade', unidadeId] });
            navigate(createPageUrl('ExecutarFiscalizacao') + `?id=${unidade.fiscalizacao_id}`);
        },
        onError: (err) => {
            alert(err.message);
        }
    });

    const handleFinalizarClick = () => {
        if (fotos.length === 0) {
            setShowConfirmaSemFotos(true);
        } else {
            finalizarUnidadeMutation.mutate();
        }
    };

    const handleResponder = (itemId, data) => {
        salvarRespostaMutation.mutate({ itemId, data });
    };

    const handleAddFoto = async (fotoData) => {
        setFotos(prev => [...prev, fotoData]);
        setFotosParaSalvar(prev => [...prev, fotoData]);
    };

    const handleRemoveFoto = async (index) => {
        const novasFotos = fotos.filter((_, i) => i !== index);
        setFotos(novasFotos);
        await salvarFotosMutation.mutateAsync(novasFotos);
    };

    const handleUpdateLegenda = async (index, legenda) => {
        const novasFotos = [...fotos];
        novasFotos[index] = { ...novasFotos[index], legenda };
        setFotos(novasFotos);
        await salvarFotosMutation.mutateAsync(novasFotos);
    };

    // Debounce para salvar fotos após 2 segundos sem adicionar mais
    React.useEffect(() => {
        if (fotosParaSalvar.length === 0) return;

        const timer = setTimeout(() => {
            salvarFotosMutation.mutate(fotos);
        }, 2000);

        return () => clearTimeout(timer);
    }, [fotosParaSalvar]);

    if (loadingUnidade) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    const totalRespondidas = Object.keys(respostas).length;
    const totalItens = Array.isArray(itensChecklist) ? itensChecklist.length : 0;
    const progresso = totalItens > 0 ? Math.round((totalRespondidas / totalItens) * 100) : 0;

    return (
        <div className="min-h-screen bg-gray-100 pb-24">
            
            {/* Header */}
            <div className="bg-blue-900 text-white sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-4 py-3">
                    <div className="flex items-center gap-3">
                        <Link to={createPageUrl('ExecutarFiscalizacao') + `?id=${unidade?.fiscalizacao_id}`}>
                            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div className="flex-1">
                            <h1 className="font-bold">{unidade?.tipo_unidade_nome}</h1>
                            {unidade?.nome_unidade && (
                                <p className="text-blue-200 text-sm">{unidade.nome_unidade}</p>
                            )}
                        </div>
                    </div>
                    
                    {/* Progress */}
                    <div className="mt-3">
                        <div className="flex justify-between text-xs text-blue-200 mb-1">
                            <span>Checklist: {totalRespondidas}/{totalItens}</span>
                            <span>{progresso}%</span>
                        </div>
                        <div className="h-2 bg-blue-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-green-400 transition-all"
                                style={{ width: `${progresso}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="max-w-4xl mx-auto px-4 py-4">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="w-full grid grid-cols-5">
                        <TabsTrigger value="checklist" className="text-xs">
                            <ClipboardCheck className="h-4 w-4 mr-1" />
                            Checklist
                        </TabsTrigger>
                        <TabsTrigger value="constatacoes" className="text-xs">
                            <FileText className="h-4 w-4 mr-1" />
                            Const
                        </TabsTrigger>
                        <TabsTrigger value="fotos" className="text-xs">
                            <Camera className="h-4 w-4 mr-1" />
                            Fotos
                            {fotos.length === 0 && <span className="ml-1 text-red-500">!</span>}
                        </TabsTrigger>
                        <TabsTrigger value="ncs" className="text-xs">
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            NC/D ({ncsExistentes.length})
                        </TabsTrigger>
                        <TabsTrigger value="recomendacoes" className="text-xs">
                            <FileText className="h-4 w-4 mr-1" />
                            Rec ({recomendacoesExistentes.length})
                        </TabsTrigger>
                    </TabsList>

                    {/* Constatações Tab */}
                    <TabsContent value="constatacoes" className="mt-4 space-y-4">
                        {(fiscalizacao?.status !== 'finalizada' || modoEdicao) && (
                            <Button onClick={() => setShowAddConstatacao(true)} className="w-full">
                                <Plus className="h-4 w-4 mr-2" />
                                Adicionar Constatação Manual
                            </Button>
                        )}

                        {/* Constatações Manuais (primeiro) */}
                        {constatacoesManuais.map(constatacao => (
                            <Card key={constatacao.id} className="border-blue-200 bg-blue-50">
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-3">
                                        <Badge className="bg-blue-600">{constatacao.numero_constatacao}</Badge>
                                        <div className="flex-1">
                                            <p className="text-sm">{constatacao.descricao}</p>
                                            {constatacao.gera_nc && (
                                                <Badge variant="outline" className="mt-2 text-xs">
                                                    Gera NC
                                                </Badge>
                                            )}
                                        </div>
                                        {(fiscalizacao?.status !== 'finalizada' || modoEdicao) && (
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={async () => {
                                                        setConstatacaoParaEditar(constatacao);
                                                        
                                                        // Se gera NC, buscar dados relacionados para permitir edição completa
                                                        if (constatacao.gera_nc) {
                                                            // Buscar NC associada
                                                            const ncsAssociadas = await base44.entities.NaoConformidade.filter({
                                                                unidade_fiscalizada_id: unidadeId
                                                            });
                                                            const ncAssociada = ncsAssociadas.find(nc => 
                                                                nc.descricao && nc.descricao.includes(constatacao.numero_constatacao)
                                                            );

                                                            if (ncAssociada) {
                                                                // Buscar Determinação associada
                                                                const detsAssociadas = await base44.entities.Determinacao.filter({
                                                                    nao_conformidade_id: ncAssociada.id
                                                                });
                                                                const detAssociada = detsAssociadas[0] || null;

                                                                // Buscar Recomendações manuais (origem: manual) criadas após esta NC
                                                                const recsAssociadas = await base44.entities.Recomendacao.filter({
                                                                    unidade_fiscalizada_id: unidadeId,
                                                                    origem: 'manual'
                                                                });
                                                                // Associar recomendação se existir na mesma sequência
                                                                const recAssociada = recsAssociadas.find(rec => {
                                                                    const numNC = parseInt(ncAssociada.numero_nc.replace('NC', ''));
                                                                    const numRec = parseInt(rec.numero_recomendacao.replace('R', ''));
                                                                    return numRec === numNC;
                                                                }) || null;

                                                                // Abrir modal de NC com dados existentes
                                                                setConstatacaoParaNC(constatacao);
                                                                setNumerosParaNC({
                                                                    numeroNC: ncAssociada.numero_nc,
                                                                    numeroDeterminacao: detAssociada?.numero_determinacao || `D${determinacoesExistentes.length + 1}`,
                                                                    numeroRecomendacao: recAssociada?.numero_recomendacao || `R${recomendacoesExistentes.length + 1}`,
                                                                    numeroConstatacao: constatacao.numero_constatacao,
                                                                    ncExistente: ncAssociada,
                                                                    determinacaoExistente: detAssociada,
                                                                    recomendacaoExistente: recAssociada
                                                                });
                                                                setShowEditarNC(true);
                                                            } else {
                                                                // Se não tem NC criada ainda, abrir form de constatação
                                                                setShowAddConstatacao(true);
                                                            }
                                                        } else {
                                                            // Se não gera NC, apenas abrir form de constatação
                                                            setShowAddConstatacao(true);
                                                        }
                                                    }}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        setConstatacaoParaExcluir(constatacao);
                                                        setShowConfirmaExclusao(true);
                                                    }}
                                                    className="text-red-600 hover:text-red-700"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}

                        {/* Constatações do Checklist (depois) */}
                        {respostasExistentes
                            .filter(r => (r.resposta === 'SIM' || r.resposta === 'NAO') && r.pergunta && r.pergunta.trim())
                            .map(resp => (
                                <Card key={resp.id}>
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-3">
                                            <Badge variant="secondary">{resp.numero_constatacao}</Badge>
                                            <div className="flex-1">
                                                <p className="text-sm">{resp.pergunta}</p>
                                                {resp.gera_nc && resp.resposta === 'NAO' && (
                                                    <Badge variant="outline" className="mt-2 text-xs text-red-600 border-red-300">
                                                        Gera NC
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                        {constatacoesManuais.length === 0 && respostasExistentes.filter(r => r.resposta === 'SIM' || r.resposta === 'NAO').length === 0 && (
                            <p className="text-center text-gray-500 text-sm py-4">
                                Nenhuma constatação registrada ainda.
                            </p>
                        )}
                    </TabsContent>

                    {/* Checklist Tab */}
                    <TabsContent value="checklist" className="mt-4 space-y-3">
                        {!Array.isArray(itensChecklist) || itensChecklist.length === 0 ? (
                            <Card>
                                <CardContent className="p-6 text-center text-gray-500">
                                    <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                    <p>Nenhum item de checklist configurado para este tipo de unidade.</p>
                                    <Link to={createPageUrl('Checklists') + `?tipo=${unidade?.tipo_unidade_id}`}>
                                        <Button variant="link">Configurar checklist</Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        ) : (
                            itensChecklist.map((item, index) => {
                                // Verificar se é o primeiro item OU se o item anterior já foi respondido
                                const itemAnterior = index > 0 ? itensChecklist[index - 1] : null;
                                const itemAnteriorRespondido = !itemAnterior || respostas[itemAnterior.id]?.resposta;
                                const liberado = itemAnteriorRespondido && !salvarRespostaMutation.isPending;
                                
                                return (
                                    <ChecklistItem
                                        key={item.id}
                                        item={item}
                                        resposta={respostas[item.id]}
                                        onResponder={(data) => handleResponder(item.id, data)}
                                        numero={index + 1}
                                        desabilitado={(unidade?.status === 'finalizada' && !modoEdicao) || !liberado || salvarRespostaMutation.isPending}
                                    />
                                );
                            })
                        )}
                    </TabsContent>

                    {/* Fotos Tab */}
                    <TabsContent value="fotos" className="mt-4">
                    <PhotoGrid
                    fotos={fotos}
                    minFotos={2}
                    onAddFoto={handleAddFoto}
                    onRemoveFoto={handleRemoveFoto}
                    onUpdateLegenda={handleUpdateLegenda}
                    titulo="Fotos da Unidade"
                    fiscalizacaoId={unidade?.fiscalizacao_id}
                    unidadeId={unidadeId}
                    />
                    {unidade?.status === 'finalizada' && (fotos.length > 0 || fotosParaSalvar.length > 0) && (
                    <Button
                    className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
                    onClick={() => salvarFotosMutation.mutate(fotos)}
                    disabled={salvarFotosMutation.isPending}
                    >
                    {salvarFotosMutation.isPending ? (
                     <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                     <Save className="h-4 w-4 mr-2" />
                    )}
                    Salvar Alterações
                    </Button>
                    )}
                    </TabsContent>

                    {/* NCs Tab */}
                    <TabsContent value="ncs" className="mt-4 space-y-4">
                        {ncsExistentes.length === 0 ? (
                            <Card>
                                <CardContent className="p-6 text-center text-gray-500">
                                    <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-50" />
                                    <p>Nenhuma Não Conformidade identificada.</p>
                                    <p className="text-xs mt-2">NCs são geradas automaticamente ao responder "NÃO" em itens do checklist.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            ncsExistentes.map((nc, index) => (
                                <Card key={nc.id} className="border-red-200 bg-red-50">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-lg flex items-center gap-2 text-red-700">
                                            <AlertTriangle className="h-5 w-5" />
                                            {nc.numero_nc}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <p className="text-sm">{nc.descricao}</p>
                                        {nc.artigo_portaria && (
                                            <Badge variant="outline">{nc.artigo_portaria}</Badge>
                                        )}

                                        {/* Determinação relacionada */}
                                        {determinacoesExistentes.filter(d => d.nao_conformidade_id === nc.id).map(det => (
                                            <div key={det.id} className="bg-white p-3 rounded border">
                                                <p className="text-xs font-medium text-blue-700">{det.numero_determinacao}</p>
                                                <p className="text-sm">{det.descricao}</p>
                                                <p className="text-xs text-gray-500 mt-1">Prazo: {det.prazo_dias} dias</p>
                                            </div>
                                        ))}


                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </TabsContent>

                    {/* Recomendações Tab */}
                    <TabsContent value="recomendacoes" className="mt-4 space-y-4">
                        {(fiscalizacao?.status !== 'finalizada' || modoEdicao) && (
                            <Button onClick={() => setShowAddRecomendacao(true)} className="w-full">
                                <Plus className="h-4 w-4 mr-2" />
                                Adicionar Recomendação
                            </Button>
                        )}

                        {recomendacoesExistentes.map(rec => (
                            <Card key={rec.id}>
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-3">
                                        <Badge variant="secondary">{rec.numero_recomendacao}</Badge>
                                        <p className="text-sm flex-1">{rec.descricao}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}

                        {recomendacoesExistentes.length === 0 && (
                            <p className="text-center text-gray-500 text-sm py-4">
                                Nenhuma recomendação adicionada.
                            </p>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            {/* Bottom Bar */}
            {unidade?.status !== 'finalizada' && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-50">
                    <div className="max-w-4xl mx-auto">
                        <Button 
                            className="w-full h-12 bg-green-600 hover:bg-green-700"
                            onClick={handleFinalizarClick}
                            disabled={finalizarUnidadeMutation.isPending}
                        >
                            {finalizarUnidadeMutation.isPending ? (
                                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            ) : (
                                <Save className="h-5 w-5 mr-2" />
                            )}
                            Finalizar Vistoria
                        </Button>
                    </div>
                </div>
            )}

            {/* Bottom Bar - Modo Edição */}
            {unidade?.status === 'finalizada' && modoEdicao && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-50">
                    <div className="max-w-4xl mx-auto">
                        <Button 
                            className="w-full h-12 bg-blue-600 hover:bg-blue-700"
                            onClick={() => salvarAlteracoesMutation.mutate()}
                            disabled={salvarAlteracoesMutation.isPending}
                        >
                            {salvarAlteracoesMutation.isPending ? (
                                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            ) : (
                                <Save className="h-5 w-5 mr-2" />
                            )}
                            Salvar Alterações
                        </Button>
                    </div>
                </div>
            )}

            {/* Dialog Recomendação */}
            <Dialog open={showAddRecomendacao} onOpenChange={setShowAddRecomendacao}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nova Recomendação</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Textarea
                            placeholder="Descreva a recomendação..."
                            value={novaRecomendacao}
                            onChange={(e) => setNovaRecomendacao(e.target.value)}
                            rows={4}
                        />
                        <div className="flex gap-2">
                            <Button 
                                className="flex-1"
                                onClick={() => adicionarRecomendacaoMutation.mutate(novaRecomendacao)}
                                disabled={!novaRecomendacao.trim() || adicionarRecomendacaoMutation.isPending}
                            >
                                Salvar
                            </Button>
                            <Button variant="outline" onClick={() => setShowAddRecomendacao(false)}>
                                Cancelar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog Constatação Manual */}
            <ConstatacaoManualForm
                open={showAddConstatacao}
                onOpenChange={(open) => {
                    setShowAddConstatacao(open);
                    if (!open) setConstatacaoParaEditar(null);
                }}
                onSave={(data) => adicionarConstatacaoManualMutation.mutate(data)}
                isSaving={adicionarConstatacaoManualMutation.isPending}
                constatacaoParaEditar={constatacaoParaEditar}
            />

            {/* Dialog Editar NC */}
            <EditarNCModal
                open={showEditarNC}
                onOpenChange={setShowEditarNC}
                onSave={(data) => salvarNCMutation.mutate(data)}
                isSaving={salvarNCMutation.isPending}
                numeroNC={numerosParaNC?.numeroNC}
                numeroDeterminacao={numerosParaNC?.numeroDeterminacao}
                numeroRecomendacao={numerosParaNC?.numeroRecomendacao}
                numeroConstatacao={numerosParaNC?.numeroConstatacao}
                constatacaoTexto={constatacaoParaNC?.descricao}
                ncExistente={numerosParaNC?.ncExistente}
                determinacaoExistente={numerosParaNC?.determinacaoExistente}
                recomendacaoExistente={numerosParaNC?.recomendacaoExistente}
            />

            {/* Dialog Confirmação Exclusão Constatação */}
            <Dialog open={showConfirmaExclusao} onOpenChange={setShowConfirmaExclusao}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-700">
                            <AlertCircle className="h-5 w-5" />
                            Excluir Constatação
                        </DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja excluir a constatação <strong>{constatacaoParaExcluir?.numero_constatacao}</strong>?
                            {constatacaoParaExcluir?.gera_nc && (
                                <span className="block mt-2 text-yellow-700 font-medium">
                                    Esta ação também excluirá as Não Conformidades, Determinações e Recomendações associadas.
                                </span>
                            )}
                            <span className="block mt-2">
                                Todas as constatações seguintes serão renumeradas automaticamente.
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-2">
                        <Button 
                            className="flex-1 bg-red-600 hover:bg-red-700"
                            onClick={() => excluirConstatacaoManualMutation.mutate(constatacaoParaExcluir?.id)}
                            disabled={excluirConstatacaoManualMutation.isPending}
                        >
                            {excluirConstatacaoManualMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            Sim, Excluir
                        </Button>
                        <Button variant="outline" onClick={() => setShowConfirmaExclusao(false)}>
                            Cancelar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog Confirmação Sem Fotos */}
            <Dialog open={showConfirmaSemFotos} onOpenChange={setShowConfirmaSemFotos}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-yellow-700">
                            <AlertCircle className="h-5 w-5" />
                            Nenhuma Foto Registrada
                        </DialogTitle>
                        <DialogDescription>
                            Esta unidade será finalizada sem nenhuma foto. Tem certeza que deseja continuar?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-2">
                        <Button 
                            className="flex-1 bg-yellow-600 hover:bg-yellow-700"
                            onClick={() => {
                                setShowConfirmaSemFotos(false);
                                finalizarUnidadeMutation.mutate();
                            }}
                            disabled={finalizarUnidadeMutation.isPending}
                        >
                            Sim, Finalizar
                        </Button>
                        <Button variant="outline" onClick={() => setShowConfirmaSemFotos(false)}>
                            Cancelar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            </div>
            );
            }