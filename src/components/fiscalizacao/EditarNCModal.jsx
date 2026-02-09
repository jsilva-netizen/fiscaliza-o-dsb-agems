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
    constatacaoTexto,
    ncExistente,
    determinacaoExistente,
    recomendacaoExistente
}) {
    const [artigoPortaria, setArtigoPortaria] = useState('');
    const [textoNC, setTextoNC] = useState('');
    const [geraDeterminacao, setGeraDeterminacao] = useState(true);
    const [geraRecomendacao, setGeraRecomendacao] = useState(false);
    const [textoDeterminacao, setTextoDeterminacao] = useState('');
    const [textoRecomendacao, setTextoRecomendacao] = useState('');
    const [textoConstatacao, setTextoConstatacao] = useState('');

    // Inicializar com valores existentes ou padrão quando abre o modal
    useEffect(() => {
        if (open && numeroConstatacao) {
            // Inicializar texto da constatação
            setTextoConstatacao(constatacaoTexto || '');

            // Se tem NC existente, usar seus dados
            if (ncExistente) {
                setArtigoPortaria(ncExistente.artigo_portaria || '');
                setTextoNC(ncExistente.descricao || '');
            } else {
                const artigoPadrao = 'Art. XX, inciso XX da Portaria AGEMS nº XX/xx';
                const ncPadrao = `A Constatação ${numeroConstatacao} não cumpre o disposto no ${artigoPadrao};`;
                setArtigoPortaria(artigoPadrao);
                setTextoNC(ncPadrao);
            }

            // Se tem Determinação existente, usar seus dados
            if (determinacaoExistente) {
                setGeraDeterminacao(true);
                // Extrair o texto removendo o prefixo e sufixo padrão
                let textoLimpo = determinacaoExistente.descricao || '';
                const prefixo = `Para sanar a ${numeroNC} `;
                const sufixo = '. Prazo: 30 dias.';
                if (textoLimpo.startsWith(prefixo)) {
                    textoLimpo = textoLimpo.substring(prefixo.length);
                }
                if (textoLimpo.endsWith(sufixo)) {
                    textoLimpo = textoLimpo.substring(0, textoLimpo.length - sufixo.length);
                }
                setTextoDeterminacao(textoLimpo);
            } else {
                setGeraDeterminacao(true);
                setTextoDeterminacao('Regularizar a situação conforme normas vigentes.');
            }

            // Se tem Recomendação existente, usar seus dados
            if (recomendacaoExistente) {
                setGeraRecomendacao(true);
                setTextoRecomendacao(recomendacaoExistente.descricao || '');
            } else {
                setGeraRecomendacao(false);
                setTextoRecomendacao('');
            }
        }
    }, [open, numeroConstatacao, ncExistente, determinacaoExistente, recomendacaoExistente, numeroNC, constatacaoTexto]);

    const handleSave = () => {
        if (!textoConstatacao.trim()) return;
        if (!textoNC.trim()) return;
        if (geraDeterminacao && !textoDeterminacao.trim()) return;
        if (geraRecomendacao && !textoRecomendacao.trim()) return;
        if (!geraDeterminacao && !geraRecomendacao) return;
        
        onSave({
            texto_constatacao: textoConstatacao.trim(),
            artigo_portaria: artigoPortaria.trim(),
            texto_nc: textoNC.trim(),
            gera_determinacao: geraDeterminacao,
            gera_recomendacao: geraRecomendacao,
            texto_determinacao: geraDeterminacao ? textoDeterminacao.trim() : null,
            texto_recomendacao: geraRecomendacao ? textoRecomendacao.trim() : null,
            nc_id: ncExistente?.id || null,
            determinacao_id: determinacaoExistente?.id || null,
            recomendacao_id: recomendacaoExistente?.id || null
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
                        Complete os detalhes da Constatação, Não Conformidade e Determinação
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="texto_constatacao">
                            Texto da Constatação ({numeroConstatacao}) *
                        </Label>
                        <Textarea
                            id="texto_constatacao"
                            placeholder="Descreva a constatação..."
                            value={textoConstatacao}
                            onChange={(e) => setTextoConstatacao(e.target.value)}
                            rows={3}
                            className="mt-1"
                        />
                    </div>

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

                    <div className="space-y-3 border-t pt-4">
                        <Label className="text-base font-semibold">Esta NC gera:</Label>
                        
                        <div className="flex items-center space-x-2">
                            <Checkbox 
                                id="gera_determinacao" 
                                checked={geraDeterminacao}
                                onCheckedChange={setGeraDeterminacao}
                            />
                            <Label htmlFor="gera_determinacao" className="cursor-pointer">
                                Determinação ({numeroDeterminacao})
                            </Label>
                        </div>

                        {geraDeterminacao && (
                            <div className="ml-6">
                                <Textarea
                                    id="determinacao"
                                    placeholder="Descreva a determinação para sanar a NC..."
                                    value={textoDeterminacao}
                                    onChange={(e) => setTextoDeterminacao(e.target.value)}
                                    rows={3}
                                    className="mt-1"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Será formatada como: "Para sanar a {numeroNC} [seu texto aqui]. Prazo: 30 dias."
                                </p>
                            </div>
                        )}

                        <div className="flex items-center space-x-2">
                            <Checkbox 
                                id="gera_recomendacao" 
                                checked={geraRecomendacao}
                                onCheckedChange={setGeraRecomendacao}
                            />
                            <Label htmlFor="gera_recomendacao" className="cursor-pointer">
                                Recomendação ({numeroRecomendacao})
                            </Label>
                        </div>

                        {geraRecomendacao && (
                            <div className="ml-6">
                                <Textarea
                                    id="recomendacao"
                                    placeholder="Descreva a recomendação..."
                                    value={textoRecomendacao}
                                    onChange={(e) => setTextoRecomendacao(e.target.value)}
                                    rows={3}
                                    className="mt-1"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 pt-4 border-t">
                        <Button 
                            className="flex-1 bg-red-600 hover:bg-red-700"
                            onClick={handleSave}
                            disabled={!textoNC.trim() || (!geraDeterminacao && !geraRecomendacao) || isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Salvando...
                                </>
                            ) : (
                                'Salvar NC'
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