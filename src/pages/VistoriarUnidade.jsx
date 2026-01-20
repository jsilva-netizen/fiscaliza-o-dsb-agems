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
    CheckCircle2, Loader2, Plus, Save, Sparkles
} from 'lucide-react';
import ChecklistItem from '@/components/fiscalizacao/ChecklistItem';
import PhotoGrid from '@/components/fiscalizacao/PhotoGrid';
import RelatorioUnidade from '@/components/fiscalizacao/RelatorioUnidade';
import OfflineIndicator from '@/components/OfflineIndicator';
import useOfflineCache from '@/components/offline/useOfflineCache';
import { addPendingOperation } from '@/components/offline/offlineStorage';

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
    const [showIASugestao, setShowIASugestao] = useState(false);
    const [iaSugestao, setIASugestao] = useState(null);
    const [loadingIA, setLoadingIA] = useState(false);

    // Queries
    const { data: unidade, isLoading: loadingUnidade } = useQuery({
        queryKey: ['unidade', unidadeId],
        queryFn: () => base44.entities.UnidadeFiscalizada.filter({ id: unidadeId }).then(r => r[0]),
        enabled: !!unidadeId
    });

    const { data: fiscalizacao } = useQuery({
        queryKey: ['fiscalizacao', unidade?.fiscalizacao_id],
        queryFn: () => base44.entities.Fiscalizacao.filter({ id: unidade?.fiscalizacao_id }).then(r => r[0]),
        enabled: !!unidade?.fiscalizacao_id
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
        enabled: !!unidadeId
    });

    const { data: ncsExistentes = [] } = useQuery({
        queryKey: ['ncs', unidadeId],
        queryFn: async () => {
            const result = await base44.entities.NaoConformidade.filter({ unidade_fiscalizada_id: unidadeId });
            return Array.isArray(result) ? result : [];
        },
        enabled: !!unidadeId
    });

    const { data: determinacoesExistentes = [] } = useQuery({
        queryKey: ['determinacoes', unidadeId],
        queryFn: async () => {
            const result = await base44.entities.Determinacao.filter({ unidade_fiscalizada_id: unidadeId });
            return Array.isArray(result) ? result : [];
        },
        enabled: !!unidadeId
    });

    const { data: recomendacoesExistentes = [] } = useQuery({
        queryKey: ['recomendacoes', unidadeId],
        queryFn: async () => {
            const result = await base44.entities.Recomendacao.filter({ unidade_fiscalizada_id: unidadeId });
            return Array.isArray(result) ? result : [];
        },
        enabled: !!unidadeId
    });

    // Load existing data
    useEffect(() => {
        if (unidade?.fotos_unidade) {
            setFotos(unidade.fotos_unidade.map(url => ({ url })));
        }
        
        const respostasMap = {};
        respostasExistentes.forEach(r => {
            respostasMap[r.item_checklist_id] = r;
        });
        setRespostas(respostasMap);
    }, [unidade, respostasExistentes]);

    // Função para obter sugestões da IA
    const obterSugestoesIA = async (item, observacao) => {
        setLoadingIA(true);
        try {
            const prompt = `Você é um especialista em fiscalização de saneamento da AGEMS (Agência Estadual de Regulação de Serviços Públicos de Mato Grosso do Sul).

CONTEXTO DA FISCALIZAÇÃO:
- Tipo de Unidade: ${unidade?.tipo_unidade_nome}
- Serviço: ${fiscalizacao?.servico}
- Município: ${fiscalizacao?.municipio_nome}

ITEM DO CHECKLIST QUE GEROU NC:
- Pergunta: ${item.pergunta}
- Observação do fiscal: ${observacao || 'Nenhuma'}

CONHECIMENTO REGULATÓRIO - PORTARIA AGEMS Nº 233/2022:
A Portaria AGEMS nº 233, de 15 de dezembro de 2022, define as penalidades e infrações aplicáveis aos prestadores de serviços de saneamento.

Principais artigos relevantes para Água e Esgoto:
- Art. 18: Infrações de natureza LEVE (Grupo II)
- Art. 20: Infrações de natureza GRAVE (Grupo IV) - obrigações operacionais críticas
- Art. 21: Infrações de natureza GRAVÍSSIMA (Grupo V) - questões de qualidade e segurança

Exemplos de obrigações conforme Art. 20 (GRAVE):
- Inciso VII: Cumprir normas técnicas e procedimentos para operação das instalações
- Inciso X: Realizar limpeza de reservatórios e redes conforme legislação
- Inciso XI: Obter licenças ambientais necessárias

Exemplos de obrigações conforme Art. 21 (GRAVÍSSIMA):
- Inciso I: Dispor adequadamente água e resíduos de ETAs, Reservatórios e ETEs
- Inciso IX: Atender requisitos de qualidade dos efluentes das ETEs conforme legislação

FORMATO ESPERADO DO RELATÓRIO AGEMS:
Baseado no modelo RFP-CATESA-CRES, o relatório deve conter:
- Constatações (C1, C2, C3...)
- Não Conformidades (NC1, NC2...) com artigo da portaria
- Determinações (D1, D2...) com prazo específico
- Recomendações (R1, R2...) quando aplicável

TAREFA:
Analisar esta não conformidade identificada durante a fiscalização e sugerir:

1. **Artigo/Inciso da Portaria AGEMS nº 233/2022** mais adequado (especifique Art. XX, inciso Y)
2. **Texto técnico da Não Conformidade** (padrão AGEMS: objetivo, técnico, referenciando a constatação)
3. **Determinação** clara para correção (use linguagem imperativa: "Determina-se..." ou "Sanar...")
4. **Prazo em dias** adequado (considere: 30 dias para questões administrativas, 60 dias para adequações operacionais, 90+ dias para obras)
5. **Recomendações adicionais** baseadas em boas práticas (se aplicável)

Seja técnico, específico e baseado na Portaria AGEMS 233/2022 e no padrão de relatórios da AGEMS.`;

            const resultado = await base44.integrations.Core.InvokeLLM({
                prompt,
                response_json_schema: {
                    type: "object",
                    properties: {
                        artigo_portaria: { type: "string" },
                        texto_nc: { type: "string" },
                        texto_determinacao: { type: "string" },
                        prazo_dias: { type: "number" },
                        recomendacoes: {
                            type: "array",
                            items: { type: "string" }
                        }
                    }
                }
            });

            setIASugestao(resultado);
            setShowIASugestao(true);
        } catch (err) {
            console.error('Erro ao obter sugestões da IA:', err);
        } finally {
            setLoadingIA(false);
        }
    };

    // Mutations with offline support
    const salvarRespostaMutation = useMutation({
        mutationFn: async ({ itemId, data, usarIA }) => {
            const item = Array.isArray(itensChecklist) ? itensChecklist.find(i => i.id === itemId) : null;
            if (!item) return;
            const existente = respostasExistentes.find(r => r.item_checklist_id === itemId);
            
            // Determinar o número da constatação
            const constatacaoNum = respostasExistentes.length + 1;
            
            // Determinar o texto da constatação baseado na resposta
            let textoConstatacao = '';
            if (data.resposta === 'SIM' && item.texto_constatacao_sim) {
                textoConstatacao = item.texto_constatacao_sim;
            } else if (data.resposta === 'NAO' && item.texto_constatacao_nao) {
                textoConstatacao = item.texto_constatacao_nao;
            } else {
                // Fallback: construir texto a partir da pergunta
                textoConstatacao = data.resposta === 'NAO' 
                    ? item.pergunta.replace('?', '').replace(/^([A-Z])/, (match) => match.toLowerCase()).trim()
                    : item.pergunta.replace('?', '').trim();
            }

            const payload = {
                unidade_fiscalizada_id: unidadeId,
                item_checklist_id: itemId,
                pergunta: textoConstatacao,
                gera_nc: item.gera_nc,
                numero_constatacao: `C${constatacaoNum}`,
                ...data
            };

            // If offline, queue the operation
            if (!navigator.onLine) {
                if (existente) {
                    await addPendingOperation({
                        operation: 'update',
                        entity: 'RespostaChecklist',
                        id: existente.id,
                        data: payload,
                        priority: 2
                    });
                } else {
                    await addPendingOperation({
                        operation: 'create',
                        entity: 'RespostaChecklist',
                        data: payload,
                        priority: 2
                    });
                }
                return;
            }

            // If online, execute immediately
            if (existente) {
                await base44.entities.RespostaChecklist.update(existente.id, payload);
            } else {
                await base44.entities.RespostaChecklist.create(payload);
            }

            // Apenas cria NC se resposta for NÃO (SIM não gera constatação nem NC)
            if (data.resposta === 'NAO' && item.gera_nc) {
                const ncExistente = ncsExistentes.find(nc => nc.resposta_checklist_id === itemId);
                if (!ncExistente) {
                    // Chamar IA se solicitado
                    if (usarIA) {
                        await obterSugestoesIA(item, data.observacao);
                        return; // Aguarda aprovação do usuário
                    }

                    // Criar NC normal
                    const ncNum = ncsExistentes.length + 1;
                    const textoNC = item.texto_nc 
                        ? `A Constatação C${constatacaoNum} não cumpre o disposto no ${item.artigo_portaria || 'regulamento aplicável'}. ${item.texto_nc}`
                        : `A Constatação C${constatacaoNum} não cumpre o disposto no ${item.artigo_portaria || 'regulamento aplicável'}.`;

                    const nc = await base44.entities.NaoConformidade.create({
                        unidade_fiscalizada_id: unidadeId,
                        resposta_checklist_id: itemId,
                        numero_nc: `NC${ncNum}`,
                        artigo_portaria: item.artigo_portaria,
                        descricao: textoNC,
                        fotos: []
                    });

                    if (item.texto_determinacao) {
                        const textoDeterminacao = `Para sanar a NC${ncNum}, ${item.texto_determinacao.charAt(0).toLowerCase()}${item.texto_determinacao.slice(1)}`;
                        await base44.entities.Determinacao.create({
                            unidade_fiscalizada_id: unidadeId,
                            nao_conformidade_id: nc.id,
                            numero_determinacao: `D${ncNum}`,
                            descricao: textoDeterminacao,
                            prazo_dias: 30,
                            status: 'pendente'
                        });
                    }
                }
            }

            queryClient.invalidateQueries({ queryKey: ['respostas', unidadeId] });
            queryClient.invalidateQueries({ queryKey: ['ncs', unidadeId] });
            queryClient.invalidateQueries({ queryKey: ['determinacoes', unidadeId] });
        }
    });

    const aplicarSugestaoIAMutation = useMutation({
            mutationFn: async ({ itemId, sugestao, constatacaoNum }) => {
                const ncNum = ncsExistentes.length + 1;
                const textoNC = `A Constatação C${constatacaoNum} não cumpre o disposto no ${sugestao.artigo_portaria}. ${sugestao.texto_nc}`;
                const nc = await base44.entities.NaoConformidade.create({
                    unidade_fiscalizada_id: unidadeId,
                    resposta_checklist_id: itemId,
                    numero_nc: `NC${ncNum}`,
                    artigo_portaria: sugestao.artigo_portaria,
                    descricao: textoNC,
                    fotos: []
                });

                const textoDeterminacao = sugestao.texto_determinacao.startsWith('Para sanar') 
                    ? sugestao.texto_determinacao.replace(/Para sanar[^,]*,/, `Para sanar a NC${ncNum},`)
                    : `Para sanar a NC${ncNum}, ${sugestao.texto_determinacao.charAt(0).toLowerCase()}${sugestao.texto_determinacao.slice(1)}`;

                await base44.entities.Determinacao.create({
                    unidade_fiscalizada_id: unidadeId,
                    nao_conformidade_id: nc.id,
                    numero_determinacao: `D${ncNum}`,
                    descricao: textoDeterminacao,
                    prazo_dias: sugestao.prazo_dias || 30,
                    status: 'pendente'
                });

            // Adicionar recomendações se houver
            if (Array.isArray(sugestao.recomendacoes) && sugestao.recomendacoes.length > 0) {
                for (const rec of sugestao.recomendacoes) {
                    const recNum = recomendacoesExistentes.length + 1;
                    await base44.entities.Recomendacao.create({
                        unidade_fiscalizada_id: unidadeId,
                        numero_recomendacao: `R${recNum}`,
                        descricao: rec,
                        origem: 'checklist'
                    });
                }
            }

            queryClient.invalidateQueries({ queryKey: ['ncs', unidadeId] });
            queryClient.invalidateQueries({ queryKey: ['determinacoes', unidadeId] });
            queryClient.invalidateQueries({ queryKey: ['recomendacoes', unidadeId] });
        },
        onSuccess: () => {
            setShowIASugestao(false);
            setIASugestao(null);
        }
    });

    const salvarFotosMutation = useMutation({
        mutationFn: async (fotosUrls) => {
            await base44.entities.UnidadeFiscalizada.update(unidadeId, {
                fotos_unidade: fotosUrls
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['unidade', unidadeId] });
        }
    });

    const adicionarRecomendacaoMutation = useMutation({
        mutationFn: async (texto) => {
            const num = recomendacoesExistentes.length + 1;
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
            // Validações
            if (fotos.length < 2) {
                throw new Error('Mínimo de 2 fotos da unidade obrigatórias.');
            }

            await base44.entities.UnidadeFiscalizada.update(unidadeId, {
                status: 'finalizada',
                total_constatacoes: Object.values(respostas).filter(r => r.resposta === 'NAO').length,
                total_ncs: ncsExistentes.length
            });
        },
        onSuccess: () => {
            navigate(createPageUrl('ExecutarFiscalizacao') + `?id=${unidade.fiscalizacao_id}`);
        },
        onError: (err) => {
            alert(err.message);
        }
    });

    const handleResponder = (itemId, data, usarIA = false) => {
        setRespostas(prev => ({ ...prev, [itemId]: data }));
        salvarRespostaMutation.mutate({ itemId, data, usarIA });
    };

    const handleAddFoto = (fotoData) => {
        const novasFotos = [...fotos, fotoData];
        setFotos(novasFotos);
        salvarFotosMutation.mutate(novasFotos.map(f => f.url));
    };

    const handleRemoveFoto = (index) => {
        const novasFotos = fotos.filter((_, i) => i !== index);
        setFotos(novasFotos);
        salvarFotosMutation.mutate(novasFotos.map(f => f.url));
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
                                    onResponderComIA={(data) => handleResponder(item.id, data, true)}
                                    numero={index + 1}
                                    loadingIA={loadingIA}
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
                        <RelatorioUnidade
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

            {/* Dialog Sugestão IA */}
            <Dialog open={showIASugestao} onOpenChange={setShowIASugestao}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-purple-500" />
                            Sugestões da IA
                        </DialogTitle>
                    </DialogHeader>
                    {iaSugestao && (
                        <div className="space-y-4">
                            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                                <p className="text-xs text-purple-600 font-medium mb-2">Artigo da Portaria AGEMS</p>
                                <p className="text-sm font-medium">{iaSugestao.artigo_portaria}</p>
                            </div>

                            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                                <p className="text-xs text-red-600 font-medium mb-2">Texto da Não Conformidade</p>
                                <p className="text-sm">{iaSugestao.texto_nc}</p>
                            </div>

                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                <p className="text-xs text-blue-600 font-medium mb-2">Determinação</p>
                                <p className="text-sm">{iaSugestao.texto_determinacao}</p>
                                <p className="text-xs text-gray-500 mt-2">Prazo: {iaSugestao.prazo_dias} dias</p>
                            </div>

                            {Array.isArray(iaSugestao.recomendacoes) && iaSugestao.recomendacoes.length > 0 && (
                                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                    <p className="text-xs text-green-600 font-medium mb-2">Recomendações Adicionais</p>
                                    <ul className="space-y-2">
                                        {iaSugestao.recomendacoes.map((rec, i) => (
                                            <li key={i} className="text-sm flex items-start gap-2">
                                                <span className="text-green-600">•</span>
                                                <span>{rec}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="flex gap-2 pt-4">
                                <Button 
                                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                                    onClick={() => {
                                        const ultimaResposta = respostasExistentes[respostasExistentes.length - 1];
                                        const itemId = ultimaResposta?.item_checklist_id;
                                        const constatacaoNum = parseInt(ultimaResposta?.numero_constatacao?.replace('C', '') || '1');
                                        if (itemId) {
                                            aplicarSugestaoIAMutation.mutate({ itemId, sugestao: iaSugestao, constatacaoNum });
                                        }
                                    }}
                                    disabled={aplicarSugestaoIAMutation.isPending}
                                >
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    {aplicarSugestaoIAMutation.isPending ? 'Aplicando...' : 'Aplicar Sugestões'}
                                </Button>
                                <Button variant="outline" onClick={() => setShowIASugestao(false)}>
                                    Cancelar
                                </Button>
                            </div>

                            <p className="text-xs text-gray-500 text-center">
                                ⚠️ Revise as sugestões antes de aplicar. A IA é uma ferramenta de apoio.
                            </p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}