import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from 'lucide-react';

export default function ConstatacaoManualForm({ open, onOpenChange, onSave, isSaving }) {
    const [descricao, setDescricao] = useState('');
    const [geraNc, setGeraNc] = useState(false);
    const [artigoPortaria, setArtigoPortaria] = useState('');
    const [textoDeterminacao, setTextoDeterminacao] = useState('');

    const handleSave = () => {
        if (!descricao.trim()) return;
        
        onSave({
            descricao: descricao.trim(),
            gera_nc: geraNc,
            artigo_portaria: artigoPortaria.trim() || null,
            texto_determinacao: textoDeterminacao.trim() || null
        });
        
        // Limpar formulário
        setDescricao('');
        setGeraNc(false);
        setArtigoPortaria('');
        setTextoDeterminacao('');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Nova Constatação Manual</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="descricao">Texto da Constatação *</Label>
                        <Textarea
                            id="descricao"
                            placeholder="Descreva a constatação observada..."
                            value={descricao}
                            onChange={(e) => setDescricao(e.target.value)}
                            rows={4}
                            className="mt-1"
                        />
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="gera_nc"
                            checked={geraNc}
                            onCheckedChange={setGeraNc}
                        />
                        <Label htmlFor="gera_nc" className="cursor-pointer">
                            Gera Não Conformidade
                        </Label>
                    </div>

                    {geraNc && (
                        <>
                            <div>
                                <Label htmlFor="artigo">
                                    Artigo/Inciso/Parágrafo da Portaria AGEMS
                                    <span className="text-gray-500 text-xs ml-2">(Opcional - deixe em branco para editar no relatório)</span>
                                </Label>
                                <Input
                                    id="artigo"
                                    placeholder="Ex: Art. 10, Inciso II da Portaria AGEMS nº 001/2025"
                                    value={artigoPortaria}
                                    onChange={(e) => setArtigoPortaria(e.target.value)}
                                    className="mt-1"
                                />
                            </div>

                            <div>
                                <Label htmlFor="determinacao">
                                    Texto da Determinação
                                    <span className="text-gray-500 text-xs ml-2">(Opcional - deixe em branco para editar no relatório)</span>
                                </Label>
                                <Textarea
                                    id="determinacao"
                                    placeholder="Ex: Regularizar a situação conforme normas vigentes..."
                                    value={textoDeterminacao}
                                    onChange={(e) => setTextoDeterminacao(e.target.value)}
                                    rows={3}
                                    className="mt-1"
                                />
                            </div>
                        </>
                    )}

                    <div className="flex gap-2 pt-4">
                        <Button 
                            className="flex-1"
                            onClick={handleSave}
                            disabled={!descricao.trim() || isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Salvando...
                                </>
                            ) : (
                                'Salvar Constatação'
                            )}
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={() => onOpenChange(false)}
                            disabled={isSaving}
                        >
                            Cancelar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}