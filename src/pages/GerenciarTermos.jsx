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
import { ArrowLeft, FileText, Download, Plus, Trash2, AlertTriangle, Upload } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import TermosKPI from '../components/termos/TermosKPI';
import TermosFiltros from '../components/termos/TermosFiltros';

export default function GerenciarTermos() {
    const queryClient = useQueryClient();
    const [selectedFiscalizacao, setSelectedFiscalizacao] = useState(null);
    const [showDialog, setShowDialog] = useState(false);
    const [filtros, setFiltros] = useState({
        camaraTecnica: '',
        status: '',
        dataInicio: '',
        dataFim: '',
        busca: ''
    });
    const [termoForm, setTermoForm] = useState({
        numero_termo_notificacao: '',
        municipio_id: '',
        numero_processo: '',
        camara_tecnica: 'CATESA',
        data_protocolo: '',
        prazo_resposta_dias: 30,
        observacoes: '',
        arquivo_url: '',
        arquivo_protocolo_url: ''
    });
    const [uploadingFile, setUploadingFile] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState({ open: false, termoId: null, step: 1, inputValue: '' });
    const [termoDetalhes, setTermoDetalhes] = useState(null);
    const [uploadingProtocolo, setUploadingProtocolo] = useState(false);
    const [termoAssinadoTemp, setTermoAssinadoTemp] = useState(null);
    const [protocoNoTemp, setProtocoloTemp] = useState(null);

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
        queryFn: async () => {
            const data = await base44.entities.Municipio.list();
            return data.sort((a, b) => a.nome.localeCompare(b.nome));
        }
    });



    // Gerar número do termo automaticamente baseado nos existentes
    useEffect(() => {
        if (showDialog && !termoForm.numero_termo_notificacao) {
            const ano = new Date().getFullYear();
            
            // Buscar o maior número de TN do ano atual
            let maiorNumero = 0;
            termos.forEach(termo => {
                const numeroTermo = termo.numero_termo_notificacao || termo.numero_termo || '';
                // Extrair número do formato "TN XXX/YYYY/DSB/AGEMS"
                const match = numeroTermo.match(/TN\s*(\d+)\/(\d{4})/i);
                if (match) {
                    const numero = parseInt(match[1], 10);
                    const anoTermo = parseInt(match[2], 10);
                    if (anoTermo === ano && numero > maiorNumero) {
                        maiorNumero = numero;
                    }
                }
            });
            
            const proximo = maiorNumero + 1;
            setTermoForm(prev => ({
                ...prev,
                numero_termo_notificacao: `TN ${String(proximo).padStart(3, '0')}/${ano}/DSB/AGEMS`
            }));
        }
    }, [showDialog, termos]);

    const criarTermoMutation = useMutation({
        mutationFn: async (dados) => {
            let dataMaxima = null;
            if (dados.data_protocolo) {
                const dataProtocolo = new Date(dados.data_protocolo);
                dataMaxima = new Date(dataProtocolo.getTime() + dados.prazo_resposta_dias * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            }
            
            const novoTermo = await base44.entities.TermoNotificacao.create({
                ...dados,
                data_maxima_resposta: dataMaxima,
                data_geracao: new Date().toISOString(),
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
                camara_tecnica: 'CATESA',
                data_protocolo: '',
                prazo_resposta_dias: 30,
                observacoes: '',
                arquivo_url: '',
                arquivo_protocolo_url: ''
            });
        }
    });

    const atualizarProtocoloMutation = useMutation({
        mutationFn: async ({ id, data_protocolo, arquivo_protocolo_url }) => {
            let dataMaxima = null;
            const termo = termos.find(t => t.id === id);
            if (data_protocolo && termo) {
                const dp = new Date(data_protocolo);
                dataMaxima = new Date(dp.getTime() + (termo.prazo_resposta_dias || 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            }
            
            return base44.entities.TermoNotificacao.update(id, {
                data_protocolo,
                arquivo_protocolo_url,
                data_maxima_resposta: dataMaxima,
                status: 'ativo'
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['termos-notificacao'] });
            alert('Dados de protocolo atualizados com sucesso!');
            setTermoDetalhes(null);
        }
    });

    const handleCriarTermo = () => {
        if (!selectedFiscalizacao?.prestador_servico_id) {
            alert('Fiscalização sem prestador de serviço');
            return;
        }

        if (!termoForm.numero_processo) {
            alert('Informe o número do processo');
            return;
        }

        criarTermoMutation.mutate({
            ...termoForm,
            fiscalizacao_id: selectedFiscalizacao.id,
            prestador_servico_id: selectedFiscalizacao.prestador_servico_id,
            municipio_id: termoForm.municipio_id || selectedFiscalizacao.municipio_id
        });
    };

    const excluirTermoMutation = useMutation({
        mutationFn: async (id) => {
            return base44.entities.TermoNotificacao.delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['termos-notificacao'] });
            alert('Termo excluído com sucesso!');
            setDeleteConfirmation({ open: false, termoId: null, step: 1, inputValue: '' });
        }
    });

    const atualizarRespostaMutation = useMutation({
        mutationFn: async ({ id, data_recebimento_resposta, arquivo_resposta_url }) => {
            const termo = termos.find(t => t.id === id);
            const dataMaxima = new Date(termo.data_maxima_resposta);
            const dataRecebimento = new Date(data_recebimento_resposta);
            const recebidaNoPrazo = dataRecebimento <= dataMaxima;

            return base44.entities.TermoNotificacao.update(id, {
                data_recebimento_resposta,
                arquivo_resposta_url,
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

    const getStatusFluxo = (termo) => {
        if (!termo.arquivo_url) return 'pendente_tn';
        if (!termo.data_protocolo || !termo.arquivo_protocolo_url) return 'pendente_protocolo';
        if (!termo.data_recebimento_resposta) return 'ativo';
        return 'respondido';
    };

    const termosFiltrados = termos.filter(termo => {
        if (filtros.busca && !termo.numero_termo_notificacao?.toLowerCase().includes(filtros.busca.toLowerCase())) return false;
        if (filtros.camaraTecnica && termo.camara_tecnica !== filtros.camaraTecnica) return false;
        if (filtros.status && getStatusFluxo(termo) !== filtros.status) return false;
        if (filtros.dataInicio && new Date(termo.data_geracao) < new Date(filtros.dataInicio)) return false;
        if (filtros.dataFim && new Date(termo.data_geracao) > new Date(filtros.dataFim)) return false;
        return true;
    });

    const getStatusBadge = (status, termo) => {
        const semTermoAssinado = !termo.arquivo_url;
        const semProtocolo = !termo.data_protocolo;
        const semArquivoProtocolo = !termo.arquivo_protocolo_url;
        
        if (status === 'pendente_protocolo') {
            const pendencias = [];
            if (semTermoAssinado) pendencias.push('Termo Assinado');
            if (semProtocolo) pendencias.push('Data de Protocolo');
            if (semArquivoProtocolo) pendencias.push('Arquivo de Protocolo');
            
            if (pendencias.length > 0) {
                return { label: `Pendente - ${pendencias.join(', ')}`, color: 'bg-yellow-500' };
            }
        }
        
        const statusMap = {
            ativo: { label: 'Ativo', color: 'bg-green-600' },
            respondido: { label: 'Respondido', color: 'bg-purple-600' }
        };
        return statusMap[status] || { label: 'Criado', color: 'bg-blue-500' };
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

                {/* Dashboard KPI */}
                <TermosKPI termos={termos} />

                {/* Filtros */}
                <TermosFiltros onFilterChange={setFiltros} filtros={filtros} />

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
                                    <Label>Número do Processo *</Label>
                                    <Input
                                        value={termoForm.numero_processo}
                                        onChange={(e) => {
                                            let valor = e.target.value.replace(/\D/g, '');
                                            if (valor.length > 13) valor = valor.slice(0, 13);
                                            
                                            if (valor.length > 9) {
                                                valor = `${valor.slice(0, 2)}.${valor.slice(2, 5)}.${valor.slice(5, 8)}-${valor.slice(8)}`;
                                            } else if (valor.length > 5) {
                                                valor = `${valor.slice(0, 2)}.${valor.slice(2, 5)}.${valor.slice(5)}`;
                                            } else if (valor.length > 2) {
                                                valor = `${valor.slice(0, 2)}.${valor.slice(2)}`;
                                            }
                                            
                                            setTermoForm({ ...termoForm, numero_processo: valor });
                                        }}
                                        placeholder="51.011.137-2025"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Fiscalização *</Label>
                                    <Select 
                                        value={selectedFiscalizacao?.id || ''} 
                                        onValueChange={(v) => {
                                            const fisc = fiscalizacoes.find(f => f.id === v);
                                            setSelectedFiscalizacao(fisc);
                                            if (fisc) {
                                                setTermoForm({ ...termoForm, municipio_id: fisc.municipio_id });
                                            }
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione uma fiscalização" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {fiscalizacoes.filter(f => f.status === 'finalizada').map(f => (
                                                <SelectItem key={f.id} value={f.id}>
                                                    {f.numero_termo} - {getMunicipioNome(f.municipio_id)} - {getPrestadorNome(f.prestador_servico_id)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Câmara Técnica Setorial *</Label>
                                    <Select value={termoForm.camara_tecnica} onValueChange={(v) => setTermoForm({ ...termoForm, camara_tecnica: v })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CATESA">CATESA</SelectItem>
                                            <SelectItem value="CATERS">CATERS</SelectItem>
                                            <SelectItem value="CRES">CRES</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div>
                                <Label>Prazo para Resposta (dias)</Label>
                                <Input
                                    type="number"
                                    value={termoForm.prazo_resposta_dias}
                                    onChange={(e) => setTermoForm({ ...termoForm, prazo_resposta_dias: parseInt(e.target.value) || 30 })}
                                />
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
                                    disabled={!termoForm.numero_processo}
                                >
                                    Criar Termo
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Dialog de Detalhes do Termo */}
                <Dialog open={termoDetalhes !== null} onOpenChange={(open) => {
          if (!open) {
              setTermoDetalhes(null);
              setTermoAssinadoTemp(null);
          }
      }}>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Detalhes do Termo de Notificação</DialogTitle>
                        </DialogHeader>
                        {termoDetalhes && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <Label className="text-gray-600">Número do TN</Label>
                                        <p className="font-semibold">{termoDetalhes.numero_termo_notificacao || termoDetalhes.numero_termo}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Processo</Label>
                                        <p className="font-semibold">{termoDetalhes.numero_processo}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Município</Label>
                                        <p className="font-semibold">{getMunicipioNome(termoDetalhes.municipio_id)}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Prestador</Label>
                                        <p className="font-semibold">{getPrestadorNome(termoDetalhes.prestador_servico_id)}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Câmara Técnica</Label>
                                        <p className="font-semibold">{termoDetalhes.camara_tecnica}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Prazo Resposta</Label>
                                        <p className="font-semibold">{termoDetalhes.prazo_resposta_dias} dias</p>
                                    </div>
                                </div>

                                <div className="border-t pt-4">
                                    <h3 className="font-semibold mb-3">Termo de Notificação Assinado</h3>
                                    <div className="space-y-3">
                                        <Input
                                            type="file"
                                            accept=".pdf"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    setUploadingFile(true);
                                                    try {
                                                        const { file_url } = await base44.integrations.Core.UploadFile({ file });
                                                        setTermoAssinadoTemp(file_url);
                                                    } catch (error) {
                                                        alert('Erro ao enviar arquivo');
                                                    } finally {
                                                        setUploadingFile(false);
                                                    }
                                                }
                                            }}
                                            disabled={uploadingFile}
                                        />
                                        {uploadingFile && <p className="text-xs text-gray-500 mt-1">Enviando arquivo...</p>}
                                        {termoAssinadoTemp && !uploadingFile && (
                                            <p className="text-xs text-green-600 mt-1">✓ Arquivo carregado. Clique em "Salvar" para confirmar.</p>
                                        )}
                                        {termoAssinadoTemp && (
                                            <Button
                                                onClick={async () => {
                                                    try {
                                                        await base44.entities.TermoNotificacao.update(termoDetalhes.id, {
                                                            arquivo_url: termoAssinadoTemp
                                                        });
                                                        queryClient.invalidateQueries({ queryKey: ['termos-notificacao'] });
                                                        setTermoDetalhes({ ...termoDetalhes, arquivo_url: termoAssinadoTemp });
                                                        setTermoAssinadoTemp(null);
                                                        alert('Termo assinado salvo com sucesso!');
                                                    } catch (error) {
                                                        alert('Erro ao salvar termo');
                                                    }
                                                }}
                                                className="w-full"
                                            >
                                                Salvar Termo Assinado
                                            </Button>
                                        )}
                                        {termoDetalhes.arquivo_url && (
                                            <Button
                                                variant="outline"
                                                onClick={() => window.open(termoDetalhes.arquivo_url)}
                                                className="w-full"
                                            >
                                                <Download className="h-4 w-4 mr-2" />
                                                Baixar Termo Assinado (PDF)
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="border-t pt-4">
                                    <h3 className="font-semibold mb-3">Dados de Protocolo / AR</h3>
                                    <div className="space-y-3">
                                        <div>
                                            <Label>Data de Protocolo / AR *</Label>
                                            <Input
                                                type="date"
                                                id="data-protocolo-detalhe"
                                                defaultValue={termoDetalhes.data_protocolo || ''}
                                            />
                                        </div>
                                        <div>
                                            <Label>Arquivo de Protocolo / AR (PDF)</Label>
                                            <Input
                                                type="file"
                                                accept=".pdf"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        setUploadingProtocolo(true);
                                                        try {
                                                            const { file_url } = await base44.integrations.Core.UploadFile({ file });
                                                            setProtocoloTemp(file_url);
                                                        } catch (error) {
                                                            alert('Erro ao enviar arquivo');
                                                        } finally {
                                                            setUploadingProtocolo(false);
                                                        }
                                                    }
                                                }}
                                                disabled={uploadingProtocolo}
                                            />
                                            {uploadingProtocolo && <p className="text-xs text-gray-500 mt-1">Enviando arquivo...</p>}
                                            {protocoNoTemp && !uploadingProtocolo && (
                                                <p className="text-xs text-green-600 mt-1">✓ Arquivo carregado. Clique em "Salvar" para confirmar.</p>
                                            )}
                                            {termoDetalhes.arquivo_protocolo_url && (
                                                <div className="mt-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => window.open(termoDetalhes.arquivo_protocolo_url)}
                                                    >
                                                        <Download className="h-4 w-4 mr-2" />
                                                        Baixar Arquivo de Protocolo
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                        <Button
                                            onClick={() => {
                                                const dataProtocolo = document.getElementById('data-protocolo-detalhe').value;
                                                if (!dataProtocolo) {
                                                    alert('Informe a data de protocolo');
                                                    return;
                                                }
                                                const archivoParaSalvar = protocoNoTemp || termoDetalhes.arquivo_protocolo_url;
                                                if (!archivoParaSalvar) {
                                                    alert('Envie o arquivo de protocolo');
                                                    return;
                                                }
                                                atualizarProtocoloMutation.mutate({
                                                    id: termoDetalhes.id,
                                                    data_protocolo: dataProtocolo,
                                                    arquivo_protocolo_url: archivoParaSalvar
                                                });
                                                setProtocoloTemp(null);
                                            }}
                                            className="w-full"
                                        >
                                            Salvar Dados de Protocolo
                                        </Button>
                                        {termoDetalhes.arquivo_protocolo_url && (
                                            <Button
                                                variant="outline"
                                                onClick={() => window.open(termoDetalhes.arquivo_protocolo_url)}
                                                className="w-full"
                                            >
                                                <Download className="h-4 w-4 mr-2" />
                                                Baixar Arquivo de Protocolo
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {termoDetalhes.data_maxima_resposta && (
                                    <div className="border-t pt-4">
                                        <Label className="text-gray-600">Data Máxima para Resposta</Label>
                                        <p className="font-semibold text-lg">{new Date(termoDetalhes.data_maxima_resposta).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                )}

                                {termoDetalhes.observacoes && (
                                    <div className="border-t pt-4">
                                        <Label className="text-gray-600">Observações</Label>
                                        <p className="text-sm">{termoDetalhes.observacoes}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Lista de Termos Criados */}
                <div className="space-y-4">
                    {termosFiltrados.length === 0 ? (
                        <Card className="p-8">
                            <div className="text-center text-gray-500">
                                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                <p>Nenhum termo encontrado com os filtros aplicados</p>
                            </div>
                        </Card>
                    ) : (
                        termosFiltrados.map(termo => (
                            <Card key={termo.id} className="hover:shadow-lg transition-shadow">
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
                                                         <span className="font-medium">Prestador:</span> {getPrestadorNome(termo.prestador_servico_id)}
                                                     </div>
                                                     <div>
                                                         <span className="font-medium">Serviços:</span> {(() => {
                                                             const fisc = fiscalizacoes.find(f => f.id === termo.fiscalizacao_id);
                                                             return fisc?.servicos?.join(', ') || 'N/A';
                                                         })()}
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
                                            <div className="text-right space-y-2">
                                                <div>
                                                    <Badge className={getStatusBadge(termo.status, termo).color}>
                                                        {getStatusBadge(termo.status, termo).label}
                                                    </Badge>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setTermoDetalhes(termo)}
                                                >
                                                    Editar
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 pt-3 border-t flex-wrap">
                                            {/* Fluxo de Botões - Ordem Específica */}
                                              {!termo.arquivo_url && (
                                                  <Dialog>
                                                      <DialogTrigger asChild>
                                                          <Button size="sm" variant="default" className="bg-blue-600 hover:bg-blue-700">
                                                              <Upload className="h-4 w-4 mr-1" />
                                                              Enviar TN Assinado
                                                          </Button>
                                                      </DialogTrigger>
                                                      <DialogContent>
                                                          <DialogHeader>
                                                              <DialogTitle>Termo de Notificação Assinado</DialogTitle>
                                                          </DialogHeader>
                                                          <div className="space-y-3">
                                                              <Input
                                                                  type="file"
                                                                  accept=".pdf"
                                                                  id={`file-tn-${termo.id}`}
                                                              />
                                                              <Button
                                                                  onClick={async () => {
                                                                      const fileInput = document.getElementById(`file-tn-${termo.id}`);
                                                                      const file = fileInput?.files?.[0];
                                                                      if (!file) {
                                                                          alert('Selecione um arquivo');
                                                                          return;
                                                                      }
                                                                      try {
                                                                          setUploadingFile(true);
                                                                          const { file_url } = await base44.integrations.Core.UploadFile({ file });
                                                                          await base44.entities.TermoNotificacao.update(termo.id, {
                                                                              arquivo_url: file_url
                                                                          });
                                                                          queryClient.invalidateQueries({ queryKey: ['termos-notificacao'] });
                                                                          alert('TN Assinado salvo com sucesso!');
                                                                      } catch (error) {
                                                                          alert('Erro ao salvar');
                                                                      } finally {
                                                                          setUploadingFile(false);
                                                                      }
                                                                  }}
                                                                  className="w-full"
                                                                  disabled={uploadingFile}
                                                              >
                                                                  {uploadingFile ? 'Salvando...' : 'Salvar'}
                                                              </Button>
                                                          </div>
                                                      </DialogContent>
                                                  </Dialog>
                                              )}

                                              {termo.arquivo_url && (!termo.data_protocolo || !termo.arquivo_protocolo_url) && (
                                                  <Dialog>
                                                      <DialogTrigger asChild>
                                                          <Button size="sm" variant="default" className="bg-blue-600 hover:bg-blue-700">
                                                              <FileText className="h-4 w-4 mr-1" />
                                                              {termo.data_protocolo ? 'Enviar Arquivo Protocolo' : 'Adicionar Protocolo'}
                                                          </Button>
                                                      </DialogTrigger>
                                                      <DialogContent>
                                                          <DialogHeader>
                                                              <DialogTitle>Dados de Protocolo / AR</DialogTitle>
                                                          </DialogHeader>
                                                          <div className="space-y-3">
                                                              <div>
                                                                  <Label>Data de Protocolo / AR *</Label>
                                                                  <Input
                                                                      type="date"
                                                                      id={`data-protocolo-${termo.id}`}
                                                                      defaultValue={termo.data_protocolo || ''}
                                                                  />
                                                              </div>
                                                              <div>
                                                                  <Label>Arquivo de Protocolo / AR (PDF) *</Label>
                                                                  <Input
                                                                      type="file"
                                                                      accept=".pdf"
                                                                      id={`file-protocolo-${termo.id}`}
                                                                  />
                                                              </div>
                                                              <Button
                                                                  onClick={async () => {
                                                                      const data = document.getElementById(`data-protocolo-${termo.id}`).value;
                                                                      const fileInput = document.getElementById(`file-protocolo-${termo.id}`);
                                                                      const file = fileInput?.files?.[0];

                                                                      if (!data) {
                                                                          alert('Informe a data de protocolo');
                                                                          return;
                                                                      }
                                                                      if (!file) {
                                                                          alert('Selecione um arquivo');
                                                                          return;
                                                                      }
                                                                      try {
                                                                          setUploadingProtocolo(true);
                                                                          const { file_url } = await base44.integrations.Core.UploadFile({ file });
                                                                          const termoAtualizado = await base44.entities.TermoNotificacao.update(termo.id, {
                                                                              data_protocolo: data,
                                                                              arquivo_protocolo_url: file_url,
                                                                              status: 'ativo'
                                                                          });
                                                                          // Atualizar cache local imediatamente
                                                                          queryClient.setQueryData(['termos-notificacao'], (old) => {
                                                                              return old.map(t => t.id === termo.id ? termoAtualizado : t);
                                                                          });
                                                                          alert('Protocolo salvo com sucesso!');
                                                                      } catch (error) {
                                                                          alert('Erro ao salvar: ' + error.message);
                                                                      } finally {
                                                                          setUploadingProtocolo(false);
                                                                      }
                                                                  }}
                                                                  className="w-full"
                                                                  disabled={uploadingProtocolo}
                                                              >
                                                                  {uploadingProtocolo ? 'Salvando...' : 'Salvar'}
                                                              </Button>
                                                          </div>
                                                      </DialogContent>
                                                  </Dialog>
                                              )}

                                              {termo.data_protocolo && termo.arquivo_protocolo_url && !termo.data_recebimento_resposta && (
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
                                                            <div>
                                                                <Label>Arquivo de Resposta (PDF)</Label>
                                                                <Input
                                                                    type="file"
                                                                    accept=".pdf"
                                                                    id={`arquivo-resposta-${termo.id}`}
                                                                />
                                                            </div>
                                                            <Button
                                                                onClick={async () => {
                                                                    const data = document.getElementById(`data-resposta-${termo.id}`).value;
                                                                    const fileInput = document.getElementById(`arquivo-resposta-${termo.id}`);
                                                                    const file = fileInput?.files?.[0];

                                                                    if (!data) {
                                                                        alert('Informe a data de recebimento');
                                                                        return;
                                                                    }

                                                                    if (!file) {
                                                                        alert('Envie o arquivo de resposta');
                                                                        return;
                                                                    }

                                                                    try {
                                                                        const { file_url } = await base44.integrations.Core.UploadFile({ file });
                                                                        atualizarRespostaMutation.mutate({
                                                                            id: termo.id,
                                                                            data_recebimento_resposta: data,
                                                                            arquivo_resposta_url: file_url
                                                                        });
                                                                    } catch (error) {
                                                                        alert('Erro ao enviar arquivo');
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
                                                    Baixar TN Assinado
                                                </Button>
                                            )}
                                            {termo.arquivo_protocolo_url && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => window.open(termo.arquivo_protocolo_url)}
                                                >
                                                    <Download className="h-4 w-4 mr-1" />
                                                    Baixar Protocolo
                                                </Button>
                                            )}

                                            
                                            {/* Botão Excluir com dupla confirmação */}
                                            <AlertDialog 
                                                open={deleteConfirmation.open && deleteConfirmation.termoId === termo.id}
                                                onOpenChange={(open) => {
                                                    if (!open) {
                                                        setDeleteConfirmation({ open: false, termoId: null, step: 1, inputValue: '' });
                                                    }
                                                }}
                                            >
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                                        onClick={() => setDeleteConfirmation({ open: true, termoId: termo.id, step: 1, inputValue: '' })}
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-1" />
                                                        Excluir
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    {deleteConfirmation.step === 1 ? (
                                                        <>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                                                                    <AlertTriangle className="h-5 w-5" />
                                                                    Excluir Termo de Notificação?
                                                                </AlertDialogTitle>
                                                                <AlertDialogDescription className="space-y-2">
                                                                    <p>Você está prestes a excluir permanentemente o termo:</p>
                                                                    <p className="font-semibold text-gray-900">{termo.numero_termo_notificacao || termo.numero_termo}</p>
                                                                    <p className="text-red-600">Esta ação não pode ser desfeita.</p>
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
                                                                <AlertDialogCancel onClick={() => setDeleteConfirmation({ open: false, termoId: null, step: 1, inputValue: '' })}>
                                                                    Cancelar
                                                                </AlertDialogCancel>
                                                                <Button
                                                                    variant="destructive"
                                                                    disabled={deleteConfirmation.inputValue !== 'EXCLUIR' || excluirTermoMutation.isPending}
                                                                    onClick={() => excluirTermoMutation.mutate(termo.id)}
                                                                >
                                                                    {excluirTermoMutation.isPending ? 'Excluindo...' : 'Excluir Permanentemente'}
                                                                </Button>
                                                            </AlertDialogFooter>
                                                        </>
                                                    )}
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </div>
            </div>
    );
}