import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function HistoricoFiscalizacoes({ fiscalizacoes, municipios }) {
    const { data: unidades = [] } = useQuery({
        queryKey: ['unidades-historico', fiscalizacoes.map(f => f.id).join(',')],
        queryFn: () => base44.entities.UnidadeFiscalizada.list('id', 500).then(us =>
            us.filter(u => fiscalizacoes.some(f => f.id === u.fiscalizacao_id))
        ),
        enabled: fiscalizacoes.length > 0
    });

    const { data: determinacoes = [] } = useQuery({
        queryKey: ['determinacoes-historico', unidades.map(u => u.id).join(',')],
        queryFn: () => base44.entities.Determinacao.list('id', 500).then(ds =>
            ds.filter(d => unidades.some(u => u.id === d.unidade_fiscalizada_id))
        ),
        enabled: unidades.length > 0
    });

    const { data: recomendacoes = [] } = useQuery({
        queryKey: ['recomendacoes-historico', unidades.map(u => u.id).join(',')],
        queryFn: () => base44.entities.Recomendacao.list('id', 500).then(rs =>
            rs.filter(r => unidades.some(u => u.id === r.unidade_fiscalizada_id))
        ),
        enabled: unidades.length > 0
    });

    const { data: ncs = [] } = useQuery({
        queryKey: ['ncs-historico', unidades.map(u => u.id).join(',')],
        queryFn: () => base44.entities.NaoConformidade.list('id', 500).then(ns =>
            ns.filter(n => unidades.some(u => u.id === n.unidade_fiscalizada_id))
        ),
        enabled: unidades.length > 0
    });

    const getNcsForFiscalizacao = (fiscId) => {
        const unidadesDoFisc = unidades.filter(u => u.fiscalizacao_id === fiscId);
        return ncs.filter(n => unidadesDoFisc.some(u => u.id === n.unidade_fiscalizada_id)).length;
    };

    const getDeterminacoesForFiscalizacao = (fiscId) => {
        const unidadesDoFisc = unidades.filter(u => u.fiscalizacao_id === fiscId);
        return determinacoes.filter(d => unidadesDoFisc.some(u => u.id === d.unidade_fiscalizada_id)).length;
    };

    const getRecomendacoesForFiscalizacao = (fiscId) => {
        const unidadesDoFisc = unidades.filter(u => u.fiscalizacao_id === fiscId);
        return recomendacoes.filter(r => unidadesDoFisc.some(u => u.id === r.unidade_fiscalizada_id)).length;
    };
    if (!fiscalizacoes || fiscalizacoes.length === 0) {
        return (
            <Card>
                <CardContent className="p-6 text-center text-gray-500">
                    Nenhuma fiscalização registrada
                </CardContent>
            </Card>
        );
    }

    const getMunicipio = (id) => {
        const m = municipios?.find(mun => mun.id === id);
        return m?.nome || 'N/A';
    };

    const getStatusColor = (status) => {
        const colors = {
            em_andamento: 'bg-orange-500',
            finalizada: 'bg-green-600',
            cancelada: 'bg-red-600'
        };
        return colors[status] || 'bg-gray-500';
    };

    return (
        <div className="space-y-3">
            {fiscalizacoes.map(fisc => (
                <Card key={fisc.id}>
                    <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                                <p className="font-semibold text-sm mb-1">{fisc.servico}</p>
                                <div className="flex items-center gap-4 text-xs text-gray-600">
                                    <div className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {getMunicipio(fisc.municipio_id)}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {new Date(fisc.data_inicio).toLocaleDateString('pt-BR')}
                                    </div>
                                </div>
                            </div>
                            <Badge className={getStatusColor(fisc.status)}>
                                {fisc.status === 'finalizada' ? 'Finalizada' : fisc.status === 'em_andamento' ? 'Em Andamento' : 'Cancelada'}
                            </Badge>
                        </div>
                        <div className="text-xs text-gray-600 mt-2">
                            NCs: <span className="font-semibold">{fisc.total_nao_conformidades || 0}</span> | 
                            Recomendações: <span className="font-semibold">{getRecomendacoesForFiscalizacao(fisc.id)}</span> | 
                            Determinações: <span className="font-semibold">{getDeterminacoesForFiscalizacao(fisc.id)}</span>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}