import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, X } from 'lucide-react';

export default function ItemChecklistForm({ item, onSave, onCancel }) {
    const [formData, setFormData] = useState({
        pergunta: '',
        gera_nc: false,
        artigo_portaria: '',
        texto_nc: '',
        texto_determinacao: '',
        texto_recomendacao: '',
        ordem: 0,
        ...item
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                    {item?.id ? 'Editar Item' : 'Novo Item do Checklist'}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="ordem">Ordem</Label>
                        <Input
                            id="ordem"
                            type="number"
                            value={formData.ordem}
                            onChange={(e) => setFormData({...formData, ordem: parseInt(e.target.value) || 0})}
                            className="w-24"
                        />
                    </div>

                    <div>
                        <Label htmlFor="pergunta">Pergunta *</Label>
                        <Textarea
                            id="pergunta"
                            value={formData.pergunta}
                            onChange={(e) => setFormData({...formData, pergunta: e.target.value})}
                            placeholder="Ex: A unidade possui licença ambiental válida?"
                            required
                        />
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Switch
                            id="gera_nc"
                            checked={formData.gera_nc}
                            onCheckedChange={(checked) => setFormData({...formData, gera_nc: checked})}
                        />
                        <Label htmlFor="gera_nc" className="cursor-pointer">
                            Resposta "NÃO" gera Não Conformidade
                        </Label>
                    </div>

                    {formData.gera_nc && (
                        <div className="space-y-4 p-4 bg-red-50 rounded-lg border border-red-200">
                            <h4 className="font-medium text-red-800">Configuração da Não Conformidade</h4>
                            
                            <div>
                                <Label htmlFor="artigo_portaria">Artigo/Inciso da Portaria AGEMS</Label>
                                <Input
                                    id="artigo_portaria"
                                    value={formData.artigo_portaria}
                                    onChange={(e) => setFormData({...formData, artigo_portaria: e.target.value})}
                                    placeholder="Ex: Art. 5º, § 2º, inciso III"
                                />
                            </div>

                            <div>
                                <Label htmlFor="texto_nc">Texto Padrão da NC</Label>
                                <Textarea
                                    id="texto_nc"
                                    value={formData.texto_nc}
                                    onChange={(e) => setFormData({...formData, texto_nc: e.target.value})}
                                    placeholder="Descrição padrão da não conformidade..."
                                    rows={3}
                                />
                            </div>

                            <div>
                                <Label htmlFor="texto_determinacao">Texto Padrão da Determinação</Label>
                                <Textarea
                                    id="texto_determinacao"
                                    value={formData.texto_determinacao}
                                    onChange={(e) => setFormData({...formData, texto_determinacao: e.target.value})}
                                    placeholder="Determinação padrão para correção..."
                                    rows={3}
                                />
                            </div>

                            <div>
                                <Label htmlFor="texto_recomendacao">Texto Padrão da Recomendação (opcional)</Label>
                                <Textarea
                                    id="texto_recomendacao"
                                    value={formData.texto_recomendacao}
                                    onChange={(e) => setFormData({...formData, texto_recomendacao: e.target.value})}
                                    placeholder="Recomendação opcional..."
                                    rows={2}
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex gap-2 pt-4">
                        <Button type="submit" className="flex-1">
                            <Save className="h-4 w-4 mr-2" />
                            Salvar
                        </Button>
                        <Button type="button" variant="outline" onClick={onCancel}>
                            <X className="h-4 w-4 mr-2" />
                            Cancelar
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}