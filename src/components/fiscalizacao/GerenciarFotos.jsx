import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Camera, Trash2, Save, Plus, Loader2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function GerenciarFotos({ fiscalizacaoId, unidadeId, onClose }) {
    const queryClient = useQueryClient();
    const [fotos, setFotos] = useState([]);
    const [legendasEditadas, setLegendas] = useState({});
    const [fotosParaExcluir, setFotosParaExcluir] = useState(new Set());
    const [fotosNadasAdicionar, setFotosNovas] = useState([]);
    const [previewIndex, setPreviewIndex] = useState(null);
    const [fotoParaExcluirConfirm, setFotoParaExcluirConfirm] = useState(null);
    const [enviandoFoto, setEnviandoFoto] = useState(false);

    const { data: unidade, isLoading } = useQuery({
        queryKey: ['unidade', unidadeId],
        queryFn: () => base44.entities.UnidadeFiscalizada.filter({ id: unidadeId }).then(r => r[0]),
        enabled: !!unidadeId
    });

    useEffect(() => {
        if (unidade?.fotos_unidade) {
            const fotosCarregadas = unidade.fotos_unidade.map(foto =>
                typeof foto === 'string' ? { url: foto, legenda: '' } : foto
            );
            setFotos(fotosCarregadas);
        }
    }, [unidade?.fotos_unidade]);

    const salvarAlteracoesMutation = useMutation({
        mutationFn: async () => {
            const fotosAtualizadas = fotos
                .filter((_, idx) => !fotosParaExcluir.has(idx))
                .map((foto, idx) => ({
                    url: foto.url,
                    legenda: legendasEditadas[idx] !== undefined ? legendasEditadas[idx] : (foto.legenda || '')
                }));

            await base44.entities.UnidadeFiscalizada.update(unidadeId, {
                fotos_unidade: fotosAtualizadas
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['unidade', unidadeId] });
            setFotosParaExcluir(new Set());
            setLegendas({});
            setFotosNovas([]);
            onClose();
        }
    });

    const handleAddFoto = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setEnviandoFoto(true);
        try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            setFotosNovas(prev => [...prev, { url: file_url, legenda: '' }]);
            setFotos(prev => [...prev, { url: file_url, legenda: '' }]);
            e.target.value = '';
        } catch (error) {
            alert('Erro ao enviar foto: ' + error.message);
        } finally {
            setEnviandoFoto(false);
        }
    };

    const handleRemoveFoto = (index) => {
        setFotosParaExcluir(prev => new Set([...prev, index]));
        setFotoParaExcluirConfirm(null);
    };

    const handleUndoRemove = (index) => {
        setFotosParaExcluir(prev => {
            const newSet = new Set(prev);
            newSet.delete(index);
            return newSet;
        });
    };

    const handleLegendaChange = (index, novaLegenda) => {
        setLegendas(prev => ({
            ...prev,
            [index]: novaLegenda
        }));
    };

    const fotosVisualizadas = fotos.filter((_, idx) => !fotosParaExcluir.has(idx));

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Editar Fotos da Unidade</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                </button>
            </div>

            {/* Upload de nova foto */}
            <Card className="border-dashed">
                <CardContent className="p-4">
                    <label className="flex flex-col items-center justify-center cursor-pointer h-32">
                        <Camera className="h-8 w-8 text-gray-400 mb-2" />
                        <span className="text-sm text-gray-600">
                            {enviandoFoto ? 'Enviando...' : 'Clique para adicionar foto'}
                        </span>
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAddFoto}
                            disabled={enviandoFoto}
                        />
                    </label>
                </CardContent>
            </Card>

            {/* Lista de fotos */}
            <div className="space-y-3">
                {fotosVisualizadas.length === 0 ? (
                    <Card>
                        <CardContent className="p-6 text-center text-gray-500">
                            <Camera className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p>Nenhuma foto adicionada</p>
                        </CardContent>
                    </Card>
                ) : (
                    fotosVisualizadas.map((foto, idx) => {
                        const indexOriginal = fotos.findIndex((f, i) => {
                            let count = 0;
                            for (let j = 0; j < i; j++) {
                                if (!fotosParaExcluir.has(j)) count++;
                            }
                            return count === idx;
                        });

                        return (
                            <Card key={indexOriginal} className={fotosParaExcluir.has(indexOriginal) ? 'opacity-50' : ''}>
                                <CardContent className="p-4">
                                    <div className="space-y-3">
                                        <div
                                            className="relative cursor-pointer overflow-hidden rounded-lg bg-gray-100 h-40"
                                            onClick={() => setPreviewIndex(indexOriginal)}
                                        >
                                            <img
                                                src={foto.url}
                                                alt="Foto da unidade"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs text-gray-600 block mb-1">Legenda</label>
                                            <Input
                                                placeholder="Digite a legenda..."
                                                value={legendasEditadas[indexOriginal] !== undefined ? legendasEditadas[indexOriginal] : (foto.legenda || '')}
                                                onChange={(e) => handleLegendaChange(indexOriginal, e.target.value)}
                                                className="text-sm"
                                            />
                                        </div>

                                        {fotosParaExcluir.has(indexOriginal) ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="w-full text-yellow-600 hover:text-yellow-700"
                                                onClick={() => handleUndoRemove(indexOriginal)}
                                            >
                                                Desfazer Exclusão
                                            </Button>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="w-full text-red-600 hover:text-red-700"
                                                onClick={() => setFotoParaExcluirConfirm(indexOriginal)}
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Apagar Foto
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>

            {/* Botões de ação */}
            <div className="flex gap-2 pt-4 border-t">
                <Button
                    variant="outline"
                    className="flex-1"
                    onClick={onClose}
                >
                    Cancelar
                </Button>
                <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    onClick={() => salvarAlteracoesMutation.mutate()}
                    disabled={salvarAlteracoesMutation.isPending}
                >
                    {salvarAlteracoesMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                        <Save className="h-4 w-4 mr-2" />
                    )}
                    Salvar Alterações
                </Button>
            </div>

            {/* Dialog de preview */}
            <Dialog open={previewIndex !== null} onOpenChange={(open) => !open && setPreviewIndex(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Visualizar Foto</DialogTitle>
                    </DialogHeader>
                    {previewIndex !== null && (
                        <img
                            src={fotos[previewIndex]?.url}
                            alt="Preview"
                            className="w-full h-auto rounded-lg"
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Confirmação de exclusão */}
            <AlertDialog open={fotoParaExcluirConfirm !== null} onOpenChange={(open) => !open && setFotoParaExcluirConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Apagar Foto?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja apagar esta foto? A exclusão será confirmada quando você clicar em "Salvar Alterações".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex gap-2">
                        <AlertDialogCancel className="flex-1">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="flex-1 bg-red-600 hover:bg-red-700"
                            onClick={() => handleRemoveFoto(fotoParaExcluirConfirm)}
                        >
                            Apagar
                        </AlertDialogAction>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}