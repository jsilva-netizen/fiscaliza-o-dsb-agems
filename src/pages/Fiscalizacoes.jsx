import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { 
    ArrowLeft, Search, MapPin, Calendar, CheckCircle2, 
    Clock, AlertTriangle, ChevronRight, Plus, Filter, Trash2, FileDown
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import RelatorioFiscalizacao from '@/components/fiscalizacao/RelatorioFiscalizacao';
import ExportarPDFConsolidado from '@/components/fiscalizacao/ExportarPDFConsolidado';
import ResumoFiscalizacao from '@/components/fiscalizacao/ResumoFiscalizacao';

export default function Fiscalizacoes() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('todos');
    const [servicoFilter, setServicoFilter] = useState('todos');
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [fiscalizacaoParaDeletar, setFiscalizacaoParaDeletar] = useState(null);
    const [mostrarFiltros, setMostrarFiltros] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState({ open: false, fiscId: null, step: 1, inputValue: '' });

    const { data: user } = useQuery({
        queryKey: ['user'],
        queryFn: () => base44.auth.me()
    });

    const { data: fiscalizacoes = [], isLoading } = useQuery({
        queryKey: ['fiscalizacoes'],
        queryFn: () => base44.entities.Fiscalizacao.list('-created_date', 100),
        staleTime: 60000,
        gcTime: 300000
    });

    const deletarFiscalizacaoMutation = useMutation({
        mutationFn: async (fiscalizacaoId) => {
            const { data } = await base44.functions.invoke('deletarFiscalizacao', {
                fiscalizacao_id: fiscalizacaoId
            });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fiscalizacoes'] });
            setFiscalizacaoParaDeletar(null);
            setDeleteConfirmation({ open: false, fiscId: null, step: 1, inputValue: '' });
        },
        onError: (error) => {
            alert('Erro ao deletar fiscalização: ' + error.message);
        }
    });

    const filtered = fiscalizacoes.filter(f => {
        const servicosStr = f.servicos?.join(' ').toLowerCase() || '';
        const matchSearch = f.municipio_nome?.toLowerCase().includes(search.toLowerCase()) ||
            servicosStr.includes(search.toLowerCase());
        const matchStatus = statusFilter === 'todos' || f.status === statusFilter;
        const matchServico = servicoFilter === 'todos' || (f.servicos && f.servicos.includes(servicoFilter));
        
        let matchData = true;
        if (dataInicio && dataFim) {
            const fiscData = new Date(f.data_inicio);
            const inicio = new Date(dataInicio);
            const fim = new Date(dataFim);
            fim.setHours(23, 59, 59, 999);
            matchData = fiscData >= inicio && fiscData <= fim;
        }
        
        return matchSearch && matchStatus && matchServico && matchData;
    });

    const servicos = [...new Set(fiscalizacoes.flatMap(f => f.servicos || []))].filter(Boolean);

    const emAndamento = fiscalizacoes.filter(f => f.status === 'em_andamento').length;
    const finalizadas = fiscalizacoes.filter(f => f.status === 'finalizada').length;

    return (
        <div className="min-h-screen bg-gray-50">
                {/* Header */}
            <div className="bg-blue-900 text-white">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link to={createPageUrl('Home')}>
                                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold">Fiscalizações</h1>
                                <p className="text-blue-200 text-sm">
                                    {emAndamento} em andamento • {finalizadas} finalizadas
                                </p>
                            </div>
                        </div>
                        <Link to={createPageUrl('NovaFiscalizacao')}>
                            <Button className="bg-green-500 hover:bg-green-600">
                                <Plus className="h-4 w-4 mr-2" />
                                Nova
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="max-w-4xl mx-auto px-4 py-4 space-y-3">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Buscar município ou serviço..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => setMostrarFiltros(!mostrarFiltros)}
                    >
                        <Filter className="h-4 w-4" />
                    </Button>
                </div>

                {/* Filtros Avançados */}
                {mostrarFiltros && (
                    <div className="space-y-2 p-4 bg-white rounded-lg border">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs text-gray-600 mb-1 block">Status</label>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos</SelectItem>
                                        <SelectItem value="em_andamento">Em andamento</SelectItem>
                                        <SelectItem value="finalizada">Finalizadas</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label className="text-xs text-gray-600 mb-1 block">Serviço</label>
                                <Select value={servicoFilter} onValueChange={setServicoFilter}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos</SelectItem>
                                        {servicos.map(s => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs text-gray-600 mb-1 block">Data Início</label>
                                <Input 
                                    type="date" 
                                    value={dataInicio}
                                    onChange={(e) => setDataInicio(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-600 mb-1 block">Data Fim</label>
                                <Input 
                                    type="date" 
                                    value={dataFim}
                                    onChange={(e) => setDataFim(e.target.value)}
                                />
                            </div>
                        </div>

                        <Button 
                            variant="ghost" 
                            size="sm"
                            className="w-full"
                            onClick={() => {
                                setStatusFilter('todos');
                                setServicoFilter('todos');
                                setDataInicio('');
                                setDataFim('');
                            }}
                        >
                            Limpar Filtros
                        </Button>
                    </div>
                )}

                {/* Exportação */}
                {filtered.length > 0 && (
                    <ExportarPDFConsolidado fiscalizacoes={filtered} />
                )}
            </div>

            {/* List */}
            <div className="max-w-4xl mx-auto px-4 pb-8">
                {isLoading ? (
                    <div className="text-center py-8 text-gray-500">Carregando...</div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map((fisc) => {
                            const podeDeleter = user?.email === fisc.created_by;
                            
                            return (
                                <Card key={fisc.id} className="hover:shadow-md transition-shadow">
                                    <CardContent className="p-4">
                                        <Link 
                                            to={createPageUrl('ExecutarFiscalizacao') + `?id=${fisc.id}`}
                                            className="block"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start gap-3">
                                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                                                        fisc.status === 'finalizada' ? 'bg-green-100' : 'bg-yellow-100'
                                                    }`}>
                                                        {fisc.status === 'finalizada' ? (
                                                            <CheckCircle2 className="h-6 w-6 text-green-600" />
                                                        ) : (
                                                            <Clock className="h-6 w-6 text-yellow-600" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-medium flex items-center gap-2">
                                                            <MapPin className="h-4 w-4 text-gray-400" />
                                                            {fisc.municipio_nome}
                                                        </h3>
                                                        <div className="flex flex-wrap gap-2 mt-1">
                                                                             {fisc.servicos?.map(s => (
                                                                                 <Badge key={s} variant="secondary" className="text-xs">
                                                                                     {s}
                                                                                 </Badge>
                                                                             ))}
                                                            <Badge 
                                                                variant={fisc.status === 'finalizada' ? 'default' : 'outline'}
                                                                className={`text-xs ${fisc.status === 'finalizada' ? 'bg-green-500' : ''}`}
                                                            >
                                                                {fisc.status === 'finalizada' ? 'Finalizada' : 'Em andamento'}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                                            <Calendar className="h-3 w-3" />
                                                            {format(new Date(fisc.data_inicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                                        </p>
                                                        {fisc.fiscal_nome && (
                                                            <p className="text-xs text-gray-400 mt-1">
                                                                Fiscal: {fisc.fiscal_nome}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-5 w-5 text-gray-400" />
                                            </div>

                                            {/* Stats */}
                                            {(fisc.total_conformidades > 0 || fisc.total_nao_conformidades > 0) && (
                                                <div className="flex gap-4 mt-3 pt-3 border-t text-xs">
                                                    <span className="flex items-center gap-1 text-green-600">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        {fisc.total_conformidades || 0} Constatações
                                                    </span>
                                                    <span className="flex items-center gap-1 text-red-600">
                                                        <AlertTriangle className="h-3 w-3" />
                                                        {fisc.total_nao_conformidades || 0} NCs
                                                    </span>
                                                </div>
                                            )}
                                        </Link>

                                        {/* Botões de ação */}
                                         <div className="mt-3 pt-3 border-t flex gap-2">
                                             {fisc.status === 'finalizada' && (
                                                 <>
                                                     <div className="flex-1">
                                                         <RelatorioFiscalizacao fiscalizacao={fisc} />
                                                     </div>
                                                     <ResumoFiscalizacao fiscalizacao_id={fisc.id} prestadorNome={fisc.prestador_servico_nome} />
                                                 </>
                                             )}
                                             {podeDeleter && (
                                                 <AlertDialog 
                                                     open={deleteConfirmation.open && deleteConfirmation.fiscId === fisc.id}
                                                     onOpenChange={(open) => {
                                                         if (!open) {
                                                             setDeleteConfirmation({ open: false, fiscId: null, step: 1, inputValue: '' });
                                                         }
                                                     }}
                                                 >
                                                     <Button
                                                         variant="outline"
                                                         size="sm"
                                                         className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                         onClick={(e) => {
                                                             e.preventDefault();
                                                             setDeleteConfirmation({ open: true, fiscId: fisc.id, step: 1, inputValue: '' });
                                                         }}
                                                     >
                                                         <Trash2 className="h-4 w-4" />
                                                     </Button>
                                                     <AlertDialogContent>
                                                         {deleteConfirmation.step === 1 ? (
                                                             <>
                                                                 <AlertDialogHeader>
                                                                     <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                                                                         <AlertTriangle className="h-5 w-5" />
                                                                         Excluir Fiscalização?
                                                                     </AlertDialogTitle>
                                                                     <AlertDialogDescription className="space-y-2">
                                                                         <p>Você está prestes a excluir permanentemente:</p>
                                                                         <p className="font-semibold text-gray-900">{fisc.numero_termo} - {fisc.municipio_nome}</p>
                                                                         <p className="text-red-600">Esta ação não pode ser desfeita e removerá todas as unidades, NCs, determinações e dados relacionados.</p>
                                                                     </AlertDialogDescription>
                                                                 </AlertDialogHeader>
                                                                 <AlertDialogFooter>
                                                                     <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                     <Button
                                                                         variant="destructive"
                                                                         onClick={() => setDeleteConfirmation(prev => ({ ...prev, step: 2 }))}
                                                                     >
                                                                         Continuar
                                                                     </Button>
                                                                 </AlertDialogFooter>
                                                             </>
                                                         ) : (
                                                             <>
                                                                 <AlertDialogHeader>
                                                                     <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                                                                         <AlertTriangle className="h-5 w-5" />
                                                                         Confirmação Final
                                                                     </AlertDialogTitle>
                                                                     <AlertDialogDescription className="space-y-3">
                                                                         <p>Para confirmar a exclusão, digite <span className="font-bold">EXCLUIR</span> no campo abaixo:</p>
                                                                         <Input
                                                                             placeholder="Digite EXCLUIR"
                                                                             value={deleteConfirmation.inputValue}
                                                                             onChange={(e) => setDeleteConfirmation(prev => ({ ...prev, inputValue: e.target.value }))}
                                                                             className="mt-2"
                                                                         />
                                                                     </AlertDialogDescription>
                                                                 </AlertDialogHeader>
                                                                 <AlertDialogFooter>
                                                                     <AlertDialogCancel onClick={() => setDeleteConfirmation({ open: false, fiscId: null, step: 1, inputValue: '' })}>
                                                                         Cancelar
                                                                     </AlertDialogCancel>
                                                                     <Button
                                                                         variant="destructive"
                                                                         disabled={deleteConfirmation.inputValue !== 'EXCLUIR' || deletarFiscalizacaoMutation.isPending}
                                                                         onClick={() => deletarFiscalizacaoMutation.mutate(fisc.id)}
                                                                     >
                                                                         {deletarFiscalizacaoMutation.isPending ? 'Excluindo...' : 'Excluir Permanentemente'}
                                                                     </Button>
                                                                 </AlertDialogFooter>
                                                             </>
                                                         )}
                                                     </AlertDialogContent>
                                                 </AlertDialog>
                                             )}
                                         </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {!isLoading && filtered.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        <MapPin className="h-12 w-12 mx-auto mb-4 opacity-30" />
                        <p className="text-lg">Nenhuma fiscalização encontrada</p>
                        <Link to={createPageUrl('NovaFiscalizacao')}>
                            <Button className="mt-4">
                                <Plus className="h-4 w-4 mr-2" />
                                Iniciar primeira fiscalização
                            </Button>
                        </Link>
                    </div>
                )}
            </div>


            </div>
            );
}