import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, AlertTriangle } from 'lucide-react';

export default function EditarNCModal({ 
    open, 
    onOpenChange, 
    onSave, 
    isSaving,
    numeroNC,
    numeroDeterminacao,
    numeroRecomendacao,
    numeroConstatacao,
    constatacaoTexto 
}) {
    const [artigoPortaria, setArtigoPortaria] = useState('');
    const [textoNC, setTextoNC] = useState('');
    const [geraDeterminacao, setGeraDeterminacao] = useState(true);
    const [geraRecomendacao, setGeraRecomendacao] = useState(false);
    const [textoDeterminacao, setTextoDeterminacao] = useState('');
    const [textoRecomendacao, setTextoRecomendacao] = useState('');

    // Inicializar com valores padrão quando abre o modal
    useEffect(() => {
        if (open && numeroConstatacao) {
            const artigoPadrao = 'Art. XX, inciso XX da Portaria AGEMS nº XX/xx';
            const ncPadrao = `A Constatação ${numeroConstatacao} não cumpre o disposto no ${artigoPadrao};`;
            const detPadrao = 'Regularizar a situação conforme normas vigentes.';
            const recPadrao = '';
            
            setArtigoPortaria(artigoPadrao);
            setTextoNC(ncPadrao);
            setGeraDeterminacao(true);
            setGeraRecomendacao(false);
            setTextoDeterminacao(detPadrao);
            setTextoRecomendacao(recPadrao);
        }
    }, [open, numeroConstatacao]);

    const handleSave = () => {
        if (!textoNC.trim()) return;
        if (geraDeterminacao && !textoDeterminacao.trim()) return;
        if (geraRecomendacao && !textoRecomendacao.trim()) return;
        if (!geraDeterminacao && !geraRecomendacao) return;
        
        onSave({
            artigo_portaria: artigoPortaria.trim(),
            texto_nc: textoNC.trim(),
            gera_determinacao: geraDeterminacao,
            gera_recomendacao: geraRecomendacao,
            texto_determinacao: geraDeterminacao ? textoDeterminacao.trim() : null,
            texto_recomendacao: geraRecomendacao ? textoRecomendacao.trim() : null
        });
    };

    const handleCancel = () => {
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-700">
                        <AlertTriangle className="h-5 w-5" />
                        Editar Não Conformidade - {numeroNC}
                    </DialogTitle>
                    <DialogDescription>
                        Complete os detalhes da Não Conformidade e Determinação baseada na constatação:
                        <span className="block mt-2 text-sm font-medium text-gray-700">
                            {numeroConstatacao}: {constatacaoTexto}
                        </span>
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="artigo">
                            Artigo/Inciso/Parágrafo da Portaria AGEMS *
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
                        <Label htmlFor="texto_nc">
                            Descrição da Não Conformidade ({numeroNC}) *
                        </Label>
                        <Textarea
                            id="texto_nc"
                            placeholder="Descreva a não conformidade..."
                            value={textoNC}
                            onChange={(e) => setTextoNC(e.target.value)}
                            rows={4}
                            className="mt-1"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Edite o texto acima para incluir o artigo correto e detalhes da NC
                        </p>
                    </div>

                    <div>
                        <Label htmlFor="determinacao">
                            Determinação ({numeroDeterminacao}) *
                        </Label>
                        <Textarea
                            id="determinacao"
                            placeholder="Descreva a determinação para sanar a NC..."
                            value={textoDeterminacao}
                            onChange={(e) => setTextoDeterminacao(e.target.value)}
                            rows={4}
                            className="mt-1"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Será formatada como: "Para sanar a {numeroNC} [seu texto aqui]. Prazo: 30 dias."
                        </p>
                    </div>

                    <div className="flex gap-2 pt-4 border-t">
                        <Button 
                            className="flex-1 bg-red-600 hover:bg-red-700"
                            onClick={handleSave}
                            disabled={!textoNC.trim() || !textoDeterminacao.trim() || isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Salvando NC e Determinação...
                                </>
                            ) : (
                                'Salvar NC e Determinação'
                            )}
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={handleCancel}
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