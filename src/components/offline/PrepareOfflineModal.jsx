import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, CheckCircle2 } from 'lucide-react';
import { DataService } from './DataService';

export default function PrepareOfflineModal({ open, onOpenChange, fiscalizacaoId }) {
    const [isLoading, setIsLoading] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [selectedData, setSelectedData] = useState({
        fiscalizacao: true,
        unidades: true,
        respostas: true,
        ncs: true,
        determinacoes: true,
        recomendacoes: true,
        constatacoes: true
    });

    const dataItems = [
        { key: 'fiscalizacao', label: 'Fiscalização', icon: '📋' },
        { key: 'unidades', label: 'Unidades', icon: '🏗️' },
        { key: 'respostas', label: 'Respostas do Checklist', icon: '✅' },
        { key: 'ncs', label: 'Não Conformidades', icon: '⚠️' },
        { key: 'determinacoes', label: 'Determinações', icon: '📌' },
        { key: 'recomendacoes', label: 'Recomendações', icon: '💡' },
        { key: 'constatacoes', label: 'Constatações Manuais', icon: '📝' }
    ];

    const toggleItem = (key) => {
        setSelectedData(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const handlePrepare = async () => {
        setIsLoading(true);
        try {
            // Pré-carregar dados na cache local
            if (selectedData.fiscalizacao) {
                await DataService.readFromCache('Fiscalizacao', { id: fiscalizacaoId });
            }
            if (selectedData.unidades) {
                await DataService.readFromCache('UnidadeFiscalizada', { fiscalizacao_id: fiscalizacaoId });
            }
            if (selectedData.respostas) {
                await DataService.readFromCache('RespostaChecklist', { fiscalizacao_id: fiscalizacaoId });
            }
            if (selectedData.ncs) {
                await DataService.readFromCache('NaoConformidade', { fiscalizacao_id: fiscalizacaoId });
            }
            if (selectedData.determinacoes) {
                await DataService.readFromCache('Determinacao', { fiscalizacao_id: fiscalizacaoId });
            }
            if (selectedData.recomendacoes) {
                await DataService.readFromCache('Recomendacao', { fiscalizacao_id: fiscalizacaoId });
            }
            if (selectedData.constatacoes) {
                await DataService.readFromCache('ConstatacaoManual', { fiscalizacao_id: fiscalizacaoId });
            }

            setCompleted(true);
            setTimeout(() => {
                onOpenChange(false);
                setCompleted(false);
            }, 2000);
        } catch (error) {
            alert('Erro ao preparar dados offline: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (!isLoading) {
            onOpenChange(false);
            setCompleted(false);
        }
    };

    if (completed) {
        return (
            <Dialog open={open} onOpenChange={handleClose}>
                <DialogContent>
                    <div className="text-center py-8">
                        <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
                        <h2 className="text-lg font-bold text-green-700">Tudo pronto!</h2>
                        <p className="text-sm text-gray-600 mt-2">Seus dados foram preparados para uso offline.</p>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Download className="h-5 w-5" />
                        Preparar para Offline
                    </DialogTitle>
                    <DialogDescription>
                        Selecione quais dados deseja pré-carregar para trabalhar offline.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {dataItems.map(item => (
                        <Card key={item.key} className={selectedData[item.key] ? 'border-blue-300 bg-blue-50' : ''}>
                            <CardContent className="p-3">
                                <div className="flex items-center gap-3">
                                    <Checkbox 
                                        checked={selectedData[item.key]}
                                        onCheckedChange={() => toggleItem(item.key)}
                                        id={item.key}
                                    />
                                    <label 
                                        htmlFor={item.key}
                                        className="flex-1 cursor-pointer flex items-center gap-2"
                                    >
                                        <span className="text-lg">{item.icon}</span>
                                        <span className="text-sm font-medium">{item.label}</span>
                                    </label>
                                    {selectedData[item.key] && (
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="flex gap-2">
                    <Button 
                        onClick={handlePrepare}
                        disabled={isLoading || !Object.values(selectedData).some(v => v)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Preparando...
                            </>
                        ) : (
                            <>
                                <Download className="h-4 w-4 mr-2" />
                                Pré-carregar
                            </>
                        )}
                    </Button>
                    <Button 
                        onClick={handleClose}
                        disabled={isLoading}
                        variant="outline"
                    >
                        Cancelar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}