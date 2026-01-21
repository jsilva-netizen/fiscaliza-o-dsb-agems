import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Trash2, Clock, X, Image, Save, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { base44 } from '@/api/base44Client';
import OptimizedImage from './OptimizedImage';

export default function PhotoGrid({ 
    fotos = [], 
    minFotos = 2, 
    onAddFoto, 
    onRemoveFoto,
    onUpdateLegenda,
    titulo = "Fotos da Unidade",
    fiscalizacaoId,
    unidadeId
}) {
    const [selectedFoto, setSelectedFoto] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [editingLegenda, setEditingLegenda] = useState({});
    const [tempLegendas, setTempLegendas] = useState({});
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    const handleFileSelect = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);

        try {
            for (const file of Array.from(files)) {
                const { file_url } = await base44.integrations.Core.UploadFile({ file: file });
                
                await onAddFoto({
                    url: file_url,
                    data_hora: new Date().toISOString()
                });
            }
        } catch (err) {
            console.error('Erro upload:', err);
            alert('Erro ao fazer upload: ' + err.message);
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const faltam = Math.max(0, minFotos - fotos.length);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h4 className="font-medium">{titulo}</h4>
                <div className="flex gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    <Button 
                        onClick={() => fileInputRef.current?.click()} 
                        size="sm"
                        variant="outline"
                        disabled={isUploading}
                    >
                        <Image className="h-4 w-4 mr-2" />
                        {isUploading ? 'Enviando...' : 'Galeria'}
                    </Button>
                    <Button 
                        onClick={() => cameraInputRef.current?.click()} 
                        size="sm"
                        disabled={isUploading}
                    >
                        <Camera className="h-4 w-4 mr-2" />
                        {isUploading ? 'Enviando...' : 'Câmera'}
                    </Button>
                </div>
            </div>

            {/* Grid de fotos */}
            {fotos.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {fotos.map((foto, index) => (
                        <div 
                            key={index} 
                            className="relative group rounded-lg overflow-hidden border"
                        >
                            <OptimizedImage 
                                src={foto.url} 
                                alt={`Foto ${index + 1}`}
                                className="w-full h-32 object-cover cursor-pointer"
                                onClick={() => setSelectedFoto(foto)}
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => onRemoveFoto(index)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 flex gap-1">
                                <Input
                                    placeholder="Legenda..."
                                    value={editingLegenda[index] ? (tempLegendas[index] ?? foto.legenda ?? '') : (foto.legenda || '')}
                                    onChange={(e) => setTempLegendas(prev => ({ ...prev, [index]: e.target.value }))}
                                    readOnly={!editingLegenda[index]}
                                    className="h-6 text-xs bg-transparent border-none text-white placeholder:text-gray-300"
                                />
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-white hover:bg-white/20"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (editingLegenda[index]) {
                                            let legenda = tempLegendas[index] ?? foto.legenda ?? '';
                                            // Adicionar ponto final se não tiver
                                            if (legenda && !legenda.trim().endsWith('.')) {
                                                legenda = legenda.trim() + '.';
                                            }
                                            onUpdateLegenda(index, legenda);
                                            setEditingLegenda(prev => ({ ...prev, [index]: false }));
                                        } else {
                                            setEditingLegenda(prev => ({ ...prev, [index]: true }));
                                            setTempLegendas(prev => ({ ...prev, [index]: foto.legenda || '' }));
                                        }
                                    }}
                                >
                                    {editingLegenda[index] ? <Save className="h-3 w-3" /> : <Edit2 className="h-3 w-3" />}
                                </Button>
                            </div>

                        </div>
                    ))}
                </div>
            )}

            {/* Aviso se faltam fotos */}
            {faltam > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
                    ⚠️ Mínimo de {minFotos} foto(s) obrigatória(s). Faltam {faltam}.
                </div>
            )}

            {/* Visualização ampliada */}
            {selectedFoto && (
                <div className="fixed inset-0 bg-black/90 z-50 flex flex-col" onClick={() => setSelectedFoto(null)}>
                    <div className="p-4 flex justify-end">
                        <Button variant="ghost" size="icon" className="text-white" onClick={() => setSelectedFoto(null)}>
                            <X className="h-6 w-6" />
                        </Button>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-4">
                        <OptimizedImage 
                            src={selectedFoto.url} 
                            alt="Foto ampliada" 
                            className="max-w-full max-h-full object-contain"
                        />
                    </div>
                    <div className="p-4 text-white text-sm">
                        {selectedFoto.legenda && <p className="mb-2">{selectedFoto.legenda}</p>}
                        {selectedFoto.data_hora && (
                            <span className="flex items-center gap-1 text-xs opacity-70">
                                <Clock className="h-3 w-3" />
                                {format(new Date(selectedFoto.data_hora), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}