import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Building2, Edit, Trash2, ClipboardCheck } from 'lucide-react';

const SERVICOS = ['Água', 'Esgoto', 'Resíduos', 'Limpeza Urbana', 'Drenagem'];

export default function TiposUnidade() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [formData, setFormData] = useState({
        nome: '',
        descricao: '',
        servicos_aplicaveis: [],
        ativo: true
    });

    const { data: tipos = [], isLoading } = useQuery({
        queryKey: ['tipos-unidade'],
        queryFn: () => base44.entities.TipoUnidade.list('nome', 100)
    });

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.TipoUnidade.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tipos-unidade'] });
            resetForm();
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.TipoUnidade.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tipos-unidade'] });
            resetForm();
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.TipoUnidade.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tipos-unidade'] })
    });

    const resetForm = () => {
        setFormData({ nome: '', descricao: '', servicos_aplicaveis: [], ativo: true });
        setEditing(null);
        setShowForm(false);
    };

    const handleEdit = (tipo) => {
        setFormData({
            nome: tipo.nome,
            descricao: tipo.descricao || '',
            servicos_aplicaveis: tipo.servicos_aplicaveis || [],
            ativo: tipo.ativo !== false
        });
        setEditing(tipo);
        setShowForm(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editing) {
            updateMutation.mutate({ id: editing.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const toggleServico = (servico) => {
        const atual = formData.servicos_aplicaveis || [];
        if (atual.includes(servico)) {
            setFormData({...formData, servicos_aplicaveis: atual.filter(s => s !== servico)});
        } else {
            setFormData({...formData, servicos_aplicaveis: [...atual, servico]});
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-blue-900 text-white">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link to={createPageUrl('Home')}>
                                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold">Tipos de Unidade</h1>
                                <p className="text-blue-200 text-sm">{tipos.length} tipos cadastrados</p>
                            </div>
                        </div>
                        <Button onClick={() => setShowForm(true)} className="bg-green-500 hover:bg-green-600">
                            <Plus className="h-4 w-4 mr-2" />
                            Novo Tipo
                        </Button>
                    </div>
                </div>
            </div>

            {/* Form Dialog */}
            <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Editar' : 'Novo'} Tipo de Unidade</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <Label>Nome *</Label>
                            <Input
                                value={formData.nome}
                                onChange={(e) => setFormData({...formData, nome: e.target.value})}
                                placeholder="Ex: ETA - Estação de Tratamento de Água"
                                required
                            />
                        </div>
                        <div>
                            <Label>Descrição</Label>
                            <Textarea
                                value={formData.descricao}
                                onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                                placeholder="Descrição do tipo de unidade..."
                            />
                        </div>
                        <div>
                            <Label>Serviços Aplicáveis</Label>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                {SERVICOS.map(servico => (
                                    <label key={servico} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                                        <Checkbox
                                            checked={formData.servicos_aplicaveis?.includes(servico)}
                                            onCheckedChange={() => toggleServico(servico)}
                                        />
                                        <span className="text-sm">{servico}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button type="submit" className="flex-1" disabled={createMutation.isPending || updateMutation.isPending}>
                                {editing ? 'Atualizar' : 'Criar'}
                            </Button>
                            <Button type="button" variant="outline" onClick={resetForm}>
                                Cancelar
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* List */}
            <div className="max-w-4xl mx-auto px-4 py-6">
                {isLoading ? (
                    <div className="text-center py-8 text-gray-500">Carregando...</div>
                ) : (
                    <div className="space-y-3">
                        {tipos.map((tipo) => (
                            <Card key={tipo.id}>
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mt-1">
                                                <Building2 className="h-5 w-5 text-blue-600" />
                                            </div>
                                            <div>
                                                <h3 className="font-medium">{tipo.nome}</h3>
                                                {tipo.descricao && (
                                                    <p className="text-sm text-gray-500 mt-1">{tipo.descricao}</p>
                                                )}
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {tipo.servicos_aplicaveis?.map(s => (
                                                        <Badge key={s} variant="secondary" className="text-xs">
                                                            {s}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <Link to={createPageUrl('Checklists') + `?tipo=${tipo.id}`}>
                                                <Button variant="ghost" size="icon" title="Configurar Checklist">
                                                    <ClipboardCheck className="h-4 w-4 text-blue-600" />
                                                </Button>
                                            </Link>
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(tipo)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon"
                                                onClick={() => {
                                                    if (confirm('Excluir este tipo de unidade?')) {
                                                        deleteMutation.mutate(tipo.id);
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {!isLoading && tipos.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                        <p>Nenhum tipo de unidade cadastrado</p>
                        <Button onClick={() => setShowForm(true)} className="mt-4">
                            <Plus className="h-4 w-4 mr-2" />
                            Criar primeiro tipo
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}