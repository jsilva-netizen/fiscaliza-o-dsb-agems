import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, X } from 'lucide-react';

export default function DeterminacoesFiltros({ 
    filtros, 
    onFiltroChange, 
    municipios = [],
    prestadores = [],
    onLimpar 
}) {
    return (
        <Card className="mb-6">
            <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Filter className="h-5 w-5" />
                    <h3 className="font-semibold">Filtros</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Município */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-2">Município</label>
                        <Select value={filtros.municipio || ''} onValueChange={(v) => onFiltroChange('municipio', v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={null}>Todos</SelectItem>
                                {[...municipios].sort((a, b) => a.nome.localeCompare(b.nome)).map(m => (
                                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Serviço */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-2">Serviço</label>
                        <Select value={filtros.servico || ''} onValueChange={(v) => onFiltroChange('servico', v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={null}>Todos</SelectItem>
                                <SelectItem value="Abastecimento de Água">Abastecimento de Água</SelectItem>
                                <SelectItem value="Esgotamento Sanitário">Esgotamento Sanitário</SelectItem>
                                <SelectItem value="Manejo de Resíduos Sólidos">Manejo de Resíduos Sólidos</SelectItem>
                                <SelectItem value="Limpeza Urbana">Limpeza Urbana</SelectItem>
                                <SelectItem value="Drenagem">Drenagem</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Prestador */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-2">Prestador</label>
                        <Select value={filtros.prestador || ''} onValueChange={(v) => onFiltroChange('prestador', v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={null}>Todos</SelectItem>
                                {prestadores.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Data Início */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-2">Data Inicial</label>
                        <Input
                            type="date"
                            value={filtros.dataInicio || ''}
                            onChange={(e) => onFiltroChange('dataInicio', e.target.value)}
                        />
                    </div>

                    {/* Data Fim */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-2">Data Final</label>
                        <Input
                            type="date"
                            value={filtros.dataFim || ''}
                            onChange={(e) => onFiltroChange('dataFim', e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex gap-2 mt-4 justify-end">
                    <Button 
                        variant="outline" 
                        size="sm"
                        onClick={onLimpar}
                        className="gap-2"
                    >
                        <X className="h-4 w-4" />
                        Limpar Filtros
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}