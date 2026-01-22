import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Download, AlertCircle, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AnalisarResposta() {
    const [searchParams] = useSearchParams();
    const determinacaoId = searchParams.get('determinacao');
    const queryClient = useQueryClient();
    const [analiseForm, setAnaliseForm] = useState({
        respostaPrestador: '',
        parecer: '',
        resultado: 'atendida', // atendida, justificada, nao_atendida
        observacoes: ''
    });
    const [gerandoParecer, setGerandoParecer] = useState(false);

    const { data: determinacao } = useQuery({
        queryKey: ['determinacao', determinacaoId],
        queryFn: () => base44.entities.Determinacao.list().then(ds => ds.find(d => d.id === determinacaoId))
    });

    const { data: respostaDeterminacao } = useQuery({
        queryKey: ['resposta-determinacao', determinacaoId],
        queryFn: async () => {
            const respostas = await base44.entities.RespostaDeterminacao.list();
            return respostas.find(r => r.determinacao_id === determinacaoId);
        }
    });

    const { data: unidade } = useQuery({
        queryKey: ['unidade', determinacao?.unidade_fiscalizada_id],
        queryFn: () => {
            if (!determinacao?.unidade_fiscalizada_id) return null;
            return base44.entities.UnidadeFiscalizada.list().then(us => 
                us.find(u => u.id === determinacao.unidade_fiscalizada_id)
            );
        },
        enabled: !!determinacao
    });

    const { data: fiscalizacao } = useQuery({
        queryKey: ['fiscalizacao', determinacao?.unidade_fiscalizada_id],
        queryFn: async () => {
            if (!determinacao?.unidade_fiscalizada_id) return null;
            const unidades = await base44.entities.UnidadeFiscalizada.list();
            const unid = unidades.find(u => u.id === determinacao.unidade_fiscalizada_id);
            if (!unid) return null;
            const fiscalizacoes = await base44.entities.Fiscalizacao.list();
            return fiscalizacoes.find(f => f.id === unid.fiscalizacao_id);
        },
        enabled: !!determinacao
    });

    const { data: termoNotificacao } = useQuery({
        queryKey: ['termo-notificacao', fiscalizacao?.id],
        queryFn: async () => {
            if (!fiscalizacao?.id) return null;
            const termos = await base44.entities.TermoNotificacao.list();
            return termos.find(t => t.fiscalizacao_id === fiscalizacao.id);
        },
        enabled: !!fiscalizacao
    });

    const salvarRespostaMutation = useMutation({
        mutationFn: async (dados) => {
            if (respostaDeterminacao) {
                return base44.entities.RespostaDeterminacao.update(respostaDeterminacao.id, dados);
            } else {
                return base44.entities.RespostaDeterminacao.create({
                    determinacao_id: determinacaoId,
                    unidade_fiscalizada_id: determinacao.unidade_fiscalizada_id,
                    fiscalizacao_id: determinacao.unidade_fiscalizada_id,
                    prestador_servico_id: 'temp',
                    ...dados
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['resposta-determinacao'] });
            alert('Análise salva com sucesso!');
        }
    });

    const handleGerarParecer = async () => {
        if (!analiseForm.respostaPrestador.trim()) {
            alert('Por favor, insira a resposta do prestador primeiro.');
            return;
        }

        setGerandoParecer(true);
        try {
            const conversation = await base44.agents.createConversation({
                agent_name: 'analise_determinacao',
                metadata: {
                    determinacao_id: determinacaoId
                }
            });

            const prompt = `DETERMINAÇÃO:
${determinacao.numero_determinacao}
${determinacao.descricao}
Prazo: ${determinacao.prazo_dias} dias

RESPOSTA DO PRESTADOR:
${analiseForm.respostaPrestador}

Por favor, forneça um parecer técnico completo mas conciso sobre esta resposta.`;

            await base44.agents.addMessage(conversation, {
                role: 'user',
                content: prompt
            });

            // Aguardar resposta
            let tentativas = 0;
            const maxTentativas = 30;
            
            while (tentativas < maxTentativas) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                const conv = await base44.agents.getConversation(conversation.id);
                const ultimaMensagem = conv.messages[conv.messages.length - 1];
                
                if (ultimaMensagem.role === 'assistant' && ultimaMensagem.content) {
                    setAnaliseForm(prev => ({
                        ...prev,
                        parecer: ultimaMensagem.content
                    }));
                    break;
                }
                tentativas++;
            }
        } catch (error) {
            console.error('Erro ao gerar parecer:', error);
            alert('Erro ao gerar parecer técnico');
        } finally {
            setGerandoParecer(false);
        }
    };

    const handleSalvarAnalise = () => {
        salvarRespostaMutation.mutate({
            status: analiseForm.resultado,
            descricao_atendimento: analiseForm.respostaPrestador + '\n\nPARECER TÉCNICO:\n' + analiseForm.parecer,
            tipo_resposta: analiseForm.resultado,
            data_resposta: new Date().toISOString()
        });
    };



    if (!determinacao) return <div className="p-6">Carregando...</div>;

    const diasAtraso = Math.ceil((new Date() - new Date(determinacao.data_limite)) / (1000 * 60 * 60 * 24));
    const atrasada = diasAtraso > 0;

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-2 mb-6">
                    <Link to={createPageUrl('AcompanhamentoDeterminacoes')}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold">Análise de Resposta</h1>
                </div>

                {/* Info da Determinação */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>{determinacao.numero_determinacao}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Descrição</label>
                            <p className="text-gray-600">{determinacao.descricao}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="text-sm font-medium">Data Limite</label>
                                <p className="text-gray-600">{new Date(determinacao.data_limite).toLocaleDateString('pt-BR')}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Prazo (dias)</label>
                                <p className="text-gray-600">{determinacao.prazo_dias}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Status</label>
                                {atrasada && <Badge className="bg-red-600">Atrasada {diasAtraso} dias</Badge>}
                                {!atrasada && <Badge className="bg-orange-600">Pendente</Badge>}
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Unidade</label>
                            <p className="text-gray-600">{unidade?.nome_unidade || 'N/A'}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Seção de Análise */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Análise da Resposta do Prestador</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Resposta do Prestador */}
                        <div>
                            <Label className="mb-2">Resposta do Prestador</Label>
                            <Textarea
                                placeholder="Descreva a resposta fornecida pelo prestador de serviços..."
                                value={analiseForm.respostaPrestador}
                                onChange={(e) => setAnaliseForm({ ...analiseForm, respostaPrestador: e.target.value })}
                                className="min-h-32"
                            />
                        </div>

                        {/* Visualizador de Resposta do TN */}
                         {termoNotificacao?.arquivo_resposta_url && (
                             <div>
                                 <Label className="mb-2">Resposta do Termo de Notificação</Label>
                                 <Button
                                     type="button"
                                     variant="outline"
                                     onClick={() => window.open(termoNotificacao.arquivo_resposta_url)}
                                     className="w-full gap-2"
                                 >
                                     <Download className="h-4 w-4" />
                                     Ver PDF da Resposta do TN
                                 </Button>
                             </div>
                         )}

                         {/* Parecer Técnico com IA */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <Label>Parecer Técnico</Label>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={handleGerarParecer}
                                    disabled={gerandoParecer || !analiseForm.respostaPrestador.trim()}
                                    className="gap-2"
                                >
                                    <Sparkles className="h-4 w-4" />
                                    {gerandoParecer ? 'Gerando...' : 'Gerar com IA'}
                                </Button>
                            </div>
                            <Textarea
                                placeholder="Descreva sua análise sobre a resposta do prestador ou use a IA para gerar um parecer técnico..."
                                value={analiseForm.parecer}
                                onChange={(e) => setAnaliseForm({ ...analiseForm, parecer: e.target.value })}
                                className="min-h-40"
                            />
                        </div>

                        {/* Resultado da Análise */}
                        <div>
                            <Label>Resultado da Análise</Label>
                            <div className="flex gap-4 mt-2">
                                <Button
                                    variant={analiseForm.resultado === 'atendida' ? 'default' : 'outline'}
                                    onClick={() => setAnaliseForm({ ...analiseForm, resultado: 'atendida' })}
                                    className={analiseForm.resultado === 'atendida' ? 'bg-green-600 hover:bg-green-700' : ''}
                                >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Atendida
                                </Button>
                                <Button
                                    variant={analiseForm.resultado === 'justificada' ? 'default' : 'outline'}
                                    onClick={() => setAnaliseForm({ ...analiseForm, resultado: 'justificada' })}
                                    className={analiseForm.resultado === 'justificada' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                                >
                                    <AlertCircle className="h-4 w-4 mr-2" />
                                    Justificada
                                </Button>
                                <Button
                                    variant={analiseForm.resultado === 'nao_atendida' ? 'default' : 'outline'}
                                    onClick={() => setAnaliseForm({ ...analiseForm, resultado: 'nao_atendida' })}
                                    className={analiseForm.resultado === 'nao_atendida' ? 'bg-red-600 hover:bg-red-700' : ''}
                                >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Não Atendida
                                </Button>
                            </div>
                        </div>

                        {/* Observações */}
                        <div>
                            <Label>Observações</Label>
                            <Textarea
                                placeholder="Observações adicionais..."
                                value={analiseForm.observacoes}
                                onChange={(e) => setAnaliseForm({ ...analiseForm, observacoes: e.target.value })}
                                className="min-h-20"
                            />
                        </div>

                        {/* Ações */}
                        <div className="flex gap-2 pt-4 border-t">
                            <Link to={createPageUrl('AcompanhamentoDeterminacoes')}>
                                <Button variant="outline">
                                    Cancelar
                                </Button>
                            </Link>
                            <Button
                                onClick={handleSalvarAnalise}
                                disabled={!analiseForm.parecer}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                Salvar Análise
                            </Button>
                            {analiseForm.resultado === 'nao_atendida' && (
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button className="bg-red-600 hover:bg-red-700">
                                            Gerar Auto de Infração
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Gerar Auto de Infração</DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                            <div>
                                                <Label>Motivo da Infração</Label>
                                                <Textarea placeholder="Por que a determinação não foi atendida?" className="min-h-24" />
                                            </div>
                                            <div>
                                                <Label>Prazo para Manifestação (dias)</Label>
                                                <Input type="number" placeholder="Número de dias" defaultValue="15" />
                                            </div>
                                            <Button className="w-full bg-red-600 hover:bg-red-700">
                                                Confirmar e Gerar Auto
                                            </Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}