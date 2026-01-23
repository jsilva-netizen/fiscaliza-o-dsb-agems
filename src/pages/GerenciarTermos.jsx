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
import { ArrowLeft, FileText, Download, Plus, Trash2, AlertTriangle, Upload, AlertCircle } from 'lucide-react';
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
    const [uploadingProtocoloData, setUploadingProtocoloData] = useState(false);

    const [uploadingResposta, setUploadingResposta] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState({ open: false, termoId: null, step: 1, inputValue: '' });
    const [termoDetalhes, setTermoDetalhes] = useState(null);
    const [termoAssinadoTemp, setTermoAssinadoTemp] = useState(null);
    const [dataProtocoloOpen, setDataProtocoloOpen] = useState(false);
    const [protocoNoTemp, setProtocoloTemp] = useState(null);
    const [uploadingProtocolo, setUploadingProtocolo] = useState(false);

    const [respostaOpenId, setRespostaOpenId] = useState(null);
    const [alteracoesPendentes, setAlteracoesPendentes] = useState(false);
    const [dadosEditados, setDadosEditados] = useState({
        data_protocolo: null,
        arquivo_protocolo_url: null,
        data_recebimento_resposta: null,
        arquivo_resposta_url: null
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
            if (!termo.data_protocolo) return 'pendente_protocolo';
            if (!termo.data_recebimento_resposta) return 'aguardando_resposta';
            return 'respondido';
        };

    const verificaPrazoVencido = (termo) => {
        if (!termo.data_maxima_resposta) return false;
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const dataMax = new Date(termo.data_maxima_resposta);
        dataMax.setHours(0, 0, 0, 0);
        return hoje > dataMax;
    };

    const termosFiltrados = termos.filter(termo => {
        if (filtros.busca && !termo.numero_termo_notificacao?.toLowerCase().includes(filtros.busca.toLowerCase())) return false;
        if (filtros.camaraTecnica && termo.camara_tecnica !== filtros.camaraTecnica) return false;
        if (filtros.status) {
            const status = getStatusFluxo(termo);
            if (filtros.status === 'prazo_vencido') {
                if (status !== 'aguardando_resposta' || !verificaPrazoVencido(termo)) return false;
            } else if (status !== filtros.status) {
                return false;
            }
        }
        if (filtros.dataInicio && new Date(termo.data_geracao) < new Date(filtros.dataInicio)) return false;
        if (filtros.dataFim && new Date(termo.data_geracao) > new Date(filtros.dataFim)) return false;
        return true;
    });

    const getStatusBadge = (status) => {
            const statusMap = {
                pendente_tn: { label: 'Pendente - TN Assinado', color: 'bg-yellow-500' },
                pendente_protocolo: { label: 'Pendente - Data Protocolo', color: 'bg-yellow-500' },
                aguardando_resposta: { label: 'Aguardando Resposta', color: 'bg-green-600' },
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
                                        disabled
                                        placeholder="Gerado automaticamente"
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
                              setAlteracoesPendentes(false);
                              setDadosEditados({
                                  data_protocolo: null,
                                  arquivo_protocolo_url: null,
                                  data_recebimento_resposta: null,
                                  arquivo_resposta_url: null
                              });
                              setProtocoloTemp(null);
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
                                    <div className="space-y-2">
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
                                        {uploadingFile && <p className="text-xs text-gray-500">Enviando arquivo...</p>}
                                        {termoAssinadoTemp && !uploadingFile && (
                                            <p className="text-xs text-green-600">✓ Arquivo carregado</p>
                                        )}
                                        {termoAssinadoTemp && (
                                            <Button onClick={async () => {
                                                try {
                                                    await base44.entities.TermoNotificacao.update(termoDetalhes.id, {
                                                        arquivo_url: termoAssinadoTemp
                                                    });
                                                    queryClient.invalidateQueries({ queryKey: ['termos-notificacao'] });
                                                    setTermoDetalhes({ ...termoDetalhes, arquivo_url: termoAssinadoTemp });
                                                    setTermoAssinadoTemp(null);
                                                    alert('Salvo com sucesso!');
                                                } catch (error) {
                                                    alert('Erro ao salvar');
                                                }
                                            }} className="w-full" size="sm">
                                                Salvar
                                            </Button>
                                        )}
                                        {termoDetalhes.arquivo_url && (
                                            <Button variant="outline" onClick={() => window.open(termoDetalhes.arquivo_url)} className="w-full" size="sm">
                                                <Download className="h-4 w-4 mr-2" />
                                                Baixar Termo Assinado
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="border-t pt-4">
                                    <h3 className="font-semibold mb-3">Arquivo de Protocolo / AR</h3>
                                    <div className="space-y-2">
                                        <div>
                                            <Label className="text-sm">Data de Protocolo / AR *</Label>
                                            <Input 
                                                type="date" 
                                                id="data-protocolo-detalhe" 
                                                defaultValue={termoDetalhes.data_protocolo || ''}
                                                onChange={(e) => {
                                                    setDadosEditados(prev => ({ ...prev, data_protocolo: e.target.value }));
                                                    setAlteracoesPendentes(true);
                                                }}
                                            />
                                        </div>
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
                                                        setDadosEditados(prev => ({ ...prev, arquivo_protocolo_url: file_url }));
                                                        setAlteracoesPendentes(true);
                                                    } catch (error) {
                                                        alert('Erro ao enviar arquivo');
                                                    } finally {
                                                        setUploadingProtocolo(false);
                                                    }
                                                }
                                            }}
                                            disabled={uploadingProtocolo}
                                        />
                                        {uploadingProtocolo && <p className="text-xs text-gray-500">Enviando arquivo...</p>}
                                        {protocoNoTemp && !uploadingProtocolo && (
                                            <p className="text-xs text-green-600">✓ Arquivo carregado</p>
                                        )}
                                        {termoDetalhes.arquivo_protocolo_url && (
                                            <Button variant="outline" onClick={() => window.open(termoDetalhes.arquivo_protocolo_url)} className="w-full" size="sm">
                                                <Download className="h-4 w-4 mr-2" />
                                                Baixar Arquivo de Protocolo
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {termoDetalhes.data_maxima_resposta && (
                                    <div className="border-t pt-4">
                                        <h3 className="font-semibold mb-3">Arquivo de Resposta do Prestador</h3>
                                        <div className="space-y-2">
                                            <div>
                                                <Label className="text-sm">Data de Recebimento da Resposta *</Label>
                                                <Input 
                                                    type="date" 
                                                    id="data-resposta-detalhe" 
                                                    defaultValue={termoDetalhes.data_recebimento_resposta || ''}
                                                    onChange={(e) => {
                                                        setDadosEditados(prev => ({ ...prev, data_recebimento_resposta: e.target.value }));
                                                        setAlteracoesPendentes(true);
                                                    }}
                                                />
                                            </div>
                                            <Input
                                                type="file"
                                                accept=".pdf"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        setUploadingResposta(true);
                                                        try {
                                                            const { file_url } = await base44.integrations.Core.UploadFile({ file });
                                                            setDadosEditados(prev => ({ ...prev, arquivo_resposta_url: file_url }));
                                                            setAlteracoesPendentes(true);
                                                        } catch (error) {
                                                            alert('Erro ao enviar arquivo');
                                                        } finally {
                                                            setUploadingResposta(false);
                                                        }
                                                    }
                                                }}
                                                disabled={uploadingResposta}
                                            />
                                            {uploadingResposta && <p className="text-xs text-gray-500">Enviando arquivo...</p>}
                                            {dadosEditados.arquivo_resposta_url && !uploadingResposta && (
                                                <p className="text-xs text-green-600">✓ Arquivo carregado</p>
                                            )}
                                            {termoDetalhes.arquivos_resposta && termoDetalhes.arquivos_resposta.length > 0 && (
                                                <>
                                                    {termoDetalhes.arquivos_resposta.map((arquivo, idx) => (
                                                        <Button key={idx} variant="outline" onClick={() => window.open(arquivo.url)} className="w-full" size="sm">
                                                            <Download className="h-4 w-4 mr-2" />
                                                            Baixar Arquivo de Resposta
                                                        </Button>
                                                    ))}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {termoDetalhes.observacoes && (
                                    <div className="border-t pt-4">
                                        <Label className="text-gray-600">Observações</Label>
                                        <p className="text-sm">{termoDetalhes.observacoes}</p>
                                    </div>
                                )}

                                {alteracoesPendentes && (
                                    <div className="border-t pt-4 flex gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setAlteracoesPendentes(false);
                                                setDadosEditados({
                                                    data_protocolo: null,
                                                    arquivo_protocolo_url: null,
                                                    data_recebimento_resposta: null,
                                                    arquivo_resposta_url: null
                                                });
                                                setProtocoloTemp(null);
                                                setTermoDetalhes(null);
                                            }}
                                            className="flex-1"
                                        >
                                            Cancelar
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button className="flex-1 bg-blue-600 hover:bg-blue-700">
                                                    Salvar Alterações
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Confirmar Alterações</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Deseja salvar as alterações realizadas neste termo?
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={async () => {
                                                        try {
                                                            const updateData = {};

                                                            if (dadosEditados.data_protocolo) {
                                                                updateData.data_protocolo = dadosEditados.data_protocolo;
                                                                const dp = new Date(dadosEditados.data_protocolo);
                                                                const prazo = termoDetalhes.prazo_resposta_dias || 30;
                                                                const dmax = new Date(dp.getTime() + prazo * 24 * 60 * 60 * 1000);
                                                                updateData.data_maxima_resposta = dmax.toISOString().split('T')[0];
                                                            }

                                                            if (dadosEditados.arquivo_protocolo_url) {
                                                                updateData.arquivo_protocolo_url = dadosEditados.arquivo_protocolo_url;
                                                            }

                                                            if (dadosEditados.data_recebimento_resposta) {
                                                                updateData.data_recebimento_resposta = dadosEditados.data_recebimento_resposta;
                                                                const dataMax = new Date(termoDetalhes.data_maxima_resposta + 'T00:00:00');
                                                                const dataReceb = new Date(dadosEditados.data_recebimento_resposta + 'T00:00:00');
                                                                updateData.recebida_no_prazo = dataReceb <= dataMax;
                                                                updateData.status = 'respondido';
                                                            }

                                                            if (dadosEditados.arquivo_resposta_url) {
                                                                const novoArquivo = {
                                                                    url: dadosEditados.arquivo_resposta_url,
                                                                    nome: 'Resposta do Prestador',
                                                                    data_upload: new Date().toISOString()
                                                                };
                                                                const arquivosAtuais = termoDetalhes.arquivos_resposta || [];
                                                                updateData.arquivos_resposta = [...arquivosAtuais, novoArquivo];
                                                            }

                                                            await base44.entities.TermoNotificacao.update(termoDetalhes.id, updateData);
                                                            queryClient.invalidateQueries({ queryKey: ['termos-notificacao'] });
                                                            setTermoDetalhes(null);
                                                            setAlteracoesPendentes(false);
                                                            setDadosEditados({
                                                                data_protocolo: null,
                                                                arquivo_protocolo_url: null,
                                                                data_recebimento_resposta: null,
                                                                arquivo_resposta_url: null
                                                            });
                                                            setProtocoloTemp(null);
                                                            alert('Alterações salvas com sucesso!');
                                                        } catch (error) {
                                                            alert('Erro ao salvar alterações: ' + error.message);
                                                        }
                                                    }}>
                                                        Confirmar
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
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
                                        {/* Avisos de Pendências */}
                                        {(() => {
                                            const status = getStatusFluxo(termo);
                                            const pendencias = [];
                                            if (status === 'pendente_tn') pendencias.push('TN Assinado');
                                            else if (status === 'pendente_protocolo') pendencias.push('Protocolo');
                                            else if (status === 'ativo') {
                                                if (verificaPrazoVencido(termo)) {
                                                    pendencias.push('Resposta Atrasada');
                                                } else {
                                                    pendencias.push('Aguardando Resposta');
                                                }
                                            }

                                            return pendencias.length > 0 ? (
                                                <div className={`mb-3 p-3 border rounded-lg flex gap-2 ${
                                                    verificaPrazoVencido(termo) 
                                                        ? 'bg-red-50 border-red-200' 
                                                        : 'bg-yellow-50 border-yellow-200'
                                                }`}>
                                                    <AlertCircle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                                                        verificaPrazoVencido(termo) 
                                                            ? 'text-red-600' 
                                                            : 'text-yellow-600'
                                                    }`} />
                                                    <div className="flex-1">
                                                        <p className={`text-sm font-medium ${
                                                            verificaPrazoVencido(termo) 
                                                                ? 'text-red-800' 
                                                                : 'text-yellow-800'
                                                        }`}>Pendências:</p>
                                                        <p className={`text-xs mt-1 ${
                                                            verificaPrazoVencido(termo) 
                                                                ? 'text-red-700' 
                                                                : 'text-yellow-700'
                                                        }`}>{pendencias.join(', ')}</p>
                                                    </div>
                                                </div>
                                            ) : null;
                                        })()}
                                        
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
                                                         <span className="font-medium">Protocolo:</span> {termo.data_protocolo ? (() => {
                                                             const [a, m, d] = termo.data_protocolo.split('-');
                                                             return `${d}/${m}/${a}`;
                                                         })() : 'N/A'}
                                                     </div>
                                                     <div>
                                                         <span className="font-medium">Prazo:</span> {termo.prazo_resposta_dias || 30} dias
                                                     </div>
                                                     <div>
                                                         <span className="font-medium">Data Máxima:</span> {termo.data_maxima_resposta ? new Date(termo.data_maxima_resposta).toLocaleDateString('pt-BR') : 'N/A'}
                                                         {termo.data_maxima_resposta && !termo.data_recebimento_resposta && (
                                                             <p className={`text-xs mt-1 ${verificaPrazoVencido(termo) ? 'text-red-600' : 'text-green-600'}`}>
                                                                 {verificaPrazoVencido(termo) ? '⚠️ Prazo vencido' : '✓ No prazo'}
                                                             </p>
                                                         )}
                                                     </div>
                                                     {termo.data_recebimento_resposta && (
                                                         <>
                                                             <div>
                                                                 <span className="font-medium">Resposta em:</span> {(() => {
                                                                     const [a, m, d] = termo.data_recebimento_resposta.split('-');
                                                                     return `${d}/${m}/${a}`;
                                                                 })()}
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
                                             <div className="flex flex-col gap-3 items-end">
                                                     <Badge className={getStatusBadge(getStatusFluxo(termo)).color}>
                                                         {getStatusBadge(getStatusFluxo(termo)).label}
                                                     </Badge>
                                                     <div className="flex gap-2">
                                                         <Button
                                                             size="sm"
                                                             variant="outline"
                                                             onClick={() => setTermoDetalhes(termo)}
                                                         >
                                                             Editar
                                                         </Button>
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

                                            {/* Fluxo de Botões - Ordem Específica */}
                                            <div className="flex gap-2 flex-wrap">
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
                                                                          const termoAtualizado = await base44.entities.TermoNotificacao.update(termo.id, {
                                                                              arquivo_url: file_url
                                                                          });
                                                                          queryClient.setQueryData(['termos-notificacao'], (old) => {
                                                                              return old.map(t => t.id === termo.id ? termoAtualizado : t);
                                                                          });
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

                                              {termo.arquivo_url && !termo.data_protocolo && (
                                                                  <Dialog open={dataProtocoloOpen} onOpenChange={setDataProtocoloOpen}>
                                                                      <DialogTrigger asChild>
                                                                          <Button size="sm" variant="default" className="bg-blue-600 hover:bg-blue-700">
                                                                              <Upload className="h-4 w-4 mr-1" />
                                                                              Registrar Protocolo
                                                                          </Button>
                                                                      </DialogTrigger>
                                                                      <DialogContent className="max-w-2xl">
                                                                          <DialogHeader>
                                                                              <DialogTitle>Data de Protocolo / AR</DialogTitle>
                                                                          </DialogHeader>
                                                                          <div className="space-y-3">
                                                                              <Label>Data de Protocolo *</Label>
                                                                              <Input
                                                                                  type="date"
                                                                                  id={`data-proto-${termo.id}`}
                                                                              />
                                                                              <Label>Arquivo de Protocolo / AR (PDF)</Label>
                                                                              <Input
                                                                                  type="file"
                                                                                  accept=".pdf"
                                                                                  id={`file-proto-${termo.id}`}
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
                                                                              <Button
                                                                                  onClick={async () => {
                                                                                      const dataInput = document.getElementById(`data-proto-${termo.id}`);
                                                                                      const data = dataInput?.value;

                                                                                      if (!data) {
                                                                                          alert('Informe a data de protocolo');
                                                                                          return;
                                                                                      }

                                                                                      try {
                                                                                          setUploadingProtocoloData(true);
                                                                                          const dprot = new Date(data + 'T00:00:00');
                                                                                          const prazo = termo.prazo_resposta_dias || 30;
                                                                                          const dmax = new Date(dprot);
                                                                                          dmax.setDate(dmax.getDate() + prazo);
                                                                                          const dmax_str = `${dmax.getFullYear()}-${String(dmax.getMonth() + 1).padStart(2, '0')}-${String(dmax.getDate()).padStart(2, '0')}`;

                                                                                          const archivoParaSalvar = protocoNoTemp || termo.arquivo_protocolo_url;

                                                                                          await base44.entities.TermoNotificacao.update(termo.id, {
                                                                                              data_protocolo: data,
                                                                                              data_maxima_resposta: dmax_str,
                                                                                              arquivo_protocolo_url: archivoParaSalvar
                                                                                          });

                                                                                          await queryClient.invalidateQueries({ queryKey: ['termos-notificacao'] });
                                                                                          setDataProtocoloOpen(false);
                                                                                          setProtocoloTemp(null);
                                                                                          document.getElementById(`file-proto-${termo.id}`).value = '';
                                                                                          alert('Data de protocolo e arquivo salvos!');
                                                                                      } catch (error) {
                                                                                          alert('Erro: ' + error.message);
                                                                                      } finally {
                                                                                          setUploadingProtocoloData(false);
                                                                                      }
                                                                                  }}
                                                                                  disabled={uploadingProtocoloData}
                                                                                  className="w-full"
                                                                              >
                                                                                  {uploadingProtocoloData ? 'Salvando...' : 'Salvar Data e Arquivo'}
                                                                              </Button>
                                                                          </div>
                                                                      </DialogContent>
                                                                  </Dialog>
                                                              )}

                                                              {termo.arquivo_url && termo.data_protocolo && !termo.data_recebimento_resposta && (
                                                              <Dialog open={respostaOpenId === termo.id} onOpenChange={(open) => setRespostaOpenId(open ? termo.id : null)}>
                                                              <DialogTrigger asChild>
                                                              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                                                              {verificaPrazoVencido(termo) ? '⚠ Resposta Atrasada' : 'Registrar Resposta do Prestador'}
                                                              </Button>
                                                              </DialogTrigger>
                                                              <DialogContent className="max-w-2xl">
                                                              <DialogHeader>
                                                              <DialogTitle>Resposta do Prestador</DialogTitle>
                                                              </DialogHeader>
                                                              <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                                                              {verificaPrazoVencido(termo) && (
                                                                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                                                                    ⚠️ Prazo vencido em {new Date(termo.data_maxima_resposta).toLocaleDateString('pt-BR')}
                                                                </div>
                                                              )}
                                                              <div>
                                                                <Label>Data de Recebimento</Label>
                                                                <Input
                                                                    type="date"
                                                                    id={`data-resp-${termo.id}`}
                                                                />
                                                              </div>
                                                              <div>
                                                                <Label>Adicionar Arquivo PDF</Label>
                                                                <Input
                                                                    type="file"
                                                                    accept=".pdf"
                                                                    id={`file-resp-${termo.id}`}
                                                                />
                                                              </div>
                                                              {termo.arquivos_resposta && termo.arquivos_resposta.length > 0 && (
                                                                <div className="border-t pt-3">
                                                                    <Label className="text-gray-600">Arquivos Adicionados</Label>
                                                                    <div className="space-y-2 mt-2">
                                                                        {termo.arquivos_resposta.map((arquivo, idx) => (
                                                                            <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                                                                <span className="text-sm text-gray-700">{arquivo.nome || `Arquivo ${idx + 1}`}</span>
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    onClick={() => window.open(arquivo.url)}
                                                                                >
                                                                                    <Download className="h-4 w-4" />
                                                                                </Button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                              )}
                                                              <Button
                                                                onClick={async () => {
                                                                    const data = document.getElementById(`data-resp-${termo.id}`)?.value;
                                                                    const file = document.getElementById(`file-resp-${termo.id}`)?.files?.[0];

                                                                    if (!data || !file) {
                                                                        alert('Preencha data e selecione arquivo');
                                                                        return;
                                                                    }

                                                                    try {
                                                                          setUploadingResposta(true);
                                                                          const { file_url } = await base44.integrations.Core.UploadFile({ file });

                                                                          const [ano, mes, dia] = data.split('-');
                                                                          const dataReceb = new Date(ano, mes - 1, parseInt(dia) + 1);
                                                                          const dataRecebStr = `${dataReceb.getFullYear()}-${String(dataReceb.getMonth() + 1).padStart(2, '0')}-${String(dataReceb.getDate()).padStart(2, '0')}`;
                                                                          const dataMax = new Date(termo.data_maxima_resposta + 'T00:00:00');

                                                                          const novoArquivo = {
                                                                              url: file_url,
                                                                              nome: file.name,
                                                                              data_upload: new Date().toISOString()
                                                                          };

                                                                          const arquivosAtuais = termo.arquivos_resposta || [];
                                                                          const dataMaxComHora = new Date(termo.data_maxima_resposta + 'T00:00:00');
                                                                          const termoAtualizado = await base44.entities.TermoNotificacao.update(termo.id, {
                                                                              data_recebimento_resposta: dataRecebStr,
                                                                              arquivos_resposta: [...arquivosAtuais, novoArquivo],
                                                                              recebida_no_prazo: dataReceb <= dataMaxComHora,
                                                                             status: 'respondido'
                                                                         });

                                                                         queryClient.setQueryData(['termos-notificacao'], (old) => {
                                                                             return old.map(t => t.id === termo.id ? termoAtualizado : t);
                                                                         });

                                                                         document.getElementById(`file-resp-${termo.id}`).value = '';
                                                                         alert('Arquivo adicionado com sucesso!');
                                                                     } catch (error) {
                                                                         alert('Erro ao salvar: ' + error.message);
                                                                     } finally {
                                                                         setUploadingResposta(false);
                                                                     }
                                                                }}
                                                                disabled={uploadingResposta}
                                                                className="w-full"
                                                              >
                                                                {uploadingResposta ? 'Salvando...' : 'Adicionar Arquivo'}
                                                              </Button>
                                                              </div>
                                                              </DialogContent>
                                                              </Dialog>
                                                              )}
                                                              </div>

                                                              {/* Download Buttons - Vertical Stack */}
                                                              <div className="flex flex-col gap-2">
                                                              {termo.arquivo_url && (
                                                              <Button
                                                              size="sm"
                                                              variant="outline"
                                                              onClick={() => window.open(termo.arquivo_url)}
                                                              className="w-full"
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
                                                              className="w-full"
                                                              >
                                                              <Download className="h-4 w-4 mr-1" />
                                                              Baixar Arquivo de Protocolo
                                                              </Button>
                                                              )}

                                                              {termo.arquivos_resposta && termo.arquivos_resposta.length > 0 && (
                                                              <>
                                                              {termo.arquivos_resposta.map((arquivo, idx) => (
                                                              <Button
                                                              key={idx}
                                                              size="sm"
                                                              variant="outline"
                                                              onClick={() => window.open(arquivo.url)}
                                                              className="w-full"
                                                              >
                                                              <Download className="h-4 w-4 mr-1" />
                                                              Baixar Resposta do Prestador
                                                              </Button>
                                                              ))}
                                                              </>
                                                              )}
                                                              </div>
                                                              </div>
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