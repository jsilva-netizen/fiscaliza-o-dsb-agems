import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, ClipboardCheck, Edit, Trash2, AlertTriangle, GripVertical, Upload, Loader2 } from 'lucide-react';
import ItemChecklistForm from '@/components/admin/ItemChecklistForm';

export default function Checklists() {
    const queryClient = useQueryClient();
    const urlParams = new URLSearchParams(window.location.search);
    const tipoIdFromUrl = urlParams.get('tipo');
    
    const [selectedTipo, setSelectedTipo] = useState(tipoIdFromUrl || '');
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [importing, setImporting] = useState(false);

    const { data: tipos = [] } = useQuery({
        queryKey: ['tipos-unidade'],
        queryFn: () => base44.entities.TipoUnidade.list('nome', 100)
    });

    const { data: itens = [], isLoading } = useQuery({
        queryKey: ['itens-checklist', selectedTipo],
        queryFn: () => selectedTipo 
            ? base44.entities.ItemChecklist.filter({ tipo_unidade_id: selectedTipo }, 'ordem', 200)
            : Promise.resolve([]),
        enabled: !!selectedTipo
    });

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.ItemChecklist.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['itens-checklist'] });
            setShowForm(false);
            setEditing(null);
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.ItemChecklist.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['itens-checklist'] });
            setShowForm(false);
            setEditing(null);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.ItemChecklist.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['itens-checklist'] })
    });

    const handleSave = (data) => {
        const payload = { ...data, tipo_unidade_id: selectedTipo };
        if (editing?.id) {
            updateMutation.mutate({ id: editing.id, data: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const handleEdit = (item) => {
        setEditing(item);
        setShowForm(true);
    };

    const handleImport = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        try {
            const csv_content = await file.text();

            const response = await base44.functions.invoke('importarChecklist', { csv_content });
            
            if (response.data.sucesso) {
                alert(`✅ Importação concluída!\n${response.data.itens_importados} itens importados\n${response.data.tipos_criados} tipos processados`);
                queryClient.invalidateQueries({ queryKey: ['itens-checklist'] });
                queryClient.invalidateQueries({ queryKey: ['tipos-unidade'] });
            }
            
            if (response.data.erros) {
                console.warn('Erros na importação:', response.data.erros);
                alert(`⚠️ Alguns erros ocorreram:\n${response.data.erros.slice(0, 5).join('\n')}`);
            }
        } catch (error) {
            alert(`❌ Erro ao importar: ${error.message}`);
        } finally {
            setImporting(false);
            e.target.value = '';
        }
    };

    const tipoSelecionado = tipos.find(t => t.id === selectedTipo);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-blue-900 text-white">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center gap-3">
                        <Link to={createPageUrl('Home')}>
                            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold">Checklists Normativos</h1>
                            <p className="text-blue-200 text-sm">Configure perguntas por tipo de unidade</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Seletor de Tipo */}
            <div className="max-w-4xl mx-auto px-4 py-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <label className="text-sm font-medium mb-2 block">Selecione o Tipo de Unidade:</label>
                                <Select value={selectedTipo} onValueChange={setSelectedTipo}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Escolha um tipo de unidade..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {tipos.map(tipo => (
                                            <SelectItem key={tipo.id} value={tipo.id}>
                                                {tipo.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="pt-6">
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={handleImport}
                                    disabled={importing}
                                    id="importar-csv"
                                    className="hidden"
                                />
                                <label htmlFor="importar-csv">
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        disabled={importing}
                                        asChild
                                    >
                                        <span className="cursor-pointer">
                                            {importing ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    Importando...
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="h-4 w-4 mr-2" />
                                                    Importar CSV
                                                </>
                                            )}
                                        </span>
                                    </Button>
                                </label>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Lista de Itens */}
            {selectedTipo && (
                <div className="max-w-4xl mx-auto px-4 pb-8">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="font-semibold">{tipoSelecionado?.nome}</h2>
                            <p className="text-sm text-gray-500">{itens.length} itens no checklist</p>
                        </div>
                        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
                            <Plus className="h-4 w-4 mr-2" />
                            Novo Item
                        </Button>
                    </div>

                    {isLoading ? (
                        <div className="text-center py-8 text-gray-500">Carregando...</div>
                    ) : (
                        <div className="space-y-2">
                            {itens.map((item, index) => (
                                <Card key={item.id} className="hover:shadow-md transition-shadow">
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="flex items-center gap-2 text-gray-400">
                                                <GripVertical className="h-4 w-4" />
                                                <span className="font-mono text-sm">{item.ordem || index + 1}.</span>
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium">{item.pergunta}</p>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {item.gera_nc && (
                                                        <Badge variant="destructive" className="text-xs">
                                                            <AlertTriangle className="h-3 w-3 mr-1" />
                                                            Gera NC
                                                        </Badge>
                                                    )}
                                                    {item.artigo_portaria && (
                                                        <Badge variant="outline" className="text-xs">
                                                            {item.artigo_portaria}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {item.texto_nc && (
                                                    <p className="text-xs text-gray-500 mt-2 line-clamp-1">
                                                        NC: {item.texto_nc}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon"
                                                    onClick={() => {
                                                        if (confirm('Excluir este item do checklist?')) {
                                                            deleteMutation.mutate(item.id);
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

                    {!isLoading && itens.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-30" />
                            <p>Nenhum item no checklist</p>
                            <Button onClick={() => setShowForm(true)} className="mt-4">
                                <Plus className="h-4 w-4 mr-2" />
                                Adicionar primeiro item
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Form Dialog */}
            <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditing(null); } }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Editar' : 'Novo'} Item do Checklist</DialogTitle>
                    </DialogHeader>
                    <ItemChecklistForm
                        item={editing}
                        onSave={handleSave}
                        onCancel={() => { setShowForm(false); setEditing(null); }}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}