import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
        cargo: '',
        tipo: 'prestador_servico'
    });

    const { data: prestadores = [], isLoading } = useQuery({
        queryKey: ['prestadores'],
        queryFn: () => base44.entities.PrestadorServico.list('nome', 200)
    });

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
            cargo: '',
            tipo: 'prestador_servico'
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
            <div className="max-w-4xl mx-auto px-4 py-6">
                <div className="flex justify-end mb-6">
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
                            <p>Nenhum prestador de serviço cadastrado.</p>
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
                            {editingId ? 'Editar Prestador' : 'Novo Prestador de Serviço'}
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
                        <div>
                            <p className="text-sm font-medium mb-1">Tipo</p>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant={formData.tipo === 'prestador_servico' ? 'default' : 'outline'}
                                    onClick={() => setFormData({ ...formData, tipo: 'prestador_servico' })}
                                    className="flex-1"
                                >
                                    Prestador
                                </Button>
                                <Button
                                    size="sm"
                                    variant={formData.tipo === 'titular' ? 'default' : 'outline'}
                                    onClick={() => setFormData({ ...formData, tipo: 'titular' })}
                                    className="flex-1"
                                >
                                    Titular
                                </Button>
                            </div>
                        </div>
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