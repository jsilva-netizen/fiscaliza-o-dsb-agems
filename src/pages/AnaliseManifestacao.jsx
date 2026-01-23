import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AnaliseManifestacao() {
    const [searchParams] = useSearchParams();
    const autoId = searchParams.get('auto');
    const queryClient = useQueryClient();
    const [parerForm, setParerForm] = useState({
        analise: '',
        recomendacao: 'analise_adicional', // aplicar_multa, rejeitar_multa, analise_adicional
        valor_multa: ''
    });

    const { data: auto } = useQuery({
        queryKey: ['auto', autoId],
        queryFn: () => base44.entities.AutoInfracao.list().then(as => as.find(a => a.id === autoId)),
        enabled: !!autoId
    });

    const { data: manifestacao } = useQuery({
        queryKey: ['manifestacao', autoId],
        queryFn: async () => {
            const manifestacoes = await base44.entities.ManifestacaoAuto.list();
            return manifestacoes.find(m => m.auto_id === autoId);
        },
        enabled: !!autoId
    });

    const { data: parecer } = useQuery({
        queryKey: ['parecer', autoId],
        queryFn: async () => {
            const pareres = await base44.entities.ParerTecnico.list();
            return pareres.find(p => p.auto_id === autoId);
        },
        enabled: !!autoId
    });

    const { data: determinacao } = useQuery({
        queryKey: ['determinacao', auto?.determinacao_id],
        queryFn: () => {
            if (!auto?.determinacao_id) return null;
            return base44.entities.Determinacao.list().then(ds => 
                ds.find(d => d.id === auto.determinacao_id)
            );
        },
        enabled: !!auto
    });

    const salvarPalerMutation = useMutation({
        mutationFn: async (dados) => {
            if (parecer) {
                return base44.entities.ParerTecnico.update(parecer.id, dados);
            } else {
                return base44.entities.ParerTecnico.create({
                    auto_id: autoId,
                    manifestacao_auto_id: manifestacao?.id,
                    responsavel_analise: (await base44.auth.me()).email,
                    ...dados
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['parecer'] });
            alert('Parecer salvo com sucesso!');
        }
    });

    const handleSalvarParecer = () => {
        salvarPalerMutation.mutate({
            analise_tecnica: parerForm.analise,
            recomendacao: parerForm.recomendacao,
            valor_multa_sugerido: parerForm.valor_multa ? parseFloat(parerForm.valor_multa) : null,
            data_parecer: new Date().toISOString(),
            status: 'finalizado'
        });
    };

    if (!autoId) {
        return (
            <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
                <Card className="max-w-md">
                    <CardContent className="p-6 text-center">
                        <p className="text-gray-600 mb-4">Nenhum auto de infração foi selecionado.</p>
                        <Link to={createPageUrl('GestaoAutos')}>
                            <Button>Ir para Gestão de Autos</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!auto) return <div className="p-6">Carregando...</div>;

    const diasAteManifestacao = Math.ceil((new Date(auto.data_limite_manifestacao) - new Date()) / (1000 * 60 * 60 * 24));
    const manifestacaoAtrasada = diasAteManifestacao < 0;

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
                    <h1 className="text-2xl font-bold">Análise de Manifestação</h1>
                </div>

                {/* Info do Auto */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>{auto.numero_auto}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="text-sm font-medium">Data de Geração</label>
                                <p className="text-gray-600">{new Date(auto.data_geracao).toLocaleDateString('pt-BR')}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Prazo para Manifestação</label>
                                <p className="text-gray-600">{auto.prazo_manifestacao} dias</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Data Limite</label>
                                {manifestacaoAtrasada ? (
                                    <Badge className="bg-red-600">Vencida há {Math.abs(diasAteManifestacao)} dias</Badge>
                                ) : (
                                    <Badge className="bg-orange-600">{diasAteManifestacao} dias restantes</Badge>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Motivo da Infração</label>
                            <p className="text-gray-600">{auto.motivo_infracao}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Determinação Relacionada</label>
                            <p className="text-gray-600">{determinacao?.numero_determinacao}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Manifestação do Prestador */}
                {manifestacao && (
                    <Card className="mb-6 border-blue-300 bg-blue-50">
                        <CardHeader>
                            <CardTitle className="text-lg">Manifestação do Prestador</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">Data da Manifestação</label>
                                <p className="text-gray-600">{new Date(manifestacao.data_manifestacao).toLocaleDateString('pt-BR')}</p>
                                {manifestacao.dentro_prazo ? (
                                    <Badge className="bg-green-600 mt-2">Dentro do Prazo</Badge>
                                ) : (
                                    <Badge className="bg-red-600 mt-2">Fora do Prazo</Badge>
                                )}
                            </div>
                            <div>
                                <label className="text-sm font-medium">Manifesto</label>
                                <p className="text-gray-600 mt-2">{manifestacao.descricao_manifestacao}</p>
                            </div>
                            {manifestacao.arquivos_anexos?.length > 0 && (
                                <div>
                                    <label className="text-sm font-medium">Anexos</label>
                                    <div className="mt-2 space-y-1">
                                        {manifestacao.arquivos_anexos.map((arquivo, idx) => (
                                            <div key={idx} className="flex items-center gap-2 text-sm">
                                                <Download className="h-4 w-4" />
                                                <a href={arquivo.url} target="_blank" rel="noopener noreferrer" className="text-blue-600">
                                                    {arquivo.nome}
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Parecer Técnico */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Parecer Técnico</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Análise */}
                        <div>
                            <Label>Análise Técnica</Label>
                            <Textarea
                                placeholder="Descreva sua análise sobre a manifestação do prestador..."
                                value={parerForm.analise}
                                onChange={(e) => setPalerForm({ ...parerForm, analise: e.target.value })}
                                className="min-h-32"
                            />
                        </div>

                        {/* Recomendação */}
                        <div>
                            <Label>Recomendação</Label>
                            <div className="grid grid-cols-3 gap-2 mt-2">
                                <Button
                                    variant={parerForm.recomendacao === 'aplicar_multa' ? 'default' : 'outline'}
                                    onClick={() => setPalerForm({ ...parerForm, recomendacao: 'aplicar_multa' })}
                                    className={parerForm.recomendacao === 'aplicar_multa' ? 'bg-red-600 hover:bg-red-700' : ''}
                                >
                                    Aplicar Multa
                                </Button>
                                <Button
                                    variant={parerForm.recomendacao === 'rejeitar_multa' ? 'default' : 'outline'}
                                    onClick={() => setPalerForm({ ...parerForm, recomendacao: 'rejeitar_multa' })}
                                    className={parerForm.recomendacao === 'rejeitar_multa' ? 'bg-green-600 hover:bg-green-700' : ''}
                                >
                                    Rejeitar Multa
                                </Button>
                                <Button
                                    variant={parerForm.recomendacao === 'analise_adicional' ? 'default' : 'outline'}
                                    onClick={() => setPalerForm({ ...parerForm, recomendacao: 'analise_adicional' })}
                                    className={parerForm.recomendacao === 'analise_adicional' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                                >
                                    Análise Adicional
                                </Button>
                            </div>
                        </div>

                        {/* Valor Multa */}
                        {parerForm.recomendacao === 'aplicar_multa' && (
                            <div>
                                <Label>Valor Multa Sugerido (R$)</Label>
                                <Input
                                    type="number"
                                    placeholder="0,00"
                                    value={parerForm.valor_multa}
                                    onChange={(e) => setPalerForm({ ...parerForm, valor_multa: e.target.value })}
                                />
                            </div>
                        )}

                        {/* Ações */}
                        <div className="flex gap-2 pt-4 border-t">
                            <Button variant="outline">
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleSalvarParecer}
                                disabled={!parerForm.analise}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                Salvar Parecer
                            </Button>
                            <Button className="bg-purple-600 hover:bg-purple-700">
                                Enviar para Câmara de Julgamento
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}