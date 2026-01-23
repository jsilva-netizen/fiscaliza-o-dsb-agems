import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, FileText, Upload, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import FluxoUploadDocumentos from '../components/autos/FluxoUploadDocumentos';

export default function GestaoAutos() {
     const queryClient = useQueryClient();
     const [autoForm, setAutoForm] = useState({ motivo: '', prazo: '15' });
     const [uploadingFile, setUploadingFile] = useState(false);
     const [penaBase, setPenaBase] = useState({});

    const { data: autos = [] } = useQuery({
        queryKey: ['autos-infracao'],
        queryFn: () => base44.entities.AutoInfracao.list()
    });

    const { data: respostas = [] } = useQuery({
        queryKey: ['respostas-determinacoes'],
        queryFn: () => base44.entities.RespostaDeterminacao.list()
    });

    const { data: determinacoes = [] } = useQuery({
        queryKey: ['determinacoes'],
        queryFn: () => base44.entities.Determinacao.list()
    });

    const { data: manifestacoes = [] } = useQuery({
        queryKey: ['manifestacoes-auto'],
        queryFn: () => base44.entities.ManifestacaoAuto.list()
    });

    const { data: prestadores = [] } = useQuery({
       queryKey: ['prestadores'],
       queryFn: () => base44.entities.PrestadorServico.list()
    });

    const { data: fiscalizacoes = [] } = useQuery({
       queryKey: ['fiscalizacoes'],
       queryFn: () => base44.entities.Fiscalizacao.list()
    });

    const { data: municipios = [] } = useQuery({
       queryKey: ['municipios'],
       queryFn: () => base44.entities.Municipio.list()
    });

    const criarAutoMutation = useMutation({
        mutationFn: async (dados) => {
            const { numero_auto } = await base44.functions.invoke('gerarNumeroAuto', {});
            const dataLimite = new Date();
            dataLimite.setDate(dataLimite.getDate() + parseInt(dados.prazo_manifestacao));

            return base44.entities.AutoInfracao.create({
                ...dados,
                numero_auto: numero_auto,
                data_geracao: new Date().toISOString(),
                data_limite_manifestacao: dataLimite.toISOString().split('T')[0],
                status: 'gerado'
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['autos-infracao'] });
            alert('Auto gerado com sucesso!');
            setAutoForm({ motivo: '', prazo: '15' });
        }
    });

    const enviarAutoMutation = useMutation({
         mutationFn: async (id) => {
             return base44.entities.AutoInfracao.update(id, {
                 status: 'enviado',
                 data_envio: new Date().toISOString()
             });
         },
         onSuccess: () => {
             queryClient.invalidateQueries({ queryKey: ['autos-infracao'] });
             alert('Auto enviado!');
         }
     });

     const salvarPenaBaseMutation = useMutation({
         mutationFn: async ({ autoId, penaUferms, penaRs }) => {
             return base44.entities.AutoInfracao.update(autoId, {
                 pena_base_uferms: parseInt(penaUferms) || 0,
                 pena_base_rs: parseFloat(penaRs.replace('R$', '').replace(',', '.').trim()) || 0
             });
         },
         onSuccess: () => {
             queryClient.invalidateQueries({ queryKey: ['autos-infracao'] });
             alert('Pena base salva com sucesso!');
             setPenaBase({});
         }
     });

    const handleUploadAuto = async (autoId, e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingFile(true);
        try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            await base44.entities.AutoInfracao.update(autoId, {
                arquivo_url: file_url
            });
            queryClient.invalidateQueries({ queryKey: ['autos-infracao'] });
            alert('Arquivo do auto salvo!');
        } catch (error) {
            console.error('Erro:', error);
            alert('Erro ao fazer upload');
        } finally {
            setUploadingFile(false);
        }
    };

    const getPrestadorNome = (id) => {
        const p = prestadores.find(pres => pres.id === id);
        return p?.nome || 'N/A';
    };

    const getMunicipioNome = (autoId) => {
         const auto = autos.find(a => a.id === autoId);
         const fisc = fiscalizacoes.find(f => f.id === auto?.fiscalizacao_id);
         const mun = municipios.find(m => m.id === fisc?.municipio_id);
         return mun?.nome || 'N/A';
     };

     const getNumeroProcesso = (autoId) => {
         const auto = autos.find(a => a.id === autoId);
         const fisc = fiscalizacoes.find(f => f.id === auto?.fiscalizacao_id);
         return fisc?.numero_processo || 'N/A';
     };

    const getStatusBadge = (status) => {
        const statusMap = {
            gerado: { label: 'Gerado', color: 'bg-gray-600' },
            enviado: { label: 'Enviado', color: 'bg-blue-600' },
            respondido: { label: 'Respondido', color: 'bg-green-600' },
            em_analise: { label: 'Em Análise', color: 'bg-orange-600' },
            finalizado: { label: 'Finalizado', color: 'bg-purple-600' }
        };
        return statusMap[status] || statusMap.gerado;
    };

    const autosNaoAtendidas = respostas.filter(r => r.status === 'nao_atendida');
    const autosPorStatus = {
        gerados: autos.filter(a => a.status === 'gerado'),
        enviados: autos.filter(a => a.status === 'enviado'),
        respondidos: autos.filter(a => a.status === 'respondido'),
        em_analise: autos.filter(a => a.status === 'em_analise')
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-2 mb-6">
                    <Link to={createPageUrl('Home')}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-3xl font-bold">Gestão de Autos de Infração</h1>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                    <Card>
                        <CardContent className="p-4 text-center">
                            <p className="text-sm text-gray-600 mb-1">Gerados</p>
                            <p className="text-2xl font-bold">{autosPorStatus.gerados.length}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 text-center">
                            <p className="text-sm text-gray-600 mb-1">Enviados</p>
                            <p className="text-2xl font-bold">{autosPorStatus.enviados.length}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 text-center">
                            <p className="text-sm text-gray-600 mb-1">Respondidos</p>
                            <p className="text-2xl font-bold">{autosPorStatus.respondidos.length}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 text-center">
                            <p className="text-sm text-gray-600 mb-1">Em Análise</p>
                            <p className="text-2xl font-bold">{autosPorStatus.em_analise.length}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="gerados" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="gerados">Gerados ({autosPorStatus.gerados.length})</TabsTrigger>
                        <TabsTrigger value="enviados">Enviados ({autosPorStatus.enviados.length})</TabsTrigger>
                        <TabsTrigger value="respondidos">Respondidos ({autosPorStatus.respondidos.length})</TabsTrigger>
                        <TabsTrigger value="analise">Em Análise ({autosPorStatus.em_analise.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="gerados" className="space-y-4">
                        {autosPorStatus.gerados.map(auto => (
                        <Card key={auto.id}>
                        <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-4">
                         <div className="flex-1">
                             <h3 className="font-semibold">{auto.numero_auto}</h3>
                             <p className="text-xs text-gray-500 mt-1">Prestador: {getPrestadorNome(auto.prestador_servico_id)}</p>
                             <p className="text-xs text-gray-500">Município: {getMunicipioNome(auto.id)}</p>
                             <p className="text-xs text-gray-500">Processo: {getNumeroProcesso(auto.id)}</p>
                             <p className="text-xs text-gray-500 mt-2">{auto.motivo_infracao}</p>
                         </div>
                         <div className="flex gap-2">
                             <FluxoUploadDocumentos auto={auto} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['autos-infracao'] })} />
                         </div>
                        </div>
                        <div className="border-t pt-4 grid grid-cols-2 gap-4 mb-4">
                         <div>
                             <Label>Pena Base (UFERMS)</Label>
                             <Input 
                                 type="number" 
                                 placeholder="0" 
                                 className="mt-1"
                                 defaultValue={auto.pena_base_uferms || ''}
                                 onChange={(e) => setPenaBase({ ...penaBase, [`${auto.id}-uferms`]: e.target.value })}
                             />
                         </div>
                         <div>
                             <Label>Pena Base (R$)</Label>
                             <Input 
                                 type="text" 
                                 placeholder="R$ 0,00" 
                                 className="mt-1"
                                 defaultValue={auto.pena_base_rs ? `R$ ${auto.pena_base_rs.toFixed(2).replace('.', ',')}` : ''}
                                 onChange={(e) => setPenaBase({ ...penaBase, [`${auto.id}-rs`]: e.target.value })}
                             />
                         </div>
                        </div>
                        <Button 
                         size="sm" 
                         className="w-full bg-green-600 hover:bg-green-700"
                         onClick={() => salvarPenaBaseMutation.mutate({
                             autoId: auto.id,
                             penaUferms: penaBase[`${auto.id}-uferms`] || auto.pena_base_uferms || 0,
                             penaRs: penaBase[`${auto.id}-rs`] || `R$ ${(auto.pena_base_rs || 0).toFixed(2).replace('.', ',')}`
                         })}
                         disabled={salvarPenaBaseMutation.isPending}
                        >
                         <Save className="h-4 w-4 mr-2" />
                         Salvar Alterações
                        </Button>
                        </CardContent>
                        </Card>
                        ))}
                    </TabsContent>

                    <TabsContent value="enviados" className="space-y-4">
                        {autosPorStatus.enviados.map(auto => (
                            <Card key={auto.id} className="border-blue-300">
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <h3 className="font-semibold">{auto.numero_auto}</h3>
                                            <p className="text-xs text-gray-500">Enviado: {new Date(auto.data_envio).toLocaleDateString('pt-BR')}</p>
                                            <p className="text-xs text-gray-500">Prazo até: {new Date(auto.data_limite_manifestacao).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                        <Badge className="bg-blue-600">Enviado</Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </TabsContent>

                    <TabsContent value="respondidos" className="space-y-4">
                        {autosPorStatus.respondidos.map(auto => {
                            const manifestacao = manifestacoes.find(m => m.auto_id === auto.id);
                            return (
                                <Card key={auto.id} className="border-green-300">
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <h3 className="font-semibold">{auto.numero_auto}</h3>
                                                <p className="text-xs text-gray-500">Respondido: {new Date(manifestacao?.data_manifestacao).toLocaleDateString('pt-BR')}</p>
                                                <p className="text-xs text-gray-500 line-clamp-2">{manifestacao?.descricao_manifestacao}</p>
                                            </div>
                                            <Link to={createPageUrl(`AnaliseManifestacao?auto=${auto.id}`)}>
                                                <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                                                    Analisar
                                                </Button>
                                            </Link>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </TabsContent>

                    <TabsContent value="analise" className="space-y-4">
                        {autosPorStatus.em_analise.map(auto => (
                            <Card key={auto.id} className="border-orange-300">
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <h3 className="font-semibold">{auto.numero_auto}</h3>
                                            <p className="text-xs text-gray-500">Em análise do parecer técnico</p>
                                        </div>
                                        <Badge className="bg-orange-600">Em Análise</Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}