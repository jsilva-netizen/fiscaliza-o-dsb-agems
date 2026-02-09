import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from 'lucide-react';

export default function ConstatacaoManualForm({ open, onOpenChange, onSave, isSaving, constatacaoParaEditar }) {
    const [descricao, setDescricao] = useState('');
    const [geraNc, setGeraNc] = useState(false);

    // Preencher form quando for edição
    React.useEffect(() => {
        if (constatacaoParaEditar) {
            setDescricao(constatacaoParaEditar.descricao || '');
            setGeraNc(constatacaoParaEditar.gera_nc || false);
        } else {
            setDescricao('');
            setGeraNc(false);
        }
    }, [constatacaoParaEditar, open]);

    const handleSave = () => {
        if (!descricao.trim()) return;
        
        onSave({
            descricao: descricao.trim(),
            gera_nc: geraNc
        });
        
        // Limpar formulário
        setDescricao('');
        setGeraNc(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{constatacaoParaEditar ? 'Editar Constatação Manual' : 'Nova Constatação Manual'}</DialogTitle>
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
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                            <p className="text-sm text-blue-700">
                                ℹ️ Após salvar a constatação, você poderá editar os detalhes da NC e Determinação na próxima tela.
                            </p>
                        </div>
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
                                constatacaoParaEditar ? 'Salvar Alterações' : 'Salvar Constatação'
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