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

    const { data: autos = [] } = useQuery({
        queryKey: ['autos-infracao'],
        queryFn: () => base44.entities.AutoInfracao.list()
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
        
        // Se ainda não tem AM (resposta não foi registrada)
        if (!termo.numero_am) {
            return { label: 'Aguardando Resposta', color: 'bg-blue-600' };
        }
        
        // Se tem AM e todas as determinações foram analisadas
        if (stats.atendidas + stats.naoAtendidas === stats.total) {
            return { label: 'Análise Concluída', color: 'bg-green-600' };
        } else {
            // Se tem AM mas ainda há determinações aguardando análise
            return { label: 'Aguardando Análise', color: 'bg-yellow-600' };
        }
    };

    const todasDeterminacoesAnalisadas = (termo) => {
        const stats = contarStatusDeterminacoes(termo);
        if (stats.total === 0) return false;
        return stats.atendidas + stats.naoAtendidas === stats.total;
    };

    const excluirAnalise = async (termo) => {
        try {
            // Deletar todos os AIs relacionados a este termo
            const dets = getDeterminacoesPorTermo(termo);
            const detIds = dets.map(d => d.id);
            const todosAIs = await base44.entities.AutoInfracao.list();
            const aisParaDeletar = todosAIs.filter(ai => detIds.includes(ai.determinacao_id));
            
            for (const ai of aisParaDeletar) {
                await base44.entities.AutoInfracao.delete(ai.id);
            }

            // Deletar as RespostaDeterminacao para voltar ao estado "aguardando análise"
            const todasRespostas = await base44.entities.RespostaDeterminacao.list();
            const respostasParaDeletar = todasRespostas.filter(r => detIds.includes(r.determinacao_id));
            
            for (const resposta of respostasParaDeletar) {
                await base44.entities.RespostaDeterminacao.delete(resposta.id);
            }
            
            // Remover numero_am para permitir nova geração
            await base44.entities.TermoNotificacao.update(termo.id, { 
                numero_am: null 
            });
            refetchTermos();
            setTermoExcluindo(null);
            setConfirmarExclusao(false);
        } catch (error) {
            console.error('Erro ao excluir análise:', error);
        }
    };



    const calcularProximoNumeroTN = async () => {
        const ano = new Date().getFullYear();
        const todosOsTermos = await base44.entities.TermoNotificacao.list();
        const tnsDoAno = todosOsTermos.filter(t => {
            if (!t.numero_termo_notificacao) return false;
            const match = t.numero_termo_notificacao.match(/TN\s*(\d+)\/(\d{4})\/DSB\/AGEMS/);
            return match && parseInt(match[2]) === ano;
        });
        const proximoNumeroTN = tnsDoAno.length + 1;
        return String(proximoNumeroTN).padStart(3, '0');
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
        
        // Usar numero_am já gerado
        let numeroAM = termo.numero_am;

        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 12;
        let yPos = margin;

        // Título
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text(numeroAM, margin, yPos);
        yPos += 8;

        // Informações do TN
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.text(`TN: ${termo.numero_termo_notificacao}`, margin, yPos);
        yPos += 5;
        doc.text(`Município: ${getMunicipioNome(termo.municipio_id)} | Prestador: ${getPrestadorNome(termo.prestador_servico_id)}`, margin, yPos);
        yPos += 8;

        // Buscar números dos AIs gerados
        const autos = await base44.entities.AutoInfracao.list();
        const autosPorDeterminacao = {};
        autos.forEach(auto => {
            if (auto.determinacao_id) {
                autosPorDeterminacao[auto.determinacao_id] = auto.numero_auto;
            }
        });

        // Processar cada determinação
        dets.forEach((det, detIndex) => {
            const resposta = resp.find(r => r.determinacao_id === det.id);
            
            // Verificar espaço para nova linha (aprox 40mm por determinação)
            if (yPos + 40 > pageHeight - 10) {
                doc.addPage();
                yPos = margin;
            }

            const colLeft = margin;
            const colWidth = pageWidth - (2 * margin);
            const cellLineHeight = 5;
            
            // Cabeçalho da determinação
            doc.setFillColor(180, 180, 180);
            doc.rect(colLeft, yPos, colWidth, cellLineHeight, 'F');
            doc.setFont(undefined, 'bold');
            doc.setFontSize(9);
            doc.text(`Determinação: ${det.numero_determinacao}`, colLeft + 1, yPos + 3.5);
            yPos += cellLineHeight;

            // Dados em formato de linhas
            const dadoLinhas = [
                { label: 'Base Legal:', valor: 'Portaria AGEMS nº 233/2022 e suas alterações' },
                { label: 'Manifestação:', valor: resposta?.manifestacao_prestador || 'Sem informação' },
                { label: 'Análise:', valor: resposta?.descricao_atendimento || 'Sem informação' }
            ];

            doc.setFont(undefined, 'normal');
            doc.setFontSize(8);

            dadoLinhas.forEach(linha => {
                const textHeight = doc.getTextDimensions(linha.valor).h;
                const wrappedText = doc.splitTextToSize(linha.valor, colWidth - 40);
                const lineCount = wrappedText.length;
                const cellHeight = Math.max(cellLineHeight, lineCount * cellLineHeight + 2);

                // Label em fundo claro
                doc.setFillColor(240, 240, 240);
                doc.rect(colLeft, yPos, 35, cellHeight, 'F');
                doc.setFont(undefined, 'bold');
                doc.text(linha.label, colLeft + 1, yPos + 3);

                // Valor
                doc.setFont(undefined, 'normal');
                doc.text(wrappedText, colLeft + 37, yPos + 2, { maxWidth: colWidth - 39 });

                yPos += cellHeight;
            });

            // Resultado da Análise
            const resultado = resposta?.status === 'atendida' ? 'ACATADA' : 'NÃO ACATADA';
            const corResultado = resposta?.status === 'atendida' ? [0, 128, 0] : [255, 0, 0];
            
            doc.setFillColor(240, 240, 240);
            doc.rect(colLeft, yPos, 35, cellLineHeight, 'F');
            doc.setFont(undefined, 'bold');
            doc.setFontSize(8);
            doc.text('Resultado:', colLeft + 1, yPos + 3);

            doc.setFont(undefined, 'bold');
            doc.setFontSize(9);
            doc.setTextColor(corResultado[0], corResultado[1], corResultado[2]);
            doc.text(resultado, colLeft + 37, yPos + 3);
            doc.setTextColor(0, 0, 0);

            yPos += cellLineHeight;

            // Nº AI
            const numeroAI = autosPorDeterminacao[det.id];
            const textoAI = numeroAI ? numeroAI : (resposta?.status === 'nao_atendida' ? 'Gerar' : 'NÃO SE APLICA');
            
            doc.setFillColor(240, 240, 240);
            doc.rect(colLeft, yPos, 35, cellLineHeight, 'F');
            doc.setFont(undefined, 'bold');
            doc.setFontSize(8);
            doc.text('Nº AI:', colLeft + 1, yPos + 3);

            doc.setFont(undefined, 'normal');
            doc.setFontSize(8);
            doc.setTextColor(0, 0, 0);
            doc.text(textoAI, colLeft + 37, yPos + 3);

            yPos += cellLineHeight + 5;
        });

        return numeroAM;
    };

    const baixarAnaliseManifestacao = async (termo) => {
        const dets = getDeterminacoesPorTermo(termo).sort((a, b) => {
            const numA = parseInt(a.numero_determinacao?.replace(/\D/g, '') || '0');
            const numB = parseInt(b.numero_determinacao?.replace(/\D/g, '') || '0');
            return numA - numB;
        });
        
        const resp = respostasDeterminacao.filter(r => 
            dets.map(d => d.id).includes(r.determinacao_id)
        );
        
        const numeroAM = termo.numero_am;
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 12;
        let yPos = margin;

        // Título
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text(numeroAM, margin, yPos);
        yPos += 8;

        // Informações do TN
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.text(`TN: ${termo.numero_termo_notificacao}`, margin, yPos);
        yPos += 5;
        doc.text(`Município: ${getMunicipioNome(termo.municipio_id)} | Prestador: ${getPrestadorNome(termo.prestador_servico_id)}`, margin, yPos);
        yPos += 8;

        // Buscar números dos AIs gerados
        const autos = await base44.entities.AutoInfracao.list();
        const autosPorDeterminacao = {};
        autos.forEach(auto => {
            if (auto.determinacao_id) {
                autosPorDeterminacao[auto.determinacao_id] = auto.numero_auto;
            }
        });

        // Processar cada determinação
        dets.forEach((det, detIndex) => {
            const resposta = resp.find(r => r.determinacao_id === det.id);
            
            // Verificar espaço para nova linha (aprox 40mm por determinação)
            if (yPos + 40 > pageHeight - 10) {
                doc.addPage();
                yPos = margin;
            }

            const colLeft = margin;
            const colWidth = pageWidth - (2 * margin);
            const cellLineHeight = 5;
            
            // Cabeçalho da determinação
            doc.setFillColor(180, 180, 180);
            doc.rect(colLeft, yPos, colWidth, cellLineHeight, 'F');
            doc.setFont(undefined, 'bold');
            doc.setFontSize(9);
            doc.text(`Determinação: ${det.numero_determinacao}`, colLeft + 1, yPos + 3.5);
            yPos += cellLineHeight;

            // Dados em formato de linhas
            const dadoLinhas = [
                { label: 'Base Legal:', valor: 'Portaria AGEMS nº 233/2022 e suas alterações' },
                { label: 'Manifestação:', valor: resposta?.manifestacao_prestador || 'Sem informação' },
                { label: 'Análise:', valor: resposta?.descricao_atendimento || 'Sem informação' }
            ];

            doc.setFont(undefined, 'normal');
            doc.setFontSize(8);

            dadoLinhas.forEach(linha => {
                const textHeight = doc.getTextDimensions(linha.valor).h;
                const wrappedText = doc.splitTextToSize(linha.valor, colWidth - 40);
                const lineCount = wrappedText.length;
                const cellHeight = Math.max(cellLineHeight, lineCount * cellLineHeight + 2);

                // Label em fundo claro
                doc.setFillColor(240, 240, 240);
                doc.rect(colLeft, yPos, 35, cellHeight, 'F');
                doc.setFont(undefined, 'bold');
                doc.text(linha.label, colLeft + 1, yPos + 3);

                // Valor
                doc.setFont(undefined, 'normal');
                doc.text(wrappedText, colLeft + 37, yPos + 2, { maxWidth: colWidth - 39 });

                yPos += cellHeight;
            });

            // Resultado da Análise
            const resultado = resposta?.status === 'atendida' ? 'ACATADA' : 'NÃO ACATADA';
            const corResultado = resposta?.status === 'atendida' ? [0, 128, 0] : [255, 0, 0];
            
            doc.setFillColor(240, 240, 240);
            doc.rect(colLeft, yPos, 35, cellLineHeight, 'F');
            doc.setFont(undefined, 'bold');
            doc.setFontSize(8);
            doc.text('Resultado:', colLeft + 1, yPos + 3);

            doc.setFont(undefined, 'bold');
            doc.setFontSize(9);
            doc.setTextColor(corResultado[0], corResultado[1], corResultado[2]);
            doc.text(resultado, colLeft + 37, yPos + 3);
            doc.setTextColor(0, 0, 0);

            yPos += cellLineHeight;

            // Nº AI
            const numeroAI = autosPorDeterminacao[det.id];
            const textoAI = numeroAI ? numeroAI : (resposta?.status === 'nao_atendida' ? 'Gerar' : 'NÃO SE APLICA');
            
            doc.setFillColor(240, 240, 240);
            doc.rect(colLeft, yPos, 35, cellLineHeight, 'F');
            doc.setFont(undefined, 'bold');
            doc.setFontSize(8);
            doc.text('Nº AI:', colLeft + 1, yPos + 3);

            doc.setFont(undefined, 'normal');
            doc.setFontSize(8);
            doc.setTextColor(0, 0, 0);
            doc.text(textoAI, colLeft + 37, yPos + 3);

            yPos += cellLineHeight + 5;
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
                                        {autos.length}
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
                                                    {termo.numero_am || termo.numero_termo_notificacao}
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
                                                {stats.total > 0 && termo.numero_am && (
                                                     <Link to={createPageUrl('AnalisarResposta') + `?termo=${termo.id}`}>
                                                         <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                                                             Analisar Determinações
                                                         </Button>
                                                     </Link>
                                                 )}
                                                 {stats.total > 0 && termo.numero_am && todasDeterminacoesAnalisadas(termo) && (
                                                     <div className="flex gap-2">
                                                         <Button 
                                                             size="sm" 
                                                             className="bg-blue-600 hover:bg-blue-700"
                                                             onClick={() => baixarAnaliseManifestacao(termo)}
                                                         >
                                                             <Download className="h-4 w-4 mr-1" />
                                                             Baixar AM PDF
                                                         </Button>
                                                         <Button 
                                                             size="sm" 
                                                             variant="outline"
                                                             onClick={async () => {
                                                                 await base44.entities.TermoNotificacao.update(termo.id, { numero_am: null });
                                                                 refetchTermos();
                                                             }}
                                                         >
                                                             Editar AM
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