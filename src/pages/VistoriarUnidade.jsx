import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { DataService } from '@/functions/dataService';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export default function VistoriarUnidade() {
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
    const [isSavingResposta, setIsSavingResposta] = useState(false);

    // Queries - Carregamento offline-first
    const { data: unidade, isLoading: loadingUnidade } = useQuery({
        queryKey: ['unidade', unidadeId],
        queryFn: () => DataService.read('UnidadeFiscalizada', { id: unidadeId }).then(r => r[0]),
        enabled: !!unidadeId,
        staleTime: 5000,
    });

    const { data: fiscalizacao } = useQuery({
        queryKey: ['fiscalizacao', unidade?.fiscalizacao_id],
        queryFn: () => DataService.read('Fiscalizacao', { id: unidade?.fiscalizacao_id }).then(r => r[0]),
        enabled: !!unidade?.fiscalizacao_id,
        staleTime: 5000,
    });

    const { data: itensChecklist = [] } = useQuery({
        queryKey: ['itensChecklist', unidade?.tipo_unidade_id],
        queryFn: () => DataService.read('ItemChecklist', { tipo_unidade_id: unidade?.tipo_unidade_id }, 'ordem', 100),
        enabled: !!unidade?.tipo_unidade_id,
        staleTime: 60000,
    });

    const { data: respostasExistentes = [] } = useQuery({
        queryKey: ['respostas', unidadeId],
        queryFn: async () => {
            const result = await DataService.read('RespostaChecklist', { unidade_fiscalizada_id: unidadeId });
            return Array.isArray(result) ? result : [];
        },
        enabled: !!unidadeId,
        staleTime: 1000,
    });

    const { data: ncsExistentes = [] } = useQuery({
        queryKey: ['ncs', unidadeId],
        queryFn: async () => {
            const result = await DataService.read('NaoConformidade', { unidade_fiscalizada_id: unidadeId });
            return Array.isArray(result) ? result : [];
        },
        enabled: !!unidadeId,
        staleTime: 1000,
    });

    const { data: determinacoesExistentes = [] } = useQuery({
        queryKey: ['determinacoes', unidadeId],
        queryFn: async () => {
            const result = await DataService.read('Determinacao', { unidade_fiscalizada_id: unidadeId });
            return Array.isArray(result) ? result : [];
        },
        enabled: !!unidadeId,
        staleTime: 1000,
    });

    const { data: recomendacoesExistentes = [] } = useQuery({
        queryKey: ['recomendacoes', unidadeId],
        queryFn: async () => {
            const result = await DataService.read('Recomendacao', { unidade_fiscalizada_id: unidadeId });
            return Array.isArray(result) ? result : [];
        },
        enabled: !!unidadeId,
        staleTime: 1000,
    });

    const { data: constatacoesManuais = [] } = useQuery({
        queryKey: ['constatacoes-manuais', unidadeId],
        queryFn: async () => {
            const result = await DataService.read('ConstatacaoManual', { unidade_fiscalizada_id: unidadeId });
            return Array.isArray(result) ? result : [];
        },
        enabled: !!unidadeId,
        staleTime: 1000,
    });

    // Load fotos from unidade
    useEffect(() => {
        if (unidade?.fotos_unidade) {
            const fotosCarregadas = unidade.fotos_unidade.map(foto => 
                typeof foto === 'string' ? { url: foto } : foto
            );
            setFotos(fotosCarregadas);
        }
    }, [unidade?.fotos_unidade]);

    // Load contadores once
    useEffect(() => {
        const carregarContadores = async () => {
            if (contadoresCarregados || !unidadeId) return;
            const contadoresCalc = await DataService.calcularProximaNumeracao(unidadeId);
            setContadores(contadoresCalc);
            setContadoresCarregados(true);
        };
        carregarContadores();
    }, [unidadeId, contadoresCarregados]);

    // Load respostas map
    useEffect(() => {
        if (respostasExistentes.length > 0) {
            const respostasMap = {};
            respostasExistentes.forEach(r => {
                respostasMap[r.item_checklist_id] = r;
            });
            setRespostas(respostasMap);
        }
    }, [respostasExistentes.length]);

    // Salvar resposta instantaneamente (offline-first)
    const handleSalvarResposta = async (itemId, data) => {
        try {
            if (fiscalizacao?.status === 'finalizada' && !modoEdicao) {
                alert('Não é possível modificar uma fiscalização finalizada');
                return;
            }
            
            setIsSavingResposta(true);
            const item = itensChecklist.find(i => i.id === itemId);
            if (!item) return;

            const resposta = respostasExistentes.find(r => r.item_checklist_id === itemId);
            
            if (resposta?.id) {
                // Atualizar resposta existente
                let textoConstatacao = data.resposta === 'SIM' 
                    ? item.texto_constatacao_sim 
                    : data.resposta === 'NAO' 
                        ? item.texto_constatacao_nao 
                        : null;
                
                if (!textoConstatacao || !textoConstatacao.trim()) {
                    textoConstatacao = null;
                } else if (!textoConstatacao.trim().endsWith(';')) {
                    textoConstatacao = textoConstatacao.trim() + ';';
                }

                await DataService.update('RespostaChecklist', resposta.id, {
                   resposta: data.resposta,
                   observacao: data.observacao || '',
                   pergunta: textoConstatacao || ''
                });
            } else {
                // Nova resposta
                const proximaNumeracao = await DataService.calcularProximaNumeracao(unidadeId);

                let textoConstatacao = data.resposta === 'SIM' 
                    ? item.texto_constatacao_sim 
                    : data.resposta === 'NAO' 
                        ? item.texto_constatacao_nao 
                        : null;
                
                const temTextoConstatacao = textoConstatacao && textoConstatacao.trim();
                
                if (temTextoConstatacao && !textoConstatacao.trim().endsWith(';')) {
                    textoConstatacao = textoConstatacao.trim() + ';';
                } else if (!temTextoConstatacao) {
                    textoConstatacao = null;
                }

                const numeroConstatacao = temTextoConstatacao ? `C${proximaNumeracao.C}` : null;

                if (item.gera_nc && data.resposta === 'NAO') {
                    await DataService.createRespostaComNCeDeterminacao(
                        unidadeId,
                        itemId,
                        item,
                        {
                            resposta: data.resposta,
                            textoConstatacao,
                            numeroConstatacao,
                            numeroNC: `NC${proximaNumeracao.NC}`,
                            numeroDeterminacao: `D${proximaNumeracao.D}`,
                            numeroRecomendacao: `R${proximaNumeracao.R}`,
                            observacao: data.observacao
                        }
                    );
                } else {
                    await DataService.create('RespostaChecklist', {
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
            
            // Update UI locally
            setRespostas(prev => ({
                ...prev,
                [itemId]: data
            }));
        } catch (error) {
            console.error('Erro ao salvar resposta:', error);
            alert('Erro ao salvar resposta: ' + error.message);
        } finally {
            setIsSavingResposta(false);
        }
    };

    const handleAddFoto = async (fotoData) => {
        setFotos(prev => [...prev, fotoData]);
        setFotosParaSalvar(prev => [...prev, fotoData]);
    };

    const handleRemoveFoto = async (index) => {
        const novasFotos = fotos.filter((_, i) => i !== index);
        setFotos(novasFotos);
        const fotosCompletas = novasFotos.map(f => {
            if (typeof f === 'string') return { url: f, legenda: '' };
            return { url: f.url, legenda: f.legenda || '' };
        });
        await DataService.update('UnidadeFiscalizada', unidadeId, {
            fotos_unidade: fotosCompletas
        });
    };

    const handleUpdateLegenda = async (index, legenda) => {
        const novasFotos = [...fotos];
        novasFotos[index] = { ...novasFotos[index], legenda };
        setFotos(novasFotos);
        const fotosCompletas = novasFotos.map(f => {
            if (typeof f === 'string') return { url: f, legenda: '' };
            return { url: f.url, legenda: f.legenda || '' };
        });
        await DataService.update('UnidadeFiscalizada', unidadeId, {
            fotos_unidade: fotosCompletas
        });
    };

    const handleResponder = (itemId, data) => {
        handleSalvarResposta(itemId, data);
    };

    const handleFinalizarClick = async () => {
        if (fotos.length === 0) {
            setShowConfirmaSemFotos(true);
        } else {
            await handleFinalizar();
        }
    };

    const handleFinalizar = async () => {
        try {
            const respostasAtuais = await DataService.read('RespostaChecklist', { unidade_fiscalizada_id: unidadeId });
            const ncsAtuais = await DataService.read('NaoConformidade', { unidade_fiscalizada_id: unidadeId });

            const totalConstatacoes = respostasAtuais.filter(r => 
                r.resposta === 'SIM' || r.resposta === 'NAO'
            ).length;

            const fotosCompletas = fotos.map(f => {
                if (typeof f === 'string') return { url: f, legenda: '' };
                return { url: f.url, legenda: f.legenda || '' };
            });
            
            await DataService.update('UnidadeFiscalizada', unidadeId, {
                status: 'finalizada',
                fotos_unidade: fotosCompletas,
                total_constatacoes: totalConstatacoes,
                total_ncs: ncsAtuais.length
            });

            navigate(createPageUrl('ExecutarFiscalizacao') + `?id=${unidade.fiscalizacao_id}`);
        } catch (error) {
            alert('Erro ao finalizar vistoria: ' + error.message);
        }
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
                                    </div>
                                </CardContent>
                            </Card>
                        ))}

                        {respostasExistentes
                            .filter(r => (r.resposta === 'SIM' || r.resposta === 'NAO') && r.pergunta && r.pergunta.trim())
                            .map(resp => (
                                <Card key={resp.id}>
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-3">
                                            <Badge variant="secondary">{resp.numero_constatacao}</Badge>
                                            <div className="flex-1">
                                                <p className="text-sm">{resp.pergunta}</p>
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
                                    <p>Nenhum item de checklist configurado.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            itensChecklist.map((item, index) => {
                                const itemAnterior = index > 0 ? itensChecklist[index - 1] : null;
                                const itemAnteriorRespondido = !itemAnterior || respostas[itemAnterior.id]?.resposta;
                                const liberado = itemAnteriorRespondido && !isSavingResposta;
                                
                                return (
                                    <ChecklistItem
                                        key={item.id}
                                        item={item}
                                        resposta={respostas[item.id]}
                                        onResponder={(data) => handleResponder(item.id, data)}
                                        numero={index + 1}
                                        desabilitado={(unidade?.status === 'finalizada' && !modoEdicao) || !liberado || isSavingResposta}
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
                                </CardContent>
                            </Card>
                        ) : (
                            ncsExistentes.map((nc) => (
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
                        >
                            <Save className="h-5 w-5 mr-2" />
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
                                onClick={async () => {
                                    if (!novaRecomendacao.trim()) return;
                                    try {
                                        const proximaNumeracao = await DataService.calcularProximaNumeracao(unidadeId);
                                        await DataService.create('Recomendacao', {
                                            unidade_fiscalizada_id: unidadeId,
                                            numero_recomendacao: `R${proximaNumeracao.R}`,
                                            descricao: novaRecomendacao,
                                            origem: 'manual'
                                        });
                                        setNovaRecomendacao('');
                                        setShowAddRecomendacao(false);
                                    } catch (error) {
                                        alert('Erro ao adicionar recomendação: ' + error.message);
                                    }
                                }}
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
                            onClick={async () => {
                                setShowConfirmaSemFotos(false);
                                await handleFinalizar();
                            }}
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