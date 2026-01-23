import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileText, AlertCircle, CheckCircle, Clock, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import jsPDF from 'jspdf';

export default function AnaliseManifestacao() {
    const [filtros, setFiltros] = useState({
        busca: '',
        camaraTecnica: '',
        status: '',
        dataInicio: '',
        dataFim: ''
    });

    const { data: termos = [] } = useQuery({
        queryKey: ['termos-notificacao'],
        queryFn: () => base44.entities.TermoNotificacao.list()
    });

    const { data: fiscalizacoes = [] } = useQuery({
        queryKey: ['fiscalizacoes'],
        queryFn: () => base44.entities.Fiscalizacao.list()
    });

    const { data: determinacoes = [] } = useQuery({
        queryKey: ['determinacoes'],
        queryFn: () => base44.entities.Determinacao.list()
    });

    const { data: unidadesFiscalizadas = [] } = useQuery({
        queryKey: ['unidades-fiscalizadas'],
        queryFn: () => base44.entities.UnidadeFiscalizada.list()
    });

    const { data: prestadores = [] } = useQuery({
        queryKey: ['prestadores'],
        queryFn: () => base44.entities.PrestadorServico.list()
    });

    const { data: municipios = [] } = useQuery({
        queryKey: ['municipios'],
        queryFn: () => base44.entities.Municipio.list()
    });

    const { data: respostasDeterminacao = [] } = useQuery({
        queryKey: ['respostas-determinacao'],
        queryFn: () => base44.entities.RespostaDeterminacao.list()
    });

    const getPrestadorNome = (id) => {
        const p = prestadores.find(pres => pres.id === id);
        return p?.nome || 'N/A';
    };

    const getMunicipioNome = (id) => {
        const m = municipios.find(mun => mun.id === id);
        return m?.nome || 'N/A';
    };

    const getDeterminacoesPorTermo = (termo) => {
        if (!termo.fiscalizacao_id) return [];
        // Buscar unidades desta fiscalização
        const unidadesDaFisc = unidadesFiscalizadas.filter(u => u.fiscalizacao_id === termo.fiscalizacao_id);
        const unidadeIds = unidadesDaFisc.map(u => u.id);
        // Buscar determinações das unidades
        return determinacoes.filter(d => unidadeIds.includes(d.unidade_fiscalizada_id));
    };

    const getStatusDeterminacao = (detId) => {
        const resposta = respostasDeterminacao.find(r => r.determinacao_id === detId);
        return resposta?.status || 'pendente';
    };

    const contarStatusDeterminacoes = (termo) => {
        const dets = getDeterminacoesPorTermo(termo);
        const total = dets.length;
        const aguardandoAnalise = dets.filter(d => getStatusDeterminacao(d.id) === 'aguardando_analise').length;
        const atendidas = dets.filter(d => getStatusDeterminacao(d.id) === 'atendida').length;
        const naoAtendidas = dets.filter(d => getStatusDeterminacao(d.id) === 'nao_atendida').length;
        return { total, aguardandoAnalise, atendidas, naoAtendidas };
    };

    // Filtrar termos: apenas aguardando_resposta ou com respostas pendentes de análise
    const termosFiltrados = termos.filter(termo => {
        // Status do termo: deve ter resposta registrada (aguardando análise) ou estar aguardando resposta
        const statusTermo = termo.status;
        if (statusTermo !== 'aguardando_resposta' && statusTermo !== 'respondido') return false;

        const fisc = fiscalizacoes.find(f => f.id === termo.fiscalizacao_id);
        if (!fisc || fisc.status !== 'finalizada') return false;

        // Aplicar filtros
        if (filtros.busca && !termo.numero_termo_notificacao?.toLowerCase().includes(filtros.busca.toLowerCase())) return false;
        if (filtros.camaraTecnica && termo.camara_tecnica !== filtros.camaraTecnica) return false;
        if (filtros.dataInicio && new Date(termo.data_geracao) < new Date(filtros.dataInicio)) return false;
        if (filtros.dataFim && new Date(termo.data_geracao) > new Date(filtros.dataFim)) return false;

        const stats = contarStatusDeterminacoes(termo);
        if (filtros.status === 'aguardando_analise' && stats.aguardandoAnalise === 0) return false;
        if (filtros.status === 'analisado' && (stats.atendidas + stats.naoAtendidas) === 0) return false;

        return true;
    });

    const getStatusBadge = (termo) => {
        const stats = contarStatusDeterminacoes(termo);
        
        if (stats.total === 0) return { label: 'Sem determinações', color: 'bg-gray-500' };
        
        // Se já tem resposta do prestador registrada
        if (termo.data_recebimento_resposta) {
            if (stats.atendidas + stats.naoAtendidas === stats.total) {
                return { label: 'Análise Concluída', color: 'bg-green-600' };
            } else {
                return { label: 'Aguardando Análise', color: 'bg-yellow-600' };
            }
        } else {
            // Se ainda não tem resposta do prestador
            return { label: 'Aguardando Resposta', color: 'bg-blue-600' };
        }
    };

    const todasDeterminacoesAnalisadas = (termo) => {
        const stats = contarStatusDeterminacoes(termo);
        if (stats.total === 0) return false;
        return stats.atendidas + stats.naoAtendidas === stats.total;
    };

    const gerarAnaliseManifestacao = async (termo) => {
        const dets = getDeterminacoesPorTermo(termo).sort((a, b) => {
            const numA = parseInt(a.numero_determinacao?.replace(/\D/g, '') || '0');
            const numB = parseInt(b.numero_determinacao?.replace(/\D/g, '') || '0');
            return numA - numB;
        });
        
        const resp = respostasDeterminacao.filter(r => 
            dets.map(d => d.id).includes(r.determinacao_id)
        );
        
        const ano = new Date().getFullYear();
        const camaraTecnica = termo.camara_tecnica;
        
        // Contar AMs já geradas neste ano para esta câmara técnica
        const todasAsAMs = await base44.entities.TermoNotificacao.list();
        const amsDoAno = todasAsAMs.filter(t => {
            if (!t.numero_termo_notificacao) return false;
            const match = t.numero_termo_notificacao.match(/AM\s*(\d+)\/\d+\/DSB\/(\w+)/);
            return match && match[2] === camaraTecnica && t.numero_termo_notificacao.includes(`/${ano}/`);
        });
        const proximoNumeroAM = amsDoAno.length + 1;
        const numeroAM = `AM ${String(proximoNumeroAM).padStart(3, '0')}/${ano}/DSB/${camaraTecnica}`;

        const doc = new jsPDF('l', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;

        // Título
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text(numeroAM, margin, 15);

        // Informações do TN
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        const fisc = fiscalizacoes.find(f => f.id === termo.fiscalizacao_id);
        doc.text(`TN: ${termo.numero_termo_notificacao}`, margin, 22);
        doc.text(`Município: ${getMunicipioNome(termo.municipio_id)} | Prestador: ${getPrestadorNome(termo.prestador_servico_id)}`, margin, 28);

        // Tabela com melhor formatação
        const tableTop = 35;
        const colWidths = [18, 28, 32, 36, 22, 18];
        const headers = ['Determinação', 'Base Legal', 'Manifestação Apresentada', 'Análise', 'Resultado da Análise', 'Nº AI'];
        
        doc.setFont(undefined, 'bold');
        doc.setFillColor(180, 200, 255);
        doc.setFontSize(9);
        let xPos = margin;
        headers.forEach((header, i) => {
            doc.rect(xPos, tableTop, colWidths[i], 7, 'F');
            const lines = doc.splitTextToSize(header, colWidths[i] - 2);
            doc.text(lines, xPos + 1, tableTop + 3.5, { align: 'left' });
            xPos += colWidths[i];
        });

        // Buscar números dos AIs gerados
        const autos = await base44.entities.AutoInfracao.list();
        const autosPorDeterminacao = {};
        autos.forEach(auto => {
            if (auto.determinacao_id) {
                autosPorDeterminacao[auto.determinacao_id] = auto.numero_auto;
            }
        });

        // Dados das determinações
        doc.setFont(undefined, 'normal');
        doc.setFontSize(8);
        let yPos = tableTop + 7;

        dets.forEach(det => {
            const resposta = resp.find(r => r.determinacao_id === det.id);
            
            // Calcular altura da linha baseado no conteúdo
            const manifestacaoLines = doc.splitTextToSize(resposta?.manifestacao_prestador || 'N/A', colWidths[2] - 2);
            const analiseLines = doc.splitTextToSize(resposta?.descricao_atendimento || 'N/A', colWidths[3] - 2);
            const maxLines = Math.max(manifestacaoLines.length, analiseLines.length, 2);
            const rowHeight = maxLines * 3.5 + 2;

            // Verificar se precisa de nova página
            if (yPos + rowHeight > pageHeight - 10) {
                doc.addPage();
                yPos = 10;
            }

            xPos = margin;

            // Determinação
            doc.text(det.numero_determinacao, xPos + 1, yPos + 2, { maxWidth: colWidths[0] - 2 });
            xPos += colWidths[0];

            // Base Legal
            doc.text('Portaria AGEMS nº 233/2022', xPos + 1, yPos + 2, { maxWidth: colWidths[1] - 2 });
            xPos += colWidths[1];

            // Manifestação Apresentada
            const manifestacaoText = doc.splitTextToSize(resposta?.manifestacao_prestador || 'N/A', colWidths[2] - 2);
            doc.text(manifestacaoText, xPos + 1, yPos + 2);
            xPos += colWidths[2];

            // Análise
            const analiseText = doc.splitTextToSize(resposta?.descricao_atendimento || 'N/A', colWidths[3] - 2);
            doc.text(analiseText, xPos + 1, yPos + 2);
            xPos += colWidths[3];

            // Resultado
            const resultado = resposta?.status === 'atendida' ? 'ACATADA' : 'NÃO ACATADA';
            doc.setFont(undefined, 'bold');
            if (resposta?.status === 'atendida') {
                doc.setTextColor(0, 128, 0);
            } else {
                doc.setTextColor(255, 0, 0);
            }
            doc.text(resultado, xPos + 1, yPos + 2, { maxWidth: colWidths[4] - 2 });
            doc.setTextColor(0, 0, 0);
            doc.setFont(undefined, 'normal');
            xPos += colWidths[4];

            // Nº AI
            const numeroAI = autosPorDeterminacao[det.id];
            if (numeroAI) {
                doc.text(numeroAI, xPos + 1, yPos + 2, { maxWidth: colWidths[5] - 2 });
            } else if (resposta?.status === 'nao_atendida') {
                doc.text('Gerar', xPos + 1, yPos + 2, { maxWidth: colWidths[5] - 2 });
            }

            // Desenhar bordo da célula
            doc.rect(margin, yPos, pageWidth - 2 * margin, rowHeight);
            yPos += rowHeight;
        });

        doc.save(`${numeroAM}.pdf`);
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
                        <h1 className="text-3xl font-bold">Análise da Manifestação</h1>
                    </div>
                </div>

                {/* Dashboard KPI */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Total TNs</p>
                                    <p className="text-2xl font-bold">{termosFiltrados.length}</p>
                                </div>
                                <FileText className="h-8 w-8 text-blue-600" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Aguardando Análise</p>
                                    <p className="text-2xl font-bold">
                                        {termosFiltrados.filter(t => {
                                            const stats = contarStatusDeterminacoes(t);
                                            return t.data_recebimento_resposta && stats.total > 0 && (stats.atendidas + stats.naoAtendidas < stats.total);
                                        }).length}
                                    </p>
                                </div>
                                <Clock className="h-8 w-8 text-yellow-600" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Análises Concluídas</p>
                                    <p className="text-2xl font-bold">
                                        {termosFiltrados.filter(t => {
                                            const stats = contarStatusDeterminacoes(t);
                                            return t.data_recebimento_resposta && stats.atendidas + stats.naoAtendidas === stats.total && stats.total > 0;
                                        }).length}
                                    </p>
                                </div>
                                <CheckCircle className="h-8 w-8 text-green-600" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Autos Gerados</p>
                                    <p className="text-2xl font-bold">
                                        {termosFiltrados.reduce((acc, t) => {
                                            const stats = contarStatusDeterminacoes(t);
                                            return acc + stats.naoAtendidas;
                                        }, 0)}
                                    </p>
                                </div>
                                <AlertCircle className="h-8 w-8 text-red-600" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filtros */}
                <Card className="mb-6">
                    <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <Input
                                placeholder="Buscar TN..."
                                value={filtros.busca}
                                onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
                            />
                            <Select value={filtros.camaraTecnica} onValueChange={(v) => setFiltros({ ...filtros, camaraTecnica: v })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Câmara Técnica" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={null}>Todas</SelectItem>
                                    <SelectItem value="CATESA">CATESA</SelectItem>
                                    <SelectItem value="CATERS">CATERS</SelectItem>
                                    <SelectItem value="CRES">CRES</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={filtros.status} onValueChange={(v) => setFiltros({ ...filtros, status: v })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={null}>Todos</SelectItem>
                                    <SelectItem value="aguardando_analise">Aguardando Análise</SelectItem>
                                    <SelectItem value="analisado">Analisado</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input
                                type="date"
                                placeholder="Data Início"
                                value={filtros.dataInicio}
                                onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
                            />
                            <Input
                                type="date"
                                placeholder="Data Fim"
                                value={filtros.dataFim}
                                onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
                            />
                        </div>
                        {(filtros.busca || filtros.camaraTecnica || filtros.status || filtros.dataInicio || filtros.dataFim) && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={() => setFiltros({ busca: '', camaraTecnica: '', status: '', dataInicio: '', dataFim: '' })}
                            >
                                Limpar Filtros
                            </Button>
                        )}
                    </CardContent>
                </Card>

                {/* Lista de TNs */}
                <div className="space-y-4">
                    {termosFiltrados.length === 0 ? (
                        <Card className="p-8">
                            <div className="text-center text-gray-500">
                                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                <p>Nenhum TN encontrado para análise</p>
                            </div>
                        </Card>
                    ) : (
                        termosFiltrados.map(termo => {
                            const fisc = fiscalizacoes.find(f => f.id === termo.fiscalizacao_id);
                            const stats = contarStatusDeterminacoes(termo);
                            const statusInfo = getStatusBadge(termo);

                            return (
                                <Card key={termo.id} className="hover:shadow-lg transition-shadow">
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-lg mb-2">{termo.numero_termo_notificacao || termo.numero_termo}</h3>
                                                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                                                    <div>
                                                        <span className="font-medium">Município:</span> {getMunicipioNome(termo.municipio_id)}
                                                    </div>
                                                    <div>
                                                        <span className="font-medium">Prestador:</span> {getPrestadorNome(termo.prestador_servico_id)}
                                                    </div>
                                                    <div>
                                                        <span className="font-medium">Câmara:</span> {termo.camara_tecnica}
                                                    </div>
                                                    <div>
                                                       <span className="font-medium">Processo:</span> {termo.numero_processo || 'N/A'}
                                                    </div>
                                                    <div className="col-span-2">
                                                        <span className="font-medium">Serviços:</span> {fisc?.servicos?.join(', ') || 'N/A'}
                                                    </div>
                                                    </div>
                                                <div className="flex gap-2 text-xs">
                                                    <Badge className="bg-blue-600">Total: {stats.total} determinações</Badge>
                                                    {stats.aguardandoAnalise > 0 && (
                                                        <Badge className="bg-yellow-600">{stats.aguardandoAnalise} aguardando análise</Badge>
                                                    )}
                                                    {stats.atendidas > 0 && (
                                                        <Badge className="bg-green-600">{stats.atendidas} atendidas</Badge>
                                                    )}
                                                    {stats.naoAtendidas > 0 && (
                                                        <Badge className="bg-red-600">{stats.naoAtendidas} não atendidas</Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2 items-end">
                                                <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                                                {stats.total > 0 && !todasDeterminacoesAnalisadas(termo) && (
                                                    <Link to={createPageUrl('AnalisarResposta') + `?termo=${termo.id}`}>
                                                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                                                            Analisar Determinações
                                                        </Button>
                                                    </Link>
                                                )}
                                                {stats.total > 0 && todasDeterminacoesAnalisadas(termo) && (
                                                    <Button 
                                                        size="sm" 
                                                        className="bg-green-600 hover:bg-green-700"
                                                        onClick={() => gerarAnaliseManifestacao(termo)}
                                                    >
                                                        <Download className="h-4 w-4 mr-1" />
                                                        Gerar Análise
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}