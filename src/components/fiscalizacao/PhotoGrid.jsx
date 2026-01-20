import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Trash2, Clock, X, Image } from 'lucide-react';
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
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    const compressImage = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxWidth = 1920;
                    const maxHeight = 1080;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = Math.round((width * maxHeight) / height);
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                    }, 'image/jpeg', 0.75);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    };

    const handleFileSelect = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        setUploadProgress(0);

        try {
            const totalFiles = files.length;
            const uploadPromises = Array.from(files).map(async (file, index) => {
                const comprimida = await compressImage(file);
                
                // Converter File para ArrayBuffer para upload
                const arrayBuffer = await comprimida.arrayBuffer();
                const { file_url } = await base44.integrations.Core.UploadFile({ file: arrayBuffer });
                
                setUploadProgress((prev) => Math.round(((index + 1) / totalFiles) * 100));

                return {
                    url: file_url,
                    data_hora: new Date().toISOString()
                };
            });

            const fotosUpload = await Promise.all(uploadPromises);
            fotosUpload.forEach(foto => onAddFoto(foto));
        } catch (err) {
            console.error('Erro upload:', err);
            alert('Erro ao fazer upload das fotos: ' + err.message);
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
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
                        {isUploading ? `${uploadProgress}%` : 'Galeria'}
                    </Button>
                    <Button 
                        onClick={() => cameraInputRef.current?.click()} 
                        size="sm"
                        disabled={isUploading}
                    >
                        <Camera className="h-4 w-4 mr-2" />
                        {isUploading ? `${uploadProgress}%` : 'Câmera'}
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
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1">
                                <Input
                                    placeholder="Legenda..."
                                    value={foto.legenda || ''}
                                    onChange={(e) => onUpdateLegenda(index, e.target.value)}
                                    className="h-6 text-xs bg-transparent border-none text-white placeholder:text-gray-300"
                                />
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