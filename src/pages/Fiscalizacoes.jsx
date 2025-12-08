import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    ArrowLeft, Search, MapPin, Calendar, CheckCircle2, 
    Clock, AlertTriangle, ChevronRight, Plus, Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import RelatorioFiscalizacao from '@/components/fiscalizacao/RelatorioFiscalizacao';

export default function Fiscalizacoes() {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('todos');

    const { data: fiscalizacoes = [], isLoading } = useQuery({
        queryKey: ['fiscalizacoes'],
        queryFn: () => base44.entities.Fiscalizacao.list('-created_date', 100)
    });

    const filtered = fiscalizacoes.filter(f => {
        const matchSearch = f.municipio_nome?.toLowerCase().includes(search.toLowerCase()) ||
            f.servico?.toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === 'todos' || f.status === statusFilter;
        return matchSearch && matchStatus;
    });

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
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-40">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos</SelectItem>
                            <SelectItem value="em_andamento">Em andamento</SelectItem>
                            <SelectItem value="finalizada">Finalizadas</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* List */}
            <div className="max-w-4xl mx-auto px-4 pb-8">
                {isLoading ? (
                    <div className="text-center py-8 text-gray-500">Carregando...</div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map((fisc) => (
                            <Link 
                                key={fisc.id} 
                                to={createPageUrl('ExecutarFiscalizacao') + `?id=${fisc.id}`}
                            >
                                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                                    <CardContent className="p-4">
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
                                                        <Badge variant="secondary" className="text-xs">
                                                            {fisc.servico}
                                                        </Badge>
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

                                        {/* Botão Relatório para finalizadas */}
                                        {fisc.status === 'finalizada' && (
                                            <div className="mt-3 pt-3 border-t">
                                                <RelatorioFiscalizacao fiscalizacao={fisc} />
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
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