import React from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X, Minus, AlertTriangle } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function ChecklistItem({ 
    item, 
    resposta, 
    onResponder,
    numero,
    desabilitado = false
}) {
    const handleResposta = (valor) => {
        const data = {
            resposta: valor,
            observacao: ''
        };
        
        onResponder(data);
    };

    const getButtonStyle = (tipo) => {
        if (!resposta) return 'bg-gray-100 hover:bg-gray-200 text-gray-700';
        
        if (tipo === 'SIM' && resposta.resposta === 'SIM') {
            return 'bg-green-500 hover:bg-green-600 text-white';
        }
        if (tipo === 'NAO' && resposta.resposta === 'NAO') {
            return 'bg-red-500 hover:bg-red-600 text-white';
        }
        if (tipo === 'NA' && resposta.resposta === 'NA') {
            return 'bg-gray-500 hover:bg-gray-600 text-white';
        }
        return 'bg-gray-100 hover:bg-gray-200 text-gray-700';
    };

    return (
        <Card className={cn(
            "p-4 transition-all",
            resposta?.resposta === 'NAO' && item.gera_nc && "border-red-300 bg-red-50"
        )}>
            <div className="flex items-start gap-3">
                <span className="text-sm font-bold text-gray-500 mt-1">
                    {numero}.
                </span>
                <div className="flex-1">
                    <p className="text-sm font-medium mb-3">{item.pergunta}</p>
                    
                    {/* Botões de resposta */}
                    <div className="flex gap-2 mb-2">
                        <Button
                            type="button"
                            size="sm"
                            className={cn("flex-1", getButtonStyle('SIM'))}
                            onClick={() => handleResposta('SIM')}
                            disabled={desabilitado || (resposta?.resposta === 'SIM')}
                        >
                            <Check className="h-4 w-4 mr-1" />
                            SIM
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            className={cn("flex-1", getButtonStyle('NAO'))}
                            onClick={() => handleResposta('NAO')}
                            disabled={desabilitado || (resposta?.resposta === 'NAO')}
                        >
                            <X className="h-4 w-4 mr-1" />
                            NÃO
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            className={cn("flex-1", getButtonStyle('NA'))}
                            onClick={() => handleResposta('NA')}
                            disabled={desabilitado || (resposta?.resposta === 'NA')}
                        >
                            <Minus className="h-4 w-4 mr-1" />
                            N/A
                        </Button>
                    </div>

                    {/* Alerta NC */}
                    {resposta?.resposta === 'NAO' && item.gera_nc && (
                        <div className="bg-red-100 border border-red-300 rounded p-2 mt-2 text-xs">
                            <div className="flex items-center gap-1 text-red-700 font-medium mb-1">
                                <AlertTriangle className="h-3 w-3" />
                                Gera Não Conformidade
                            </div>
                            {item.artigo_portaria && (
                                <p className="text-red-600">{item.artigo_portaria}</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}