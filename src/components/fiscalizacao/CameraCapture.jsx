import React, { useRef, useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Camera, X, Check, RotateCcw } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function CameraCapture({ onCapture, onCancel }) {
    const videoRef = useRef(null);
    const [capturedImage, setCapturedImage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [stream, setStream] = useState(null);
    const [error, setError] = useState(null);
    const [location, setLocation] = useState(null);

    useEffect(() => {
        startCamera();
        getLocation();
        return () => {
            stopCamera();
        };
    }, []);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });
            
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                setStream(mediaStream);
            }
        } catch (err) {
            console.error('Erro ao acessar câmera:', err);
            setError('Não foi possível acessar a câmera. Verifique as permissões.');
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    };

    const getLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setLocation({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    });
                },
                (err) => {
                    console.log('Localização não disponível:', err);
                }
            );
        }
    };

    const capturePhoto = () => {
        if (!videoRef.current) return;

        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage(imageData);
        stopCamera();
    };

    const retakePhoto = () => {
        setCapturedImage(null);
        startCamera();
    };

    const confirmPhoto = async () => {
        if (!capturedImage) return;
        
        setIsLoading(true);
        try {
            // Converter base64 para blob
            const response = await fetch(capturedImage);
            const blob = await response.blob();
            const file = new File([blob], `foto_${Date.now()}.jpg`, { type: 'image/jpeg' });
            
            // Upload
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            
            onCapture({
                url: file_url,
                latitude: location?.lat,
                longitude: location?.lng,
                data_hora: new Date().toISOString()
            });
        } catch (err) {
            console.error('Erro ao salvar foto:', err);
            alert('Erro ao salvar foto. Tente novamente.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        stopCamera();
        onCancel();
    };

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    {location && (
                        <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                            <span>📍</span>
                            <span>GPS</span>
                        </div>
                    )}
                </div>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleClose}
                    className="text-white hover:bg-white/20"
                >
                    <X className="h-6 w-6" />
                </Button>
            </div>

            {/* Camera View / Preview */}
            <div className="flex-1 relative bg-black">
                {error ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-8 text-center">
                        <Camera className="h-16 w-16 mb-4 opacity-50" />
                        <p className="mb-6">{error}</p>
                        <Button onClick={startCamera} variant="outline" className="text-white border-white">
                            Tentar Novamente
                        </Button>
                    </div>
                ) : capturedImage ? (
                    <img 
                        src={capturedImage} 
                        alt="Foto capturada" 
                        className="w-full h-full object-contain"
                    />
                ) : (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                    />
                )}
            </div>

            {/* Controls */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-8 pb-12">
                {capturedImage ? (
                    // Preview controls
                    <div className="flex justify-center items-center gap-4">
                        <Button 
                            size="lg"
                            variant="outline"
                            onClick={retakePhoto}
                            disabled={isLoading}
                            className="bg-white/10 border-white/30 text-white hover:bg-white/20 backdrop-blur"
                        >
                            <RotateCcw className="h-5 w-5 mr-2" />
                            Refazer
                        </Button>
                        <Button 
                            size="lg"
                            onClick={confirmPhoto}
                            disabled={isLoading}
                            className="bg-green-600 hover:bg-green-700 text-white min-w-[140px]"
                        >
                            {isLoading ? (
                                'Salvando...'
                            ) : (
                                <>
                                    <Check className="h-5 w-5 mr-2" />
                                    Confirmar
                                </>
                            )}
                        </Button>
                    </div>
                ) : (
                    // Capture button
                    <div className="flex flex-col items-center gap-4">
                        <Button
                            onClick={capturePhoto}
                            disabled={!stream || !!error}
                            className="w-20 h-20 rounded-full bg-white hover:bg-gray-200 disabled:bg-gray-600 disabled:opacity-50 shadow-2xl border-4 border-white/30 p-0 transition-all active:scale-95"
                        >
                            <div className="w-16 h-16 rounded-full bg-white border-4 border-gray-800" />
                        </Button>
                        <p className="text-white text-sm font-medium">
                            {!stream && !error ? 'Iniciando câmera...' : error ? 'Erro' : 'Toque para capturar'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}