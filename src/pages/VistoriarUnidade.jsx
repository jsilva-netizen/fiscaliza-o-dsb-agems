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
    const [filaRespostas, setFilaRespostas] = useState([]);
    const [ultimaRespostaTimestamp, setUltimaRespostaTimestamp] = useState(0);

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
        staleTime: 300000,
        gcTime: 300000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false
    });

    const { data: ncsExistentes = [] } = useQuery({
        queryKey: ['ncs', unidadeId],
        queryFn: async () => {
            const result = await base44.entities.NaoConformidade.filter({ unidade_fiscalizada_id: unidadeId });
            return Array.isArray(result) ? result : [];
        },
        enabled: !!unidadeId,
        staleTime: 300000,
        gcTime: 300000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false
    });



    const { data: determinacoesExistentes = [] } = useQuery({
        queryKey: ['determinacoes', unidadeId],
        queryFn: async () => {
            const result = await base44.entities.Determinacao.filter({ unidade_fiscalizada_id: unidadeId });
            return Array.isArray(result) ? result : [];
        },
        enabled: !!unidadeId,
        staleTime: 300000,
        gcTime: 300000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false
    });

    const { data: recomendacoesExistentes = [] } = useQuery({
        queryKey: ['recomendacoes', unidadeId],
        queryFn: async () => {
            const result = await base44.entities.Recomendacao.filter({ unidade_fiscalizada_id: unidadeId });
            return Array.isArray(result) ? result : [];
        },
        enabled: !!unidadeId,
        staleTime: 300000,
        gcTime: 300000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false
    });

    const { data: constatacoesManuais = [] } = useQuery({
        queryKey: ['constatacoes-manuais', unidadeId],
        queryFn: async () => {
            const result = await base44.entities.ConstatacaoManual.filter({ unidade_fiscalizada_id: unidadeId }, 'ordem', 100);
            return Array.isArray(result) ? result : [];
        },
        enabled: !!unidadeId,
        staleTime: 300000,
        gcTime: 300000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false
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

    // Processar fila de respostas (criar RespostaChecklist + numerar constatações)
    useEffect(() => {
        if (filaRespostas.length === 0) return;

        const processarBatch = async () => {
            try {
                const batch = [...filaRespostas];
                setFilaRespostas([]);

                // Buscar dados atuais
                const respostasAtuais = await base44.entities.RespostaChecklist.filter({
                    unidade_fiscalizada_id: unidadeId
                }, 'created_date', 200);
                
                const constatacoesManuais = await base44.entities.ConstatacaoManual.filter({
                    unidade_fiscalizada_id: unidadeId
                }, 'ordem', 100);

                let contadorC = respostasAtuais.filter(r => {
                    if (r.resposta !== 'SIM' && r.resposta !== 'NAO') return false;
                    return r.pergunta && r.pergunta.trim();
                }).length + constatacoesManuais.length + 1;

                for (const { itemId, data } of batch) {
                    const item = itensChecklist.find(i => i.id === itemId);
                    if (!item) continue;

                    const respostaExistente = respostasAtuais.find(r => r.item_checklist_id === itemId);
                    
                    let textoConstatacao = data.resposta === 'SIM' 
                        ? item.texto_constatacao_sim 
                        : data.resposta === 'NAO' 
                            ? item.texto_constatacao_nao 
                            : null;
                    
                    const temTexto = textoConstatacao && textoConstatacao.trim();
                    if (temTexto && !textoConstatacao.trim().endsWith(';')) {
                        textoConstatacao = textoConstatacao.trim() + ';';
                    } else if (!temTexto) {
                        textoConstatacao = null;
                    }

                    const numeroConstatacao = temTexto ? `C${contadorC}` : null;
                    
                    if (respostaExistente?.id) {
                        await base44.entities.RespostaChecklist.update(respostaExistente.id, {
                            resposta: data.resposta,
                            observacao: data.observacao || '',
                            pergunta: textoConstatacao || '',
                            numero_constatacao: numeroConstatacao,
                            gera_nc: data.resposta === 'NAO' && item.gera_nc
                        });
                    } else {
                        await base44.entities.RespostaChecklist.create({
                            unidade_fiscalizada_id: unidadeId,
                            item_checklist_id: itemId,
                            pergunta: textoConstatacao,
                            resposta: data.resposta,
                            gera_nc: data.resposta === 'NAO' && item.gera_nc,
                            numero_constatacao: numeroConstatacao,
                            observacao: data.observacao || ''
                        });
                    }

                    if (temTexto) contadorC++;
                }

                await queryClient.invalidateQueries({ queryKey: ['respostas', unidadeId] });

            } catch (err) {
                console.error('Erro ao processar batch:', err);
                alert(err.message);
            }
        };

        const timer = setTimeout(processarBatch, 300);
        return () => clearTimeout(timer);
    }, [filaRespostas, unidadeId, itensChecklist]);

    const salvarRespostaMutation = useMutation({
        mutationFn: async ({ itemId, data }) => {
            if (fiscalizacao?.status === 'finalizada' && !modoEdicao) {
                throw new Error('Não é possível modificar uma fiscalização finalizada');
            }
            return { itemId, data };
        },
        onSuccess: ({ itemId, data }) => {
            const respostaAtual = respostasExistentes.find(r => r.item_checklist_id === itemId);
            
            // Atualizar estado local imediatamente para feedback instantâneo
            if (respostaAtual) {
                setRespostas(prev => ({
                    ...prev,
                    [itemId]: { 
                        ...respostaAtual, 
                        resposta: data.resposta, 
                        observacao: data.observacao
                    }
                }));
            } else {
                setRespostas(prev => ({
                    ...prev,
                    [itemId]: { 
                        item_checklist_id: itemId,
                        resposta: data.resposta, 
                        observacao: data.observacao
                    }
                }));
            }
            
            // Marcar timestamp da última resposta (delay 1s para próxima)
            setUltimaRespostaTimestamp(Date.now());
            
            // Adicionar à fila para processamento em batch
            setFilaRespostas(prev => [...prev, { itemId, data }]);
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

                return { constatacao: { ...constatacaoParaEditar, descricao: descricaoFinal, gera_nc: data.gera_nc } };
            }

            // Se for nova constatação, criar (NC/D geradas apenas ao finalizar)
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

            return { constatacao };
        },
        onSuccess: async ({ constatacao }) => {
            queryClient.invalidateQueries({ queryKey: ['constatacoes-manuais', unidadeId] });
            setShowAddConstatacao(false);
            setConstatacaoParaEditar(null);

            // Se gera NC e é nova constatação, abrir modal para definir NC/D/R
            if (constatacao.gera_nc && !constatacaoParaEditar) {
                // Buscar dados atuais para calcular próximos números
                const ncsAtuais = await base44.entities.NaoConformidade.filter({
                    unidade_fiscalizada_id: unidadeId
                });
                const determinacoesAtuais = await base44.entities.Determinacao.filter({
                    unidade_fiscalizada_id: unidadeId
                });
                const recomendacoesAtuais = await base44.entities.Recomendacao.filter({
                    unidade_fiscalizada_id: unidadeId
                });

                // Calcular números sequenciais
                const numeroNC = `NC${ncsAtuais.length + 1}`;
                const numeroDeterminacao = `D${determinacoesAtuais.length + 1}`;
                const numeroRecomendacao = `R${recomendacoesAtuais.length + 1}`;

                setConstatacaoParaNC(constatacao);
                setNumerosParaNC({
                    numeroNC,
                    numeroDeterminacao,
                    numeroRecomendacao,
                    numeroConstatacao: constatacao.numero_constatacao
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

            // Salvar artigo, texto_determinacao e texto_recomendacao na constatação manual
            let textoConstatacaoFinal = data.texto_constatacao;
            if (textoConstatacaoFinal && !textoConstatacaoFinal.trim().endsWith(';')) {
                textoConstatacaoFinal = textoConstatacaoFinal.trim() + ';';
            }
            
            await base44.entities.ConstatacaoManual.update(constatacaoParaNC.id, {
                descricao: textoConstatacaoFinal,
                artigo_portaria: data.artigo_portaria,
                texto_determinacao: data.gera_determinacao ? data.texto_determinacao : null,
                texto_recomendacao: data.gera_recomendacao ? data.texto_recomendacao : null
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['constatacoes-manuais', unidadeId] });
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
            console.log('🔵 Iniciando finalização da unidade:', unidadeId);
            
            // 1. Gerar todas as NC/D/R baseado no checklist completo
            console.log('🔵 Chamando gerarNCsDaUnidade...');
            const { data: result } = await base44.functions.invoke('gerarNCsDaUnidade', {
                unidade_fiscalizada_id: unidadeId
            });
            
            console.log('🔵 Resultado gerarNCsDaUnidade:', result);

            if (!result.success) {
                throw new Error(result.error || 'Erro ao gerar NC/D/R');
            }

            // 2. Atualizar status e fotos da unidade
            const fotosCompletas = fotos.map(f => {
                if (typeof f === 'string') {
                    return { url: f, legenda: '' };
                }
                return { url: f.url, legenda: f.legenda || '' };
            });
            
            console.log('🔵 Atualizando unidade com totais:', {
                total_constatacoes: result.total_constatacoes,
                total_ncs: result.total_ncs
            });
            
            await base44.entities.UnidadeFiscalizada.update(unidadeId, {
                status: 'finalizada',
                fotos_unidade: fotosCompletas,
                total_constatacoes: result.total_constatacoes || 0,
                total_ncs: result.total_ncs || 0
            });
            
            console.log('🟢 Finalização concluída com sucesso');
        },
        onSuccess: () => {
             queryClient.invalidateQueries({ queryKey: ['unidades-fiscalizacao'] });
             queryClient.invalidateQueries({ queryKey: ['ncs', unidadeId] });
             queryClient.invalidateQueries({ queryKey: ['determinacoes', unidadeId] });
             queryClient.invalidateQueries({ queryKey: ['recomendacoes', unidadeId] });
             navigate(createPageUrl('ExecutarFiscalizacao') + `?id=${unidade.fiscalizacao_id}`);
         },
         onError: (err) => {
             console.error('🔴 Erro ao finalizar unidade:', err);
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
        
        // Forçar re-render após 1s para liberar próxima pergunta
        setTimeout(() => {
            setUltimaRespostaTimestamp(0);
        }, 1000);
    };

    const handleAddFoto = async (fotoData) => {
        setFotos(prev => [...prev, fotoData]);
        setFotosParaSalvar(prev => [...prev, fotoData]);
    };

    const handleRemoveFoto = (index) => {
        const novasFotos = fotos.filter((_, i) => i !== index);
        setFotos(novasFotos);
    };

    const handleUpdateLegenda = (index, legenda) => {
        const novasFotos = [...fotos];
        novasFotos[index] = { ...novasFotos[index], legenda };
        setFotos(novasFotos);
    };

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
                            <Button 
                                onClick={() => {
                                    setConstatacaoParaEditar(null);
                                    setShowAddConstatacao(true);
                                }}
                                className="w-full"
                            >
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
                                
                                // Delay de 1s após última resposta
                                const tempoDecorrido = Date.now() - ultimaRespostaTimestamp;
                                const aguardandoDelay = itemAnteriorRespondido && tempoDecorrido < 1000;
                                
                                const liberado = itemAnteriorRespondido && !aguardandoDelay;
                                
                                return (
                                    <ChecklistItem
                                        key={item.id}
                                        item={item}
                                        resposta={respostas[item.id]}
                                        onResponder={(data) => handleResponder(item.id, data)}
                                        numero={index + 1}
                                        desabilitado={(unidade?.status === 'finalizada' && !modoEdicao) || !liberado}
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
                        isEditable={unidade?.status !== 'finalizada' || modoEdicao}
                    />
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