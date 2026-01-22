import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileText, Send, Download, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function GerenciarTermos() {
    const queryClient = useQueryClient();
    const [selectedFiscalizacao, setSelectedFiscalizacao] = useState(null);
    const [showDialog, setShowDialog] = useState(false);
    const [termoForm, setTermoForm] = useState({
        numero_termo_notificacao: '',
        municipio_id: '',
        numero_processo: '',
        camara_tecnica: 'Água e Esgoto',
        data_protocolo: '',
        prazo_resposta_dias: 30,
        observacoes: ''
    });

    const { data: fiscalizacoes = [] } = useQuery({
        queryKey: ['fiscalizacoes'],
        queryFn: () => base44.entities.Fiscalizacao.list()
    });

    const { data: determinacoes = [] } = useQuery({
        queryKey: ['determinacoes'],
        queryFn: () => base44.entities.Determinacao.list()
    });

    const { data: termos = [] } = useQuery({
        queryKey: ['termos-notificacao'],
        queryFn: () => base44.entities.TermoNotificacao.list()
    });

    const { data: prestadores = [] } = useQuery({
        queryKey: ['prestadores'],
        queryFn: () => base44.entities.PrestadorServico.list()
    });

    const { data: municipios = [] } = useQuery({
        queryKey: ['municipios'],
        queryFn: () => base44.entities.Municipio.list()
    });

    // Calcular data máxima de resposta
    const dataMaximaResposta = termoForm.data_protocolo && termoForm.prazo_resposta_dias
        ? new Date(new Date(termoForm.data_protocolo).getTime() + termoForm.prazo_resposta_dias * 24 * 60 * 60 * 1000)
            .toISOString().split('T')[0]
        : '';

    // Gerar número do termo automaticamente
    useEffect(() => {
        if (showDialog && !termoForm.numero_termo_notificacao) {
            const ano = new Date().getFullYear();
            const proximo = termos.length + 1;
            setTermoForm(prev => ({
                ...prev,
                numero_termo_notificacao: `TN ${String(proximo).padStart(3, '0')}/${ano}/DSB/AGEMS`
            }));
        }
    }, [showDialog, termos.length]);

    const criarTermoMutation = useMutation({
        mutationFn: async (dados) => {
            // Calcular data máxima de resposta
            const dataProtocolo = new Date(dados.data_protocolo);
            const dataMaxima = new Date(dataProtocolo.getTime() + dados.prazo_resposta_dias * 24 * 60 * 60 * 1000);
            
            const novoTermo = await base44.entities.TermoNotificacao.create({
                ...dados,
                data_maxima_resposta: dataMaxima.toISOString().split('T')[0],
                data_geracao: new Date().toISOString(),
                status: 'rascunho',
                numero_termo: dados.numero_termo_notificacao
            });
            return novoTermo;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['termos-notificacao'] });
            alert('Termo criado com sucesso!');
            setShowDialog(false);
            setSelectedFiscalizacao(null);
            setTermoForm({
                numero_termo_notificacao: '',
                municipio_id: '',
                numero_processo: '',
                camara_tecnica: 'Água e Esgoto',
                data_protocolo: '',
                prazo_resposta_dias: 30,
                observacoes: ''
            });
        }
    });

    const enviarTermoMutation = useMutation({
        mutationFn: async ({ id, data_envio }) => {
            return base44.entities.TermoNotificacao.update(id, {
                status: 'enviado',
                data_envio
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['termos-notificacao'] });
            alert('Termo enviado com sucesso!');
        }
    });

    const handleCriarTermo = () => {
        if (!selectedFiscalizacao?.prestador_servico_id) {
            alert('Fiscalização sem prestador de serviço');
            return;
        }

        if (!termoForm.numero_processo || !termoForm.data_protocolo) {
            alert('Preencha todos os campos obrigatórios');
            return;
        }

        criarTermoMutation.mutate({
            fiscalizacao_id: selectedFiscalizacao.id,
            prestador_servico_id: selectedFiscalizacao.prestador_servico_id,
            municipio_id: termoForm.municipio_id || selectedFiscalizacao.municipio_id,
            ...termoForm
        });
    };

    const atualizarRespostaMutation = useMutation({
        mutationFn: async ({ id, data_recebimento_resposta }) => {
            const termo = termos.find(t => t.id === id);
            const dataMaxima = new Date(termo.data_maxima_resposta);
            const dataRecebimento = new Date(data_recebimento_resposta);
            const recebidaNoPrazo = dataRecebimento <= dataMaxima;

            return base44.entities.TermoNotificacao.update(id, {
                data_recebimento_resposta,
                recebida_no_prazo: recebidaNoPrazo,
                status: 'respondido'
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['termos-notificacao'] });
            alert('Resposta registrada com sucesso!');
        }
    });

    const getPrestadorNome = (id) => {
        const p = prestadores.find(pres => pres.id === id);
        return p?.nome || 'N/A';
    };

    const getMunicipioNome = (id) => {
        const m = municipios.find(mun => mun.id === id);
        return m?.nome || 'N/A';
    };

    const getStatusBadge = (status) => {
        const statusMap = {
            rascunho: { label: 'Rascunho', color: 'bg-gray-500' },
            enviado: { label: 'Enviado', color: 'bg-blue-600' },
            recebido: { label: 'Recebido', color: 'bg-green-600' },
            respondido: { label: 'Respondido', color: 'bg-purple-600' }
        };
        return statusMap[status] || statusMap.rascunho;
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Link to={createPageUrl('Home')}>
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <h1 className="text-3xl font-bold">Gerenciar Termos de Notificação</h1>
                    </div>
                    <Button 
                        onClick={() => {
                            setSelectedFiscalizacao(fiscalizacoes.find(f => f.status === 'finalizada'));
                            setShowDialog(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Termo
                    </Button>
                </div>

                {/* Dialog de Criar Termo */}
                <Dialog open={showDialog} onOpenChange={setShowDialog}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Criar Termo de Notificação</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Número do TN *</Label>
                                    <Input
                                        value={termoForm.numero_termo_notificacao}
                                        onChange={(e) => setTermoForm({ ...termoForm, numero_termo_notificacao: e.target.value })}
                                        placeholder="TN 001/2026/DSB/AGEMS"
                                    />
                                </div>
                                <div>
                                    <Label>Município *</Label>
                                    <Select value={termoForm.municipio_id} onValueChange={(v) => setTermoForm({ ...termoForm, municipio_id: v })}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {municipios.map(m => (
                                                <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Número do Processo *</Label>
                                    <Input
                                        value={termoForm.numero_processo}
                                        onChange={(e) => setTermoForm({ ...termoForm, numero_processo: e.target.value })}
                                        placeholder="Ex: 12345/2026"
                                    />
                                </div>
                                <div>
                                    <Label>Câmara Técnica Setorial *</Label>
                                    <Select value={termoForm.camara_tecnica} onValueChange={(v) => setTermoForm({ ...termoForm, camara_tecnica: v })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Água e Esgoto">Água e Esgoto</SelectItem>
                                            <SelectItem value="Resíduos Sólidos">Resíduos Sólidos</SelectItem>
                                            <SelectItem value="Drenagem">Drenagem</SelectItem>
                                            <SelectItem value="Multissetorial">Multissetorial</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Data de Protocolo do TN *</Label>
                                    <Input
                                        type="date"
                                        value={termoForm.data_protocolo}
                                        onChange={(e) => setTermoForm({ ...termoForm, data_protocolo: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label>Prazo para Resposta (dias)</Label>
                                    <Input
                                        type="number"
                                        value={termoForm.prazo_resposta_dias}
                                        onChange={(e) => setTermoForm({ ...termoForm, prazo_resposta_dias: parseInt(e.target.value) || 30 })}
                                    />
                                </div>
                            </div>

                            {dataMaximaResposta && (
                                <div>
                                    <Label>Data Máxima para Resposta (calculado)</Label>
                                    <Input
                                        type="date"
                                        value={dataMaximaResposta}
                                        disabled
                                        className="bg-gray-100"
                                    />
                                </div>
                            )}

                            <div>
                                <Label>Fiscalização</Label>
                                <Select 
                                    value={selectedFiscalizacao?.id || ''} 
                                    onValueChange={(v) => setSelectedFiscalizacao(fiscalizacoes.find(f => f.id === v))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione uma fiscalização" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {fiscalizacoes.filter(f => f.status === 'finalizada').map(f => (
                                            <SelectItem key={f.id} value={f.id}>
                                                {f.numero_termo} - {getPrestadorNome(f.prestador_servico_id)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Observações</Label>
                                <Textarea
                                    placeholder="Adicione observações ao termo..."
                                    value={termoForm.observacoes}
                                    onChange={(e) => setTermoForm({ ...termoForm, observacoes: e.target.value })}
                                    className="min-h-24"
                                />
                            </div>

                            <div className="flex gap-2 pt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowDialog(false)}
                                    className="flex-1"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleCriarTermo}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                                    disabled={!termoForm.numero_processo || !termoForm.data_protocolo}
                                >
                                    Criar Termo
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Lista de Termos Criados */}
                <div>
                        <h2 className="text-xl font-semibold mb-4">Termos Criados</h2>
                        <div className="space-y-4">
                            {termos.map(termo => (
                                <Card key={termo.id}>
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-lg">{termo.numero_termo_notificacao || termo.numero_termo}</h3>
                                                <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-gray-600">
                                                    <div>
                                                        <span className="font-medium">Município:</span> {getMunicipioNome(termo.municipio_id)}
                                                    </div>
                                                    <div>
                                                        <span className="font-medium">Processo:</span> {termo.numero_processo || 'N/A'}
                                                    </div>
                                                    <div>
                                                        <span className="font-medium">Câmara:</span> {termo.camara_tecnica || 'N/A'}
                                                    </div>
                                                    <div>
                                                        <span className="font-medium">Protocolo:</span> {termo.data_protocolo ? new Date(termo.data_protocolo).toLocaleDateString('pt-BR') : 'N/A'}
                                                    </div>
                                                    <div>
                                                        <span className="font-medium">Prazo:</span> {termo.prazo_resposta_dias || 30} dias
                                                    </div>
                                                    <div>
                                                        <span className="font-medium">Data Máxima:</span> {termo.data_maxima_resposta ? new Date(termo.data_maxima_resposta).toLocaleDateString('pt-BR') : 'N/A'}
                                                    </div>
                                                    {termo.data_recebimento_resposta && (
                                                        <>
                                                            <div>
                                                                <span className="font-medium">Resposta em:</span> {new Date(termo.data_recebimento_resposta).toLocaleDateString('pt-BR')}
                                                            </div>
                                                            <div>
                                                                <Badge className={termo.recebida_no_prazo ? 'bg-green-600' : 'bg-red-600'}>
                                                                    {termo.recebida_no_prazo ? 'No prazo' : 'Fora do prazo'}
                                                                </Badge>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <Badge className={getStatusBadge(termo.status).color}>
                                                    {getStatusBadge(termo.status).label}
                                                </Badge>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 pt-3 border-t">
                                            {termo.status === 'rascunho' && (
                                                <Button
                                                    size="sm"
                                                    className="bg-blue-600 hover:bg-blue-700"
                                                    onClick={() => enviarTermoMutation.mutate({
                                                        id: termo.id,
                                                        data_envio: new Date().toISOString()
                                                    })}
                                                >
                                                    <Send className="h-4 w-4 mr-1" />
                                                    Enviar
                                                </Button>
                                            )}
                                            {(termo.status === 'enviado' || termo.status === 'recebido') && !termo.data_recebimento_resposta && (
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button size="sm" variant="outline">
                                                            Registrar Resposta
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent>
                                                        <DialogHeader>
                                                            <DialogTitle>Registrar Recebimento de Resposta</DialogTitle>
                                                        </DialogHeader>
                                                        <div className="space-y-4">
                                                            <div>
                                                                <Label>Data de Recebimento</Label>
                                                                <Input
                                                                    type="date"
                                                                    id={`data-resposta-${termo.id}`}
                                                                />
                                                            </div>
                                                            <Button
                                                                onClick={() => {
                                                                    const data = document.getElementById(`data-resposta-${termo.id}`).value;
                                                                    if (data) {
                                                                        atualizarRespostaMutation.mutate({
                                                                            id: termo.id,
                                                                            data_recebimento_resposta: data
                                                                        });
                                                                    }
                                                                }}
                                                                className="w-full"
                                                            >
                                                                Confirmar
                                                            </Button>
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            )}
                                            {termo.arquivo_url && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => window.open(termo.arquivo_url)}
                                                >
                                                    <Download className="h-4 w-4 mr-1" />
                                                    Baixar PDF
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}