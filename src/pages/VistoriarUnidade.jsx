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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
    ArrowLeft, ClipboardCheck, Camera, AlertTriangle, FileText, 
    CheckCircle2, Loader2, Plus, Save
} from 'lucide-react';
import ChecklistItem from '@/components/fiscalizacao/ChecklistItem';
import PhotoGrid from '@/components/fiscalizacao/PhotoGrid';
import RelatorioUnidade from '@/components/fiscalizacao/RelatorioUnidade';
import OfflineIndicator from '@/components/OfflineIndicator';
import SyncManager from '@/components/offline/SyncManager';
import useOfflineCache from '@/components/offline/useOfflineCache';
import { addPendingOperation } from '@/components/offline/offlineStorage';
import { preloadImages } from '@/components/offline/preloadImages';
import { gerarNumeroConstatacao, gerarNumeroNC, gerarNumeroDeterminacao } from '@/components/offline/numerationHelper';

// Wrapper para calcular offset das figuras
function RelatorioUnidadeWrapper({ unidade, ...props }) {
    const [offsetFiguras, setOffsetFiguras] = React.useState(0);
    
    React.useEffect(() => {
        const calcularOffset = async () => {
            // Buscar todas as unidades da fiscalização criadas antes desta
            const todasUnidades = await base44.entities.UnidadeFiscalizada.filter(
                { fiscalizacao_id: unidade.fiscalizacao_id },
                'created_date',
                500
            );
            
            let totalFotos = 0;
            for (const u of todasUnidades) {
                // Contar apenas fotos de unidades anteriores (created_date menor)
                if (new Date(u.created_date) < new Date(unidade.created_date)) {
                    const fotosUnidade = Array.isArray(u.fotos_unidade) ? u.fotos_unidade : [];
                    totalFotos += fotosUnidade.length;
                    
                    // Contar fotos das NCs desta unidade
                    const ncsUnidade = await base44.entities.NaoConformidade.filter(
                        { unidade_fiscalizada_id: u.id }
                    );
                    for (const nc of ncsUnidade) {
                        const fotosNC = Array.isArray(nc.fotos) ? nc.fotos : [];
                        totalFotos += fotosNC.length;
                    }
                }
            }
            
            setOffsetFiguras(totalFotos);
        };
        
        if (unidade?.fiscalizacao_id) {
            calcularOffset();
        }
    }, [unidade]);
    
    return <RelatorioUnidade unidade={unidade} offsetFiguras={offsetFiguras} {...props} />;
}

