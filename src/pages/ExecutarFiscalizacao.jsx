import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DataService from '@/functions/dataService';
import OfflineSyncButton from '@/components/offline/OfflineSyncButton';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    ArrowLeft, Plus, Building2, CheckCircle2, AlertTriangle, 
    Camera, MapPin, Clock, FileText, Loader2, Trash2, Edit
} from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ExecutarFiscalizacao() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const urlParams = new URLSearchParams(window.location.search);
    const fiscalizacaoId = urlParams.get('id');
    const [unidadeParaExcluir, setUnidadeParaExcluir] = useState(null);
    const [mostrarConfirmacaoFinalizacao, setMostrarConfirmacaoFinalizacao] = useState(false);
    const [user, setUser] = useState(null);

    // Buscar usuário atual
    useEffect(() => {
        base44.auth.me().then(setUser).catch(() => setUser(null));
    }, []);

    const { data: fiscalizacao, isLoading: loadingFiscalizacao } = useQuery({
        queryKey: ['fiscalizacao', fiscalizacaoId],
        queryFn: () => DataService.read('Fiscalizacao', { id: fiscalizacaoId }).then(r => r[0]),
        enabled: !!fiscalizacaoId,
        staleTime: 60000,
        gcTime: 300000
    });

    const { data: unidades = [], isLoading: loadingUnidades } = useQuery({
        queryKey: ['unidades-fiscalizacao', fiscalizacaoId],
        queryFn: () => DataService.read('UnidadeFiscalizada', { fiscalizacao_id: fiscalizacaoId }, '-created_date', 50),
        enabled: !!fiscalizacaoId,
        staleTime: 30000,
        gcTime: 300000
    });

    const { data: tipos = [] } = useQuery({
        queryKey: ['tipos-unidade'],
        queryFn: () => DataService.read('TipoUnidade', {}, 'nome', 100),
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
                if (unidade.status !== 'finalizada') {
                    throw new Error(`Finalize a vistoria da unidade "${unidade.nome_unidade || unidade.tipo_unidade_nome}" antes de finalizar a fiscalização.`);
                }
            }
            
            // Gerar número do termo sequencial
            const dataFim = new Date();
            const ano = dataFim.getFullYear();
            
            // Buscar fiscalizações finalizadas no mesmo ano
            const fiscalizacoesDoAno = await DataService.read('Fiscalizacao', { status: 'finalizada' }, '-data_fim', 1000);
            
            const fiscalizacoesAnoAtual = fiscalizacoesDoAno.filter(f => {
                if (!f.data_fim) return false;
                const anoFisc = new Date(f.data_fim).getFullYear();
                return anoFisc === ano;
            });
            
            const proximoNumero = fiscalizacoesAnoAtual.length + 1;
            const numeroTermo = `${String(proximoNumero).padStart(3, '0')}/${ano}`;
            
            return DataService.update('Fiscalizacao', fiscalizacaoId, {
                status: 'finalizada',
                data_fim: dataFim.toISOString(),
                numero_termo: numeroTermo
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

    const excluirUnidadeMutation = useMutation({
        mutationFn: async (unidadeId) => {
            return await base44.functions.invoke('deleteUnidadeFiscalizadaComCascade', {
                unidade_id: unidadeId
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['unidades-fiscalizacao', fiscalizacaoId] });
            queryClient.invalidateQueries({ queryKey: ['fiscalizacao', fiscalizacaoId] });
            setUnidadeParaExcluir(null);
        }
    });

    const handleExcluirUnidade = (e, unidade) => {
        e.preventDefault();
        e.stopPropagation();
        setUnidadeParaExcluir(unidade);
    };

    const confirmarExclusaoUnidade = () => {
        if (unidadeParaExcluir) {
            excluirUnidadeMutation.mutate(unidadeParaExcluir.id);
        }
    };

    const handleEditarUnidade = (e, unidadeId) => {
        e.preventDefault();
        e.stopPropagation();
        navigate(createPageUrl('VistoriarUnidade') + `?id=${unidadeId}&modo=edicao`);
    };

    const podeEditarOuExcluir = () => {
        if (!user) return false;
        if (fiscalizacao?.status === 'finalizada') return false;
        const isAdmin = user.role === 'admin';
        const isFiscalCriador = fiscalizacao?.fiscal_email === user.email;
        return isAdmin || isFiscalCriador;
    };

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
                            <div className="flex-1">
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
                        <div className="flex items-center gap-3">
                            <Badge className={fiscalizacao.status === 'finalizada' ? 'bg-green-500' : 'bg-yellow-500'}>
                                {fiscalizacao.status === 'finalizada' ? 'Finalizada' : 'Em andamento'}
                            </Badge>
                            <OfflineSyncButton />
                        </div>
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
                        <div key={unidade.id} className="relative">
                            <Card className="hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                    <Link to={createPageUrl('VistoriarUnidade') + `?id=${unidade.id}`} className="block">
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
                                                        <h3 className="font-medium">{unidade.codigo_unidade || unidade.tipo_unidade_nome}</h3>
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
                                                        {unidade.fotos_unidade?.length || 0} fotos
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                    {podeEditarOuExcluir() && (
                                        <div className="flex gap-2 mt-3">
                                            {unidade.status === 'finalizada' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={(e) => handleEditarUnidade(e, unidade.id)}
                                                >
                                                    <Edit className="w-3 h-3 mr-1" />
                                                    Editar
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={(e) => handleExcluirUnidade(e, unidade)}
                                                disabled={excluirUnidadeMutation.isPending}
                                            >
                                                <Trash2 className="w-3 h-3 mr-1" />
                                                Excluir
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
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
                            onClick={() => setMostrarConfirmacaoFinalizacao(true)}
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

            {/* Dialog de confirmação para excluir unidade */}
            <AlertDialog open={!!unidadeParaExcluir} onOpenChange={() => setUnidadeParaExcluir(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Unidade</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir a unidade <strong>{unidadeParaExcluir?.nome_unidade || unidadeParaExcluir?.tipo_unidade_nome}</strong>?
                            <br /><br />
                            Esta ação irá:
                            <ul className="list-disc ml-6 mt-2">
                                <li>Excluir todos os dados do checklist</li>
                                <li>Excluir todas as constatações, NCs e determinações</li>
                                <li>Excluir todas as fotos e evidências</li>
                                <li>Recalcular a numeração de todas as outras unidades</li>
                            </ul>
                            <br />
                            <strong>Esta ação não pode ser desfeita.</strong>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={excluirUnidadeMutation.isPending}>
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={confirmarExclusaoUnidade}
                            disabled={excluirUnidadeMutation.isPending}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {excluirUnidadeMutation.isPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Excluindo...
                                </>
                            ) : (
                                'Sim, Excluir'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Dialog de confirmação dupla para finalizar fiscalização */}
            <AlertDialog open={mostrarConfirmacaoFinalizacao} onOpenChange={setMostrarConfirmacaoFinalizacao}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Finalizar Fiscalização</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja finalizar esta fiscalização?
                            <br /><br />
                            Após a finalização:
                            <ul className="list-disc ml-6 mt-2">
                                <li>Nenhuma unidade poderá ser editada ou excluída</li>
                                <li>Nenhuma nova unidade poderá ser adicionada</li>
                                <li>A fiscalização ficará disponível apenas para visualização</li>
                            </ul>
                            <br />
                            <strong>Esta ação não pode ser desfeita (exceto por administradores).</strong>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={finalizarMutation.isPending}>
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={() => {
                                setMostrarConfirmacaoFinalizacao(false);
                                finalizarMutation.mutate();
                            }}
                            disabled={finalizarMutation.isPending}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {finalizarMutation.isPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Finalizando...
                                </>
                            ) : (
                                'Sim, Finalizar'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            </div>
            );
            }