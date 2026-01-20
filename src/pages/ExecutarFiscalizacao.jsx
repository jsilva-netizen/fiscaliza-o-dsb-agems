import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    ArrowLeft, Plus, Building2, CheckCircle2, AlertTriangle, 
    Camera, MapPin, Clock, FileText, Loader2 
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ExecutarFiscalizacao() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const urlParams = new URLSearchParams(window.location.search);
    const fiscalizacaoId = urlParams.get('id');

    const { data: fiscalizacao, isLoading: loadingFiscalizacao } = useQuery({
        queryKey: ['fiscalizacao', fiscalizacaoId],
        queryFn: () => base44.entities.Fiscalizacao.filter({ id: fiscalizacaoId }).then(r => r[0]),
        enabled: !!fiscalizacaoId,
        staleTime: 60000,
        gcTime: 300000
    });

    const { data: unidades = [], isLoading: loadingUnidades } = useQuery({
        queryKey: ['unidades-fiscalizacao', fiscalizacaoId],
        queryFn: () => base44.entities.UnidadeFiscalizada.filter({ fiscalizacao_id: fiscalizacaoId }, '-created_date', 50),
        enabled: !!fiscalizacaoId,
        staleTime: 30000,
        gcTime: 300000
    });

    const { data: tipos = [] } = useQuery({
        queryKey: ['tipos-unidade'],
        queryFn: () => base44.entities.TipoUnidade.list('nome', 100),
        staleTime: 3600000,
        gcTime: 86400000
    });

    const finalizarMutation = useMutation({
        mutationFn: async () => {
            // Recarregar unidades do banco para validação precisa
            const unidadesAtualizadas = await base44.entities.UnidadeFiscalizada.filter({ 
                fiscalizacao_id: fiscalizacaoId 
            });
            
            // Verificar se todas as unidades estão completas
            for (const unidade of unidadesAtualizadas) {
                const fotos = Array.isArray(unidade.fotos_unidade) ? unidade.fotos_unidade : [];
                if (fotos.length < 2) {
                    throw new Error(`Unidade "${unidade.nome_unidade || unidade.tipo_unidade_nome}" precisa de pelo menos 2 fotos (tem ${fotos.length}).`);
                }
                if (unidade.status !== 'finalizada') {
                    throw new Error(`Finalize a vistoria da unidade "${unidade.nome_unidade || unidade.tipo_unidade_nome}" antes de finalizar a fiscalização.`);
                }
            }
            
            return base44.entities.Fiscalizacao.update(fiscalizacaoId, {
                status: 'finalizada',
                data_fim: new Date().toISOString()
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fiscalizacoes'] });
            navigate(createPageUrl('Fiscalizacoes'));
        },
        onError: (err) => {
            alert(err.message);
        }
    });

    if (loadingFiscalizacao) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!fiscalizacao) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p>Fiscalização não encontrada</p>
            </div>
        );
    }

    const tiposFiltrados = tipos.filter(t => 
        t.servicos_aplicaveis?.includes(fiscalizacao.servico)
    );

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <div className="bg-blue-900 text-white sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link to={createPageUrl('Fiscalizacoes')}>
                                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                            </Link>
                            <div>
                                <h1 className="font-bold">{fiscalizacao.municipio_nome}</h1>
                                <div className="flex items-center gap-2 text-sm text-blue-200">
                                    <Badge variant="secondary" className="text-xs">
                                        {fiscalizacao.servico}
                                    </Badge>
                                    <span>•</span>
                                    <span>{format(new Date(fiscalizacao.data_inicio), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                                </div>
                            </div>
                        </div>
                        <Badge className={fiscalizacao.status === 'finalizada' ? 'bg-green-500' : 'bg-yellow-500'}>
                            {fiscalizacao.status === 'finalizada' ? 'Finalizada' : 'Em andamento'}
                        </Badge>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 py-4">
                {/* Stats */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                    <Card className="bg-blue-50">
                        <CardContent className="p-3 text-center">
                            <p className="text-2xl font-bold text-blue-600">{unidades.length}</p>
                            <p className="text-xs text-gray-500">Unidades</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-green-50">
                        <CardContent className="p-3 text-center">
                            <p className="text-2xl font-bold text-green-600">
                                {unidades.reduce((acc, u) => acc + (u.total_constatacoes || 0), 0)}
                            </p>
                            <p className="text-xs text-gray-500">Constatações</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-red-50">
                        <CardContent className="p-3 text-center">
                            <p className="text-2xl font-bold text-red-600">
                                {unidades.reduce((acc, u) => acc + (u.total_ncs || 0), 0)}
                            </p>
                            <p className="text-xs text-gray-500">NCs</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-purple-50">
                        <CardContent className="p-3 text-center">
                            <p className="text-2xl font-bold text-purple-600">
                                {unidades.reduce((acc, u) => acc + (u.fotos_unidade?.length || 0), 0)}
                            </p>
                            <p className="text-xs text-gray-500">Fotos</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Add Unit Button */}
                {fiscalizacao.status !== 'finalizada' && (
                    <Link to={createPageUrl('AdicionarUnidade') + `?fiscalizacao=${fiscalizacaoId}`}>
                        <Button className="w-full mb-4 h-14 bg-green-600 hover:bg-green-700">
                            <Plus className="h-5 w-5 mr-2" />
                            Adicionar Unidade
                        </Button>
                    </Link>
                )}

                {/* Units List */}
                <div className="space-y-3">
                    {unidades.map((unidade) => (
                        <Link 
                            key={unidade.id} 
                            to={createPageUrl('VistoriarUnidade') + `?id=${unidade.id}`}
                        >
                            <Card className="hover:shadow-md transition-shadow cursor-pointer">
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-3">
                                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                                            unidade.status === 'finalizada' ? 'bg-green-100' : 'bg-blue-100'
                                        }`}>
                                            <Building2 className={`h-6 w-6 ${
                                                unidade.status === 'finalizada' ? 'text-green-600' : 'text-blue-600'
                                            }`} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h3 className="font-medium">{unidade.tipo_unidade_nome}</h3>
                                                    {unidade.nome_unidade && (
                                                        <p className="text-sm text-gray-500">{unidade.nome_unidade}</p>
                                                    )}
                                                </div>
                                                <Badge variant={unidade.status === 'finalizada' ? 'default' : 'secondary'} className="text-xs">
                                                    {unidade.status === 'finalizada' ? (
                                                        <><CheckCircle2 className="h-3 w-3 mr-1" /> Completa</>
                                                    ) : (
                                                        'Pendente'
                                                    )}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                                                    {unidade.total_constatacoes || 0} C
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3 text-red-500" />
                                                    {unidade.total_ncs || 0} NC
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Camera className="h-3 w-3" />
                                                    {unidade.fotos_unidade?.length || 0}/2 fotos
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>

                {unidades.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        <Building2 className="h-16 w-16 mx-auto mb-4 opacity-30" />
                        <p className="text-lg">Nenhuma unidade vistoriada</p>
                        <p className="text-sm">Clique em "Adicionar Unidade" para começar</p>
                    </div>
                )}

                {/* Finalize Button */}
                {fiscalizacao.status !== 'finalizada' && unidades.length > 0 && (
                    <div className="mt-6 space-y-2">
                        <Button 
                            className="w-full h-14 bg-blue-600 hover:bg-blue-700"
                            onClick={() => {
                                if (confirm('Deseja finalizar esta fiscalização? Não será possível adicionar mais unidades.')) {
                                    finalizarMutation.mutate();
                                }
                            }}
                            disabled={finalizarMutation.isPending}
                        >
                            {finalizarMutation.isPending ? (
                                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            ) : (
                                <FileText className="h-5 w-5 mr-2" />
                            )}
                            Finalizar Fiscalização
                        </Button>
                    </div>
                )}
            </div>
            </div>
            );
            }