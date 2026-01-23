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
        numero_rfp: '',
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
    const [oficioProtocoloTemp, setOficioProtocoloTemp] = useState(null);

    const [uploadingResposta, setUploadingResposta] = useState(false);
    const [respostaManifestacaoTemp, setRespostaManifestacaoTemp] = useState(null);
    const [respostaOficioTemp, setRespostaOficioTemp] = useState(null);
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
        arquivo_oficio_protocolo: null,
        data_recebimento_resposta: null,
        arquivo_resposta_url: null,
        arquivo_oficio_resposta: null,
        numero_processo: null,
        fiscalizacao_id: null,
        camara_tecnica: null,
        prazo_resposta_dias: null
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

    // Atualizar RFP automaticamente quando câmara é mudada
    useEffect(() => {
        if (showDialog && termoForm.camara_tecnica) {
            const ano = new Date().getFullYear();

            // Buscar o maior número de RFP para esta câmara no ano atual
            let maiorRFP = 0;
            termos.forEach(termo => {
                if (termo.camara_tecnica === termoForm.camara_tecnica) {
                    const rfpNum = parseInt(termo.numero_rfp || 0, 10);
                    if (rfpNum > maiorRFP) {
                        maiorRFP = rfpNum;
                    }
                }
            });

            const proximoRFP = maiorRFP + 1;
            setTermoForm(prev => ({
                ...prev,
                numero_rfp: String(proximoRFP).padStart(3, '0')
            }));
        }
    }, [showDialog, termoForm.camara_tecnica, termos]);

     const criarTermoMutation = useMutation({
        mutationFn: async (dados) => {
            let dataMaxima = null;
            if (dados.data_protocolo) {
                const dp = new Date(dados.data_protocolo + 'T00:00:00');
                const dmax = new Date(dp);
                dmax.setDate(dmax.getDate() + dados.prazo_resposta_dias);
                dataMaxima = `${dmax.getFullYear()}-${String(dmax.getMonth() + 1).padStart(2, '0')}-${String(dmax.getDate()).padStart(2, '0')}`;
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
                numero_rfp: '',
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
                const dp = new Date(data_protocolo + 'T00:00:00');
                const prazo = termo.prazo_resposta_dias || 30;
                const dmax = new Date(dp);
                dmax.setDate(dmax.getDate() + prazo);
                dataMaxima = `${dmax.getFullYear()}-${String(dmax.getMonth() + 1).padStart(2, '0')}-${String(dmax.getDate()).padStart(2, '0')}`;
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

        if (!termoForm.numero_rfp) {
            alert('Informe o número do RFP');
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
            const dataMaxima = new Date(termo.data_maxima_resposta + 'T00:00:00');
            const dataRecebimento = new Date(data_recebimento_resposta + 'T00:00:00');
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
        const dataMax = new Date(termo.data_maxima_resposta + 'T00:00:00');
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
                pendente_protocolo: { label: 'Pendente - Protocolo', color: 'bg-yellow-500' },
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
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>Número do TN *</Label>
                                    <Input
                                        value={termoForm.numero_termo_notificacao}
                                        disabled
                                        placeholder="Gerado automaticamente"
                                    />
                                </div>
                                <div>
                                    <Label>Número do RFP *</Label>
                                    <Input
                                        value={termoForm.numero_rfp}
                                        onChange={(e) => {
                                            const valor = e.target.value.replace(/\D/g, '').slice(0, 3);
                                            setTermoForm({ ...termoForm, numero_rfp: valor });
                                        }}
                                        placeholder="001"
                                        maxLength={3}
                                    />
                                    {termoForm.numero_rfp && termoForm.camara_tecnica && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            RFP/DSB/{termoForm.camara_tecnica}/{termoForm.numero_rfp}/{new Date().getFullYear()}
                                        </p>
                                    )}
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
                                            {fiscalizacoes
                                                .filter(f => f.status === 'finalizada')
                                                .filter(f => !termos.some(t => t.fiscalizacao_id === f.id))
                                                .map(f => (
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
                                    disabled={!termoForm.numero_processo || !termoForm.numero_rfp}
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
                                  arquivo_oficio_protocolo: null,
                                  data_recebimento_resposta: null,
                                  arquivo_resposta_url: null,
                                  arquivo_oficio_resposta: null,
                                  numero_processo: null,
                                  fiscalizacao_id: null,
                                  camara_tecnica: null,
                                  prazo_resposta_dias: null
                              });
                              setProtocoloTemp(null);
                              setOficioProtocoloTemp(null);
                              setRespostaManifestacaoTemp(null);
                              setRespostaOficioTemp(null);
                          }
                      }}>
                                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Detalhes do Termo de Notificação</DialogTitle>
                        </DialogHeader>
                        {termoDetalhes && (
                        <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-gray-600">Número do TN</Label>
                                <p className="font-semibold">{termoDetalhes.numero_termo_notificacao || termoDetalhes.numero_termo}</p>
                            </div>
                            <div>
                                <Label>Processo *</Label>
                                <Input
                                    value={dadosEditados.numero_processo !== null ? dadosEditados.numero_processo : termoDetalhes.numero_processo || ''}
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

                                        setDadosEditados(prev => ({ ...prev, numero_processo: valor }));
                                        setAlteracoesPendentes(true);
                                    }}
                                    placeholder="51.011.137-2025"
                                />
                            </div>
                            <div>
                                <Label>Fiscalização *</Label>
                                <Select 
                                    value={dadosEditados.fiscalizacao_id !== null ? dadosEditados.fiscalizacao_id : termoDetalhes.fiscalizacao_id || ''}
                                    onValueChange={(v) => {
                                        setDadosEditados(prev => ({ ...prev, fiscalizacao_id: v }));
                                        setAlteracoesPendentes(true);
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
                                <Label>Câmara Técnica *</Label>
                                <Select 
                                    value={dadosEditados.camara_tecnica !== null ? dadosEditados.camara_tecnica : termoDetalhes.camara_tecnica || ''}
                                    onValueChange={(v) => {
                                        setDadosEditados(prev => ({ ...prev, camara_tecnica: v }));
                                        setAlteracoesPendentes(true);
                                    }}
                                >
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
                            <div>
                                <Label>Município</Label>
                                <p className="font-semibold mt-2">{getMunicipioNome(termoDetalhes.municipio_id)}</p>
                            </div>
                            <div>
                                <Label>Prestador</Label>
                                <p className="font-semibold mt-2">{getPrestadorNome(termoDetalhes.prestador_servico_id)}</p>
                            </div>
                            <div>
                                <Label>Prazo para Resposta (dias)</Label>
                                <Input
                                    type="number"
                                    value={dadosEditados.prazo_resposta_dias !== null ? dadosEditados.prazo_resposta_dias : termoDetalhes.prazo_resposta_dias || 30}
                                    onChange={(e) => {
                                        setDadosEditados(prev => ({ ...prev, prazo_resposta_dias: parseInt(e.target.value) || 30 }));
                                        setAlteracoesPendentes(true);
                                    }}
                                />
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
                                    <h3 className="font-semibold mb-3">Protocolo / AR</h3>
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
                                        <div>
                                            <Label className="text-sm">Arquivo de Protocolo / AR (PDF)</Label>
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
                                        </div>
                                        <div>
                                            <Label className="text-sm">Ofício que Acompanha o Protocolo (PDF)</Label>
                                            <Input
                                                type="file"
                                                accept=".pdf"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        setUploadingProtocolo(true);
                                                        try {
                                                            const { file_url } = await base44.integrations.Core.UploadFile({ file });
                                                            setDadosEditados(prev => ({ ...prev, arquivo_oficio_protocolo: file_url }));
                                                            setAlteracoesPendentes(true);
                                                        } catch (error) {
                                                            alert('Erro ao enviar ofício');
                                                        } finally {
                                                            setUploadingProtocolo(false);
                                                        }
                                                    }
                                                }}
                                                disabled={uploadingProtocolo}
                                            />
                                        </div>
                                        {uploadingProtocolo && <p className="text-xs text-gray-500">Enviando arquivo...</p>}
                                        {(protocoNoTemp || dadosEditados.arquivo_oficio_protocolo) && !uploadingProtocolo && (
                                            <p className="text-xs text-green-600">✓ Arquivo(s) carregado(s)</p>
                                        )}
                                    </div>
                                </div>

                                {termoDetalhes.data_maxima_resposta && (
                                    <div className="border-t pt-4">
                                        <h3 className="font-semibold mb-3">Manifestação do Prestador</h3>
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
                                            <div>
                                                <Label className="text-sm">Arquivo de Manifestação (PDF)</Label>
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
                                            </div>
                                            <div>
                                                <Label className="text-sm">Ofício que Acompanha a Manifestação (PDF)</Label>
                                                <Input
                                                    type="file"
                                                    accept=".pdf"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            setUploadingResposta(true);
                                                            try {
                                                                const { file_url } = await base44.integrations.Core.UploadFile({ file });
                                                                setDadosEditados(prev => ({ ...prev, arquivo_oficio_resposta: file_url }));
                                                                setAlteracoesPendentes(true);
                                                            } catch (error) {
                                                                alert('Erro ao enviar ofício');
                                                            } finally {
                                                                setUploadingResposta(false);
                                                            }
                                                        }
                                                    }}
                                                    disabled={uploadingResposta}
                                                />
                                            </div>
                                            {uploadingResposta && <p className="text-xs text-gray-500">Enviando arquivo...</p>}
                                            {(dadosEditados.arquivo_resposta_url || dadosEditados.arquivo_oficio_resposta) && !uploadingResposta && (
                                                <p className="text-xs text-green-600">✓ Arquivo(s) carregado(s)</p>
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
                                                    arquivo_oficio_protocolo: null,
                                                    data_recebimento_resposta: null,
                                                    arquivo_resposta_url: null,
                                                    arquivo_oficio_resposta: null,
                                                    numero_processo: null,
                                                    fiscalizacao_id: null,
                                                    camara_tecnica: null,
                                                    prazo_resposta_dias: null
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

                                                        // Dados básicos do termo
                                                        if (dadosEditados.numero_processo !== null) {
                                                            updateData.numero_processo = dadosEditados.numero_processo;
                                                        }
                                                        if (dadosEditados.fiscalizacao_id !== null) {
                                                            updateData.fiscalizacao_id = dadosEditados.fiscalizacao_id;
                                                            const fisc = fiscalizacoes.find(f => f.id === dadosEditados.fiscalizacao_id);
                                                            if (fisc) {
                                                                updateData.municipio_id = fisc.municipio_id;
                                                                updateData.prestador_servico_id = fisc.prestador_servico_id;
                                                            }
                                                        }
                                                        if (dadosEditados.camara_tecnica !== null) {
                                                            updateData.camara_tecnica = dadosEditados.camara_tecnica;
                                                        }
                                                        if (dadosEditados.prazo_resposta_dias !== null) {
                                                            updateData.prazo_resposta_dias = dadosEditados.prazo_resposta_dias;
                                                            // Recalcular data_maxima_resposta se houver data_protocolo
                                                            if (termoDetalhes.data_protocolo) {
                                                                const dp = new Date(termoDetalhes.data_protocolo + 'T00:00:00');
                                                                const dmax = new Date(dp);
                                                                dmax.setDate(dmax.getDate() + dadosEditados.prazo_resposta_dias);
                                                                updateData.data_maxima_resposta = `${dmax.getFullYear()}-${String(dmax.getMonth() + 1).padStart(2, '0')}-${String(dmax.getDate()).padStart(2, '0')}`;
                                                            }
                                                        }

                                                        if (dadosEditados.data_protocolo) {
                                                            updateData.data_protocolo = dadosEditados.data_protocolo;
                                                            const dp = new Date(dadosEditados.data_protocolo + 'T00:00:00');
                                                            const prazo = dadosEditados.prazo_resposta_dias !== null ? dadosEditados.prazo_resposta_dias : termoDetalhes.prazo_resposta_dias || 30;
                                                            const dmax = new Date(dp);
                                                            dmax.setDate(dmax.getDate() + prazo);
                                                            updateData.data_maxima_resposta = `${dmax.getFullYear()}-${String(dmax.getMonth() + 1).padStart(2, '0')}-${String(dmax.getDate()).padStart(2, '0')}`;
                                                        }

                                                        if (dadosEditados.arquivo_protocolo_url) {
                                                                            updateData.arquivo_protocolo_url = dadosEditados.arquivo_protocolo_url;
                                                                        }

                                                                        if (dadosEditados.arquivo_oficio_protocolo) {
                                                                            updateData.arquivo_oficio_protocolo = dadosEditados.arquivo_oficio_protocolo;
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

                                                                        if (dadosEditados.arquivo_oficio_resposta) {
                                                                            updateData.arquivo_oficio_resposta = dadosEditados.arquivo_oficio_resposta;
                                                                        }

                                                        await base44.entities.TermoNotificacao.update(termoDetalhes.id, updateData);
                                                        queryClient.invalidateQueries({ queryKey: ['termos-notificacao'] });
                                                        setTermoDetalhes(null);
                                                        setAlteracoesPendentes(false);
                                                        setDadosEditados({
                                                            data_protocolo: null,
                                                            arquivo_protocolo_url: null,
                                                            arquivo_oficio_protocolo: null,
                                                            data_recebimento_resposta: null,
                                                            arquivo_resposta_url: null,
                                                            arquivo_oficio_resposta: null,
                                                            numero_processo: null,
                                                            fiscalizacao_id: null,
                                                            camara_tecnica: null,
                                                            prazo_resposta_dias: null
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
                                                 {termo.numero_rfp && (
                                                     <p className="text-sm text-blue-600 font-medium">
                                                         RFP/DSB/{termo.camara_tecnica}/{String(termo.numero_rfp).padStart(3, '0')}/{new Date(termo.data_geracao || Date.now()).getFullYear()}
                                                     </p>
                                                 )}
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
                                                         <span className="font-medium">Protocolado em:</span> {termo.data_protocolo ? (() => {
                                                             const [a, m, d] = termo.data_protocolo.split('-');
                                                             return `${d}/${m}/${a}`;
                                                         })() : 'N/A'}
                                                     </div>
                                                     <div>
                                                         <span className="font-medium">Prazo:</span> {termo.prazo_resposta_dias || 30} dias
                                                     </div>
                                                     <div>
                                                         <span className="font-medium">Prazo para Manifestação do Prestador:</span> {termo.data_maxima_resposta ? (() => {
                                                             const [a, m, d] = termo.data_maxima_resposta.split('-');
                                                             return `${d}/${m}/${a}`;
                                                         })() : 'N/A'}
                                                         {termo.data_maxima_resposta && !termo.data_recebimento_resposta && (
                                                             <p className={`text-xs mt-1 ${verificaPrazoVencido(termo) ? 'text-red-600' : 'text-green-600'}`}>
                                                                 {verificaPrazoVencido(termo) ? '⚠️ Prazo vencido' : '✓ No prazo'}
                                                             </p>
                                                         )}
                                                     </div>
                                                     {termo.data_recebimento_resposta && (
                                                         <>
                                                             <div>
                                                                 <span className="font-medium">Manifestação do Prestador em:</span> {(() => {
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
                                                                             <Label>Ofício Recebido (PDF) *</Label>
                                                                             <Input
                                                                                 type="file"
                                                                                 accept=".pdf"
                                                                                 id={`file-oficio-proto-${termo.id}`}
                                                                                 onChange={async (e) => {
                                                                                     const file = e.target.files?.[0];
                                                                                     if (file) {
                                                                                         setUploadingProtocolo(true);
                                                                                         try {
                                                                                             const { file_url } = await base44.integrations.Core.UploadFile({ file });
                                                                                             setOficioProtocoloTemp(file_url);
                                                                                         } catch (error) {
                                                                                             alert('Erro ao enviar ofício');
                                                                                         } finally {
                                                                                             setUploadingProtocolo(false);
                                                                                         }
                                                                                     }
                                                                                 }}
                                                                                 disabled={uploadingProtocolo}
                                                                             />
                                                                             <Label>TN recebido / AR (PDF) *</Label>
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
                                                                             {protocoNoTemp && oficioProtocoloTemp && !uploadingProtocolo && (
                                                                                 <p className="text-xs text-green-600 mt-1">✓ Arquivos carregados. Clique em "Salvar" para confirmar.</p>
                                                                             )}
                                                                              <Button
                                                                                  onClick={async () => {
                                                                                      const dataInput = document.getElementById(`data-proto-${termo.id}`);
                                                                                      const data = dataInput?.value;

                                                                                      if (!data) {
                                                                                          alert('Informe a data de protocolo');
                                                                                          return;
                                                                                      }

                                                                                      if (!protocoNoTemp || !oficioProtocoloTemp) {
                                                                                          alert('Envie ambos os arquivos obrigatórios');
                                                                                          return;
                                                                                      }

                                                                                      try {
                                                                                          setUploadingProtocoloData(true);
                                                                                          
                                                                                          const dprot = new Date(data + 'T00:00:00');
                                                                                          const prazo = termo.prazo_resposta_dias || 30;
                                                                                          const dmax = new Date(dprot);
                                                                                          dmax.setDate(dmax.getDate() + prazo);
                                                                                          const dmax_str = `${dmax.getFullYear()}-${String(dmax.getMonth() + 1).padStart(2, '0')}-${String(dmax.getDate()).padStart(2, '0')}`;

                                                                                          const updateData = {
                                                                                              data_protocolo: data,
                                                                                              data_maxima_resposta: dmax_str,
                                                                                              arquivo_protocolo_url: protocoNoTemp,
                                                                                              arquivo_oficio_protocolo: oficioProtocoloTemp
                                                                                          };

                                                                                          await base44.entities.TermoNotificacao.update(termo.id, updateData);

                                                                                          await queryClient.invalidateQueries({ queryKey: ['termos-notificacao'] });
                                                                                          setDataProtocoloOpen(false);
                                                                                          setProtocoloTemp(null);
                                                                                          setOficioProtocoloTemp(null);
                                                                                          document.getElementById(`file-proto-${termo.id}`).value = '';
                                                                                          document.getElementById(`file-oficio-proto-${termo.id}`).value = '';
                                                                                          alert('Data de protocolo e arquivos salvos!');
                                                                                      } catch (error) {
                                                                                          alert('Erro: ' + error.message);
                                                                                      } finally {
                                                                                          setUploadingProtocoloData(false);
                                                                                      }
                                                                                  }}
                                                                                  disabled={uploadingProtocoloData || !protocoNoTemp || !oficioProtocoloTemp}
                                                                                  className="w-full"
                                                                              >
                                                                                  {uploadingProtocoloData ? 'Salvando...' : 'Salvar'}
                                                                              </Button>
                                                                          </div>
                                                                      </DialogContent>
                                                                  </Dialog>
                                                              )}

                                                              {termo.arquivo_url && termo.data_protocolo && !termo.data_recebimento_resposta && (
                                                              <Dialog open={respostaOpenId === termo.id} onOpenChange={(open) => {
                                                                  setRespostaOpenId(open ? termo.id : null);
                                                                  if (!open) {
                                                                      setRespostaManifestacaoTemp(null);
                                                                      setRespostaOficioTemp(null);
                                                                  }
                                                              }}>
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
                                                                   ⚠️ Prazo vencido em {(() => {
                                                                       const [a, m, d] = termo.data_maxima_resposta.split('-');
                                                                       return `${d}/${m}/${a}`;
                                                                   })()}
                                                                </div>
                                                              )}
                                                              <div>
                                                                <Label>Data de Recebimento *</Label>
                                                                <Input
                                                                    type="date"
                                                                    id={`data-resp-${termo.id}`}
                                                                />
                                                              </div>
                                                              <div>
                                                                <Label>Ofício de Manifestação (PDF) *</Label>
                                                                <Input
                                                                    type="file"
                                                                    accept=".pdf"
                                                                    id={`file-oficio-resp-${termo.id}`}
                                                                    onChange={async (e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) {
                                                                            setUploadingResposta(true);
                                                                            try {
                                                                                const { file_url } = await base44.integrations.Core.UploadFile({ file });
                                                                                setRespostaOficioTemp(file_url);
                                                                            } catch (error) {
                                                                                alert('Erro ao enviar ofício');
                                                                            } finally {
                                                                                setUploadingResposta(false);
                                                                            }
                                                                        }
                                                                    }}
                                                                    disabled={uploadingResposta}
                                                                />
                                                              </div>
                                                              <div>
                                                                <Label>Arquivo Manifestação (PDF) *</Label>
                                                                <Input
                                                                    type="file"
                                                                    accept=".pdf"
                                                                    id={`file-resp-${termo.id}`}
                                                                    onChange={async (e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) {
                                                                            setUploadingResposta(true);
                                                                            try {
                                                                                const { file_url } = await base44.integrations.Core.UploadFile({ file });
                                                                                setRespostaManifestacaoTemp(file_url);
                                                                            } catch (error) {
                                                                                alert('Erro ao enviar arquivo');
                                                                            } finally {
                                                                                setUploadingResposta(false);
                                                                            }
                                                                        }
                                                                    }}
                                                                    disabled={uploadingResposta}
                                                                />
                                                              </div>
                                                              {uploadingResposta && <p className="text-xs text-gray-500 mt-1">Enviando arquivo...</p>}
                                                              {respostaManifestacaoTemp && respostaOficioTemp && !uploadingResposta && (
                                                                  <p className="text-xs text-green-600 mt-1">✓ Arquivos carregados. Clique em "Adicionar Arquivo" para confirmar.</p>
                                                              )}
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

                                                                    if (!data) {
                                                                        alert('Informe a data de recebimento');
                                                                        return;
                                                                    }

                                                                    if (!respostaManifestacaoTemp || !respostaOficioTemp) {
                                                                        alert('Envie ambos os arquivos obrigatórios');
                                                                        return;
                                                                    }

                                                                    try {
                                                                          setUploadingResposta(true);

                                                                          const dataRecebStr = data;
                                                                          const dataMax = new Date(termo.data_maxima_resposta + 'T00:00:00');
                                                                          const dataReceb = new Date(data + 'T00:00:00');

                                                                          const novoArquivo = {
                                                                              url: respostaManifestacaoTemp,
                                                                              nome: 'Manifestação do Prestador',
                                                                              data_upload: new Date().toISOString()
                                                                          };

                                                                          const arquivosAtuais = termo.arquivos_resposta || [];
                                                                          const termoAtualizado = await base44.entities.TermoNotificacao.update(termo.id, {
                                                                              data_recebimento_resposta: dataRecebStr,
                                                                              arquivos_resposta: [...arquivosAtuais, novoArquivo],
                                                                              arquivo_oficio_resposta: respostaOficioTemp,
                                                                              recebida_no_prazo: dataReceb <= dataMax,
                                                                             status: 'respondido'
                                                                          });

                                                                         queryClient.setQueryData(['termos-notificacao'], (old) => {
                                                                             return old.map(t => t.id === termo.id ? termoAtualizado : t);
                                                                         });

                                                                         setRespostaManifestacaoTemp(null);
                                                                         setRespostaOficioTemp(null);
                                                                         document.getElementById(`file-resp-${termo.id}`).value = '';
                                                                         document.getElementById(`file-oficio-resp-${termo.id}`).value = '';
                                                                         alert('Arquivos adicionados com sucesso!');
                                                                     } catch (error) {
                                                                         alert('Erro ao salvar: ' + error.message);
                                                                     } finally {
                                                                         setUploadingResposta(false);
                                                                     }
                                                                }}
                                                                disabled={uploadingResposta || !respostaManifestacaoTemp || !respostaOficioTemp}
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
                                                              onClick={() => {
                                                                  window.open(termo.arquivo_protocolo_url);
                                                                  if (termo.arquivo_oficio_protocolo) {
                                                                      setTimeout(() => window.open(termo.arquivo_oficio_protocolo), 500);
                                                                  }
                                                              }}
                                                              className="w-full"
                                                              >
                                                              <Download className="h-4 w-4 mr-1" />
                                                              Baixar Protocolo {termo.arquivo_oficio_protocolo && '+ Ofício'}
                                                              </Button>
                                                              )}

                                                              {termo.arquivos_resposta && termo.arquivos_resposta.length > 0 && (
                                                              <>
                                                              {termo.arquivos_resposta.map((arquivo, idx) => (
                                                              <Button
                                                              key={idx}
                                                              size="sm"
                                                              variant="outline"
                                                              onClick={() => {
                                                                  window.open(arquivo.url);
                                                                  if (termo.arquivo_oficio_resposta) {
                                                                      setTimeout(() => window.open(termo.arquivo_oficio_resposta), 500);
                                                                  }
                                                              }}
                                                              className="w-full"
                                                              >
                                                              <Download className="h-4 w-4 mr-1" />
                                                              Baixar Manifestação {termo.arquivo_oficio_resposta && '+ Ofício'}
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