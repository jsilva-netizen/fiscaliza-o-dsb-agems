import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileText, AlertCircle, CheckCircle, Clock, Download, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import jsPDF from 'jspdf';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AnaliseManifestacao() {
    const [filtros, setFiltros] = useState({
        busca: '',
        camaraTecnica: '',
        status: '',
        dataInicio: '',
        dataFim: ''
    });
    const [termoExcluindo, setTermoExcluindo] = useState(null);
    const [confirmarExclusao, setConfirmarExclusao] = useState(false);

    const { data: termos = [], refetch: refetchTermos } = useQuery({
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

    const excluirAnalise = async (termo) => {
        // Restaurar para o número original do TN (sem AM)
        const numeroOriginal = `TN 002/${new Date().getFullYear()}/DSB/${termo.camara_tecnica}`;
        await base44.entities.TermoNotificacao.update(termo.id, { 
            numero_termo_notificacao: numeroOriginal 
        });
        refetchTermos();
        setTermoExcluindo(null);
        setConfirmarExclusao(false);
    };

    const calcularNumeroAM = async (termo) => {
        const ano = new Date().getFullYear();
        const todosOsTermos = await base44.entities.TermoNotificacao.list();
        const amsDoAno = todosOsTermos.filter(t => {
            if (!t.numero_termo_notificacao) return false;
            const match = t.numero_termo_notificacao.match(/AM\s*(\d+)\/(\d{4})\/DSB\/AGEMS/);
            return match && parseInt(match[2]) === ano;
        });
        const proximoNumeroAM = amsDoAno.length + 1;
        return `AM ${String(proximoNumeroAM).padStart(3, '0')}/${ano}/DSB/AGEMS`;
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
        
        const numeroAM = await calcularNumeroAM(termo);
        
        // Salvar número da AM no termo
        await base44.entities.TermoNotificacao.update(termo.id, { numero_termo_notificacao: numeroAM });
        
        // Atualizar lista de termos
        refetchTermos();

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
        const colWidths = [14, 24, 31, 33, 28, 18];
        const headers = ['Determinação', 'Base Legal', 'Manifestação Apresentada', 'Análise', 'Resultado da Análise', 'Nº AI'];
        
        doc.setFont(undefined, 'bold');
        doc.setFillColor(150, 170, 220);
        doc.setFontSize(9);
        let xPos = margin;
        headers.forEach((header, i) => {
            doc.rect(xPos, tableTop, colWidths[i], 6, 'F');
            doc.setTextColor(0, 0, 0);
            const headerLines = doc.splitTextToSize(header, colWidths[i] - 1);
            doc.text(headerLines, xPos + 0.5, tableTop + 3.5, { maxWidth: colWidths[i] - 1 });
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
        doc.setFontSize(7);
        let yPos = tableTop + 6;

        dets.forEach((det, detIndex) => {
            const resposta = resp.find(r => r.determinacao_id === det.id);
            
            // Quebrar texto em múltiplas linhas
            const manifestacaoLines = doc.splitTextToSize(resposta?.manifestacao_prestador || '', colWidths[2] - 1);
            const analiseLines = doc.splitTextToSize(resposta?.descricao_atendimento || '', colWidths[3] - 1);
            const baseLegalLines = doc.splitTextToSize('Portaria AGEMS nº 233/2022 e suas alterações', colWidths[1] - 1);
            
            const maxLines = Math.max(manifestacaoLines.length || 1, analiseLines.length || 1, baseLegalLines.length || 1);
            const lineHeight = 2.5;
            const rowHeight = Math.max(6, maxLines * lineHeight + 2);

            // Verificar se precisa de nova página
            if (yPos + rowHeight > pageHeight - 10) {
                doc.addPage();
                yPos = 10;
            }

            xPos = margin;
            const cellStartY = yPos + 1;

            // Célula: Determinação
            doc.rect(xPos, yPos, colWidths[0], rowHeight);
            doc.setFont(undefined, 'bold');
            doc.text(det.numero_determinacao, xPos + 0.5, cellStartY, { maxWidth: colWidths[0] - 1 });
            xPos += colWidths[0];

            // Célula: Base Legal
            doc.rect(xPos, yPos, colWidths[1], rowHeight);
            doc.setFont(undefined, 'normal');
            doc.text(baseLegalLines, xPos + 0.5, cellStartY, { maxWidth: colWidths[1] - 1 });
            xPos += colWidths[1];

            // Célula: Manifestação Apresentada
            doc.rect(xPos, yPos, colWidths[2], rowHeight);
            doc.text(manifestacaoLines, xPos + 0.5, cellStartY, { maxWidth: colWidths[2] - 1 });
            xPos += colWidths[2];

            // Célula: Análise
            doc.rect(xPos, yPos, colWidths[3], rowHeight);
            doc.text(analiseLines, xPos + 0.5, cellStartY, { maxWidth: colWidths[3] - 1 });
            xPos += colWidths[3];

            // Célula: Resultado da Análise
            doc.rect(xPos, yPos, colWidths[4], rowHeight);
            const resultado = resposta?.status === 'atendida' ? 'ACATADA' : 'NÃO ACATADA';
            doc.setFont(undefined, 'bold');
            if (resposta?.status === 'atendida') {
                doc.setTextColor(0, 128, 0);
            } else {
                doc.setTextColor(255, 0, 0);
            }
            doc.text(resultado, xPos + 0.5, cellStartY, { maxWidth: colWidths[4] - 1 });
            doc.setTextColor(0, 0, 0);
            doc.setFont(undefined, 'normal');
            xPos += colWidths[4];

            // Célula: Nº AI
            doc.rect(xPos, yPos, colWidths[5], rowHeight);
            const numeroAI = autosPorDeterminacao[det.id];
            if (numeroAI) {
                doc.text(numeroAI, xPos + 0.5, cellStartY, { maxWidth: colWidths[5] - 1 });
            } else if (resposta?.status === 'nao_atendida') {
                doc.text('Gerar', xPos + 0.5, cellStartY, { maxWidth: colWidths[5] - 1 });
            } else {
                doc.text('NÃO SE APLICA', xPos + 0.5, cellStartY, { maxWidth: colWidths[5] - 1 });
            }

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
                                                <h3 className="font-semibold text-lg mb-2">
                                                    {termo.numero_termo_notificacao}
                                                </h3>
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
                                                    <div className="flex gap-2">
                                                        <Button 
                                                            size="sm" 
                                                            className="bg-green-600 hover:bg-green-700"
                                                            onClick={() => gerarAnaliseManifestacao(termo)}
                                                        >
                                                            <Download className="h-4 w-4 mr-1" />
                                                            Gerar Análise
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            onClick={() => {
                                                                setTermoExcluindo(termo);
                                                                setConfirmarExclusao(false);
                                                            }}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </div>

                {/* Dialog de Exclusão */}
                <AlertDialog open={termoExcluindo !== null} onOpenChange={(open) => {
                    if (!open) setTermoExcluindo(null);
                }}>
                    <AlertDialogContent>
                        {!confirmarExclusao ? (
                            <>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir Análise?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Tem certeza que deseja excluir a análise da manifestação? Esta ação removerá o número AM e permitirá que a análise seja refeita.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="flex gap-2 justify-end">
                                    <AlertDialogCancel onClick={() => setTermoExcluindo(null)}>
                                        Cancelar
                                    </AlertDialogCancel>
                                    <Button
                                        variant="destructive"
                                        onClick={() => setConfirmarExclusao(true)}
                                    >
                                        Excluir
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta é a última confirmação. Ao continuar, a análise será removida permanentemente e o TN voltará ao estado anterior.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="flex gap-2 justify-end">
                                    <Button
                                        variant="outline"
                                        onClick={() => setConfirmarExclusao(false)}
                                    >
                                        Voltar
                                    </Button>
                                    <AlertDialogAction
                                        className="bg-red-600 hover:bg-red-700"
                                        onClick={() => excluirAnalise(termoExcluindo)}
                                    >
                                        Confirmar Exclusão
                                    </AlertDialogAction>
                                </div>
                            </>
                        )}
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}