import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Trash2, MapPin, Clock, X, Image } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { base44 } from '@/api/base44Client';

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
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            // Upload da foto
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            
            // Obter GPS atual
            let location = null;
            if (navigator.geolocation) {
                location = await new Promise((resolve) => {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                        () => resolve(null)
                    );
                });
            }

            onAddFoto({
                url: file_url,
                latitude: location?.lat,
                longitude: location?.lng,
                data_hora: new Date().toISOString()
            });
        } catch (err) {
            alert('Erro ao fazer upload da foto');
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const faltam = Math.max(0, minFotos - fotos.length);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h4 className="font-medium">{titulo}</h4>
                    <p className="text-xs text-gray-500">
                        {fotos.length}/{minFotos} fotos {faltam > 0 && (
                            <span className="text-red-500">(faltam {faltam})</span>
                        )}
                    </p>
                </div>
                <div className="flex gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
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
                            <img 
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
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1">
                                <Input
                                    placeholder="Legenda..."
                                    value={foto.legenda || ''}
                                    onChange={(e) => onUpdateLegenda(index, e.target.value)}
                                    className="h-6 text-xs bg-transparent border-none text-white placeholder:text-gray-300"
                                />
                            </div>
                            {foto.latitude && (
                                <div className="absolute top-1 left-1 bg-green-500 text-white text-xs px-1 rounded flex items-center">
                                    <MapPin className="h-3 w-3" />
                                </div>
                            )}
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
                        <img 
                            src={selectedFoto.url} 
                            alt="Foto ampliada" 
                            className="max-w-full max-h-full object-contain"
                        />
                    </div>
                    <div className="p-4 text-white text-sm">
                        {selectedFoto.legenda && <p className="mb-2">{selectedFoto.legenda}</p>}
                        <div className="flex gap-4 text-xs opacity-70">
                            {selectedFoto.latitude && (
                                <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {selectedFoto.latitude.toFixed(6)}, {selectedFoto.longitude.toFixed(6)}
                                </span>
                            )}
                            {selectedFoto.data_hora && (
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {format(new Date(selectedFoto.data_hora), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}