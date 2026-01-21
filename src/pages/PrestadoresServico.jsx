import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Loader2, ArrowLeft, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function PrestadoresServico() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        nome: '',
        razao_social: '',
        endereco: '',
        cidade: '',
        telefone: '',
        email_contato: '',
        cnpj: '',
        responsavel: '',
        cargo: ''
    });

    const { data: prestadores = [], isLoading } = useQuery({
        queryKey: ['prestadores'],
        queryFn: () => base44.entities.PrestadorServico.list('nome', 200)
    });

    const { data: fiscalizacoes = [] } = useQuery({
        queryKey: ['fiscalizacoes-todos'],
        queryFn: () => base44.entities.Fiscalizacao.list('data_inicio', 500)
    });

    const { data: unidades = [] } = useQuery({
        queryKey: ['unidades-todas'],
        queryFn: () => base44.entities.UnidadeFiscalizada.list('id', 500)
    });

    const { data: ncs = [] } = useQuery({
        queryKey: ['ncs-todos'],
        queryFn: () => base44.entities.NaoConformidade.list('id', 500)
    });

    const { data: determinacoes = [] } = useQuery({
        queryKey: ['determinacoes-todos'],
        queryFn: () => base44.entities.Determinacao.list('id', 500)
    });

    const { data: autos = [] } = useQuery({
        queryKey: ['autos-todos'],
        queryFn: () => base44.entities.AutoInfracao.list('id', 500)
    });

    const { data: recomendacoes = [] } = useQuery({
        queryKey: ['recomendacoes-todas'],
        queryFn: () => base44.entities.Recomendacao.list('id', 500)
    });

    const getStatsForPrestador = (prestadorId) => {
        const prestadorFiscalizacoes = fiscalizacoes.filter(f => f.prestador_servico_id === prestadorId);
        const unidadeIds = unidades
            .filter(u => prestadorFiscalizacoes.some(f => f.id === u.fiscalizacao_id))
            .map(u => u.id);

        return {
            fiscalizacoes: prestadorFiscalizacoes.length,
            fiscalizacoesFinalizado: prestadorFiscalizacoes.filter(f => f.status === 'finalizada').length,
            ncs: ncs.filter(nc => unidadeIds.includes(nc.unidade_fiscalizada_id)).length,
            recomendacoes: recomendacoes.filter(r => unidadeIds.includes(r.unidade_fiscalizada_id)).length,
            determinacoes: determinacoes.filter(d => unidadeIds.includes(d.unidade_fiscalizada_id)).length,
            autos: autos.filter(a => a.prestador_servico_id === prestadorId).length
        };
    };

    const criarMutation = useMutation({
        mutationFn: (data) => base44.entities.PrestadorServico.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['prestadores'] });
            resetForm();
            setShowForm(false);
        }
    });

    const atualizarMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.PrestadorServico.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['prestadores'] });
            resetForm();
            setShowForm(false);
        }
    });

    const deletarMutation = useMutation({
        mutationFn: (id) => base44.entities.PrestadorServico.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['prestadores'] });
        }
    });

    const resetForm = () => {
        setFormData({
            nome: '',
            razao_social: '',
            endereco: '',
            cidade: '',
            telefone: '',
            email_contato: '',
            cnpj: '',
            responsavel: '',
            cargo: ''
        });
        setEditingId(null);
    };

    const handleEdit = (prestador) => {
        setFormData(prestador);
        setEditingId(prestador.id);
        setShowForm(true);
    };

    const handleSubmit = () => {
        if (!formData.nome || !formData.cnpj) {
            alert('Nome e CNPJ são obrigatórios');
            return;
        }

        if (editingId) {
            atualizarMutation.mutate({ id: editingId, data: formData });
        } else {
            criarMutation.mutate(formData);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-blue-900 text-white">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
                    <Link to={createPageUrl('Home')}>
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold">Prestadores de Serviço</h1>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
                <div className="flex justify-end">
                    <Button onClick={() => { resetForm(); setShowForm(true); }} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Prestador
                    </Button>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                ) : prestadores.length === 0 ? (
                    <Card>
                        <CardContent className="p-6 text-center text-gray-500">
                            <p>Nenhum prestador cadastrado.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {prestadores.map(prestador => (
                            <Card key={prestador.id}>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg">{prestador.nome}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {prestador.razao_social && (
                                        <p className="text-sm text-gray-600">
                                            <span className="font-medium">Razão Social:</span> {prestador.razao_social}
                                        </p>
                                    )}
                                    {prestador.endereco && (
                                        <p className="text-sm text-gray-600">
                                            <span className="font-medium">Endereço:</span> {prestador.endereco}
                                        </p>
                                    )}
                                    {prestador.cidade && (
                                        <p className="text-sm text-gray-600">
                                            <span className="font-medium">Cidade:</span> {prestador.cidade}
                                        </p>
                                    )}
                                    {prestador.telefone && (
                                        <p className="text-sm text-gray-600">
                                            <span className="font-medium">Telefone:</span> {prestador.telefone}
                                        </p>
                                    )}
                                    {prestador.cnpj && (
                                        <p className="text-sm text-gray-600">
                                            <span className="font-medium">CNPJ/MF:</span> {prestador.cnpj}
                                        </p>
                                    )}
                                    {prestador.responsavel && (
                                        <p className="text-sm text-gray-600">
                                            <span className="font-medium">Responsável:</span> {prestador.responsavel}
                                        </p>
                                    )}
                                    {prestador.cargo && (
                                        <p className="text-sm text-gray-600">
                                            <span className="font-medium">Cargo:</span> {prestador.cargo}
                                        </p>
                                    )}
                                    {prestador.email_contato && (
                                        <p className="text-sm text-gray-600 mt-2">
                                            <span className="font-medium">Email:</span> {prestador.email_contato}
                                        </p>
                                    )}
                                    <div className="text-xs text-gray-500 mt-3 pt-3 border-t">
                                        {(() => {
                                            const stats = getStatsForPrestador(prestador.id);
                                            return (
                                                <div className="flex gap-4 flex-wrap">
                                                    <span>Fiscalizações Finalizadas: {stats.fiscalizacoesFinalizado}</span>
                                                    <span>NCs: {stats.ncs}</span>
                                                    <span>Recomendações: {stats.recomendacoes}</span>
                                                    <span>Determinações: {stats.determinacoes}</span>
                                                    <span>Autos: {stats.autos}</span>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div className="flex gap-2 mt-4">
                                        <Link to={createPageUrl(`DetalhePrestador?id=${prestador.id}`)}>
                                            <Button size="sm" variant="outline">
                                                <Eye className="h-4 w-4 mr-1" />
                                                Detalhes
                                            </Button>
                                        </Link>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleEdit(prestador)}
                                        >
                                            <Edit2 className="h-4 w-4 mr-1" />
                                            Editar
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => {
                                                if (confirm('Tem certeza?')) {
                                                    deletarMutation.mutate(prestador.id);
                                                }
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4 mr-1" />
                                            Deletar
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Dialog */}
            <Dialog open={showForm} onOpenChange={setShowForm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingId ? 'Editar Prestador' : 'Novo Prestador'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Input
                            placeholder="Nome *"
                            value={formData.nome}
                            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        />
                        <Input
                            placeholder="Razão Social"
                            value={formData.razao_social}
                            onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
                        />
                        <Textarea
                            placeholder="Endereço"
                            value={formData.endereco}
                            onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                            rows={2}
                        />
                        <Input
                            placeholder="Cidade"
                            value={formData.cidade}
                            onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                        />
                        <Input
                            placeholder="Telefone"
                            value={formData.telefone}
                            onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                        />
                        <Input
                            placeholder="CNPJ/MF *"
                            value={formData.cnpj}
                            onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                        />
                        <Input
                            placeholder="Responsável"
                            value={formData.responsavel}
                            onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                        />
                        <Input
                            placeholder="Cargo"
                            value={formData.cargo}
                            onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                        />
                        <Input
                            placeholder="Email de Contato"
                            type="email"
                            value={formData.email_contato}
                            onChange={(e) => setFormData({ ...formData, email_contato: e.target.value })}
                        />
                        <div className="flex gap-2">
                            <Button
                                className="flex-1 bg-blue-600 hover:bg-blue-700"
                                onClick={handleSubmit}
                                disabled={criarMutation.isPending || atualizarMutation.isPending}
                            >
                                {criarMutation.isPending || atualizarMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : null}
                                Salvar
                            </Button>
                            <Button variant="outline" onClick={() => setShowForm(false)}>
                                Cancelar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}