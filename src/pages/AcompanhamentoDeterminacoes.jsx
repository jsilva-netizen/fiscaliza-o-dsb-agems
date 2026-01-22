import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, AlertCircle, CheckCircle, Clock, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ChartEvolucaoStatus from '@/components/determinacoes/ChartEvolucaoStatus';
import AnaliseTemposMedios from '@/components/determinacoes/AnaliseTemposMedios';
import MapaDistribuicao from '@/components/determinacoes/MapaDistribuicao';
import DeterminacoesFiltros from '@/components/determinacoes/DeterminacoesFiltros';

export default function AcompanhamentoDeterminacoes() {
    const [selectedDeterminacao, setSelectedDeterminacao] = useState(null);
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
        const limite = new Date(d.data_limite);
        return limite < hoje && d.status === 'pendente';
    }).length;

    const determVencerEm7 = determFiltradas.filter(d => {
        const hoje = new Date();
        const limite = new Date(d.data_limite);
        const diasAte = (limite - hoje) / (1000 * 60 * 60 * 24);
        return diasAte > 0 && diasAte <= 7 && d.status === 'pendente';
    }).length;

    const determRespondidas = respostas.filter(r => r.status !== 'pendente' && determFiltradas.find(d => d.id === r.determinacao_id)).length;

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

    const getStatusBadge = (status) => {
        const statusMap = {
            pendente: { label: 'Pendente', variant: 'outline', color: 'text-orange-600' },
            atendida: { label: 'Atendida', variant: 'default', color: 'text-green-600' },
            justificada: { label: 'Justificada', variant: 'secondary', color: 'text-blue-600' },
            nao_atendida: { label: 'Não Atendida', variant: 'destructive', color: 'text-red-600' }
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

                {/* Tabs */}
                <Tabs defaultValue="pendentes" className="w-full mb-8">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="pendentes">Pendentes ({determPorStatus.pendente.length})</TabsTrigger>
                        <TabsTrigger value="atendidas">Atendidas ({determPorStatus.atendidas.length})</TabsTrigger>
                        <TabsTrigger value="nao_atendidas">Não Atendidas ({determPorStatus.nao_atendidas.length})</TabsTrigger>
                        <TabsTrigger value="autos">Com Auto ({determPorStatus.com_auto.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="pendentes" className="space-y-4">
                        {determPorStatus.pendente.map(det => {
                            const dias = diasAteVencimento(det.data_limite);
                            return (
                                <Card key={det.id} className={dias < 7 ? 'border-orange-300 bg-orange-50' : ''}>
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <h3 className="font-semibold mb-2">{det.numero_determinacao}</h3>
                                                <p className="text-sm text-gray-600 mb-1">{det.descricao}</p>
                                                <p className="text-xs text-gray-500">Unidade: {getUnidadeNome(det.unidade_fiscalizada_id)}</p>
                                                <p className="text-xs text-gray-500">Prazo: {new Date(det.data_limite).toLocaleDateString('pt-BR')}</p>
                                            </div>
                                            <div className="text-right">
                                                <Badge className={dias < 0 ? 'bg-red-600' : dias < 7 ? 'bg-orange-500' : 'bg-green-600'}>
                                                    {dias < 0 ? `${Math.abs(dias)} dias vencido` : `${dias} dias`}
                                                </Badge>
                                                <Link to={createPageUrl(`AnalisarResposta?determinacao=${det.id}`)}>
                                                    <Button size="sm" className="mt-2 w-full">Analisar</Button>
                                                </Link>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </TabsContent>

                    <TabsContent value="atendidas" className="space-y-4">
                        {respostas.filter(r => r.status === 'atendida').map(resp => {
                            const det = determinacoes.find(d => d.id === resp.determinacao_id);
                            return (
                                <Card key={resp.id} className="border-green-300 bg-green-50">
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <h3 className="font-semibold mb-2">{det?.numero_determinacao}</h3>
                                                <p className="text-sm text-gray-600 mb-1">Respondida em: {new Date(resp.data_resposta).toLocaleDateString('pt-BR')}</p>
                                                <p className="text-xs text-gray-500">{resp.descricao_atendimento}</p>
                                            </div>
                                            <Badge className="bg-green-600">Atendida</Badge>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </TabsContent>

                    <TabsContent value="nao_atendidas" className="space-y-4">
                        {respostas.filter(r => r.status === 'nao_atendida').map(resp => {
                            const det = determinacoes.find(d => d.id === resp.determinacao_id);
                            return (
                                <Card key={resp.id} className="border-red-300 bg-red-50">
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <h3 className="font-semibold mb-2">{det?.numero_determinacao}</h3>
                                                <p className="text-sm text-red-700 font-medium">Não atendida no prazo</p>
                                                <p className="text-xs text-gray-500 mt-1">Vencimento: {new Date(det?.data_limite).toLocaleDateString('pt-BR')}</p>
                                            </div>
                                            <Badge className="bg-red-600">Não Atendida</Badge>
                                        </div>
                                    </CardContent>
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