export default function VistoriarUnidade() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const urlParams = new URLSearchParams(window.location.search);
    const unidadeId = urlParams.get('id');

    const [activeTab, setActiveTab] = useState('checklist');
    const [respostas, setRespostas] = useState({});
    const [fotos, setFotos] = useState([]);
    const [fotosNC, setFotosNC] = useState({});
    const [showAddRecomendacao, setShowAddRecomendacao] = useState(false);
    const [novaRecomendacao, setNovaRecomendacao] = useState('');

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

    // Use offline cache for checklist items
    const { data: itensChecklist = [], fromCache: checklistFromCache } = useOfflineCache(
        `checklist_${unidade?.tipo_unidade_id}`,
        () => base44.entities.ItemChecklist.filter({ tipo_unidade_id: unidade?.tipo_unidade_id }, 'ordem', 100),
        1440 // 24 hours cache
    );

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

    // Corrigir NCs antigas que não têm referência à constatação
    useEffect(() => {
        const corrigirNCs = async () => {
            if (!ncsExistentes.length || !respostasExistentes.length) return;
            
            let houveCorrecao = false;
            
            for (const nc of ncsExistentes) {
                // Se a NC não contém "Constatação" no texto, atualizar
                if (!nc.descricao.includes('Constatação')) {
                    // Buscar a resposta pelo ID correto
                    const respostaRelacionada = respostasExistentes.find(
                        r => r.id === nc.resposta_checklist_id
                    );
                    
                    if (respostaRelacionada?.numero_constatacao) {
                        const textoCorrigido = `A Constatação ${respostaRelacionada.numero_constatacao} não cumpre o disposto no ${nc.artigo_portaria || 'regulamento aplicável'}. ${nc.descricao}`;
                        
                        await base44.entities.NaoConformidade.update(nc.id, {
                            descricao: textoCorrigido
                        });
                        houveCorrecao = true;
                    }
                }
            }
            
            // Recarregar as NCs apenas se houve correção
            if (houveCorrecao) {
                queryClient.invalidateQueries({ queryKey: ['ncs', unidadeId] });
            }
        };
        
        corrigirNCs();
    }, [ncsExistentes.length, respostasExistentes.length]);

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

    // Load existing data - sincronizar apenas na inicialização
    useEffect(() => {
        if (unidade?.fotos_unidade) {
            const fotosCarregadas = unidade.fotos_unidade.map(foto => 
                typeof foto === 'string' ? { url: foto } : foto
            );
            setFotos(fotosCarregadas);
            
            // Pre-carregar imagens em cache
            const urls = fotosCarregadas.map(f => f.url).filter(Boolean);
            if (urls.length > 0) {
                setTimeout(() => preloadImages(urls), 500);
            }
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

    // Pre-carregar imagens das NCs
    useEffect(() => {
        const ncUrls = [];
        ncsExistentes.forEach(nc => {
            if (nc.fotos) {
                nc.fotos.forEach(foto => {
                    const url = typeof foto === 'string' ? foto : foto.url;
                    if (url) ncUrls.push(url);
                });
            }
        });
        if (ncUrls.length > 0) {
            setTimeout(() => preloadImages(ncUrls), 1000);
        }
    }, [ncsExistentes.length]);



    // Mutations with offline support
     const salvarRespostaMutation = useMutation({
             mutationFn: async ({ itemId, data }) => {
                 const item = Array.isArray(itensChecklist) ? itensChecklist.find(i => i.id === itemId) : null;
                 if (!item) return;

                 const respostaExistente = respostasExistentes.find(r => r.item_checklist_id === itemId);

                 // Gerar número de constatação (sequencial mesmo se resposta não der NC)
                 let numeroConstatacao = null;
                 if (data.resposta === 'SIM' || data.resposta === 'NAO') {
                     if (respostaExistente?.numero_constatacao) {
                         numeroConstatacao = respostaExistente.numero_constatacao;
                     } else {
                         numeroConstatacao = gerarNumeroConstatacao(respostasExistentes);
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

                 if (!navigator.onLine) {
                     if (respostaExistente) {
                         await addPendingOperation({
                             operation: 'update',
                             entity: 'RespostaChecklist',
                             id: respostaExistente.id,
                             data: payloadResposta,
                             priority: 2
                         });
                     } else {
                         await addPendingOperation({
                             operation: 'create',
                             entity: 'RespostaChecklist',
                             data: payloadResposta,
                             priority: 2
                         });
                     }
                     return;
                 }

                 let respostaId;
                 if (respostaExistente) {
                     await base44.entities.RespostaChecklist.update(respostaExistente.id, payloadResposta);
                     respostaId = respostaExistente.id;
                 } else {
                     const nova = await base44.entities.RespostaChecklist.create(payloadResposta);
                     respostaId = nova.id;
                 }

                 // Gerenciar NC: só cria se resposta = NAO E item.gera_nc = true
                 const ncExistente = ncsExistentes.find(nc => nc.resposta_checklist_id === respostaId);
                 const deveExistirNC = (data.resposta === 'NAO' && item.gera_nc === true);

                 if (deveExistirNC && !ncExistente) {
                     const numeroNC = gerarNumeroNC(ncsExistentes);

                     const textoNC = item.texto_nc 
                         ? `A Constatação ${numeroConstatacao} não cumpre o disposto no ${item.artigo_portaria || 'regulamento aplicável'}. ${item.texto_nc}`
                         : `A Constatação ${numeroConstatacao} não cumpre o disposto no ${item.artigo_portaria || 'regulamento aplicável'}.`;

                     const ncCriada = await base44.entities.NaoConformidade.create({
                         unidade_fiscalizada_id: unidadeId,
                         resposta_checklist_id: respostaId,
                         numero_nc: numeroNC,
                         artigo_portaria: item.artigo_portaria || '',
                         descricao: textoNC,
                         fotos: []
                     });

                     // Criar Determinação se houver texto
                     if (item.texto_determinacao) {
                         const numeroDet = gerarNumeroDeterminacao(determinacoesExistentes);
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

                     queryClient.invalidateQueries({ queryKey: ['ncs', unidadeId] });
                     queryClient.invalidateQueries({ queryKey: ['determinacoes', unidadeId] });

                 } else if (!deveExistirNC && ncExistente) {
                     // Remover NC e determinações vinculadas
                     const detsVinculadas = determinacoesExistentes.filter(d => d.nao_conformidade_id === ncExistente.id);
                     for (const det of detsVinculadas) {
                         await base44.entities.Determinacao.delete(det.id);
                     }
                     await base44.entities.NaoConformidade.delete(ncExistente.id);
                     queryClient.invalidateQueries({ queryKey: ['ncs', unidadeId] });
                     queryClient.invalidateQueries({ queryKey: ['determinacoes', unidadeId] });
                 }
             },
             onSuccess: () => {
                 queryClient.invalidateQueries({ queryKey: ['respostas', unidadeId] });
             }
         });



    const salvarFotosMutation = useMutation({
        mutationFn: async (fotosData) => {
            await base44.entities.UnidadeFiscalizada.update(unidadeId, {
                fotos_unidade: fotosData
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['unidade', unidadeId] });
        }
    });

    const adicionarRecomendacaoMutation = useMutation({
        mutationFn: async (texto) => {
            // Buscar TODAS as unidades da fiscalização
            const todasUnidades = await base44.entities.UnidadeFiscalizada.filter(
                { fiscalizacao_id: unidade.fiscalizacao_id },
                'created_date',
                500
            );
            const idsUnidades = todasUnidades.map(u => u.id);
            
            // Buscar TODAS as recomendações de TODA a fiscalização
            const todasRec = await base44.entities.Recomendacao.list('created_date', 1000);
            const recsDaFiscalizacao = todasRec.filter(r => idsUnidades.includes(r.unidade_fiscalizada_id));
            const numerosRec = recsDaFiscalizacao
                .map(r => parseInt(r.numero_recomendacao?.replace('R', '') || '0'))
                .filter(n => !isNaN(n));
            const num = numerosRec.length > 0 ? Math.max(...numerosRec) + 1 : 1;
            await base44.entities.Recomendacao.create({
                unidade_fiscalizada_id: unidadeId,
                numero_recomendacao: `R${num}`,
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

    const finalizarUnidadeMutation = useMutation({
         mutationFn: async () => {
             // Validar fotos (estado local é fonte da verdade)
             if (fotos.length < 2) {
                 throw new Error(`Mínimo de 2 fotos obrigatórias (você tem ${fotos.length}).`);
             }

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

             await base44.entities.UnidadeFiscalizada.update(unidadeId, {
                 status: 'finalizada',
                 fotos_unidade: fotos,
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

    const handleResponder = (itemId, data) => {
        setRespostas(prev => ({ ...prev, [itemId]: data }));
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
        <SyncManager>
            <div className="min-h-screen bg-gray-100 pb-24">
                <OfflineIndicator />
            
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
                            {fotos.length < 2 && <span className="ml-1 text-red-500">!</span>}
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
                            itensChecklist.map((item, index) => (
                                <ChecklistItem
                                    key={item.id}
                                    item={item}
                                    resposta={respostas[item.id]}
                                    onResponder={(data) => handleResponder(item.id, data)}
                                    numero={index + 1}
                                    desabilitado={unidade?.status === 'finalizada'}
                                />
                            ))
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

                                        {/* Fotos da NC */}
                                        <div className="mt-3 pt-3 border-t">
                                            <PhotoGrid
                                                fotos={(nc.fotos || []).map((f, i) => 
                                                    typeof f === 'string' ? { url: f } : f
                                                )}
                                                minFotos={0}
                                                fiscalizacaoId={unidade?.fiscalizacao_id}
                                                unidadeId={unidadeId}
                                                onAddFoto={(fotoData) => {
                                                    const fotosAtuais = (nc.fotos || []).map(f => typeof f === 'string' ? { url: f } : f);
                                                    const novasFotos = [...fotosAtuais, fotoData];
                                                    base44.entities.NaoConformidade.update(nc.id, {
                                                        fotos: novasFotos,
                                                        latitude_foto: fotoData.latitude,
                                                        longitude_foto: fotoData.longitude
                                                    }).then(() => {
                                                        queryClient.invalidateQueries({ queryKey: ['ncs', unidadeId] });
                                                    });
                                                }}
                                                onRemoveFoto={(index) => {
                                                    const fotosAtuais = (nc.fotos || []).map(f => typeof f === 'string' ? { url: f } : f);
                                                    const novasFotos = fotosAtuais.filter((_, i) => i !== index);
                                                    base44.entities.NaoConformidade.update(nc.id, {
                                                        fotos: novasFotos
                                                    }).then(() => {
                                                        queryClient.invalidateQueries({ queryKey: ['ncs', unidadeId] });
                                                    });
                                                }}
                                                onUpdateLegenda={(index, legenda) => {
                                                    const fotosAtuais = (nc.fotos || []).map(f => typeof f === 'string' ? { url: f } : f);
                                                    fotosAtuais[index] = { ...fotosAtuais[index], legenda };
                                                    base44.entities.NaoConformidade.update(nc.id, {
                                                        fotos: fotosAtuais
                                                    }).then(() => {
                                                        queryClient.invalidateQueries({ queryKey: ['ncs', unidadeId] });
                                                    });
                                                }}
                                                titulo={`Fotos da ${nc.numero_nc}`}
                                            />
                                        </div>
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
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-50">
                <div className="max-w-4xl mx-auto space-y-2">
                    {unidade?.status === 'finalizada' ? (
                        <RelatorioUnidadeWrapper
                            unidade={unidade}
                            fiscalizacao={fiscalizacao}
                            respostas={respostasExistentes}
                            ncs={ncsExistentes}
                            determinacoes={determinacoesExistentes}
                            recomendacoes={recomendacoesExistentes}
                            fotos={fotos}
                        />
                    ) : (
                        <Button 
                            className="w-full h-12 bg-green-600 hover:bg-green-700"
                            onClick={() => finalizarUnidadeMutation.mutate()}
                            disabled={finalizarUnidadeMutation.isPending}
                        >
                            {finalizarUnidadeMutation.isPending ? (
                                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            ) : (
                                <Save className="h-5 w-5 mr-2" />
                            )}
                            Finalizar Vistoria
                        </Button>
                    )}
                </div>
            </div>

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


            </div>
        </SyncManager>
    );
}