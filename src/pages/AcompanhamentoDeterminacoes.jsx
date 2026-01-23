import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, AlertCircle, CheckCircle, Clock, FileText, ChevronDown, ChevronRight, MapPin, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ChartEvolucaoStatus from '@/components/determinacoes/ChartEvolucaoStatus';
import AnaliseTemposMedios from '@/components/determinacoes/AnaliseTemposMedios';
import MapaDistribuicao from '@/components/determinacoes/MapaDistribuicao';
import DeterminacoesFiltros from '@/components/determinacoes/DeterminacoesFiltros';

export default function AcompanhamentoDeterminacoes() {
    const [selectedDeterminacao, setSelectedDeterminacao] = useState(null);
    const [expandedFiscalizacao, setExpandedFiscalizacao] = useState(null);
    const [filtros, setFiltros] = useState({
        municipio: '',
        servico: '',
        prestador: '',
        dataInicio: '',
        dataFim: ''
    });

    const { data: determinacoes = [] } = useQuery({
        queryKey: ['determinacoes'],
        queryFn: () => base44.entities.Determinacao.list()
    });

    const { data: respostas = [] } = useQuery({
        queryKey: ['respostas-determinacoes'],
        queryFn: () => base44.entities.RespostaDeterminacao.list()
    });

    const { data: autos = [] } = useQuery({
        queryKey: ['autos-infracao'],
        queryFn: () => base44.entities.AutoInfracao.list()
    });

    const { data: unidades = [] } = useQuery({
        queryKey: ['unidades-fiscalizadas'],
        queryFn: () => base44.entities.UnidadeFiscalizada.list()
    });

    const { data: fiscalizacoes = [] } = useQuery({
        queryKey: ['fiscalizacoes'],
        queryFn: () => base44.entities.Fiscalizacao.list()
    });

    const { data: municipios = [] } = useQuery({
        queryKey: ['municipios'],
        queryFn: () => base44.entities.Municipio.list()
    });

    const { data: prestadores = [] } = useQuery({
        queryKey: ['prestadores'],
        queryFn: () => base44.entities.PrestadorServico.list()
    });

    const { data: termos = [] } = useQuery({
        queryKey: ['termos-notificacao'],
        queryFn: () => base44.entities.TermoNotificacao.list()
    });

    // Função para calcular data limite com base no TN
    const getDataLimiteComTermo = (determinacao, fiscalizacaoId) => {
        // Buscar o termo de notificação da fiscalização
        const termo = termos.find(t => t.fiscalizacao_id === fiscalizacaoId);
        
        if (termo?.data_protocolo && determinacao.prazo_dias) {
            // Calcular prazo a partir da data de protocolo do TN
            const dataProtocolo = new Date(termo.data_protocolo);
            const dataLimite = new Date(dataProtocolo.getTime() + determinacao.prazo_dias * 24 * 60 * 60 * 1000);
            return dataLimite;
        }
        
        // Fallback para data_limite original
        return determinacao.data_limite ? new Date(determinacao.data_limite) : null;
    };

    // Aplicar filtros
    const determFiltradas = useMemo(() => {
        return determinacoes.filter(det => {
            const unidade = unidades.find(u => u.id === det.unidade_fiscalizada_id);
            const fisc = fiscalizacoes.find(f => f.id === unidade?.fiscalizacao_id);
            
            // Filtro município
            if (filtros.municipio && fisc?.municipio_id !== filtros.municipio) return false;
            
            // Filtro serviço
            if (filtros.servico && (!fisc?.servicos || !fisc.servicos.includes(filtros.servico))) return false;
            
            // Filtro prestador
            if (filtros.prestador && fisc?.prestador_servico_id !== filtros.prestador) return false;
            
            // Filtro data
            if (filtros.dataInicio) {
                const dataInicio = new Date(filtros.dataInicio);
                if (new Date(det.created_date) < dataInicio) return false;
            }
            if (filtros.dataFim) {
                const dataFim = new Date(filtros.dataFim);
                dataFim.setHours(23, 59, 59);
                if (new Date(det.created_date) > dataFim) return false;
            }
            
            return true;
        });
    }, [determinacoes, filtros, unidades, fiscalizacoes]);

    // Calcular KPIs com filtros aplicados
    const determVencidas = determFiltradas.filter(d => {
        const hoje = new Date();
        const unidade = unidades.find(u => u.id === d.unidade_fiscalizada_id);
        const limite = getDataLimiteComTermo(d, unidade?.fiscalizacao_id);
        return limite && limite < hoje && d.status === 'pendente';
    }).length;

    const determVencerEm7 = determFiltradas.filter(d => {
        const hoje = new Date();
        const unidade = unidades.find(u => u.id === d.unidade_fiscalizada_id);
        const limite = getDataLimiteComTermo(d, unidade?.fiscalizacao_id);
        if (!limite) return false;
        const diasAte = (limite - hoje) / (1000 * 60 * 60 * 24);
        return diasAte > 0 && diasAte <= 7 && d.status === 'pendente';
    }).length;

    const determRespondidas = respostas.filter(r => r.status !== 'pendente' && determFiltradas.find(d => d.id === r.determinacao_id)).length;

    // Agrupar determinações por fiscalização
    const fiscalizacoesComDeterminacoes = useMemo(() => {
        const fiscPorId = {};
        
        determFiltradas.forEach(det => {
            const unidade = unidades.find(u => u.id === det.unidade_fiscalizada_id);
            if (!unidade) return;
            
            const fisc = fiscalizacoes.find(f => f.id === unidade.fiscalizacao_id);
            if (!fisc) return;
            
            if (!fiscPorId[fisc.id]) {
                fiscPorId[fisc.id] = {
                    fiscalizacao: fisc,
                    determinacoes: []
                };
            }
            
            fiscPorId[fisc.id].determinacoes.push({
                ...det,
                unidade: unidade
            });
        });
        
        return Object.values(fiscPorId);
    }, [determFiltradas, unidades, fiscalizacoes]);

    // Agrupar determinações por status (com filtros)
    const determPorStatus = {
        pendente: determFiltradas.filter(d => d.status === 'pendente'),
        atendidas: respostas.filter(r => r.status === 'atendida' && determFiltradas.find(d => d.id === r.determinacao_id)),
        nao_atendidas: respostas.filter(r => r.status === 'nao_atendida' && determFiltradas.find(d => d.id === r.determinacao_id)),
        com_auto: autos.filter(a => a.status !== 'finalizado' && determFiltradas.find(d => d.id === a.determinacao_id))
    };

    const getUnidadeNome = (id) => {
        const u = unidades.find(u => u.id === id);
        return u?.nome_unidade || 'N/A';
    };

    const getMunicipio = (id) => {
        const m = municipios.find(m => m.id === id);
        return m?.nome || 'N/A';
    };
    
    const getFiscalizacaoUnidades = (fiscId) => {
        return unidades.filter(u => u.fiscalizacao_id === fiscId).length;
    };

    const getStatusBadge = (status) => {
        const statusMap = {
            pendente: { label: 'Pendente', variant: 'outline', color: 'text-orange-600' },
            atendida: { label: 'Acatada', variant: 'default', color: 'text-green-600' },
            justificada: { label: 'Justificada', variant: 'secondary', color: 'text-blue-600' },
            nao_atendida: { label: 'Não Acatada', variant: 'destructive', color: 'text-red-600' }
        };
        return statusMap[status] || statusMap.pendente;
    };

    const diasAteVencimento = (dataLimite) => {
        const hoje = new Date();
        const limite = new Date(dataLimite);
        return Math.ceil((limite - hoje) / (1000 * 60 * 60 * 24));
    };

    const handleFiltroChange = (campo, valor) => {
        setFiltros(prev => ({ ...prev, [campo]: valor }));
    };

    const handleLimparFiltros = () => {
        setFiltros({
            municipio: '',
            servico: '',
            prestador: '',
            dataInicio: '',
            dataFim: ''
        });
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <Link to={createPageUrl('Home')}>
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <h1 className="text-3xl font-bold">Acompanhamento de Determinações</h1>
                    </div>
                </div>

                {/* Filtros */}
                <DeterminacoesFiltros 
                    filtros={filtros}
                    onFiltroChange={handleFiltroChange}
                    onLimpar={handleLimparFiltros}
                    municipios={municipios}
                    prestadores={prestadores}
                />

                {/* KPIs */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                    <Card>
                        <CardContent className="p-6">
                            <div className="text-center">
                                <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                                <p className="text-sm text-gray-600 mb-1">Vencidas</p>
                                <p className="text-2xl font-bold text-red-600">{determVencidas}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="text-center">
                                <Clock className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                                <p className="text-sm text-gray-600 mb-1">Vencer em 7 dias</p>
                                <p className="text-2xl font-bold text-orange-600">{determVencerEm7}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="text-center">
                                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                                <p className="text-sm text-gray-600 mb-1">Respondidas</p>
                                <p className="text-2xl font-bold text-green-600">{determRespondidas}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="text-center">
                                <FileText className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                                <p className="text-sm text-gray-600 mb-1">Total</p>
                                <p className="text-2xl font-bold text-blue-600">{determinacoes.length}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Lista de Fiscalizações com Determinações */}
                <Tabs defaultValue="pendentes" className="w-full mb-8">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="pendentes">Pendentes ({determPorStatus.pendente.length})</TabsTrigger>
                        <TabsTrigger value="atendidas">Acatadas ({determPorStatus.atendidas.length})</TabsTrigger>
                        <TabsTrigger value="nao_atendidas">Não Acatadas ({determPorStatus.nao_atendidas.length})</TabsTrigger>
                        <TabsTrigger value="autos">Com Auto ({determPorStatus.com_auto.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="pendentes" className="space-y-4">
                        {fiscalizacoesComDeterminacoes
                            .filter(f => f.determinacoes.some(d => d.status === 'pendente'))
                            .map(({ fiscalizacao, determinacoes: dets }) => {
                                const detsPendentes = dets.filter(d => d.status === 'pendente');
                                const isExpanded = expandedFiscalizacao === fiscalizacao.id;
                                
                                return (
                                    <Card key={fiscalizacao.id} className="overflow-hidden">
                                        <CardContent 
                                            className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                                            onClick={() => setExpandedFiscalizacao(isExpanded ? null : fiscalizacao.id)}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-start gap-3 flex-1">
                                                    {isExpanded ? <ChevronDown className="h-5 w-5 text-gray-500 mt-1" /> : <ChevronRight className="h-5 w-5 text-gray-500 mt-1" />}
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div>
                                                                <h3 className="font-semibold text-lg">{fiscalizacao.numero_termo}</h3>
                                                                {(() => {
                                                                    const termo = termos.find(t => t.fiscalizacao_id === fiscalizacao.id);
                                                                    if (termo?.numero_rfp) {
                                                                        return (
                                                                            <p className="text-sm text-blue-600 font-medium">
                                                                                RFP/DSB/{termo.camara_tecnica}/{String(termo.numero_rfp).padStart(3, '0')}/{new Date(termo.data_geracao || Date.now()).getFullYear()}
                                                                            </p>
                                                                        );
                                                                    }
                                                                })()}
                                                            </div>
                                                            <span className="text-gray-500">•</span>
                                                            <div className="flex items-center gap-1 text-gray-600">
                                                                <MapPin className="h-4 w-4" />
                                                                <span className="text-sm">{getMunicipio(fiscalizacao.municipio_id)}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-4 text-sm text-gray-600">
                                                            <div className="flex items-center gap-1">
                                                                <FileText className="h-4 w-4" />
                                                                <span>Concluída em: {new Date(fiscalizacao.data_fim).toLocaleDateString('pt-BR')}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <Building2 className="h-4 w-4" />
                                                                <span>{getFiscalizacaoUnidades(fiscalizacao.id)} unidades</span>
                                                            </div>
                                                            <div>
                                                                <Badge variant="outline">{detsPendentes.length} determinações pendentes</Badge>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                        
                                        {isExpanded && (
                                            <div className="border-t bg-gray-50 p-4 space-y-3">
                                                {detsPendentes.map(det => {
                                                    const dataLimite = getDataLimiteComTermo(det, fiscalizacao.id);
                                                    const dias = dataLimite ? diasAteVencimento(dataLimite) : null;
                                                    const termo = termos.find(t => t.fiscalizacao_id === fiscalizacao.id);
                                                    
                                                    return (
                                                        <Card key={det.id} className={dias && dias < 7 ? 'border-orange-300 bg-orange-50' : 'bg-white'}>
                                                            <CardContent className="p-4">
                                                                <div className="flex justify-between items-start">
                                                                    <div className="flex-1">
                                                                        <h4 className="font-semibold mb-2">{det.numero_determinacao}</h4>
                                                                        <p className="text-sm text-gray-600 mb-2">{det.descricao}</p>
                                                                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                                                                            <p>Unidade: {det.unidade.nome_unidade || 'N/A'}</p>
                                                                            <p>Município: {getMunicipio(fiscalizacao.municipio_id)}</p>
                                                                            <p>Termo: {fiscalizacao.numero_termo}</p>
                                                                            <p>
                                                                                Prazo: {dataLimite ? dataLimite.toLocaleDateString('pt-BR') : 'N/A'}
                                                                                {termo?.data_protocolo && det.prazo_dias && (
                                                                                    <span className="ml-1 text-blue-600">
                                                                                        ({det.prazo_dias} dias após protocolo TN)
                                                                                    </span>
                                                                                )}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right ml-4">
                                                                        {dias !== null ? (
                                                                            <Badge className={dias < 0 ? 'bg-red-600' : dias < 7 ? 'bg-orange-500' : 'bg-green-600'}>
                                                                                {dias < 0 ? `${Math.abs(dias)} dias vencido` : `${dias} dias`}
                                                                            </Badge>
                                                                        ) : (
                                                                            <Badge variant="outline">Sem prazo definido</Badge>
                                                                        )}
                                                                        <Link to={createPageUrl(`AnalisarResposta?determinacao=${det.id}`)}>
                                                                            <Button size="sm" className="mt-2 w-full">Analisar</Button>
                                                                        </Link>
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </Card>
                                );
                            })}
                    </TabsContent>

                    <TabsContent value="atendidas" className="space-y-4">
                        {fiscalizacoesComDeterminacoes
                            .filter(f => {
                                const detsIds = f.determinacoes.map(d => d.id);
                                return respostas.some(r => r.status === 'atendida' && detsIds.includes(r.determinacao_id));
                            })
                            .map(({ fiscalizacao, determinacoes: dets }) => {
                                const detsAtendidas = respostas.filter(r => 
                                    r.status === 'atendida' && dets.some(d => d.id === r.determinacao_id)
                                );
                                const isExpanded = expandedFiscalizacao === fiscalizacao.id;
                                
                                return (
                                    <Card key={fiscalizacao.id} className="overflow-hidden border-green-200">
                                        <CardContent 
                                            className="p-4 cursor-pointer hover:bg-green-50 transition-colors"
                                            onClick={() => setExpandedFiscalizacao(isExpanded ? null : fiscalizacao.id)}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-start gap-3 flex-1">
                                                    {isExpanded ? <ChevronDown className="h-5 w-5 text-gray-500 mt-1" /> : <ChevronRight className="h-5 w-5 text-gray-500 mt-1" />}
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div>
                                                                <h3 className="font-semibold text-lg">{fiscalizacao.numero_termo}</h3>
                                                                {(() => {
                                                                    const termo = termos.find(t => t.fiscalizacao_id === fiscalizacao.id);
                                                                    if (termo?.numero_rfp) {
                                                                        return (
                                                                            <p className="text-sm text-blue-600 font-medium">
                                                                                RFP/DSB/{termo.camara_tecnica}/{String(termo.numero_rfp).padStart(3, '0')}/{new Date(termo.data_geracao || Date.now()).getFullYear()}
                                                                            </p>
                                                                        );
                                                                    }
                                                                })()}
                                                            </div>
                                                            <span className="text-gray-500">•</span>
                                                            <div className="flex items-center gap-1 text-gray-600">
                                                                <MapPin className="h-4 w-4" />
                                                                <span className="text-sm">{getMunicipio(fiscalizacao.municipio_id)}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-4 text-sm text-gray-600">
                                                            <div>
                                                                <Badge className="bg-green-600">{detsAtendidas.length} acatadas</Badge>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                        
                                        {isExpanded && (
                                            <div className="border-t bg-green-50 p-4 space-y-3">
                                                {detsAtendidas.map(resp => {
                                                    const det = dets.find(d => d.id === resp.determinacao_id);
                                                    return (
                                                        <Card key={resp.id} className="bg-white border-green-300">
                                                            <CardContent className="p-4">
                                                                <div className="flex justify-between items-start">
                                                                    <div className="flex-1">
                                                                        <h4 className="font-semibold mb-2">{det?.numero_determinacao}</h4>
                                                                        <p className="text-sm text-gray-600 mb-1">Respondida em: {new Date(resp.data_resposta).toLocaleDateString('pt-BR')}</p>
                                                                        <p className="text-xs text-gray-500">{resp.descricao_atendimento}</p>
                                                                    </div>
                                                                    <Badge className="bg-green-600">Acatada</Badge>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </Card>
                                );
                            })}
                    </TabsContent>

                    <TabsContent value="nao_atendidas" className="space-y-4">
                        {fiscalizacoesComDeterminacoes
                            .filter(f => {
                                const detsIds = f.determinacoes.map(d => d.id);
                                return respostas.some(r => r.status === 'nao_atendida' && detsIds.includes(r.determinacao_id));
                            })
                            .map(({ fiscalizacao, determinacoes: dets }) => {
                                const detsNaoAtendidas = respostas.filter(r => 
                                    r.status === 'nao_atendida' && dets.some(d => d.id === r.determinacao_id)
                                );
                                const isExpanded = expandedFiscalizacao === fiscalizacao.id;
                                
                                return (
                                    <Card key={fiscalizacao.id} className="overflow-hidden border-red-200">
                                        <CardContent 
                                            className="p-4 cursor-pointer hover:bg-red-50 transition-colors"
                                            onClick={() => setExpandedFiscalizacao(isExpanded ? null : fiscalizacao.id)}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-start gap-3 flex-1">
                                                    {isExpanded ? <ChevronDown className="h-5 w-5 text-gray-500 mt-1" /> : <ChevronRight className="h-5 w-5 text-gray-500 mt-1" />}
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div>
                                                                <h3 className="font-semibold text-lg">{fiscalizacao.numero_termo}</h3>
                                                                {(() => {
                                                                    const termo = termos.find(t => t.fiscalizacao_id === fiscalizacao.id);
                                                                    if (termo?.numero_rfp) {
                                                                        return (
                                                                            <p className="text-sm text-blue-600 font-medium">
                                                                                RFP/DSB/{termo.camara_tecnica}/{String(termo.numero_rfp).padStart(3, '0')}/{new Date(termo.data_geracao || Date.now()).getFullYear()}
                                                                            </p>
                                                                        );
                                                                    }
                                                                })()}
                                                            </div>
                                                            <span className="text-gray-500">•</span>
                                                            <div className="flex items-center gap-1 text-gray-600">
                                                                <MapPin className="h-4 w-4" />
                                                                <span className="text-sm">{getMunicipio(fiscalizacao.municipio_id)}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-4 text-sm text-gray-600">
                                                            <div>
                                                                <Badge className="bg-red-600">{detsNaoAtendidas.length} não atendidas</Badge>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                        
                                        {isExpanded && (
                                            <div className="border-t bg-red-50 p-4 space-y-3">
                                                {detsNaoAtendidas.map(resp => {
                                                    const det = dets.find(d => d.id === resp.determinacao_id);
                                                    const dataLimite = det ? getDataLimiteComTermo(det, fiscalizacao.id) : null;

                                                    return (
                                                       <Card key={resp.id} className="bg-white border-red-300">
                                                           <CardContent className="p-4">
                                                               <div className="flex justify-between items-start">
                                                                   <div className="flex-1">
                                                                       <h4 className="font-semibold mb-2">{det?.numero_determinacao}</h4>
                                                                       <p className="text-sm text-red-700 font-medium">Não atendida no prazo</p>
                                                                       <p className="text-xs text-gray-500 mt-1">
                                                                           Vencimento: {dataLimite ? dataLimite.toLocaleDateString('pt-BR') : 'N/A'}
                                                                       </p>
                                                                   </div>
                                                                   <Badge className="bg-red-600">Não Atendida</Badge>
                                                               </div>
                                                           </CardContent>
                                                       </Card>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </Card>
                                );
                            })}
                    </TabsContent>

                    <TabsContent value="autos" className="space-y-4">
                        {determPorStatus.com_auto.map(auto => {
                            const det = determinacoes.find(d => d.id === auto.determinacao_id);
                            return (
                                <Card key={auto.id} className="border-red-300">
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <h3 className="font-semibold mb-2">{auto.numero_auto}</h3>
                                                <p className="text-sm text-gray-600 mb-1">Determinação: {det?.numero_determinacao}</p>
                                                <p className="text-xs text-gray-500">Prazo resposta: {new Date(auto.data_limite_manifestacao).toLocaleDateString('pt-BR')}</p>
                                            </div>
                                            <Link to={createPageUrl(`AnaliseManifestacao?auto=${auto.id}`)}>
                                                <Button size="sm">Analisar Auto</Button>
                                            </Link>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </TabsContent>
                </Tabs>

                {/* Análises */}
                <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">Análises</h2>
                    <AnaliseTemposMedios determinacoes={determFiltradas} respostas={respostas} />
                </div>

                {/* Gráficos */}
                <div className="grid grid-cols-2 gap-6">
                    <ChartEvolucaoStatus determinacoes={determFiltradas} respostas={respostas} />
                    <MapaDistribuicao determinacoes={determFiltradas} autos={autos} municipios={municipios} />
                </div>
            </div>
        </div>
    );
}