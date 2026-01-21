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
    CheckCircle2, Loader2, Plus, Save, AlertCircle
} from 'lucide-react';
import ChecklistItem from '@/components/fiscalizacao/ChecklistItem';
import PhotoGrid from '@/components/fiscalizacao/PhotoGrid';
import { calcularProximaNumeracao, gerarNumeroConstatacao, gerarNumeroNC, gerarNumeroDeterminacao, gerarNumeroRecomendacao } from '@/components/utils/numerationHelper';

export default function VistoriarUnidade() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const urlParams = new URLSearchParams(window.location.search);
    const unidadeId = urlParams.get('id');

    const [activeTab, setActiveTab] = useState('checklist');
    const [respostas, setRespostas] = useState({});
    const [fotos, setFotos] = useState([]);
    const [showAddRecomendacao, setShowAddRecomendacao] = useState(false);
    const [novaRecomendacao, setNovaRecomendacao] = useState('');
    const [recomendacoesCache, setRecomendacoesCache] = useState(null);
    const [showConfirmaSemFotos, setShowConfirmaSemFotos] = useState(false);

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

    useEffect(() => {
        if (unidade?.fotos_unidade) {
            const fotosCarregadas = unidade.fotos_unidade.map(foto => 
                typeof foto === 'string' ? { url: foto } : foto
            );
            setFotos(fotosCarregadas);
        }
    }, [unidade?.fotos_unidade]);

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
            const item = itensChecklist.find(i => i.id === itemId);
            if (!item) return;

            const resposta = respostasExistentes.find(r => r.item_checklist_id === itemId);

            if (resposta?.id) {
                // Atualizar resposta existente
                await base44.entities.RespostaChecklist.update(resposta.id, {
                    resposta: data.resposta,
                    observacao: data.observacao
                });
            } else {
                // Contar respostas atuais para gerar número único
                const respostasAtuais = await base44.entities.RespostaChecklist.filter({ 
                    unidade_fiscalizada_id: unidadeId 
                });
                const numero = `C${respostasAtuais.length + 1}`;

                // Definir texto da constatação baseado na resposta
                let textoConstatacao = data.resposta === 'SIM' 
                    ? item.texto_constatacao_sim 
                    : data.resposta === 'NAO' 
                        ? item.texto_constatacao_nao 
                        : item.pergunta;
                
                // Adicionar ';' ao final se não existir
                if (textoConstatacao && !textoConstatacao.trim().endsWith(';')) {
                    textoConstatacao = textoConstatacao.trim() + ';';
                }

                if (item.gera_nc && data.resposta === 'NAO') {
                    // Usar backend function para criar Resposta + NC + D/R atomicamente
                    await base44.functions.invoke('criarNcComDeterminacao', {
                        unidade_fiscalizada_id: unidadeId,
                        item_checklist_id: itemId,
                        pergunta: textoConstatacao,
                        numero_constatacao: numero,
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
                        numero_constatacao: numero,
                        observacao: data.observacao
                    });
                }
            }
            
            return { itemId, data };
        },
        onSuccess: async ({ itemId, data }) => {
            // Aguardar invalidação e refetch das queries
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['respostas', unidadeId] }),
                queryClient.invalidateQueries({ queryKey: ['ncs', unidadeId] }),
                queryClient.invalidateQueries({ queryKey: ['determinacoes', unidadeId] }),
                queryClient.invalidateQueries({ queryKey: ['recomendacoes', unidadeId] })
            ]);
            
            // Aguardar refetch completar
            await queryClient.refetchQueries({ queryKey: ['respostas', unidadeId] });
            await queryClient.refetchQueries({ queryKey: ['ncs', unidadeId] });
            await queryClient.refetchQueries({ queryKey: ['determinacoes', unidadeId] });
            
            // Atualizar estado local APENAS após tudo ser recarregado
            setRespostas(prev => ({ ...prev, [itemId]: data }));
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
         }
     });

    const adicionarRecomendacaoMutation = useMutation({
        mutationFn: async (texto) => {
            let proximoNumero = 1;
            
            // Usar cache se disponível, senão buscar
            if (recomendacoesCache !== null) {
                const numerosRec = recomendacoesCache
                    .map(r => parseInt(r.numero_recomendacao?.replace('R', '') || '0'))
                    .filter(n => !isNaN(n));
                proximoNumero = numerosRec.length > 0 ? Math.max(...numerosRec) + 1 : 1;
            } else {
                // Primeira vez: buscar do banco
                const todasUnidades = await base44.entities.UnidadeFiscalizada.filter(
                    { fiscalizacao_id: unidade.fiscalizacao_id },
                    'created_date',
                    500
                );
                const idsUnidades = todasUnidades.map(u => u.id);
                
                const todasRec = await base44.entities.Recomendacao.list('created_date', 1000);
                const recsDaFiscalizacao = todasRec.filter(r => idsUnidades.includes(r.unidade_fiscalizada_id));
                
                // Cachear resultado
                setRecomendacoesCache(recsDaFiscalizacao);
                
                const numerosRec = recsDaFiscalizacao
                    .map(r => parseInt(r.numero_recomendacao?.replace('R', '') || '0'))
                    .filter(n => !isNaN(n));
                proximoNumero = numerosRec.length > 0 ? Math.max(...numerosRec) + 1 : 1;
            }
            
            await base44.entities.Recomendacao.create({
                unidade_fiscalizada_id: unidadeId,
                numero_recomendacao: `R${proximoNumero}`,
                descricao: texto,
                origem: 'manual'
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recomendacoes', unidadeId] });
            setRecomendacoesCache(null); // Limpar cache para recarregar na próxima
            setNovaRecomendacao('');
            setShowAddRecomendacao(false);
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
        const novasFotos = [...fotos, fotoData];
        setFotos(novasFotos);
        await salvarFotosMutation.mutateAsync(novasFotos);
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
                    <TabsList className="w-full grid grid-cols-4">
                        <TabsTrigger value="checklist" className="text-xs">
                            <ClipboardCheck className="h-4 w-4 mr-1" />
                            Checklist
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
                                        desabilitado={unidade?.status === 'finalizada' || !liberado || salvarRespostaMutation.isPending}
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
                        <Button onClick={() => setShowAddRecomendacao(true)} className="w-full">
                            <Plus className="h-4 w-4 mr-2" />
                            Adicionar Recomendação
                        </Button>

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